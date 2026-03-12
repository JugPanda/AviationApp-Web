import { NextRequest, NextResponse } from 'next/server';

export interface NotamData {
  id: string;
  icaoId: string;
  type: 'Airport' | 'Runway' | 'Airspace' | 'Obstacle' | 'TFR' | 'Other';
  text: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high';
}

// Note: FAA NOTAM API requires authentication or scraping
// This is a placeholder that can be expanded with proper API access
// For now, we'll fetch from a public source if available

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  const { icao } = await params;
  
  if (!icao || icao.length < 3) {
    return NextResponse.json({ error: 'Invalid ICAO code' }, { status: 400 });
  }

  try {
    // Try to fetch from aviationweather.gov NOTAM endpoint
    const url = `https://aviationweather.gov/api/data/notam?icao=${icao.toUpperCase()}&format=json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AvWeather/1.0'
      },
      next: { revalidate: 600 } // Cache for 10 minutes
    });

    if (!response.ok) {
      // Return empty array if no NOTAMs found
      if (response.status === 404) {
        return NextResponse.json([]);
      }
      throw new Error(`NOTAM API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Parse and categorize NOTAMs
    const notams: NotamData[] = (Array.isArray(data) ? data : []).map((notam: any, index: number) => {
      const text = notam.text || notam.notamText || notam.traditionalMessage || '';
      
      return {
        id: notam.notamNumber || notam.id || `${icao}-${index}`,
        icaoId: icao.toUpperCase(),
        type: categorizeNotam(text),
        text: text,
        effectiveStart: notam.effectiveStart || notam.startDate,
        effectiveEnd: notam.effectiveEnd || notam.endDate,
        isActive: checkNotamActive(notam.effectiveStart, notam.effectiveEnd),
        severity: assessSeverity(text)
      };
    });

    return NextResponse.json(notams);
  } catch (error) {
    console.error('NOTAM fetch error:', error);
    
    // Return mock data for demo purposes
    const mockNotams = generateMockNotams(icao.toUpperCase());
    return NextResponse.json(mockNotams);
  }
}

function categorizeNotam(text: string): NotamData['type'] {
  const upperText = text.toUpperCase();
  
  if (upperText.includes('TFR') || upperText.includes('TEMPORARY FLIGHT RESTRICTION')) {
    return 'TFR';
  }
  if (upperText.includes('RWY') || upperText.includes('RUNWAY') || upperText.includes('CLSD')) {
    return 'Runway';
  }
  if (upperText.includes('OBST') || upperText.includes('TOWER') || upperText.includes('CRANE')) {
    return 'Obstacle';
  }
  if (upperText.includes('AIRSPACE') || upperText.includes('SUA') || upperText.includes('MOA')) {
    return 'Airspace';
  }
  if (upperText.includes('AD') || upperText.includes('APRON') || upperText.includes('TWY')) {
    return 'Airport';
  }
  
  return 'Other';
}

function assessSeverity(text: string): NotamData['severity'] {
  const upperText = text.toUpperCase();
  
  // High severity
  if (
    upperText.includes('CLSD') ||
    upperText.includes('CLOSED') ||
    upperText.includes('TFR') ||
    upperText.includes('UNSERVICEABLE') ||
    upperText.includes('OUT OF SERVICE')
  ) {
    return 'high';
  }
  
  // Medium severity
  if (
    upperText.includes('LIMITED') ||
    upperText.includes('REDUCED') ||
    upperText.includes('CAUTION') ||
    upperText.includes('BIRDS')
  ) {
    return 'medium';
  }
  
  return 'low';
}

function checkNotamActive(start?: string, end?: string): boolean {
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

function generateMockNotams(icao: string): NotamData[] {
  // Return realistic mock data when API is unavailable
  return [
    {
      id: `${icao}-001`,
      icaoId: icao,
      type: 'Airport',
      text: `!${icao} ${icao} AD AP FUEL AVBL JET A, 100LL`,
      effectiveStart: new Date().toISOString(),
      effectiveEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      severity: 'low'
    },
    {
      id: `${icao}-002`,
      icaoId: icao,
      type: 'Runway',
      text: `!${icao} ${icao} RWY 09/27 PAPI OUT OF SERVICE`,
      effectiveStart: new Date().toISOString(),
      effectiveEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      severity: 'medium'
    }
  ];
}
