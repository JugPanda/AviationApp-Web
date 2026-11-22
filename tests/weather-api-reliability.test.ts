import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextRequest } from 'next/server';
import { GET as getNotams } from '@/app/api/notam/[icao]/route';
import { GET as getMetars } from '@/app/api/metar/route';
import { GET as getTafs } from '@/app/api/taf/route';
import { GET as getPireps } from '@/app/api/pirep/route';
import { GET as getSigmets } from '@/app/api/sigmet/route';
import SigmetLayer from '@/components/SigmetLayer';

const map = {};
vi.mock('react-leaflet', () => ({
  useMap: () => map,
  Polygon: ({ positions, children }: { positions: unknown; children: ReactNode }) =>
    createElement('div', { 'data-polygon': JSON.stringify(positions) }, children),
  Popup: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/MapLayerNotice', () => ({
  default: ({ message }: { message: string | null }) => message ? createElement('div', { role: 'status' }, message) : null,
}));

const req = (path: string) => new NextRequest(`http://localhost/api/${path}`);
const notams = () => getNotams(req('notam/KJFK'), { params: Promise.resolve({ icao: 'KJFK' }) });
const respond = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });
const upstream = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => respond(body, status)));

// Provider-shaped fixture: AWC /api/data/airsigmet?format=json bounded GET,
// 2026-11-22. Epoch seconds + {lon,lat}; raw text shortened for this test.
// Contract: https://aviationweather.gov/data/schema/openapi.yaml (AirSigmetJSON).
const domestic = {
  icaoId: 'KKCI', seriesId: '15C', airSigmetType: 'SIGMET', hazard: 'CONVECTIVE',
  validTimeFrom: 1795326900, validTimeTo: 1795334100,
  altitudeLow1: 0, altitudeHi1: 40000, severity: 5,
  rawAirSigmet: 'CONVECTIVE SIGMET 15C VALID UNTIL 0755Z',
  coords: [{ lon: -100.2, lat: 37.298 }, { lon: -98.328, lat: 37.115 }, { lon: -98.515, lat: 34.144 }, { lon: -100.467, lat: 34.432 }, { lon: -100.2, lat: 37.298 }],
};
// ISigmetJSON schema describes AREA; live RURD sample also has AREAS (separate rings).
const international = {
  icaoId: 'RURD', firId: 'URRV', seriesId: '3', hazard: 'TS', geom: 'AREAS',
  validTimeFrom: domestic.validTimeFrom, validTimeTo: domestic.validTimeTo,
  base: 0, top: 31000, rawSigmet: 'Synthetic multi-area contract fixture',
  coords: [domestic.coords, [{ lon: 45.633, lat: 42.208 }, { lon: 45.63, lat: 42.2 }, { lon: 45.633, lat: 42.199 }, { lon: 45.633, lat: 42.208 }]],
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-22T06:00:00Z'));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('weather no-data versus failure contracts', () => {
  it('discloses absent AIRMET coverage even for successful empty SIGMET feeds', async () => {
    upstream(null, 204);
    const response = await getSigmets(req('sigmet?type=all'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [], status: 'live', message: expect.stringContaining('not G-AIRMETs or Alaska AIRMETs') });
  });
  it.each([
    ['METAR', () => getMetars(req('metar?ids=KJFK')), []],
    ['TAF', () => getTafs(req('taf?ids=KJFK')), []],
    ['PIREP', () => getPireps(req('pirep')), { items: [], status: 'live' }],
    ['SIGMET', () => getSigmets(req('sigmet?type=all')), { items: [], status: 'live' }],
    ['NOTAM', notams, { notams: [] }],
  ] as const)('%s treats upstream 204 as successful no-data without JSON parsing', async (_name, handler, expected) => {
    const json = vi.fn().mockRejectedValue(new Error('204 has no body'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json }));
    const response = await handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject(expected);
    expect(json).not.toHaveBeenCalled();
  });

  it('never treats a NOTAM upstream 404 as no NOTAMs', async () => {
    upstream(null, 404);
    const response = await notams();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ notams: [], unavailable: true, message: expect.stringContaining('official briefing source') });
  });

  it.each([
    ['METAR', () => getMetars(req('metar?ids=KJFK'))],
    ['TAF', () => getTafs(req('taf?ids=KJFK'))],
    ['NOTAM', notams],
  ] as const)('%s rejects malformed successful payloads rather than returning no-data', async (_name, handler) => {
    upstream({ error: 'upstream changed contract' });
    expect((await handler()).status).toBeGreaterThanOrEqual(500);
  });

  it('TAF successful empty array has the same no-data contract as 204', async () => {
    upstream([]);
    const response = await getTafs(req('taf?ids=KJFK'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe('SIGMET provider normalization and incomplete coverage', () => {
  it('normalizes epoch seconds, object points, raw text and zero altitude', async () => {
    upstream([domestic]);
    const response = await getSigmets(req('sigmet?type=airmet'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('live');
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ validFrom: '2026-11-22T05:55:00.000Z', validTo: '2026-11-22T07:55:00.000Z', isActive: true, altitudeLow: 0, altitudeHigh: 40000, rawText: domestic.rawAirSigmet, coords: domestic.coords.map(p => ({ lat: p.lat, lng: p.lon })) });
  });

  it('keeps nested areas separate, with distinct stable IDs and international fields', async () => {
    upstream([international]);
    const data = await (await getSigmets(req('sigmet?type=sigmet'))).json();
    const again = await (await getSigmets(req('sigmet?type=sigmet'))).json();
    expect(data.items).toHaveLength(2);
    expect(new Set(data.items.map((p: { id: string }) => p.id)).size).toBe(2);
    expect(data.items.map((p: { id: string }) => p.id)).toEqual(again.items.map((p: { id: string }) => p.id));
    expect(data.items[1]).toMatchObject({ altitudeLow: 0, altitudeHigh: 31000, rawText: international.rawSigmet, coords: international.coords[1].map(p => ({ lat: p.lat, lng: p.lon })) });
  });

  it('normalizes AWC dateline-split AREAS longitudes as whole rings', async () => {
    // Actual NZKL series 5 second ring, bounded AWC GET 2026-11-22.
    const eastOfDateline = [{ lon: 180, lat: -28.567 }, { lon: 180, lat: -29.81 }, { lon: 184.167, lat: -31 }, { lon: 188.5, lat: -30.833 }, { lon: 180, lat: -28.567 }];
    upstream([{ ...international, coords: [domestic.coords, eastOfDateline] }]);
    const response = await getSigmets(req('sigmet?type=sigmet'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[1].coords[0]).toEqual({ lat: -28.567, lng: -180 });
    expect(body.items[1].coords[3]).toEqual({ lat: -30.833, lng: -171.5 });
  });

  it('accepts numeric lon/lat pairs without swapping axes', async () => {
    upstream([{ ...domestic, coords: domestic.coords.map(p => [p.lon, p.lat]) }]);
    const data = await (await getSigmets(req('sigmet?type=sigmet'))).json();
    expect(data.items[0].coords[0]).toEqual({ lat: 37.298, lng: -100.2 });
  });

  it.each([
    { coords: undefined }, { coords: [{ lon: -80, lat: 100 }, ...domestic.coords] },
    { coords: [{ lon: '-80', lat: 35 }, ...domestic.coords] },
    { coords: [domestic.coords[0], domestic.coords[0], domestic.coords[1]] },
    { coords: [[0, 0], [1, 1], [2, 2]] },
    { geom: 'LINE' }, { validTimeTo: undefined }, { validTimeFrom: 'bad-date' },
    { validTimeTo: domestic.validTimeFrom - 1 },
  ])('excludes malformed geometry/validity and warns while retaining valid reports: %j', async (invalid) => {
    upstream([domestic, { ...domestic, ...invalid }]);
    const response = await getSigmets(req('sigmet?type=sigmet'));
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data.status).toBe('unavailable');
    expect(data.message).toMatch(/incomplete|partial/i);
    expect(data.items).toHaveLength(1);
  });

  it('retains valid subareas but warns when another subarea is invalid', async () => {
    upstream([{ ...international, coords: [domestic.coords, [{ lon: 200, lat: 0 }]] }]);
    const response = await getSigmets(req('sigmet?type=sigmet'));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(body.items).toHaveLength(1);
  });

  it.each([{ payload: [] }, { payload: null }, { payload: { error: 'bad payload' } }])('distinguishes successful empty from malformed feeds: %j', async ({ payload }) => {
    upstream(payload);
    const response = await getSigmets(req('sigmet?type=all'));
    const body = await response.json();
    expect(response.status).toBe(Array.isArray(payload) ? 200 : 503);
    expect(body.status).toBe(Array.isArray(payload) ? 'live' : 'unavailable');
    expect(body.items).toEqual([]);
  });

  it('does not call a partial upstream success live', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/isigmet?') ? respond([domestic]) : respond(null, 502)));
    const response = await getSigmets(req('sigmet?type=all'));
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data).toMatchObject({ status: 'unavailable', message: expect.stringMatching(/incomplete|partial/i) });
    expect(data.items).toHaveLength(1);
  });

  it('treats a successful feed plus a 204 feed as complete retrieval', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/isigmet?') ? respond([domestic]) : respond(null, 204)));
    const response = await getSigmets(req('sigmet?type=all'));
    expect(response.status).toBe(200);
    expect((await response.json()).items).toHaveLength(1);
  });

  it('returns unavailable, not live empty, when every geometry is invalid', async () => {
    upstream([{ ...domestic, coords: [] }, null]);
    const response = await getSigmets(req('sigmet?type=sigmet'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ items: [], status: 'unavailable', message: expect.stringContaining('incomplete') });
  });

  it('does not invent a validity period or treat expired/future reports as active', async () => {
    upstream([
      { ...domestic, validTimeFrom: '2026-11-22T01:00:00Z', validTimeTo: '2026-11-22T02:00:00Z' },
      { ...domestic, validTimeFrom: '2026-11-22T07:00:00Z', validTimeTo: '2026-11-22T08:00:00Z' },
      { ...domestic, validTimeFrom: '2026-11-22T05:00:00Z', validTimeTo: '2026-11-22T06:00:00Z' },
    ]);
    const response = await getSigmets(req('sigmet?type=sigmet'));
    expect(response.status).toBe(200);
    expect((await response.json()).items.map((item: { isActive: boolean }) => item.isActive)).toEqual([false, false, false]);
  });

  it('rejects an unsupported type without contacting upstream', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await getSigmets(req('sigmet?type=unknown'))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('PIREP position validation', () => {
  it('never fabricates missing positions or exposes invalid ones as live', async () => {
    upstream([{ pirepId: 'valid', lat: 35, lon: -80, altFt: 5000 }, { pirepId: 'missing' }, { lat: 91, lon: 0 }, null]);
    const response = await getPireps(req('pirep'));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe('unavailable');
    expect(body.message).toMatch(/incomplete|partial/i);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ lat: 35, lon: -80 });
  });
});

describe('SIGMET layer boundary', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it('renders normalized polygons and an explicit partial warning together', async () => {
    upstream([domestic, { ...domestic, coords: null }]);
    const apiResponse = await getSigmets(req('sigmet?type=sigmet'));
    const body = await apiResponse.json();
    upstream(body, apiResponse.status);
    await act(async () => root.render(createElement(SigmetLayer, { visible: true })));
    expect(container.querySelectorAll('[data-polygon]')).toHaveLength(1);
    expect(JSON.parse(container.querySelector('[data-polygon]')!.getAttribute('data-polygon')!)[0]).toEqual([37.298, -100.2]);
    expect(container.querySelector('[role=status]')?.textContent).toMatch(/incomplete|partial/i);
  });

  it('renders provider-normalized geometry through real Leaflet SVG polygons', async () => {
    const leaflet = await import('leaflet');
    const { MapContainer, Polygon } = await vi.importActual<typeof import('react-leaflet')>('react-leaflet');
    // jsdom does not expose createSVGRect; enable Leaflet's real SVG renderer.
    const originalSvg = Object.getOwnPropertyDescriptor(leaflet.Browser, 'svg')!;
    Object.defineProperty(leaflet.Browser, 'svg', { ...originalSvg, value: true });
    try {
      upstream([international]);
      const body = await (await getSigmets(req('sigmet?type=sigmet'))).json();
      await act(async () => root.render(createElement('div', null,
        body.items.map((item: { id: string; coords: { lat: number; lng: number }[] }) => createElement(MapContainer, {
          key: item.id, center: [item.coords[0].lat, item.coords[0].lng], zoom: 10, style: { width: 800, height: 600 },
        }, createElement(Polygon, {
          noClip: true, positions: item.coords.map(p => [p.lat, p.lng] as [number, number]),
        }))))));
      const paths = Array.from(container.querySelectorAll('.leaflet-overlay-pane svg path'));
      expect(paths).toHaveLength(2);
      for (const path of paths) {
        expect(path.getAttribute('d')).toMatch(/^M/);
        expect(path.getAttribute('d')).toMatch(/L.*z$/);
        expect(path.getAttribute('d')).not.toMatch(/NaN|undefined/);
      }
    } finally {
      await act(async () => root.unmount());
      root = createRoot(container);
      Object.defineProperty(leaflet.Browser, 'svg', originalSvg);
    }
  });

  it('defends against malformed client payloads without hiding a valid subset', async () => {
    const good = { id: 'ok', type: 'SIGMET', subType: 'TS', hazard: 'TS', rawText: '', validFrom: '2026-11-22T05:55:00Z', validTo: '2026-11-22T07:55:00Z', isActive: true, coords: domestic.coords.map(p => ({ lat: p.lat, lng: p.lon })) };
    upstream({ status: 'live', updatedAt: '2026-11-22T06:00:00Z', items: [null, good, { ...good, id: 'bad', coords: [{ lat: {}, lng: -80 }, ...good.coords] }] });
    await act(async () => root.render(createElement(SigmetLayer, { visible: true })));
    expect(container.querySelectorAll('[data-polygon]')).toHaveLength(1);
    expect(container.querySelector('[role=status]')?.textContent).toMatch(/incomplete|invalid/i);
  });
});
