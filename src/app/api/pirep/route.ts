import { NextRequest, NextResponse } from 'next/server';

import { buildLiveOverlayResponse, buildUnavailableOverlayResponse } from '@/lib/overlay-response';

export interface PirepData {
  id: string;
  receiptTime: string;
  obsTime: string;
  icaoId?: string;
  lat: number;
  lon: number;
  altitude: number;
  aircraftType?: string;
  reportType: 'PIREP' | 'URGENT';
  
  // Conditions
  turbulence?: {
    intensity: 'NEG' | 'SMTH-LGT' | 'LGT' | 'LGT-MOD' | 'MOD' | 'MOD-SEV' | 'SEV' | 'EXTRM';
    type?: string;
    frequency?: string;
    altitude?: number;
  };
  icing?: {
    intensity: 'NEG' | 'TRC' | 'LGT' | 'MOD' | 'SEV';
    type?: string;
    altitude?: number;
  };
  skyCondition?: string;
  visibility?: number;
  temperature?: number;
  wind?: {
    direction: number;
    speed: number;
  };
  rawText: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bounds = searchParams.get('bounds');
  const hours = searchParams.get('hours') || '3';
  const unavailableMessage = 'Live PIREP data is unavailable right now. Cross-check with an official briefing source.';
  
  try {
    let url = `https://aviationweather.gov/api/data/pirep?format=json&age=${hours}`;
    
    if (bounds) {
      const [south, north, west, east] = bounds.split(',').map(Number);
      // Use bounding box
      url += `&bbox=${west},${south},${east},${north}`;
    }
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AvWeather/1.0' },
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      return NextResponse.json(buildUnavailableOverlayResponse<PirepData>(unavailableMessage), { status: 503 });
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json(buildUnavailableOverlayResponse<PirepData>(unavailableMessage), { status: 503 });
    }

    const pireps: PirepData[] = data.map((p: any, i: number) => ({
      id: p.pirepId || `pirep-${i}`,
      receiptTime: p.receiptTime || '',
      obsTime: p.obsTime || p.receiptTime || '',
      icaoId: p.icaoId,
      lat: p.lat || 0,
      lon: p.lon || 0,
      altitude: p.altFt || p.fltlvl * 100 || 0,
      aircraftType: p.acType,
      reportType: p.reportType === 'URGENT' ? 'URGENT' : 'PIREP',
      turbulence: p.turbInt ? {
        intensity: p.turbInt,
        type: p.turbType,
        frequency: p.turbFreq,
        altitude: p.turbAlt
      } : undefined,
      icing: p.icgInt ? {
        intensity: p.icgInt,
        type: p.icgType,
        altitude: p.icgAlt
      } : undefined,
      skyCondition: p.skyCover,
      visibility: p.visib,
      temperature: p.temp,
      wind: p.wdir && p.wspd ? { direction: p.wdir, speed: p.wspd } : undefined,
      rawText: p.rawOb || p.rawText || ''
    }));

    return NextResponse.json(buildLiveOverlayResponse(pireps));
  } catch (error) {
    console.error('PIREP fetch error:', error);
    return NextResponse.json(buildUnavailableOverlayResponse<PirepData>(unavailableMessage), { status: 503 });
  }
}
