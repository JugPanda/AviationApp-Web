import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/sigmet/route';
import SigmetLayer from '@/components/SigmetLayer';
import { normalizeGairmet, normalizeAlaskaAirmet } from '@/lib/airmet-normalize';
import { isRenderableSigmet } from '@/lib/sigmet-normalize';

const map = { getContainer: () => document.body.firstElementChild as HTMLElement };
vi.mock('react-leaflet', () => ({
  useMap: () => map,
  Polygon: ({ children }: { children: ReactNode }) => createElement('div', { 'data-polygon': true }, children),
  Popup: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/MapLayerNotice', () => ({
  default: ({ message }: { message: string }) => createElement('div', { role: 'status' }, message),
}));
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T07:00:00Z')));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

// Unmodified relevant fields and all vertices of bounded real AWC samples,
// 2026-11-22: /api/data/gairmet?format=json and /api/data/airmet?format=geojson.
export const observedGairmet = {
  tag: '1E', forecastHour: 3, validTime: '2026-11-22T06:00:00.000Z', hazard: 'IFR',
  geometryType: 'AREA', latlonpairs: 7, frequency: null, severity: null,
  due_to: 'CIG BLW 010 VIS BLW 3SM PCPN BR FG', status: 'AMD', top: null, base: null,
  fzltop: null, fzlbase: null, level: null, receiptTime: 1795322411,
  issueTime: 1795322340, expireTime: 1795338000, product: 'SIERRA', geom: 'AREA',
  coords: [{ lat: '48.25', lon: '-88.11' }, { lat: '47.29', lon: '-85.54' },
    { lat: '37.40', lon: '-95.70' }, { lat: '35.21', lon: '-98.83' },
    { lat: '35.13', lon: '-100.41' }, { lat: '38.35', lon: '-99.92' }, { lat: '48.25', lon: '-88.11' }],
};
export const observedAlaska = {
  type: 'Feature', properties: { region: 'AI', zone: 'Alaska Peninsula', receiptTime: '2026-11-22 05:45:12',
    validTimeFrom: '2026-11-22T05:45:00.000Z', validTimeTo: '2026-11-22T17:00:00.000Z',
    airmetType: 'AIRMET', hazard: 'TURB', base: 300, top: 400 },
  geometry: { type: 'Polygon', coordinates: [[[-157, 54.3], [-160, 53.5], [-164, 52.8], [-166, 55.8], [-162, 57], [-158.9, 56.83], [-158.5, 56.58], [-158.3, 56.17], [-157, 54.3]]] },
};
const now = Date.parse('2026-11-22T07:00:00Z');

describe('observed AWC advisory contracts', () => {
  it('rejects not-yet-issued packages but permits future forecast snapshots', () => {
    const future = { ...observedGairmet, issueTime: '2026-11-22T08:00:00Z' };
    expect(normalizeGairmet(future, 'future').incomplete).toBe(true);
    const good = normalizeGairmet(observedGairmet, 'issued').items[0];
    expect(isRenderableSigmet({ ...good, issuedAt: future.issueTime })).toBe(false);
    const forecast = normalizeGairmet({ ...observedGairmet, validTime: '2026-11-22T09:00:00Z' }, 'forecast');
    expect(forecast.incomplete).toBe(false);
    expect(isRenderableSigmet(forecast.items[0])).toBe(true);
  });
  it('rejects unsplit dateline rings at normalization and rendering boundaries', () => {
    const ring = [[179, 51], [-179, 51], [-179, 53], [179, 53], [179, 51]];
    expect(normalizeAlaskaAirmet({ ...observedAlaska, geometry: { type: 'Polygon', coordinates: [ring] } }, 'crossing', now)).toEqual({ items: [], incomplete: true });
    const good = normalizeAlaskaAirmet(observedAlaska, 'good', now).items[0];
    expect(isRenderableSigmet({ ...good, coords: ring.map(([lng, lat]) => ({ lng, lat })) })).toBe(false);
  });
  it('keeps snapshot time separate from issue/expiry, with no invented interval', () => {
    const result = normalizeGairmet(observedGairmet, 'g:0');
    expect(result.incomplete).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ product: 'G-AIRMET', timeKind: 'snapshot',
      validFrom: observedGairmet.validTime, validTo: observedGairmet.validTime,
      snapshotTime: observedGairmet.validTime, isActive: false,
      productExpiresAt: '2026-11-22T09:00:00.000Z',
      coords: observedGairmet.coords.map(p => ({ lat: Number(p.lat), lng: Number(p.lon) })) });
    expect(isRenderableSigmet(result.items[0])).toBe(true);
  });
  it('normalizes G-AIRMET hundreds of feet, preserving FZL and surface rather than inventing a base', () => {
    // Observed altitude fields from ICE tag 2C, with geometry borrowed above.
    const ice = normalizeGairmet({ ...observedGairmet, hazard: 'ICE', base: 'FZL', top: '200', fzlbase: '070', fzltop: '110' }, 'g').items[0];
    expect(ice.altitudeLow).toBeUndefined();
    expect(ice.altitudeHigh).toBe(20000);
    expect(ice.altitudeDescription).toContain('freezing level');
    const surface = normalizeGairmet({ ...observedGairmet, base: 'SFC', top: '160' }, 'g').items[0];
    expect(surface.altitudeLow).toBeUndefined();
    expect(surface.altitudeDescription).toContain('surface');
    expect(surface.altitudeHigh).toBe(16000);
  });
  it('never turns observed FZLVL LINE into a filled polygon despite geometryType AREA', () => {
    expect(normalizeGairmet({ ...observedGairmet, hazard: 'FZLVL', geom: 'LINE' }, 'g')).toEqual({ items: [], incomplete: true });
  });
  it.each([{ validTime: undefined }, { issueTime: undefined }, { expireTime: 1 },
    { base: '200', top: '150' }, { base: 'unknown' }, { geom: 'POINT' },
    { coords: [{ lat: '', lon: '-90' }, ...observedGairmet.coords] }, { status: 'UNKNOWN' },
    { coords: [{ lat: 'NaN', lon: '-90' }, ...observedGairmet.coords] }])('rejects malformed snapshot metadata/vertices: %j', change => {
    expect(normalizeGairmet({ ...observedGairmet, ...change }, 'g').incomplete).toBe(true);
  });
  it('preserves Alaska zone/product dates but does not guess ambiguous altitude units', () => {
    const result = normalizeAlaskaAirmet(observedAlaska, 'ak:0', now);
    expect(result.incomplete).toBe(false);
    expect(result.items[0]).toMatchObject({ product: 'Alaska AIRMET', timeKind: 'period',
      validFrom: observedAlaska.properties.validTimeFrom, validTo: observedAlaska.properties.validTimeTo,
      zone: 'Alaska Peninsula', isActive: true });
    expect(result.items[0].altitudeLow).toBeUndefined();
    expect(result.items[0].altitudeHigh).toBeUndefined();
    expect(result.items[0].altitudeDescription).toMatch(/unverified/);
    expect(isRenderableSigmet(result.items[0])).toBe(true);
  });
  it.each([
    { type: 'LineString', coordinates: observedAlaska.geometry.coordinates[0] },
    { type: 'Polygon', coordinates: [...observedAlaska.geometry.coordinates, observedAlaska.geometry.coordinates[0]] },
    { type: 'Polygon', coordinates: [[[-190.7, 52.1], [-178, 53.1], [-176, 50.4], [-190.7, 52.1]]] },
  ])('rejects unsupported Alaska geometry rather than inventing/silently filling it', geometry => {
    expect(normalizeAlaskaAirmet({ ...observedAlaska, geometry }, 'ak', now)).toEqual({ items: [], incomplete: true });
  });
  it('retains valid MultiPolygon siblings with incomplete coverage', () => {
    const result = normalizeAlaskaAirmet({ ...observedAlaska, geometry: { type: 'MultiPolygon', coordinates: [observedAlaska.geometry.coordinates, [[]]] } }, 'ak', now);
    expect(result.incomplete).toBe(true);
    expect(result.items).toHaveLength(1);
  });
  it('rejects forged snapshot metadata at the client boundary', () => {
    const good = normalizeGairmet(observedGairmet, 'g').items[0];
    expect(isRenderableSigmet({ ...good, validTo: '2026-11-22T09:00:00Z' })).toBe(false);
    expect(isRenderableSigmet({ ...good, productExpiresAt: undefined })).toBe(false);
    expect(isRenderableSigmet({ ...good, timeKind: 'invalid' })).toBe(false);
    expect(isRenderableSigmet({ ...good, issuedAt: 1795322340 })).toBe(false);
    expect(isRenderableSigmet({ ...good, product: { unexpected: true } })).toBe(false);
  });
});

const response = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });
const get = () => GET(new NextRequest('http://localhost/api/sigmet?type=all'));
const collection = { type: 'FeatureCollection', features: [observedAlaska] };

describe('AIRMET routes and product selection', () => {
  it('fetches documented feeds, retaining the old envelope and actual product dates', async () => {
    const fetch = vi.fn(async (url: string) => url.includes('/gairmet?') ? response([observedGairmet])
      : url.includes('/airmet?') ? response(collection) : response(null, 204));
    vi.stubGlobal('fetch', fetch);
    const result = await get();
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls.map(call => call[0])).toContain('https://aviationweather.gov/api/data/airmet?format=geojson');
    const body = await result.json();
    expect(body.status).toBe('live');
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { product: string }) => item.product)).toEqual(['G-AIRMET', 'Alaska AIRMET']);
    expect(body.items[0].validTo).toBe(observedGairmet.validTime);
  });
  it.each(['gairmet', 'airmet'])('keeps valid siblings and names failed %s feed', async failed => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes(`/${failed}?`) ? response(null, 502)
      : url.includes('/gairmet?') ? response([observedGairmet])
      : url.includes('/airmet?') ? response(collection) : response(null, 204)));
    const result = await get();
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ status: 'unavailable', items: [expect.any(Object)], message: expect.stringContaining(`(${failed})`) });
  });
  it('retains valid G-AIRMET siblings when an observed LINE cannot be drawn', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/gairmet?')
      ? response([observedGairmet, { ...observedGairmet, geom: 'LINE', hazard: 'FZLVL' }]) : response(null, 204)));
    const result = await get();
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ items: [expect.objectContaining({ product: 'G-AIRMET' })], message: expect.stringContaining('freezing-level lines are not drawn') });
  });
  it.each([{ type: 'FeatureCollection', features: [] }, null, [], { type: 'FeatureCollection', features: null }])('distinguishes Alaska empty FeatureCollection from malformed success: %j', async payload => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/airmet?') ? response(payload) : response(null, 204)));
    expect((await get()).status).toBe(payload && !Array.isArray(payload) && Array.isArray(payload.features) ? 200 : 503);
  });
  it('selects forecast snapshots separately, preserves warnings, and expires them on the clock', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const snapshot = normalizeGairmet(observedGairmet, 'g').items[0];
    const alaska = normalizeAlaskaAirmet(observedAlaska, 'ak', now).items[0];
    const sigmet = { ...alaska, id: 'synthetic-sigmet', type: 'SIGMET', product: undefined, zone: undefined };
    vi.stubGlobal('fetch', vi.fn(async () => response({ status: 'unavailable', items: [snapshot, alaska, sigmet],
      updatedAt: '2026-11-22T07:00:00Z', message: 'Coverage is incomplete (gairmet): freezing-level lines omitted.' }, 503)));
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(SigmetLayer, { visible: true })));
      expect(container.querySelectorAll('[data-polygon]')).toHaveLength(1);
      expect(container.querySelector('[data-polygon]')?.textContent).toContain('SIGMET');
      const select = document.querySelector('select')!;
      await act(async () => { select.value = snapshot.snapshotTime!; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(container.querySelectorAll('[data-polygon]')).toHaveLength(1);
      expect(container.querySelector('[data-polygon]')?.textContent).toContain('Forecast snapshot:');
      expect(container.querySelector('[data-polygon]')?.textContent).not.toContain('Until:');
      expect(document.body.textContent).toContain('Current SIGMET / Alaska layers hidden');
      expect(container.querySelector('[role=status]')?.textContent).toContain('incomplete');
      await act(async () => { select.value = 'alaska'; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(container.querySelector('[data-polygon]')?.textContent).toContain('Alaska Peninsula');
      expect(container.querySelector('[data-polygon]')?.textContent).toContain('Product from:');
      await act(async () => { select.value = snapshot.snapshotTime!; select.dispatchEvent(new Event('change', { bubbles: true })); });
      vi.mocked(Date.now).mockReturnValue(Date.parse('2026-11-22T09:00:00Z'));
      await act(async () => vi.advanceTimersByTime(30000));
      expect(select.value).toBe('current');
      expect(Array.from(select.options).some(option => option.value === snapshot.snapshotTime)).toBe(false);
      expect(document.body.textContent).toContain('No unexpired G-AIRMET snapshots available');
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
});
