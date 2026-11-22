import { NextRequest, NextResponse } from 'next/server';
import { buildLiveOverlayResponse, buildUnavailableOverlayResponse } from '@/lib/overlay-response';
import { normalizeSigmet, type SigmetData } from '@/lib/sigmet-normalize';
import { normalizeAlaskaAirmet, normalizeGairmet } from '@/lib/airmet-normalize';
export type { SigmetData } from '@/lib/sigmet-normalize';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'all';
  const unavailableMessage = 'Live SIGMET/AIRMET data is unavailable right now. Cross-check with an official briefing source.';
  const coverageNotice = type === 'sigmet'
    ? 'SIGMET polygons only. Cross-check with an official briefing source.'
    : 'G-AIRMETs are CONUS forecast snapshots, not continuous validity; freezing-level lines are not drawn. Alaska AIRMETs show forecast zones and product periods, not precise hazard boundaries or local timing. Cross-check with an official briefing source.';
  if (!['all', 'sigmet', 'airmet'].includes(type)) {
    return NextResponse.json({ error: 'Invalid SIGMET type' }, { status: 400 });
  }

  try {
    const sources: string[] = [];
    if (type === 'all' || type === 'sigmet') sources.push('isigmet');
    // Retain legacy airsigmet selection for backwards compatibility.
    if (type === 'all' || type === 'airmet') sources.push('airsigmet');
    if (type === 'all' || type === 'airmet') sources.push('gairmet', 'airmet');
    const results = await Promise.allSettled(sources.map(async (source) => {
      const response = await fetch(`https://aviationweather.gov/api/data/${source}?format=${source === 'airmet' ? 'geojson' : 'json'}`, {
        headers: { 'User-Agent': 'AvWeather/1.0' },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`SIGMET upstream returned ${response.status}`);
      // AWC documents 204 as valid no-data; it has no JSON body.
      if (response.status === 204) return [];
      const data: unknown = await response.json();
      if (source === 'airmet') {
        if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'FeatureCollection' ||
          !('features' in data) || !Array.isArray(data.features)) throw new Error('Malformed Alaska AIRMET feed');
        return data.features;
      }
      if (!Array.isArray(data)) throw new Error('Malformed SIGMET feed');
      return data;
    }));

    const items: SigmetData[] = [];
    let incomplete = false;
    const incompleteSources: string[] = [];
    results.forEach((result, sourceIndex) => {
      const source = sources[sourceIndex];
      if (result.status === 'rejected') { incomplete = true; incompleteSources.push(source); return; }
      result.value.forEach((item, itemIndex) => {
        const normalize = source === 'gairmet' ? normalizeGairmet : source === 'airmet' ? normalizeAlaskaAirmet : normalizeSigmet;
        const normalized = normalize(item, `${source}:${itemIndex}`);
        items.push(...normalized.items);
        incomplete ||= normalized.incomplete;
        if (normalized.incomplete && !incompleteSources.includes(source)) incompleteSources.push(source);
      });
    });

    if (incomplete) {
      const message = `SIGMET/AIRMET coverage is incomplete (${incompleteSources.join(', ')}): one or more feeds or reports could not be displayed. Only valid available polygons are shown. ${coverageNotice}`;
      // Preserve the two-state envelope: unavailable means coverage is not complete,
      // even when a valid subset can still be rendered alongside the warning.
      return NextResponse.json({ ...buildUnavailableOverlayResponse<SigmetData>(message), items }, { status: 503 });
    }
    return NextResponse.json({ ...buildLiveOverlayResponse(items), message: coverageNotice });
  } catch (error) {
    console.error('SIGMET fetch error:', error);
    return NextResponse.json(buildUnavailableOverlayResponse<SigmetData>(unavailableMessage), { status: 503 });
  }
}
