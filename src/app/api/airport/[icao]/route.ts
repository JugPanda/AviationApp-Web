import { NextRequest, NextResponse } from 'next/server';

// OurAirports data URLs
const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
const FREQUENCIES_URL = 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv';

// Cache for parsed data (in-memory, refreshes on cold start)
let airportsCache: Map<string, AirportData> | null = null;
let runwaysCache: Map<string, RunwayData[]> | null = null;
let frequenciesCache: Map<string, FrequencyData[]> | null = null;
let lastFetch = 0;
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

async function parseCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, { next: { revalidate: 86400 } });
  const text = await res.text();
  const lines = text.split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

async function loadData() {
  const now = Date.now();
  if (airportsCache && runwaysCache && frequenciesCache && (now - lastFetch) < CACHE_TTL) {
    return;
  }

  console.log('Loading OurAirports data...');
  
  const [airportsData, runwaysData, frequenciesData] = await Promise.all([
    parseCSV(AIRPORTS_URL),
    parseCSV(RUNWAYS_URL),
    parseCSV(FREQUENCIES_URL),
  ]);

  // Parse airports
  airportsCache = new Map();
  const airportHeaders = airportsData[0];
  for (let i = 1; i < airportsData.length; i++) {
    const row = airportsData[i];
    if (row.length < 5) continue;
    const ident = row[1]; // ident column
    if (!ident) continue;
    
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
  runwaysCache = new Map();
  for (let i = 1; i < runwaysData.length; i++) {
    const row = runwaysData[i];
    if (row.length < 10) continue;
    const airportIdent = row[2]; // airport_ident column
    if (!airportIdent) continue;
    
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
  frequenciesCache = new Map();
  for (let i = 1; i < frequenciesData.length; i++) {
    const row = frequenciesData[i];
    if (row.length < 5) continue;
    const airportIdent = row[2]; // airport_ident column
    if (!airportIdent) continue;
    
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

  lastFetch = now;
  console.log(`Loaded ${airportsCache.size} airports, ${runwaysCache.size} runway sets, ${frequenciesCache.size} frequency sets`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  try {
    const { icao } = await params;
    const icaoUpper = icao.toUpperCase();
    
    await loadData();

    const airport = airportsCache?.get(icaoUpper);
    const runways = runwaysCache?.get(icaoUpper) || [];
    const frequencies = frequenciesCache?.get(icaoUpper) || [];

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
