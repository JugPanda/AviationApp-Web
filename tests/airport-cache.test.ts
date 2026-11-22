// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const airportsHeader = 'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords';
const runwayHeader = 'id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degT,le_displaced_threshold_ft,he_ident,he_latitude_deg,he_longitude_deg,he_elevation_ft,he_heading_degT,he_displaced_threshold_ft';
function fixtures(name = '"Test, ""Quoted"" Airport"') {
  return {
    'airports.csv': `${airportsHeader}\r\n1,KAAA,small_airport,${name},40,-75,100,NA,US,US-PA,Town,no,KAAA,AAA,KAAA,AAA,https://example.com,https://example.com/wiki,\r\n`,
    'runways.csv': `${runwayHeader}\n1,1,KAAA,4000,75,ASP,1,0,09,40,-75,101,90,0,27,40,-75,102,270,0\n`,
    'airport-frequencies.csv': 'id,airport_ref,airport_ident,type,description,frequency_mhz\n1,1,KAAA,CTAF,"Traffic, advisory",123.000\n',
  };
}
let data: ReturnType<typeof fixtures>;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let get: typeof import('@/app/api/airport/[icao]/route').GET;
const request = (icao = 'KAAA') => get(new NextRequest(`http://localhost/api/airport/${icao}`), { params: Promise.resolve({ icao }) });

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  data = fixtures();
  fetchMock = vi.fn<typeof fetch>(async input => new Response(data[String(input).split('/').pop() as keyof typeof data]));
  vi.stubGlobal('fetch', fetchMock);
  get = (await import('@/app/api/airport/[icao]/route')).GET;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('airport dataset cache', () => {
  it('coalesces concurrent reads, bypasses Next Data Cache and reuses the 24-hour snapshot', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => request()));
    expect(results.every(result => result.status === 200)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, options] of fetchMock.mock.calls) expect(options).toMatchObject({ cache: 'no-store' });
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1);
    expect((await request()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1);
    expect((await request()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('parses quoted commas, escaped quotes, CRLF and source fields by name', async () => {
    const body = await (await request('kaaa')).json();
    expect(body.airport).toMatchObject({ name: 'Test, "Quoted" Airport', gps_code: 'KAAA', local_code: 'AAA', home_link: 'https://example.com', wikipedia_link: 'https://example.com/wiki' });
    expect(body.runways[0]).toMatchObject({ le_heading_degT: 90, he_heading_degT: 270, le_elevation_ft: 101, he_elevation_ft: 102 });
    expect(body.frequencies[0]).toEqual({ type: 'CTAF', description: 'Traffic, advisory', frequency_mhz: '123.000' });
    expect((await request('NONE')).status).toBe(404);
  });

  it('retries non-OK retrievals instead of caching the error body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    expect((await request()).status).toBe(500);
    expect((await request()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it.each(['<html>upstream error</html>', `${airportsHeader}\n`, `${airportsHeader}\n1,KAAA,small_airport`])('rejects invalid/empty/truncated CSV and retries: %s', async invalid => {
    data['airports.csv'] = invalid;
    expect((await request()).status).toBe(500);
    data = fixtures();
    expect((await request()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('holds the shared failed load until every retrieval settles, then retries', async () => {
    let finishFrequency!: (response: Response) => void;
    let markStarted!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async input => {
      if (String(input).endsWith('/airports.csv')) return new Response('unavailable', { status: 503 });
      if (String(input).endsWith('/airport-frequencies.csv')) {
        markStarted();
        return new Promise<Response>(resolve => { finishFrequency = resolve; });
      }
      return normalFetch(input);
    });
    const first = request();
    await started;
    const second = request();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    finishFrequency(new Response(data['airport-frequencies.csv']));
    expect((await first).status).toBe(500);
    expect((await second).status).toBe(500);
    fetchMock.mockImplementation(normalFetch);
    expect((await request()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('does not commit a partial refresh or mark a failed refresh as fresh', async () => {
    expect((await request()).status).toBe(200);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    data = fixtures('Poisoned partial refresh');
    data['airport-frequencies.csv'] = '<html>bad gateway</html>';
    expect((await request()).status).toBe(500);
    // Inspect the still-fresh original snapshot by rewinding the test clock:
    // a failed refresh must not have published any newly parsed map.
    vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
    const preserved = await (await request()).json();
    expect(preserved.airport.name).toBe('Test, "Quoted" Airport');
    expect(preserved.frequencies).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    expect((await request()).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    data = fixtures('Recovered airport');
    const body = await (await request()).json();
    expect(body.airport.name).toBe('Recovered airport');
    expect(body.frequencies).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect((await (await request()).json()).airport.name).toBe('Recovered airport');
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });
});
