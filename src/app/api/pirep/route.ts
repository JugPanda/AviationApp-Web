import { NextRequest, NextResponse } from 'next/server';

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
  
  try {
    // Fetch PIREPs from aviationweather.gov
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
      // Return sample data if API fails
      return NextResponse.json(getSamplePireps());
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json(getSamplePireps());
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

    return NextResponse.json(pireps);
  } catch (error) {
    console.error('PIREP fetch error:', error);
    return NextResponse.json(getSamplePireps());
  }
}

function getSamplePireps(): PirepData[] {
  const now = new Date();
  return [
    {
      id: 'pirep-demo-1',
      receiptTime: now.toISOString(),
      obsTime: new Date(now.getTime() - 30 * 60000).toISOString(),
      icaoId: 'KORD',
      lat: 42.1,
      lon: -87.8,
      altitude: 12000,
      aircraftType: 'B737',
      reportType: 'PIREP',
      turbulence: { intensity: 'MOD', type: 'CHOP' },
      rawText: 'ORD UA /OV ORD/TM 1430/FL120/TP B737/TB MOD CHOP'
    },
    {
      id: 'pirep-demo-2',
      receiptTime: now.toISOString(),
      obsTime: new Date(now.getTime() - 45 * 60000).toISOString(),
      icaoId: 'KJFK',
      lat: 40.8,
      lon: -73.6,
      altitude: 8000,
      aircraftType: 'C172',
      reportType: 'PIREP',
      icing: { intensity: 'LGT', type: 'RIME' },
      rawText: 'JFK UA /OV JFK/TM 1415/FL080/TP C172/IC LGT RIME'
    },
    {
      id: 'pirep-demo-3',
      receiptTime: now.toISOString(),
      obsTime: new Date(now.getTime() - 15 * 60000).toISOString(),
      icaoId: 'KATL',
      lat: 33.8,
      lon: -84.3,
      altitude: 18000,
      aircraftType: 'A320',
      reportType: 'URGENT',
      turbulence: { intensity: 'SEV' },
      rawText: 'ATL UUA /OV ATL/TM 1500/FL180/TP A320/TB SEV'
    },
  ];
}
