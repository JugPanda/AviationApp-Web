import { NextResponse } from 'next/server';
import { getFlightSearchCandidates, looksLikeIcaoHex, normalizeFlightIdentifier } from '@/lib/flight-tracking';

export interface FlightData {
  icao24: string;
  callsign: string;
  registration?: string | null;
  aircraftType?: string | null;
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
const ADSB_API = 'https://api.adsb.lol/v2';
const KNOTS_TO_METERS_PER_SECOND = 0.514444;
const FEET_TO_METERS = 0.3048;
const FEET_PER_MINUTE_TO_METERS_PER_SECOND = 0.00508;

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number | null;
  lon?: number | null;
  alt_baro?: number | string | null;
  alt_geom?: number | null;
  gs?: number | null;
  track?: number | null;
  geom_rate?: number | null;
  baro_rate?: number | null;
  seen?: number | null;
}

interface AdsbResponse {
  ac?: AdsbAircraft[];
  now?: number;
}

function normalizeAdsbFlight(aircraft: AdsbAircraft, nowMs: number): FlightData | null {
  if (!Number.isFinite(aircraft.lat) || !Number.isFinite(aircraft.lon) || !aircraft.hex) {
    return null;
  }

  const altitudeFeet = typeof aircraft.alt_geom === 'number'
    ? aircraft.alt_geom
    : typeof aircraft.alt_baro === 'number'
      ? aircraft.alt_baro
      : 0;
  const verticalRateFpm = typeof aircraft.geom_rate === 'number'
    ? aircraft.geom_rate
    : typeof aircraft.baro_rate === 'number'
      ? aircraft.baro_rate
      : 0;
  const seenSeconds = typeof aircraft.seen === 'number' ? aircraft.seen : 0;

  return {
    icao24: normalizeFlightIdentifier(aircraft.hex),
    callsign: normalizeFlightIdentifier(aircraft.flight) || 'N/A',
    registration: normalizeFlightIdentifier(aircraft.r) || null,
    aircraftType: normalizeFlightIdentifier(aircraft.t) || null,
    originCountry: 'Unknown',
    longitude: aircraft.lon as number,
    latitude: aircraft.lat as number,
    altitude: altitudeFeet * FEET_TO_METERS,
    velocity: (aircraft.gs ?? 0) * KNOTS_TO_METERS_PER_SECOND,
    heading: aircraft.track ?? 0,
    verticalRate: verticalRateFpm * FEET_PER_MINUTE_TO_METERS_PER_SECOND,
    onGround: aircraft.alt_baro === 'ground',
    lastUpdate: Math.max(0, Math.floor(nowMs / 1000 - seenSeconds)),
  };
}

async function fetchAdsbFlights(path: string): Promise<FlightData[]> {
  const res = await fetch(`${ADSB_API}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    throw new Error(`adsb.lol API error: ${res.status}`);
  }

  const data = await res.json() as AdsbResponse;
  const nowMs = typeof data.now === 'number' ? data.now : Date.now();
  return (data.ac ?? [])
    .map((aircraft) => normalizeAdsbFlight(aircraft, nowMs))
    .filter((flight): flight is FlightData => flight !== null);
}

async function fetchFlightsByQuery(query: string): Promise<FlightData[]> {
  const normalized = normalizeFlightIdentifier(query);
  if (!normalized) {
    return [];
  }

  const searchCandidates = getFlightSearchCandidates(normalized);
  const endpointQueue: string[] = [];

  if (looksLikeIcaoHex(normalized)) {
    endpointQueue.push(`/icao/${normalized.toLowerCase()}`);
  }

  for (const candidate of searchCandidates) {
    endpointQueue.push(`/reg/${encodeURIComponent(candidate)}`);
  }

  endpointQueue.push(`/callsign/${encodeURIComponent(normalized)}`);

  const seen = new Set<string>();
  const results: FlightData[] = [];

  for (const endpoint of endpointQueue) {
    const flights = await fetchAdsbFlights(endpoint);
    for (const flight of flights) {
      const key = normalizeFlightIdentifier(flight.icao24);
      if (key && !seen.has(key)) {
        seen.add(key);
        results.push(flight);
      }
    }
    if (results.length > 0) {
      break;
    }
  }

  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') ?? searchParams.get('callsign');
  const bounds = searchParams.get('bounds'); // "lat1,lat2,lon1,lon2"
  
  try {
    if (query) {
      const flights = await fetchFlightsByQuery(query);
      return NextResponse.json(flights);
    }

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
    })).filter((f: FlightData) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
    
    return NextResponse.json(flights);
  } catch (error) {
    console.error('Flight API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch flights' },
      { status: 500 }
    );
  }
}
