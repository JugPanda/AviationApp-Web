import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import AirportInfo from '@/components/AirportInfo';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const HOUR = 3_600_000;
const key = 'avweather-briefing-KAAA';
const details = { airport: { ident: 'KAAA', name: 'Test Airport', municipality: 'Test Town', iso_region: 'US-CA' }, runways: [], frequencies: [] };
// The TAF route forwards AWC validTimeFrom/To unchanged: epoch seconds,
// despite the old route's string annotations. Exercise that real wire shape.
const taf = (overrides = {}) => ({ icaoId: 'KAAA', rawTaf: 'KAAA TEST FORECAST', issueTime: '2026-11-22T11:00:00Z', validFrom: (NOW - HOUR) / 1000, validTo: (NOW + HOUR) / 1000, forecasts: [], ...overrides });
const response = (data: unknown, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => data });
let container: HTMLDivElement;
let root: Root;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  fetchSpy = vi.fn(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response([taf()]));
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const text = () => container.textContent ?? '';
const saved = () => JSON.parse(localStorage.getItem(key)!);
const tafCalls = () => fetchSpy.mock.calls.filter(([url]) => String(url).startsWith('/api/taf?'));
async function render(icaoId = 'KAAA') {
  await act(async () => root.render(createElement(AirportInfo, { airport: { icaoId, lat: 0, lon: 0 }, onClose: vi.fn() })));
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(button => button.textContent === label);
  expect(button, `button ${label}`).toBeDefined();
  await act(async () => button!.click());
}
function seed(payload: object) { localStorage.setItem(key, JSON.stringify(payload)); }

describe('independent airport briefing product freshness', () => {
  it.each([undefined, 'garbage', (NOW + 2 * HOUR) / 1000])('rejects invalid forecast start %s without replacing the previous report', async validFrom => {
    const old = taf({ rawTaf: 'PRESERVED FORECAST' });
    seed({ taf: old, tafRetrievedAt: NOW - HOUR });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response([taf({ validFrom })]));
    await render(); await click('Forecast');
    expect(text()).toContain('TAF refresh unavailable');
    expect(saved().taf).toEqual(old);
    expect(saved().tafRetrievedAt).toBe(NOW - HOUR);
  });
  it.each([undefined, 'garbage', (NOW + 2 * HOUR) / 1000])('revalidates recently retrieved cache with invalid start %s', async validFrom => {
    seed({ taf: taf({ validFrom }), tafRetrievedAt: NOW });
    await render(); await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
  });
  it('revalidates a 48-hour-old forecast on selection without metadata renewing its age', async () => {
    const old = taf({ rawTaf: 'OLD FORECAST', validTo: (NOW - 47 * HOUR) / 1000 });
    seed({ details, taf: old, tafRetrievedAt: NOW - 48 * HOUR, detailsRetrievedAt: NOW - 48 * HOUR, notamsRetrievedAt: NOW - HOUR });
    await render();
    expect(saved().detailsRetrievedAt).toBe(NOW);
    expect(saved().tafRetrievedAt).toBe(NOW - 48 * HOUR);
    expect(saved().notamsRetrievedAt).toBe(NOW - HOUR);
    expect(saved().taf).toEqual(old);
    await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
    expect(text()).toContain('KAAA TEST FORECAST');
    expect(saved().tafRetrievedAt).toBe(NOW);
    expect(saved().notamsRetrievedAt).toBe(NOW - HOUR);
  });

  it('preserves legacy data but does not infer TAF freshness from shared cachedAt', async () => {
    seed({ details, taf: taf(), cachedAt: NOW });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response({ error: 'offline' }, false));
    await render();
    expect(saved().tafRetrievedAt).toBeUndefined();
    await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
    expect(text()).toContain('KAAA TEST FORECAST');
    expect(text()).toContain('TAF freshness unknown');
    expect(text()).toContain('TAF refresh unavailable');
    expect(text()).not.toContain('No TAF issued');
    expect(saved().tafRetrievedAt).toBeUndefined();
  });

  it('retains a stale forecast after failure, labels it, and retries only on explicit action', async () => {
    seed({ taf: taf(), tafRetrievedAt: NOW - HOUR });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response({ error: 'offline' }, false));
    await render();
    await click('Forecast');
    expect(text()).toContain('Stale TAF');
    expect(text()).toContain('TAF refresh unavailable');
    expect(text()).toContain('KAAA TEST FORECAST');
    expect(saved().tafRetrievedAt).toBe(NOW - HOUR);
    await render();
    expect(tafCalls()).toHaveLength(1);
    fetchSpy.mockImplementation(async () => response([taf({ rawTaf: 'RETRIED FORECAST' })]));
    await click('Retry TAF');
    expect(tafCalls()).toHaveLength(2);
    expect(text()).toContain('RETRIED FORECAST');
    expect(text()).not.toContain('TAF refresh unavailable');
  });

  it.each([
    (NOW - 1) / 1000,
    NOW - 1,
    String((NOW - 1) / 1000),
    new Date(NOW - 1).toISOString(),
  ])('refreshes expired provider validity %s even if just retrieved', async validTo => {
    seed({ taf: taf({ validTo }), tafRetrievedAt: NOW });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response({}, false));
    await render();
    await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
    expect(text()).toContain('Expired TAF');
    expect(text()).not.toContain('Invalid Date');
  });

  it('reuses fresh valid forecasts and revalidates when selected after they become stale', async () => {
    seed({ taf: taf({ validTo: (NOW + 12 * HOUR) / 1000 }), tafRetrievedAt: NOW });
    await render();
    await click('Forecast');
    expect(tafCalls()).toHaveLength(0);
    expect(text()).toContain('TAF retrieved:');
    expect(text()).toContain('UTC');
    await click('Airport');
    vi.mocked(Date.now).mockReturnValue(NOW + HOUR);
    await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
  });

  it('expires an open forecast as the clock advances without starting a retry loop', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    seed({ taf: taf({ validTo: (NOW + 60_000) / 1000 }), tafRetrievedAt: NOW });
    await render();
    await click('Forecast');
    expect(text()).not.toContain('Expired TAF');
    vi.mocked(Date.now).mockReturnValue(NOW + 120_000);
    await act(async () => vi.advanceTimersByTime(120_000));
    expect(text()).toContain('Expired TAF');
    expect(tafCalls()).toHaveLength(0);
    fetchSpy.mockImplementation(async () => response([taf({ validTo: (NOW - HOUR) / 1000 })]));
    await click('Refresh TAF');
    await act(async () => vi.advanceTimersByTime(600_000));
    expect(text()).toContain('Expired TAF');
    expect(tafCalls()).toHaveLength(1);
  });

  it('leaves failed refreshes idle through clock updates', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    seed({ taf: taf(), tafRetrievedAt: NOW - HOUR });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response({}, false));
    await render();
    await click('Forecast');
    await act(async () => vi.advanceTimersByTime(600_000));
    expect(tafCalls()).toHaveLength(1);
    expect(text()).toContain('TAF refresh unavailable');
  });

  it('does not let a late request overwrite another airport or its saved data', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    seed({ taf: taf(), cachedAt: NOW });
    const oldSaved = localStorage.getItem(key);
    localStorage.setItem('avweather-briefing-KBBB', JSON.stringify({ taf: taf({ icaoId: 'KBBB', rawTaf: 'SECOND AIRPORT' }), tafRetrievedAt: NOW }));
    fetchSpy.mockImplementation((url: string) => url.startsWith('/api/airport/') ? new Promise(() => {}) : new Promise(resolve => { resolveOld = resolve; }));
    await render();
    await click('Forecast');
    await render('KBBB');
    expect(text()).toContain('SECOND AIRPORT');
    await act(async () => resolveOld(response([taf({ rawTaf: 'LATE FIRST AIRPORT' })])));
    expect(text()).not.toContain('LATE FIRST AIRPORT');
    expect(text()).toContain('SECOND AIRPORT');
    expect(localStorage.getItem(key)).toBe(oldSaved);
    expect(tafCalls()).toHaveLength(1);
  });

  it('preserves fresh reuse after retry and clears loading when leaving an unfinished manual refresh', async () => {
    seed({ taf: taf(), tafRetrievedAt: NOW });
    await render();
    await click('Forecast');
    await click('Refresh TAF');
    expect(tafCalls()).toHaveLength(1);
    await click('Airport');
    await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
    fetchSpy.mockImplementation(() => new Promise(() => {}));
    await click('Refresh TAF');
    expect(text()).toContain('Refreshing TAF');
    await click('Airport');
    await click('Forecast');
    expect(text()).not.toContain('Refreshing TAF');
    expect(tafCalls()).toHaveLength(2);
  });

  it.each(['array', '204'])('distinguishes successful empty %s from failure and caches its own check time', async result => {
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : result === '204' ? response(null, true, 204) : response([]));
    await render();
    await click('Forecast');
    expect(text()).toContain('No TAF issued');
    expect(text()).not.toContain('TAF unavailable');
    expect(saved().taf).toBeNull();
    expect(saved().tafRetrievedAt).toBe(NOW);
    await click('Airport');
    await click('Forecast');
    expect(tafCalls()).toHaveLength(1);
  });

  it.each([
    response({ error: 'No TAF data found' }, false, 404),
    response({ error: 'Provider unavailable' }, false),
    response({ error: 'Unexpected object' }),
    response([{ icaoId: 'KBBB', forecasts: [] }]),
  ])('does not present an error or malformed payload as successful empty', async result => {
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : result);
    await render();
    await click('Forecast');
    expect(text()).toContain('TAF unavailable');
    expect(text()).not.toContain('No TAF issued');
    expect(saved().tafRetrievedAt).toBeUndefined();
    expect(tafCalls()).toHaveLength(1);
  });

  it('keeps retrieval usable when storage reads and writes throw, without claiming persistence', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await render();
    await click('Forecast');
    expect(text()).toContain('KAAA TEST FORECAST');
    expect(text()).toContain('not saved for offline use');
    expect(text()).not.toContain('TAF unavailable');
    expect(text()).not.toContain('Could not load airport details');
  });

  it('does not renew NOTAM retrieval or erase reports on unavailable responses', async () => {
    const notams = [{ id: 'old', icaoId: 'KAAA', type: 'Other', text: 'SAVED NOTICE', isActive: true, severity: 'low' }];
    seed({ notams, notamsRetrievedAt: NOW - HOUR, taf: taf(), tafRetrievedAt: NOW - HOUR });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response({ notams: [], unavailable: true, message: 'Official source unavailable' }, false));
    await render();
    await click('NOTAMs');
    expect(text()).toContain('SAVED NOTICE');
    expect(text()).toContain('Official source unavailable');
    expect(text()).not.toContain('No NOTAMs found');
    expect(saved().notamsRetrievedAt).toBe(NOW - HOUR);
    expect(saved().tafRetrievedAt).toBe(NOW - HOUR);
    expect(saved().notams).toEqual(notams);
  });

  it('records successful empty NOTAM retrieval independently of TAF', async () => {
    seed({ taf: taf(), tafRetrievedAt: NOW - HOUR });
    fetchSpy.mockImplementation(async (url: string) => url.startsWith('/api/airport/') ? response(details) : response({ notams: [] }));
    await render();
    await click('NOTAMs');
    expect(text()).toContain('No NOTAMs found');
    expect(saved().notamsRetrievedAt).toBe(NOW);
    expect(saved().tafRetrievedAt).toBe(NOW - HOUR);
  });
});
