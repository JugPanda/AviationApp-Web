import { NextRequest, NextResponse } from 'next/server';
import { US_STATES, US_REGIONS, DEFAULT_AIRPORTS, getAirportsForStates } from '@/lib/airports';

const AWC_BASE = 'https://aviationweather.gov/api/data/metar';
const MAX_IDS_PER_REQUEST = 50; // API limit

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  const bbox = searchParams.get('bbox');
  const states = searchParams.get('states'); // Comma-separated state codes
  const region = searchParams.get('region'); // Region name

  try {
    let airportIds: string[] = [];

    if (ids) {
      // Fetch specific airports by ICAO code
      airportIds = ids.split(',').map(id => id.trim().toUpperCase());
    } else if (states) {
      // Fetch airports for specific states
      const stateCodes = states.split(',').map(s => s.trim().toUpperCase());
      airportIds = getAirportsForStates(stateCodes);
    } else if (region) {
      // Fetch airports for a region
      const regionData = US_REGIONS[region.toLowerCase()];
      if (regionData) {
        airportIds = getAirportsForStates(regionData.states);
      }
    } else if (bbox) {
      // Fetch airports in a bounding box
      const url = `${AWC_BASE}?bbox=${bbox}&format=json`;
      const response = await fetch(url, {
        next: { revalidate: 300 },
        headers: { 'User-Agent': 'AviationWeatherApp/1.0' },
      });

      if (!response.ok) {
        throw new Error(`AWC API error: ${response.status}`);
      }

      return NextResponse.json(await response.json());
    } else {
      // Default: fetch popular US airports
      airportIds = DEFAULT_AIRPORTS;
    }

    // Remove duplicates
    airportIds = [...new Set(airportIds)];

    // Batch requests if needed (API has limits)
    const results: unknown[] = [];
    
    for (let i = 0; i < airportIds.length; i += MAX_IDS_PER_REQUEST) {
      const batch = airportIds.slice(i, i + MAX_IDS_PER_REQUEST);
      const url = `${AWC_BASE}?ids=${batch.join(',')}&format=json`;
      
      const response = await fetch(url, {
        next: { revalidate: 300 }, // Cache for 5 minutes
        headers: { 'User-Agent': 'AviationWeatherApp/1.0' },
      });

      if (!response.ok) {
        console.error(`AWC API error for batch: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        results.push(...data);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('METAR fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch METAR data' },
      { status: 500 }
    );
  }
}

// Endpoint info for frontend
export async function OPTIONS() {
  return NextResponse.json({
    states: Object.entries(US_STATES).map(([code, data]) => ({
      code,
      name: data.name,
      airportCount: data.airports.length,
    })),
    regions: Object.entries(US_REGIONS).map(([id, data]) => ({
      id,
      name: data.name,
      states: data.states,
    })),
  });
}
