import { NextRequest, NextResponse } from 'next/server';
import { buildLiveOverlayResponse, buildUnavailableOverlayResponse } from '@/lib/overlay-response';
import { normalizeSigmet, type SigmetData } from '@/lib/sigmet-normalize';
export type { SigmetData } from '@/lib/sigmet-normalize';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'all';
  const unavailableMessage = 'Live SIGMET/AIRMET data is unavailable right now. Cross-check with an official briefing source.';
  // Existing endpoint selection is retained; neither feed supplies G-AIRMETs.
  const coverageNotice = 'Coverage limitation: these feeds contain SIGMETs, not G-AIRMETs or Alaska AIRMETs. Cross-check with an official briefing source.';
  if (!['all', 'sigmet', 'airmet'].includes(type)) {
    return NextResponse.json({ error: 'Invalid SIGMET type' }, { status: 400 });
  }

  try {
    const sources: string[] = [];
    if (type === 'all' || type === 'sigmet') sources.push('isigmet');
    if (type === 'all' || type === 'airmet') sources.push('airsigmet');
    const results = await Promise.allSettled(sources.map(async (source) => {
      const response = await fetch(`https://aviationweather.gov/api/data/${source}?format=json`, {
        headers: { 'User-Agent': 'AvWeather/1.0' },
        next: { revalidate: 300 },
      });
      if (!response.ok) throw new Error(`SIGMET upstream returned ${response.status}`);
      // AWC documents 204 as valid no-data; it has no JSON body.
      if (response.status === 204) return [];
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Malformed SIGMET feed');
      return data;
    }));

    const items: SigmetData[] = [];
    let incomplete = false;
    results.forEach((result, sourceIndex) => {
      if (result.status === 'rejected') { incomplete = true; return; }
      result.value.forEach((item, itemIndex) => {
        const normalized = normalizeSigmet(item, `${sources[sourceIndex]}:${itemIndex}`);
        items.push(...normalized.items);
        incomplete ||= normalized.incomplete;
      });
    });

    if (incomplete) {
      const message = `SIGMET/AIRMET coverage is incomplete: one or more feeds or reports could not be displayed. Only valid available polygons are shown. ${coverageNotice}`;
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
