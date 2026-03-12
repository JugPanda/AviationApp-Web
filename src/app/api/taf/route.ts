import { NextRequest, NextResponse } from 'next/server';

export interface TafData {
  icaoId: string;
  rawTaf: string;
  issueTime: string;
  validFrom: string;
  validTo: string;
  forecasts: TafForecast[];
}

export interface TafForecast {
  type: 'BASE' | 'TEMPO' | 'BECMG' | 'PROB' | 'FM';
  fromTime?: string;
  toTime?: string;
  probability?: number;
  wind?: {
    direction: number | 'VRB';
    speed: number;
    gust?: number;
    unit: string;
  };
  visibility?: {
    value: number;
    unit: string;
  };
  weather?: string[];
  clouds?: {
    cover: string;
    base: number;
  }[];
  raw: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  
  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  try {
    // Fetch TAF from aviationweather.gov
    const url = `https://aviationweather.gov/api/data/taf?ids=${ids}&format=json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AvWeather/1.0'
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`TAF API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'No TAF data found' }, { status: 404 });
    }

    // Parse and structure the TAF data
    const tafs: TafData[] = data.map((taf: any) => ({
      icaoId: taf.icaoId,
      rawTaf: taf.rawTAF || taf.rawOb,
      issueTime: taf.issueTime,
      validFrom: taf.validTimeFrom,
      validTo: taf.validTimeTo,
      forecasts: parseTafForecasts(taf.rawTAF || taf.rawOb)
    }));

    return NextResponse.json(tafs);
  } catch (error) {
    console.error('TAF fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TAF data' },
      { status: 500 }
    );
  }
}

function parseTafForecasts(rawTaf: string): TafForecast[] {
  if (!rawTaf) return [];
  
  const forecasts: TafForecast[] = [];
  
  // Split TAF into segments
  // FM, TEMPO, BECMG, PROB are change indicators
  const segments = rawTaf.split(/(?=FM\d{6}|TEMPO|BECMG|PROB\d{2})/);
  
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    
    const forecast: TafForecast = {
      type: 'BASE',
      raw: trimmed
    };
    
    // Determine type
    if (trimmed.startsWith('FM')) {
      forecast.type = 'FM';
      const match = trimmed.match(/FM(\d{6})/);
      if (match) {
        forecast.fromTime = match[1];
      }
    } else if (trimmed.startsWith('TEMPO')) {
      forecast.type = 'TEMPO';
    } else if (trimmed.startsWith('BECMG')) {
      forecast.type = 'BECMG';
    } else if (trimmed.startsWith('PROB')) {
      forecast.type = 'PROB';
      const match = trimmed.match(/PROB(\d{2})/);
      if (match) {
        forecast.probability = parseInt(match[1]);
      }
    }
    
    // Parse wind
    const windMatch = trimmed.match(/(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)/);
    if (windMatch) {
      forecast.wind = {
        direction: windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1]),
        speed: parseInt(windMatch[2]),
        gust: windMatch[4] ? parseInt(windMatch[4]) : undefined,
        unit: windMatch[5]
      };
    }
    
    // Parse visibility
    const visMatch = trimmed.match(/\s(\d+)SM\s/);
    if (visMatch) {
      forecast.visibility = {
        value: parseInt(visMatch[1]),
        unit: 'SM'
      };
    }
    
    // Parse clouds
    const cloudMatches = trimmed.matchAll(/(FEW|SCT|BKN|OVC|VV)(\d{3})/g);
    const clouds = [];
    for (const match of cloudMatches) {
      clouds.push({
        cover: match[1],
        base: parseInt(match[2]) * 100
      });
    }
    if (clouds.length > 0) {
      forecast.clouds = clouds;
    }
    
    // Parse weather phenomena
    const wxPatterns = [
      'RA', 'SN', 'DZ', 'FG', 'BR', 'HZ', 'FU', 'SA', 'DU',
      'TS', 'SH', 'GR', 'GS', 'PL', 'IC', 'UP',
      '+RA', '-RA', '+SN', '-SN', '+TS', 'TSRA', 'SHRA'
    ];
    const weather = [];
    for (const wx of wxPatterns) {
      if (trimmed.includes(` ${wx} `) || trimmed.includes(` ${wx}`) || trimmed.startsWith(`${wx} `)) {
        weather.push(wx);
      }
    }
    if (weather.length > 0) {
      forecast.weather = weather;
    }
    
    forecasts.push(forecast);
  }
  
  return forecasts;
}
