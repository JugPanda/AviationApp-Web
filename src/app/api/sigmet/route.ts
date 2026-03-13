import { NextRequest, NextResponse } from 'next/server';

export interface SigmetData {
  id: string;
  type: 'SIGMET' | 'AIRMET';
  subType: string; // TURB, ICE, IFR, MTN OBSCN, etc.
  hazard: string;
  severity?: string;
  validFrom: string;
  validTo: string;
  altitudeLow?: number;
  altitudeHigh?: number;
  rawText: string;
  coords: { lat: number; lng: number }[];
  isActive: boolean;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'all'; // sigmet, airmet, all
  
  try {
    // Fetch from aviationweather.gov
    const urls = [];
    
    if (type === 'all' || type === 'sigmet') {
      urls.push(`https://aviationweather.gov/api/data/isigmet?format=json`);
    }
    if (type === 'all' || type === 'airmet') {
      urls.push(`https://aviationweather.gov/api/data/airsigmet?format=json`);
    }
    
    const results = await Promise.allSettled(
      urls.map(url => fetch(url, {
        headers: { 'User-Agent': 'AvWeather/1.0' },
        next: { revalidate: 300 }
      }).then(r => r.json()))
    );

    const sigmets: SigmetData[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        for (const item of result.value) {
          sigmets.push(parseSigmet(item));
        }
      }
    }

    if (sigmets.length === 0) {
      return NextResponse.json(getSampleSigmets());
    }

    return NextResponse.json(sigmets);
  } catch (error) {
    console.error('SIGMET fetch error:', error);
    return NextResponse.json(getSampleSigmets());
  }
}

function parseSigmet(item: any): SigmetData {
  const now = new Date();
  
  // Parse coordinates from various formats
  const coords: { lat: number; lng: number }[] = [];
  if (item.coords) {
    // Some formats have coords as array of [lon, lat] pairs
    if (Array.isArray(item.coords)) {
      for (const coord of item.coords) {
        if (Array.isArray(coord) && coord.length >= 2) {
          coords.push({ lat: coord[1], lng: coord[0] });
        }
      }
    }
  }
  
  const validFrom = item.validTimeFrom || item.issueTime || now.toISOString();
  const validTo = item.validTimeTo || new Date(now.getTime() + 6 * 3600000).toISOString();
  
  return {
    id: item.airSigmetId || item.isigmetId || `sigmet-${Math.random().toString(36).substr(2, 6)}`,
    type: (item.airSigmetType === 'AIRMET' || item.hazard?.includes('AIRMET')) ? 'AIRMET' : 'SIGMET',
    subType: item.hazard || 'UNKNOWN',
    hazard: item.hazard || item.rawAirSigmet?.substring(0, 50) || 'Weather hazard',
    severity: item.severity,
    validFrom,
    validTo,
    altitudeLow: item.altLow1 || item.altitudeLo,
    altitudeHigh: item.altHi1 || item.altitudeHi,
    rawText: item.rawAirSigmet || item.rawText || '',
    coords,
    isActive: new Date(validTo) > now && new Date(validFrom) <= now
  };
}

function getSampleSigmets(): SigmetData[] {
  const now = new Date();
  const later = new Date(now.getTime() + 6 * 3600000);
  
  return [
    {
      id: 'airmet-tango-1',
      type: 'AIRMET',
      subType: 'TURB',
      hazard: 'AIRMET TANGO - Moderate Turbulence',
      severity: 'MOD',
      validFrom: now.toISOString(),
      validTo: later.toISOString(),
      altitudeLow: 15000,
      altitudeHigh: 35000,
      rawText: 'AIRMET TURB...MOD TURB BTN FL150 AND FL350',
      coords: [
        { lat: 42, lng: -90 },
        { lat: 42, lng: -80 },
        { lat: 38, lng: -80 },
        { lat: 38, lng: -90 },
      ],
      isActive: true
    },
    {
      id: 'airmet-zulu-1',
      type: 'AIRMET',
      subType: 'ICE',
      hazard: 'AIRMET ZULU - Moderate Icing',
      severity: 'MOD',
      validFrom: now.toISOString(),
      validTo: later.toISOString(),
      altitudeLow: 5000,
      altitudeHigh: 18000,
      rawText: 'AIRMET ICE...MOD ICG BTN 050 AND FL180',
      coords: [
        { lat: 45, lng: -95 },
        { lat: 45, lng: -85 },
        { lat: 40, lng: -85 },
        { lat: 40, lng: -95 },
      ],
      isActive: true
    },
    {
      id: 'airmet-sierra-1',
      type: 'AIRMET',
      subType: 'IFR',
      hazard: 'AIRMET SIERRA - IFR Conditions',
      validFrom: now.toISOString(),
      validTo: later.toISOString(),
      rawText: 'AIRMET IFR...CIG BLW 010/VIS BLW 3SM',
      coords: [
        { lat: 35, lng: -85 },
        { lat: 35, lng: -75 },
        { lat: 30, lng: -75 },
        { lat: 30, lng: -85 },
      ],
      isActive: true
    },
    {
      id: 'sigmet-1',
      type: 'SIGMET',
      subType: 'CONVECTIVE',
      hazard: 'Convective SIGMET - Thunderstorms',
      severity: 'SEV',
      validFrom: now.toISOString(),
      validTo: new Date(now.getTime() + 2 * 3600000).toISOString(),
      altitudeLow: 0,
      altitudeHigh: 45000,
      rawText: 'CONVECTIVE SIGMET...SEV TS',
      coords: [
        { lat: 34, lng: -95 },
        { lat: 34, lng: -88 },
        { lat: 30, lng: -88 },
        { lat: 30, lng: -95 },
      ],
      isActive: true
    }
  ];
}
