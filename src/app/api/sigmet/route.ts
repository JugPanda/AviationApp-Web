import { NextRequest, NextResponse } from 'next/server';

import { buildLiveOverlayResponse, buildUnavailableOverlayResponse } from '@/lib/overlay-response';

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
  const unavailableMessage = 'Live SIGMET/AIRMET data is unavailable right now. Cross-check with an official briefing source.';
  
  try {
    const urls = [];
    
    if (type === 'all' || type === 'sigmet') {
      urls.push(`https://aviationweather.gov/api/data/isigmet?format=json`);
    }
    if (type === 'all' || type === 'airmet') {
      urls.push(`https://aviationweather.gov/api/data/airsigmet?format=json`);
    }
    
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'AvWeather/1.0' },
          next: { revalidate: 300 }
        });

        if (!response.ok) {
          throw new Error(`SIGMET upstream returned ${response.status}`);
        }

        return response.json();
      })
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
      return NextResponse.json(buildUnavailableOverlayResponse<SigmetData>(unavailableMessage), { status: 503 });
    }

    return NextResponse.json(buildLiveOverlayResponse(sigmets));
  } catch (error) {
    console.error('SIGMET fetch error:', error);
    return NextResponse.json(buildUnavailableOverlayResponse<SigmetData>(unavailableMessage), { status: 503 });
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


