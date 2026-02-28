import { NextRequest, NextResponse } from 'next/server';

const AWC_BASE = 'https://aviationweather.gov/api/data/metar';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  const bbox = searchParams.get('bbox');

  try {
    let url: string;

    if (ids) {
      // Fetch specific airports by ICAO code
      url = `${AWC_BASE}?ids=${ids}&format=json`;
    } else if (bbox) {
      // Fetch airports in a bounding box (lat1,lon1,lat2,lon2)
      url = `${AWC_BASE}?bbox=${bbox}&format=json`;
    } else {
      // Default: fetch popular US airports
      const defaultAirports = [
        'KJFK', 'KLAX', 'KORD', 'KATL', 'KDFW', 
        'KDEN', 'KSFO', 'KLAS', 'KMIA', 'KSEA',
        'KBOS', 'KMSP', 'KDTW', 'KPHL', 'KPHX',
        'KIAH', 'KMCO', 'KEWR', 'KSLC', 'KSAN'
      ].join(',');
      url = `${AWC_BASE}?ids=${defaultAirports}&format=json`;
    }

    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`AWC API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('METAR fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch METAR data' },
      { status: 500 }
    );
  }
}
