import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import DensityAltitude from '@/components/tools/DensityAltitude';
import WeightBalance from '@/components/tools/WeightBalance';
import AirportInfo from '@/components/AirportInfo';
import WeatherRadarLayer from '@/components/WeatherRadarLayer';

// A component-level network boundary test: Leaflet tile props are observed,
// not requested. No test contacts RainViewer or enables a deployment setting.
vi.mock('react-leaflet', () => ({
  TileLayer: ({ url }: { url: string }) => createElement('div', { 'data-radar-tile': url }),
}));

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function render(element: ReturnType<typeof createElement>) {
  root ??= createRoot(container);
  await act(async () => root?.render(element));
}

function buttonContaining(text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(text));
  if (!button) throw new Error(`Missing button: ${text}`);
  return button;
}

describe('density altitude preference preservation', () => {
  it.each([0, -200, 5432])('hydrates saved elevation %s and Fahrenheit without writing defaults', async fieldElevation => {
    const saved = JSON.stringify({ fieldElevation, tempUnit: 'F' });
    localStorage.setItem('density-alt-prefs', saved);
    localStorage.setItem('unrelated-pilot-work', 'keep');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const recoverableError = vi.fn();
    const element = createElement(StrictMode, null, createElement(DensityAltitude));
    container.innerHTML = renderToString(element);
    expect(container.textContent).toContain('Loading saved preferences');
    expect(write).not.toHaveBeenCalled();

    await act(async () => {
      root = hydrateRoot(container, element, { onRecoverableError: recoverableError });
    });
    expect(recoverableError).not.toHaveBeenCalled();
    expect(container.querySelector('input')?.value).toBe(String(fieldElevation));
    expect(buttonContaining('°F').className).toContain('bg-blue-600');
    expect(localStorage.getItem('density-alt-prefs')).toBe(saved);
    expect(write.mock.calls.every(([key, value]) => key === 'density-alt-prefs' && value === saved)).toBe(true);
    expect(localStorage.getItem('unrelated-pilot-work')).toBe('keep');

    await act(async () => buttonContaining('°C').click());
    expect(JSON.parse(localStorage.getItem('density-alt-prefs')!)).toEqual({ fieldElevation, tempUnit: 'C' });
  });

  it('keeps the form usable if storage is denied', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await render(createElement(DensityAltitude));
    expect(container.querySelector('input')?.value).toBe('0');
    await act(async () => buttonContaining('°F').click());
    expect(buttonContaining('°F').className).toContain('bg-blue-600');
  });
});

describe('licensed radar gate', () => {
  it.each([undefined, '', 'false', 'TRUE', '1'])('does not fetch or mount tiles for flag %s', async flag => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_LICENSED_RADAR', flag);
    vi.useFakeTimers();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await render(createElement(WeatherRadarLayer, { visible: true }));
    await act(async () => vi.advanceTimersByTime(600_000));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-radar-tile]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('licensing pending');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing when hidden even with explicit opt-in', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_LICENSED_RADAR', 'true');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await render(createElement(WeatherRadarLayer, { visible: false }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });

  it('retains frame selection, animation and refresh when opted in, and stops when hidden', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_LICENSED_RADAR', 'true');
    vi.useFakeTimers();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ radar: {
        past: [{ time: 1000, path: '/past-1' }, { time: 2000, path: '/past-2' }],
        nowcast: [{ time: 3000, path: '/forecast' }],
      } }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    await render(createElement(WeatherRadarLayer, { visible: true }));
    expect(fetchSpy).toHaveBeenCalledWith('https://api.rainviewer.com/public/weather-maps.json');
    const tileUrl = () => container.querySelector('[data-radar-tile]')?.getAttribute('data-radar-tile');
    expect(tileUrl()).toContain('/past-2/256/');
    await act(async () => buttonContaining('◀').click());
    expect(tileUrl()).toContain('/past-1/256/');
    await act(async () => buttonContaining('Play').click());
    await act(async () => vi.advanceTimersByTime(500));
    expect(tileUrl()).toContain('/past-2/256/');
    await act(async () => vi.advanceTimersByTime(500));
    expect(tileUrl()).toContain('/forecast/256/');
    await act(async () => buttonContaining('Stop').click());
    await act(async () => vi.advanceTimersByTime(300_000));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await render(createElement(WeatherRadarLayer, { visible: false }));
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('[data-radar-tile]')).toBeNull();
  });
});

describe('weight and balance source boundaries', () => {
  it('labels templates and limited results without changing saved loadouts or profile identifiers', async () => {
    const first = JSON.stringify({ fuel: 21, stations: [{ weight: 180 }, { weight: 100 }, { weight: 20 }, { weight: 0 }] });
    const second = JSON.stringify({ fuel: 52, stations: [{ weight: 170 }, { weight: 90 }, { weight: 10 }, { weight: 0 }] });
    const profiles = JSON.stringify([{ id: 'saved-flight', name: 'Existing work', aircraftType: 'C182T', fuelGallons: 52, stationWeights: [170, 90, 10, 0], createdAt: 1, updatedAt: 1 }]);
    localStorage.setItem('wb-C172S', first);
    localStorage.setItem('wb-C182T', second);
    localStorage.setItem('avweather-profiles', profiles);
    await render(createElement(WeightBalance));
    const warning = container.querySelector('aside')?.textContent;
    expect(warning).toContain('Illustrative templates — unverified');
    expect(warning).toContain('C182T is not T182T; C172S is not 172N');
    expect(warning).toContain('not an individual-aircraft weight and balance record');
    expect(container.textContent).toContain('Within selected weight/CG limits only — unverified');
    expect(container.querySelector('input[type="range"]')?.getAttribute('value')).toBe('21');
    const aircraftSelect = container.querySelectorAll('select')[1];
    expect(Array.from(aircraftSelect.options).map(option => option.value)).toEqual(['C172S', 'C182T', 'PA28-181']);
    await act(async () => {
      aircraftSelect.value = 'C182T';
      aircraftSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('input[type="range"]')?.getAttribute('value')).toBe('52');
    await act(async () => {
      aircraftSelect.value = 'C172S';
      aircraftSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(localStorage.getItem('wb-C172S')).toBe(first);
    expect(localStorage.getItem('wb-C182T')).toBe(second);
    expect(localStorage.getItem('avweather-profiles')).toBe(profiles);
  });
});

describe('airport briefing cache initialization', () => {
  it('keeps cache per airport, preserves the selected tab and does not overwrite cached work while fetching', async () => {
    const cached = (icaoId: string, municipality: string) => JSON.stringify({
      details: { airport: { ident: icaoId, name: icaoId, municipality, iso_region: 'US-CA' }, runways: [], frequencies: [] },
      taf: { icaoId, rawTaf: `${icaoId} CACHED TAF`, forecasts: [] },
      cachedAt: 1,
    });
    const first = cached('KAAA', 'First town');
    const second = cached('KBBB', 'Second town');
    localStorage.setItem('avweather-briefing-KAAA', first);
    localStorage.setItem('avweather-briefing-KBBB', second);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const airport = (icaoId: string) => ({ icaoId, lat: 0, lon: 0 });
    await render(createElement(AirportInfo, { airport: airport('KAAA'), onClose: vi.fn() }));
    expect(container.textContent).toContain('First town');
    await act(async () => buttonContaining('Forecast').click());
    expect(container.textContent).toContain('KAAA CACHED TAF');
    await render(createElement(AirportInfo, { airport: airport('KBBB'), onClose: vi.fn() }));
    expect(container.textContent).toContain('Second town');
    expect(container.textContent).toContain('KBBB CACHED TAF');
    expect(container.textContent).not.toContain('KAAA CACHED TAF');
    expect(localStorage.getItem('avweather-briefing-KAAA')).toBe(first);
    expect(localStorage.getItem('avweather-briefing-KBBB')).toBe(second);
  });
});
