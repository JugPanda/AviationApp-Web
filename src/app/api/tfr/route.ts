import { NextRequest, NextResponse } from 'next/server';

import { buildLiveOverlayResponse, buildUnavailableOverlayResponse } from '@/lib/overlay-response';

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
    const tfrUrl = 'https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=300&outputFormat=application/json&srsname=EPSG:4326';
    const response = await fetch(tfrUrl, {
      headers: {
        'User-Agent': 'AvWeather/1.0',
        'Accept': 'application/json'
      },
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      return NextResponse.json(
        buildUnavailableOverlayResponse<TfrData>('Live TFR data is unavailable right now. Cross-check with an official FAA briefing source.'),
        { status: 503 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Unexpected TFR content type: ${contentType || 'unknown'}`);
    }

    const data = await response.json();
    let tfrs = parseFaaTfrs(data);

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

    return NextResponse.json(buildLiveOverlayResponse(tfrs));
  } catch (error) {
    console.error('TFR fetch error:', error);
    return NextResponse.json(
      buildUnavailableOverlayResponse<TfrData>('Live TFR data is unavailable right now. Cross-check with an official FAA briefing source.'),
      { status: 503 }
    );
  }
}

function parseFaaTfrs(data: any): TfrData[] {
  if (data && Array.isArray(data.features)) {
    return data.features.map((feature: any) => {
      const props = feature?.properties ?? {};
      const coordinates = parseCoordinates(feature);
      const effective = extractEffectiveWindow(props.TITLE);
      return {
        id: props.NOTAM_KEY || feature.id || crypto.randomUUID(),
        name: props.TITLE || 'TFR',
        type: props.LEGAL || 'GENERAL',
        facility: props.CNS_LOCATION_ID || 'N/A',
        state: props.STATE || '',
        effectiveStart: effective.start || props.LAST_MODIFICATION_DATETIME,
        effectiveEnd: effective.end || props.LAST_MODIFICATION_DATETIME,
        altitudeLow: 0,
        altitudeHigh: 99999,
        description: props.TITLE || '',
        coordinates,
        isActive: checkActive(effective.start || undefined, effective.end || undefined),
        notamNumber: props.NOTAM_KEY
      };
    });
  }

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
  if (item?.geometry?.type === 'Polygon' && Array.isArray(item.geometry.coordinates?.[0])) {
    return {
      type: 'polygon',
      points: item.geometry.coordinates[0].map((coord: number[]) => ({
        lat: coord[1],
        lng: coord[0]
      }))
    };
  }

  if (item?.geometry?.type === 'MultiPolygon' && Array.isArray(item.geometry.coordinates?.[0]?.[0])) {
    return {
      type: 'polygon',
      points: item.geometry.coordinates[0][0].map((coord: number[]) => ({
        lat: coord[1],
        lng: coord[0]
      }))
    };
  }

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

function extractEffectiveWindow(title?: string): { start: string | null; end: string | null } {
  if (!title) return { start: null, end: null };

  const segments = title.split(',').slice(2).join(',').split(' through ');
  if (segments.length !== 2) {
    return { start: null, end: null };
  }

  const parseDate = (value: string) => {
    const normalized = value.replace(/ Local$/i, '').trim();
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  return {
    start: parseDate(segments[0]),
    end: parseDate(segments[1]),
  };
}


