import { NextRequest, NextResponse } from 'next/server';

// OurAirports data URLs
const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
const FREQUENCIES_URL = 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';

// One bounded process-local snapshot; cold starts fetch again.
interface AirportSnapshot {
  airports: Map<string, AirportData>;
  runways: Map<string, RunwayData[]>;
  frequencies: Map<string, FrequencyData[]>;
  fetchedAt: number;
}
let cache: AirportSnapshot | null = null;
let inFlight: Promise<AirportSnapshot> | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface AirportData {
  ident: string;
  type: string;
  name: string;
  elevation_ft: number | null;
  continent: string;
  iso_country: string;
  iso_region: string;
  municipality: string;
  scheduled_service: string;
  gps_code: string;
  iata_code: string;
  local_code: string;
  home_link: string;
  wikipedia_link: string;
}

interface RunwayData {
  le_ident: string;
  he_ident: string;
  length_ft: number | null;
  width_ft: number | null;
  surface: string;
  lighted: boolean;
  closed: boolean;
  le_heading_degT: number | null;
  he_heading_degT: number | null;
  le_elevation_ft: number | null;
  he_elevation_ft: number | null;
}

interface FrequencyData {
  type: string;
  description: string;
  frequency_mhz: string;
}

async function parseCSV(url: string, columns: string[]): Promise<string[][]> {
  // These CSVs exceed Next's Data Cache item limit; cache only parsed snapshots.
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`OurAirports retrieval failed: ${res.status}`);
  const text = await res.text();
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(current.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      current = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      current += char;
    }
  }
  if (inQuotes) throw new Error('Unterminated OurAirports CSV field');
  row.push(current.trim());
  if (row.some(value => value !== '')) rows.push(row);

  const headers = rows.shift();
  if (!headers || new Set(headers).size !== headers.length || rows.length === 0) {
    throw new Error('Empty or invalid OurAirports CSV');
  }
  const indices = columns.map(column => headers.indexOf(column));
  if (indices.some(index => index < 0) || rows.some(values => values.length !== headers.length)) {
    throw new Error('Unexpected OurAirports CSV schema');
  }
  // Project only required fields by name, allowing additive upstream columns.
  return rows.map(values => indices.map(index => values[index]));
}

async function loadData(): Promise<AirportSnapshot> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) return cache;
  if (!inFlight) {
    inFlight = refreshData().then(snapshot => {
      cache = snapshot; // Publish all three maps together, only after success.
      return snapshot;
    }).finally(() => {
      inFlight = null; // Failures remain retryable; never renew stale data.
    });
  }
  return inFlight;
}

async function refreshData(): Promise<AirportSnapshot> {

  console.log('Loading OurAirports data...');
  
  // Settle every retrieval before releasing the shared load, including failures.
  const results = await Promise.allSettled([
    parseCSV(AIRPORTS_URL, ['id', 'ident', 'type', 'name', 'latitude_deg', 'longitude_deg', 'elevation_ft', 'continent', 'iso_country', 'iso_region', 'municipality', 'scheduled_service', 'gps_code', 'iata_code', 'local_code', 'home_link', 'wikipedia_link']),
    parseCSV(RUNWAYS_URL, ['id', 'airport_ref', 'airport_ident', 'length_ft', 'width_ft', 'surface', 'lighted', 'closed', 'le_ident', 'le_heading_degT', 'le_elevation_ft', 'le_latitude_deg', 'le_longitude_deg', 'le_displaced_threshold_ft', 'he_ident', 'he_heading_degT', 'he_elevation_ft']),
    parseCSV(FREQUENCIES_URL, ['id', 'airport_ref', 'airport_ident', 'type', 'description', 'frequency_mhz']),
  ]);
  const [airportsData, runwaysData, frequenciesData] = results.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });

  // Parse airports
  const airportsCache = new Map<string, AirportData>();
  for (let i = 0; i < airportsData.length; i++) {
    const row = airportsData[i];
    const ident = row[1]; // ident column
    if (!ident) throw new Error('Missing airport identifier');
    
    airportsCache.set(ident.toUpperCase(), {
      ident: row[1],
      type: row[2],
      name: row[3],
      elevation_ft: row[6] ? parseInt(row[6]) : null,
      continent: row[7],
      iso_country: row[8],
      iso_region: row[9],
      municipality: row[10],
      scheduled_service: row[11],
      gps_code: row[12],
      iata_code: row[13],
      local_code: row[14],
      home_link: row[15],
      wikipedia_link: row[16],
    });
  }

  // Parse runways
  const runwaysCache = new Map<string, RunwayData[]>();
  for (let i = 0; i < runwaysData.length; i++) {
    const row = runwaysData[i];
    const airportIdent = row[2]; // airport_ident column
    if (!airportIdent) throw new Error('Missing runway airport identifier');
    
    const runway: RunwayData = {
      le_ident: row[8],
      he_ident: row[14],
      length_ft: row[3] ? parseInt(row[3]) : null,
      width_ft: row[4] ? parseInt(row[4]) : null,
      surface: row[5],
      lighted: row[6] === '1',
      closed: row[7] === '1',
      le_heading_degT: row[9] ? parseFloat(row[9]) : null,
      he_heading_degT: row[15] ? parseFloat(row[15]) : null,
      le_elevation_ft: row[10] ? parseInt(row[10]) : null,
      he_elevation_ft: row[16] ? parseInt(row[16]) : null,
    };
    
    const key = airportIdent.toUpperCase();
    if (!runwaysCache.has(key)) {
      runwaysCache.set(key, []);
    }
    runwaysCache.get(key)!.push(runway);
  }

  // Parse frequencies
  const frequenciesCache = new Map<string, FrequencyData[]>();
  for (let i = 0; i < frequenciesData.length; i++) {
    const row = frequenciesData[i];
    const airportIdent = row[2]; // airport_ident column
    if (!airportIdent) throw new Error('Missing frequency airport identifier');
    
    const freq: FrequencyData = {
      type: row[3],
      description: row[4],
      frequency_mhz: row[5],
    };
    
    const key = airportIdent.toUpperCase();
    if (!frequenciesCache.has(key)) {
      frequenciesCache.set(key, []);
    }
    frequenciesCache.get(key)!.push(freq);
  }

  return { airports: airportsCache, runways: runwaysCache, frequencies: frequenciesCache, fetchedAt: Date.now() };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  try {
    const { icao } = await params;
    const icaoUpper = icao.toUpperCase();
    
    const snapshot = await loadData();

    const airport = snapshot.airports.get(icaoUpper);
    const runways = snapshot.runways.get(icaoUpper) || [];
    const frequencies = snapshot.frequencies.get(icaoUpper) || [];

    if (!airport) {
      return NextResponse.json({ error: 'Airport not found' }, { status: 404 });
    }

    return NextResponse.json({
      airport,
      runways,
      frequencies,
    });
  } catch (error) {
    console.error('Airport data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch airport data' },
      { status: 500 }
    );
  }
}
