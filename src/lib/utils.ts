import { FlightCategory } from '@/types';

export function getFlightCategoryColor(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return '#22c55e'; // green
    case 'MVFR':
      return '#3b82f6'; // blue
    case 'IFR':
      return '#ef4444'; // red
    case 'LIFR':
      return '#a855f7'; // purple
    default:
      return '#6b7280'; // gray
  }
}

export function getFlightCategoryClass(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return 'bg-vfr';
    case 'MVFR':
      return 'bg-mvfr';
    case 'IFR':
      return 'bg-ifr';
    case 'LIFR':
      return 'bg-lifr';
    default:
      return 'bg-gray-500';
  }
}

export function getFlightCategoryTextClass(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return 'text-green-400';
    case 'MVFR':
      return 'text-blue-400';
    case 'IFR':
      return 'text-red-400';
    case 'LIFR':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
}

export function formatVisibility(visib: string | number): string {
  if (typeof visib === 'string') {
    return visib.replace('+', '+ ') + ' SM';
  }
  return visib + ' SM';
}

export function formatWind(wdir: number | null, wspd: number | null, wgst: number | null): string {
  if (wdir === null || wspd === null) return 'Calm';
  if (wspd === 0) return 'Calm';
  
  const dir = wdir.toString().padStart(3, '0');
  let wind = `${dir}° @ ${wspd} kt`;
  if (wgst) {
    wind += ` G${wgst}`;
  }
  return wind;
}

export function formatTemperature(temp: number | null): string {
  if (temp === null) return '--';
  return `${Math.round(temp)}°C`;
}

export function formatAltimeter(altim: number | null): string {
  if (altim === null) return '--';
  // Convert hPa to inHg if needed
  const inHg = altim > 100 ? (altim * 0.02953).toFixed(2) : altim.toFixed(2);
  return `${inHg}"`;
}

export function formatObsTime(obsTime: number): string {
  const date = new Date(obsTime * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
