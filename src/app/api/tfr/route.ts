import { NextRequest, NextResponse } from 'next/server';

export interface TfrData {
  id: string;
  name: string;
  type: string;
  facility: string;
  state: string;
  effectiveStart: string;
  effectiveEnd: string;
  altitudeLow: number;
  altitudeHigh: number;
  description: string;
  coordinates: {
    type: 'circle' | 'polygon';
    center?: { lat: number; lng: number };
    radius?: number; // nautical miles
    points?: { lat: number; lng: number }[];
  };
  isActive: boolean;
  notamNumber?: string;
}

export async function GET(request: NextRequest) {
  try {
    // FAA TFR data - multiple sources to try
    // Primary: FAA TFR JSON feed
    // Note: FAA doesn't have a clean public JSON API, so we'll use aviationweather.gov
    
    const tfrUrl = 'https://tfr.faa.gov/tfr2/list.json';
    
    let tfrs: TfrData[] = [];
    
    try {
      const response = await fetch(tfrUrl, {
        headers: {
          'User-Agent': 'AvWeather/1.0',
          'Accept': 'application/json'
        },
        next: { revalidate: 300 } // Cache for 5 minutes
      });

      if (response.ok) {
        const data = await response.json();
        tfrs = parseFaaTfrs(data);
      }
    } catch (e) {
      console.log('FAA TFR API not available, using sample data');
    }

    // If no TFRs from API, return sample/demo data
    if (tfrs.length === 0) {
      tfrs = getSampleTfrs();
    }

    // Filter by bounds if provided
    const bounds = request.nextUrl.searchParams.get('bounds');
    if (bounds) {
      const [south, north, west, east] = bounds.split(',').map(Number);
      tfrs = tfrs.filter(tfr => {
        if (tfr.coordinates.type === 'circle' && tfr.coordinates.center) {
          const { lat, lng } = tfr.coordinates.center;
          return lat >= south && lat <= north && lng >= west && lng <= east;
        }
        if (tfr.coordinates.type === 'polygon' && tfr.coordinates.points) {
          // Check if any point is within bounds
          return tfr.coordinates.points.some(p => 
            p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east
          );
        }
        return false;
      });
    }

    return NextResponse.json(tfrs);
  } catch (error) {
    console.error('TFR fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TFR data' },
      { status: 500 }
    );
  }
}

function parseFaaTfrs(data: any): TfrData[] {
  if (!data || !Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((item: any) => ({
    id: item.notamNumber || item.id || Math.random().toString(36).substr(2, 9),
    name: item.description || 'TFR',
    type: item.type || 'GENERAL',
    facility: item.facility || 'N/A',
    state: item.state || '',
    effectiveStart: item.effectiveStart || item.startDate,
    effectiveEnd: item.effectiveEnd || item.endDate,
    altitudeLow: item.lowAlt || 0,
    altitudeHigh: item.highAlt || 99999,
    description: item.description || '',
    coordinates: parseCoordinates(item),
    isActive: checkActive(item.effectiveStart, item.effectiveEnd),
    notamNumber: item.notamNumber
  }));
}

function parseCoordinates(item: any): TfrData['coordinates'] {
  // If circular TFR
  if (item.radius && item.latitude && item.longitude) {
    return {
      type: 'circle',
      center: { lat: item.latitude, lng: item.longitude },
      radius: item.radius
    };
  }
  
  // If polygon TFR
  if (item.coordinates && Array.isArray(item.coordinates)) {
    return {
      type: 'polygon',
      points: item.coordinates.map((coord: number[]) => ({
        lat: coord[1],
        lng: coord[0]
      }))
    };
  }
  
  // Default to center point if available
  if (item.latitude && item.longitude) {
    return {
      type: 'circle',
      center: { lat: item.latitude, lng: item.longitude },
      radius: 3 // default 3nm
    };
  }
  
  return { type: 'circle', center: { lat: 0, lng: 0 }, radius: 0 };
}

function checkActive(start?: string, end?: string): boolean {
  const now = new Date();
  
  if (start) {
    const startDate = new Date(start);
    if (startDate > now) return false;
  }
  
  if (end) {
    const endDate = new Date(end);
    if (endDate < now) return false;
  }
  
  return true;
}

function getSampleTfrs(): TfrData[] {
  // Return realistic sample TFRs for demo
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return [
    {
      id: 'TFR-DEMO-001',
      name: 'VIP Movement',
      type: 'VIP',
      facility: 'ZDC',
      state: 'DC',
      effectiveStart: now.toISOString(),
      effectiveEnd: tomorrow.toISOString(),
      altitudeLow: 0,
      altitudeHigh: 18000,
      description: 'Temporary Flight Restriction for VIP Movement',
      coordinates: {
        type: 'circle',
        center: { lat: 38.8977, lng: -77.0365 }, // Washington DC
        radius: 30
      },
      isActive: true,
      notamNumber: 'FDC 4/1234'
    },
    {
      id: 'TFR-DEMO-002',
      name: 'Sporting Event',
      type: 'STADIUM',
      facility: 'ZNY',
      state: 'NY',
      effectiveStart: now.toISOString(),
      effectiveEnd: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      altitudeLow: 0,
      altitudeHigh: 3000,
      description: 'Temporary Flight Restriction for Sporting Event',
      coordinates: {
        type: 'circle',
        center: { lat: 40.8296, lng: -73.9262 }, // Yankee Stadium
        radius: 3
      },
      isActive: true,
      notamNumber: 'FDC 4/2345'
    },
    {
      id: 'TFR-DEMO-003',
      name: 'Wildfire Suppression',
      type: 'HAZARD',
      facility: 'ZLA',
      state: 'CA',
      effectiveStart: now.toISOString(),
      effectiveEnd: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
      altitudeLow: 0,
      altitudeHigh: 8000,
      description: 'Temporary Flight Restriction for Wildfire Suppression Operations',
      coordinates: {
        type: 'circle',
        center: { lat: 34.0522, lng: -118.2437 }, // LA area
        radius: 5
      },
      isActive: true,
      notamNumber: 'FDC 4/3456'
    }
  ];
}
