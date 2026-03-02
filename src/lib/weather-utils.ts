import { CloudLayer, SafetyLevel, WeatherCondition, FlightCategory, TafPeriod } from '@/types';

// Calculate crosswind component
export function calculateCrosswind(
  windDir: number,
  windSpeed: number,
  runwayHeading: number
): number {
  const angle = Math.abs(windDir - runwayHeading);
  const crosswindAngle = angle > 180 ? 360 - angle : angle;
  return Math.abs(Math.sin((crosswindAngle * Math.PI) / 180) * windSpeed);
}

// Calculate headwind/tailwind component
export function calculateHeadwind(
  windDir: number,
  windSpeed: number,
  runwayHeading: number
): number {
  const angle = windDir - runwayHeading;
  return Math.cos((angle * Math.PI) / 180) * windSpeed;
}

// Get wind arrow rotation
export function getWindRotation(windDir: number | null | undefined): number {
  if (windDir === null || windDir === undefined) return 0;
  return windDir;
}

// Assess visibility safety
export function assessVisibility(visib: string | number | null | undefined): SafetyLevel {
  if (visib === null || visib === undefined) return 'caution';
  const vis = typeof visib === 'string' ? parseFloat(visib.replace('+', '')) : visib;
  if (vis >= 5) return 'good';
  if (vis >= 3) return 'caution';
  if (vis >= 1) return 'marginal';
  return 'hazardous';
}

// Assess ceiling safety
export function assessCeiling(clouds: CloudLayer[] | undefined): SafetyLevel {
  if (!clouds || clouds.length === 0) return 'good';
  
  const ceiling = clouds.find(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
  if (!ceiling) return 'good';
  
  const base = ceiling.base;
  if (base >= 3000) return 'good';
  if (base >= 1000) return 'caution';
  if (base >= 500) return 'marginal';
  return 'hazardous';
}

// Assess wind safety
export function assessWind(wspd: number | null | undefined, wgst: number | null | undefined): SafetyLevel {
  const speed = wspd ?? 0;
  const gust = wgst ?? speed;
  const maxWind = Math.max(speed, gust);
  
  if (maxWind <= 15) return 'good';
  if (maxWind <= 25) return 'caution';
  if (maxWind <= 35) return 'marginal';
  return 'hazardous';
}

// Get safety level color
export function getSafetyColor(level: SafetyLevel): string {
  switch (level) {
    case 'good': return '#22c55e';
    case 'caution': return '#eab308';
    case 'marginal': return '#f97316';
    case 'hazardous': return '#ef4444';
    default: return '#6b7280';
  }
}

// Get safety level class
export function getSafetyClass(level: SafetyLevel): string {
  switch (level) {
    case 'good': return 'text-green-400 bg-green-500/20';
    case 'caution': return 'text-yellow-400 bg-yellow-500/20';
    case 'marginal': return 'text-orange-400 bg-orange-500/20';
    case 'hazardous': return 'text-red-400 bg-red-500/20';
    default: return 'text-gray-400 bg-gray-500/20';
  }
}

// Comprehensive weather assessment
export function assessWeatherConditions(
  visib: string | number | null | undefined,
  clouds: CloudLayer[] | undefined,
  wspd: number | null | undefined,
  wgst: number | null | undefined
): WeatherCondition[] {
  const conditions: WeatherCondition[] = [];
  
  // Visibility
  const visLevel = assessVisibility(visib);
  const visValue = visib !== null && visib !== undefined 
    ? (typeof visib === 'string' ? visib : `${visib} SM`)
    : 'Unknown';
  conditions.push({
    parameter: 'Visibility',
    value: visValue,
    level: visLevel,
    description: getVisibilityDescription(visLevel)
  });
  
  // Ceiling
  const ceilLevel = assessCeiling(clouds);
  const ceiling = clouds?.find(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
  conditions.push({
    parameter: 'Ceiling',
    value: ceiling ? `${ceiling.base.toLocaleString()} ft AGL` : 'Clear/SCT',
    level: ceilLevel,
    description: getCeilingDescription(ceilLevel)
  });
  
  // Wind
  const windLevel = assessWind(wspd, wgst);
  const windValue = wspd ? `${wspd}${wgst ? ` G${wgst}` : ''} kt` : 'Calm';
  conditions.push({
    parameter: 'Wind',
    value: windValue,
    level: windLevel,
    description: getWindDescription(windLevel)
  });
  
  return conditions;
}

function getVisibilityDescription(level: SafetyLevel): string {
  switch (level) {
    case 'good': return 'Excellent visibility for VFR';
    case 'caution': return 'Marginal VFR - monitor conditions';
    case 'marginal': return 'IFR conditions - instrument rating required';
    case 'hazardous': return 'Low IFR - extreme caution';
    default: return 'Unknown';
  }
}

function getCeilingDescription(level: SafetyLevel): string {
  switch (level) {
    case 'good': return 'VFR ceiling adequate';
    case 'caution': return 'MVFR ceiling - reduced separation';
    case 'marginal': return 'IFR ceiling - instrument approaches likely';
    case 'hazardous': return 'LIFR ceiling - limited options';
    default: return 'Unknown';
  }
}

function getWindDescription(level: SafetyLevel): string {
  switch (level) {
    case 'good': return 'Light winds favorable';
    case 'caution': return 'Moderate winds - check crosswind limits';
    case 'marginal': return 'Strong winds - turbulence likely';
    case 'hazardous': return 'Dangerous winds - delay recommended';
    default: return 'Unknown';
  }
}

// Format TAF period time
export function formatTafTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
}

// Get cloud cover description
export function getCloudCoverDescription(cover: string): string {
  switch (cover) {
    case 'SKC':
    case 'CLR': return 'Clear';
    case 'FEW': return 'Few (1-2 oktas)';
    case 'SCT': return 'Scattered (3-4 oktas)';
    case 'BKN': return 'Broken (5-7 oktas)';
    case 'OVC': return 'Overcast (8 oktas)';
    case 'VV': return 'Vertical Visibility';
    default: return cover;
  }
}

// Calculate distance between coordinates in nautical miles
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between coordinates
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Compass direction from bearing
export function bearingToCompass(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

// Get overall flight category from TAF period
export function getTafPeriodCategory(period: TafPeriod): FlightCategory {
  if (period.fltCat) return period.fltCat;
  
  // Calculate from visibility and clouds
  const visib = period.visib;
  const clouds = period.clouds;
  
  let vis = 10;
  if (visib !== null && visib !== undefined) {
    vis = typeof visib === 'string' ? parseFloat(visib.replace('+', '')) : visib;
  }
  
  let ceiling = 99999;
  if (clouds) {
    const ceilingLayer = clouds.find(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
    if (ceilingLayer) ceiling = ceilingLayer.base;
  }
  
  if (ceiling >= 3000 && vis >= 5) return 'VFR';
  if (ceiling >= 1000 && vis >= 3) return 'MVFR';
  if (ceiling >= 500 && vis >= 1) return 'IFR';
  return 'LIFR';
}
