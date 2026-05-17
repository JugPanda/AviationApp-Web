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

interface NotamResponse {
  notams: NotamData[];
  unavailable?: boolean;
  message?: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ icao: string }> }
) {
  const { icao } = await params;

  if (!icao || icao.length < 3) {
    return NextResponse.json({ error: 'Invalid ICAO code' }, { status: 400 });
  }

  try {
    const url = `https://aviationweather.gov/api/data/notam?icao=${icao.toUpperCase()}&format=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AvWeather/1.0'
      },
      next: { revalidate: 600 }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json<NotamResponse>({ notams: [] });
      }
      throw new Error(`NOTAM API returned ${response.status}`);
    }

    const data = await response.json();

    const notams: NotamData[] = (Array.isArray(data) ? data : []).map((notam: Record<string, unknown>, index: number) => {
      const text = String(notam.text || notam.notamText || notam.traditionalMessage || '');

      return {
        id: String(notam.notamNumber || notam.id || `${icao}-${index}`),
        icaoId: icao.toUpperCase(),
        type: categorizeNotam(text),
        text,
        effectiveStart: typeof notam.effectiveStart === 'string' ? notam.effectiveStart : typeof notam.startDate === 'string' ? notam.startDate : undefined,
        effectiveEnd: typeof notam.effectiveEnd === 'string' ? notam.effectiveEnd : typeof notam.endDate === 'string' ? notam.endDate : undefined,
        isActive: checkNotamActive(
          typeof notam.effectiveStart === 'string' ? notam.effectiveStart : typeof notam.startDate === 'string' ? notam.startDate : undefined,
          typeof notam.effectiveEnd === 'string' ? notam.effectiveEnd : typeof notam.endDate === 'string' ? notam.endDate : undefined,
        ),
        severity: assessSeverity(text)
      };
    });

    return NextResponse.json<NotamResponse>({ notams });
  } catch (error) {
    console.error('NOTAM fetch error:', error);

    return NextResponse.json<NotamResponse>({
      notams: [],
      unavailable: true,
      message: 'Live NOTAM source unavailable right now. Reconnect or cross-check with an official briefing source.',
    }, { status: 503 });
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

  if (
    upperText.includes('CLSD') ||
    upperText.includes('CLOSED') ||
    upperText.includes('TFR') ||
    upperText.includes('UNSERVICEABLE') ||
    upperText.includes('OUT OF SERVICE')
  ) {
    return 'high';
  }

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
