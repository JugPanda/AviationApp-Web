import { NextRequest, NextResponse } from 'next/server';
import { US_STATES, US_REGIONS, DEFAULT_AIRPORTS, bboxToString, combineStateBboxes } from '@/lib/airports';

const AWC_BASE = 'https://aviationweather.gov/api/data/metar';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  const bbox = searchParams.get('bbox');
  const states = searchParams.get('states'); // Comma-separated state codes
  const region = searchParams.get('region'); // Region name

  try {
    let url: string;

    if (ids) {
      // Fetch specific airports by ICAO code
      url = `${AWC_BASE}?ids=${ids.toUpperCase()}&format=json`;
    } else if (states) {
      // Fetch airports for specific states using combined bounding box
      const stateCodes = states.split(',').map(s => s.trim().toUpperCase());
      const combinedBbox = combineStateBboxes(stateCodes);
      
      if (!combinedBbox) {
        return NextResponse.json({ error: 'Invalid state codes' }, { status: 400 });
      }
      
      url = `${AWC_BASE}?bbox=${bboxToString(combinedBbox)}&format=json`;
    } else if (region) {
      // Fetch airports for a region using its bounding box
      const regionData = US_REGIONS[region.toLowerCase()];
      
      if (!regionData) {
        return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
      }
      
      url = `${AWC_BASE}?bbox=${bboxToString(regionData.bbox)}&format=json`;
    } else if (bbox) {
      // Direct bounding box query
      url = `${AWC_BASE}?bbox=${bbox}&format=json`;
    } else {
      // Default: fetch popular US airports for fast initial load
      url = `${AWC_BASE}?ids=${DEFAULT_AIRPORTS.join(',')}&format=json`;
    }

    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: { 'User-Agent': 'AviationWeatherApp/1.0' },
    });

    if (!response.ok) {
      throw new Error(`AWC API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter to only US airports if using bbox (might include Canadian/Mexican airports near borders)
    // US ICAO codes start with K, P (Pacific), or are in territories
    const filtered = Array.isArray(data) 
      ? data.filter((airport: { icaoId?: string }) => {
          const icao = airport.icaoId || '';
          return icao.startsWith('K') || icao.startsWith('P') || 
                 icao.startsWith('TJ') || // Puerto Rico
                 icao.startsWith('TI');   // US Virgin Islands
        })
      : data;

    return NextResponse.json(filtered);
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
    })),
    regions: Object.entries(US_REGIONS).map(([id, data]) => ({
      id,
      name: data.name,
      states: data.states,
    })),
  });
}
