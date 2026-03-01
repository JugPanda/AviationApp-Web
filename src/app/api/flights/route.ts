import { NextResponse } from 'next/server';

export interface FlightData {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  altitude: number;      // meters
  velocity: number;      // m/s
  heading: number;       // degrees
  verticalRate: number;  // m/s
  onGround: boolean;
  lastUpdate: number;
}

// OpenSky Network API - free, no auth required for basic queries
const OPENSKY_API = 'https://opensky-network.org/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get('callsign');
  const bounds = searchParams.get('bounds'); // "lat1,lat2,lon1,lon2"
  
  try {
    let url = `${OPENSKY_API}/states/all`;
    
    if (bounds) {
      const [lamin, lamax, lomin, lomax] = bounds.split(',');
      url += `?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
    }
    
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 10 }, // Cache for 10 seconds
    });
    
    if (!res.ok) {
      throw new Error(`OpenSky API error: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.states || data.states.length === 0) {
      return NextResponse.json([]);
    }
    
    // Transform OpenSky response to our format
    let flights: FlightData[] = data.states.map((state: (string | number | boolean | null)[]) => ({
      icao24: state[0] as string,
      callsign: (state[1] as string)?.trim() || 'N/A',
      originCountry: state[2] as string,
      longitude: state[5] as number,
      latitude: state[6] as number,
      altitude: state[7] as number || state[13] as number || 0,
      velocity: state[9] as number || 0,
      heading: state[10] as number || 0,
      verticalRate: state[11] as number || 0,
      onGround: state[8] as boolean,
      lastUpdate: state[4] as number,
    })).filter((f: FlightData) => f.latitude && f.longitude);
    
    // Filter by callsign if provided
    if (callsign) {
      const search = callsign.toUpperCase().trim();
      flights = flights.filter((f: FlightData) => 
        f.callsign.toUpperCase().includes(search) ||
        f.icao24.toUpperCase().includes(search)
      );
    }
    
    return NextResponse.json(flights);
  } catch (error) {
    console.error('Flight API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch flights' },
      { status: 500 }
    );
  }
}
