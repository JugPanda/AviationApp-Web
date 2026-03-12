'use client';

import { useState, useMemo, useEffect } from 'react';

// Sun calculation algorithms based on NOAA Solar Calculator
function calcJD(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function calcTimeJulianCent(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

function calcSunEqOfCenter(t: number): number {
  const m = calcGeomMeanAnomalySun(t);
  const mrad = (m * Math.PI) / 180;
  const sinm = Math.sin(mrad);
  const sin2m = Math.sin(2 * mrad);
  const sin3m = Math.sin(3 * mrad);
  return sinm * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin2m * (0.019993 - 0.000101 * t) + sin3m * 0.000289;
}

function calcGeomMeanLongSun(t: number): number {
  let L0 = 280.46646 + t * (36000.76983 + 0.0003032 * t);
  while (L0 > 360) L0 -= 360;
  while (L0 < 0) L0 += 360;
  return L0;
}

function calcGeomMeanAnomalySun(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function calcEccentricityEarthOrbit(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function calcSunTrueLong(t: number): number {
  return calcGeomMeanLongSun(t) + calcSunEqOfCenter(t);
}

function calcSunApparentLong(t: number): number {
  const o = calcSunTrueLong(t);
  const omega = 125.04 - 1934.136 * t;
  return o - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180);
}

function calcMeanObliquityOfEcliptic(t: number): number {
  const seconds = 21.448 - t * (46.8150 + t * (0.00059 - t * 0.001813));
  return 23.0 + (26.0 + seconds / 60.0) / 60.0;
}

function calcObliquityCorrection(t: number): number {
  const e0 = calcMeanObliquityOfEcliptic(t);
  const omega = 125.04 - 1934.136 * t;
  return e0 + 0.00256 * Math.cos((omega * Math.PI) / 180);
}

function calcSunDeclination(t: number): number {
  const e = calcObliquityCorrection(t);
  const lambda = calcSunApparentLong(t);
  const sint = Math.sin((e * Math.PI) / 180) * Math.sin((lambda * Math.PI) / 180);
  return (Math.asin(sint) * 180) / Math.PI;
}

function calcEquationOfTime(t: number): number {
  const epsilon = calcObliquityCorrection(t);
  const l0 = calcGeomMeanLongSun(t);
  const e = calcEccentricityEarthOrbit(t);
  const m = calcGeomMeanAnomalySun(t);
  
  let y = Math.tan(((epsilon / 2) * Math.PI) / 180);
  y *= y;
  
  const sin2l0 = Math.sin((2 * l0 * Math.PI) / 180);
  const sinm = Math.sin((m * Math.PI) / 180);
  const cos2l0 = Math.cos((2 * l0 * Math.PI) / 180);
  const sin4l0 = Math.sin((4 * l0 * Math.PI) / 180);
  const sin2m = Math.sin((2 * m * Math.PI) / 180);
  
  const Etime = y * sin2l0 - 2 * e * sinm + 4 * e * y * sinm * cos2l0 - 0.5 * y * y * sin4l0 - 1.25 * e * e * sin2m;
  return (Etime * 180 * 4) / Math.PI; // in minutes
}

function calcHourAngleSunrise(lat: number, solarDec: number, zenith: number): number {
  const latRad = (lat * Math.PI) / 180;
  const sdRad = (solarDec * Math.PI) / 180;
  const HA = Math.acos(
    Math.cos((zenith * Math.PI) / 180) / (Math.cos(latRad) * Math.cos(sdRad)) - Math.tan(latRad) * Math.tan(sdRad)
  );
  return (HA * 180) / Math.PI; // in degrees
}

interface SunTimesResult {
  official: { rise: string; set: string } | null;
  civil: { rise: string; set: string } | null;
  nautical: { rise: string; set: string } | null;
  astronomical: { rise: string; set: string } | null;
  solarNoon: string;
  dayLength: string | null;
}

function calcSunTimes(year: number, month: number, day: number, lat: number, lon: number, timezone: number): SunTimesResult {
  const jd = calcJD(year, month, day);
  const t = calcTimeJulianCent(jd);
  const eqTime = calcEquationOfTime(t);
  const solarDec = calcSunDeclination(t);
  
  // Calculate for different zenith angles
  const zenithOfficial = 90.833; // 90° 50' - official sunrise/sunset
  const zenithCivil = 96; // Civil twilight
  const zenithNautical = 102; // Nautical twilight
  const zenithAstro = 108; // Astronomical twilight
  
  const calcForZenith = (zenith: number): { rise: string; set: string } | null => {
    try {
      const hourAngle = calcHourAngleSunrise(lat, solarDec, zenith);
      const sunrise = 720 - 4 * (lon + hourAngle) - eqTime + timezone * 60;
      const sunset = 720 - 4 * (lon - hourAngle) - eqTime + timezone * 60;
      return {
        rise: formatMinutes(sunrise),
        set: formatMinutes(sunset)
      };
    } catch {
      return null; // Polar day/night
    }
  };
  
  const official = calcForZenith(zenithOfficial);
  const civil = calcForZenith(zenithCivil);
  const nautical = calcForZenith(zenithNautical);
  const astronomical = calcForZenith(zenithAstro);
  
  return {
    official,
    civil,
    nautical,
    astronomical,
    solarNoon: formatMinutes(720 - 4 * lon - eqTime + timezone * 60),
    dayLength: official ? calculateDayLength(official.rise, official.set) : null
  };
}

function formatMinutes(minutes: number): string {
  let mins = minutes;
  if (mins < 0) mins += 1440;
  if (mins >= 1440) mins -= 1440;
  
  const hours = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  
  return `${hours.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function calculateDayLength(rise: string, set: string): string {
  const [riseH, riseM] = rise.split(':').map(Number);
  const [setH, setM] = set.split(':').map(Number);
  
  let totalMinutes = (setH * 60 + setM) - (riseH * 60 + riseM);
  if (totalMinutes < 0) totalMinutes += 1440;
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours}h ${minutes}m`;
}

export default function SunCalculator() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [latitude, setLatitude] = useState<string>('40.7128');
  const [longitude, setLongitude] = useState<string>('-74.0060');
  const [timezone, setTimezone] = useState<string>('-5');
  const [locationName, setLocationName] = useState<string>('New York, NY');

  // Try to get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toFixed(4));
          setLongitude(position.coords.longitude.toFixed(4));
          setLocationName('Current Location');
          // Estimate timezone from longitude (rough approximation)
          const tz = Math.round(position.coords.longitude / 15);
          setTimezone(tz.toString());
        },
        () => {
          // Keep defaults
        }
      );
    }
  }, []);

  const result = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const lat = parseFloat(latitude) || 0;
    const lon = parseFloat(longitude) || 0;
    const tz = parseFloat(timezone) || 0;
    
    return calcSunTimes(year, month, day, lat, lon, tz);
  }, [date, latitude, longitude, timezone]);

  // Common airport locations
  const presetLocations = [
    { name: 'KJFK (New York)', lat: '40.6413', lon: '-73.7781', tz: '-5' },
    { name: 'KLAX (Los Angeles)', lat: '33.9425', lon: '-118.4081', tz: '-8' },
    { name: 'KORD (Chicago)', lat: '41.9742', lon: '-87.9073', tz: '-6' },
    { name: 'KATL (Atlanta)', lat: '33.6407', lon: '-84.4277', tz: '-5' },
    { name: 'KDFW (Dallas)', lat: '32.8998', lon: '-97.0403', tz: '-6' },
  ];

  const applyPreset = (preset: typeof presetLocations[0]) => {
    setLatitude(preset.lat);
    setLongitude(preset.lon);
    setTimezone(preset.tz);
    setLocationName(preset.name);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Sunrise / Sunset Calculator</h3>
        <p className="text-sm text-slate-400">Calculate sun times and twilight periods for VFR planning</p>
      </div>

      {/* Date Input */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white"
        />
      </div>

      {/* Location Quick Select */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">Quick Select Airport</label>
        <div className="flex flex-wrap gap-2">
          {presetLocations.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
            >
              {preset.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Location */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Latitude</label>
          <input
            type="number"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            step="0.0001"
            placeholder="40.7128"
          />
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Longitude</label>
          <input
            type="number"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            step="0.0001"
            placeholder="-74.0060"
          />
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">UTC Offset (timezone)</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
        >
          {Array.from({ length: 25 }, (_, i) => i - 12).map((tz) => (
            <option key={tz} value={tz}>
              UTC{tz >= 0 ? '+' : ''}{tz}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Main Times */}
          <div className="bg-gradient-to-b from-orange-900/30 via-blue-900/30 to-slate-900/30 border border-slate-700 rounded-lg overflow-hidden">
            {/* Civil Twilight Start */}
            {result.civil && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🌅</span>
                  <span className="text-slate-300 text-sm">Civil Twilight Begins</span>
                </div>
                <span className="text-white font-mono">{result.civil.rise}</span>
              </div>
            )}

            {/* Sunrise */}
            {result.official && (
              <div className="flex items-center justify-between px-4 py-4 bg-orange-900/20 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">☀️</span>
                  <div>
                    <span className="text-white font-medium">Sunrise</span>
                    <p className="text-xs text-slate-400">Official</p>
                  </div>
                </div>
                <span className="text-2xl text-white font-mono font-bold">{result.official.rise}</span>
              </div>
            )}

            {/* Solar Noon */}
            <div className="flex items-center justify-between px-4 py-3 bg-yellow-900/10 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400">🌞</span>
                <span className="text-slate-300 text-sm">Solar Noon</span>
              </div>
              <span className="text-white font-mono">{result.solarNoon}</span>
            </div>

            {/* Sunset */}
            {result.official && (
              <div className="flex items-center justify-between px-4 py-4 bg-orange-900/20 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌅</span>
                  <div>
                    <span className="text-white font-medium">Sunset</span>
                    <p className="text-xs text-slate-400">Official</p>
                  </div>
                </div>
                <span className="text-2xl text-white font-mono font-bold">{result.official.set}</span>
              </div>
            )}

            {/* Civil Twilight End */}
            {result.civil && (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400">🌃</span>
                  <span className="text-slate-300 text-sm">Civil Twilight Ends</span>
                </div>
                <span className="text-white font-mono">{result.civil.set}</span>
              </div>
            )}
          </div>

          {/* Day Length */}
          {result.dayLength && (
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-sm">Day Length</p>
              <p className="text-2xl font-bold text-white">{result.dayLength}</p>
            </div>
          )}

          {/* VFR Night Definition */}
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
            <h4 className="text-amber-400 font-medium mb-2">📋 FAR 1.1 Night Definition</h4>
            <p className="text-sm text-slate-300">
              Night means the time between the end of evening civil twilight and the beginning of morning civil twilight.
            </p>
            {result.civil && (
              <p className="text-sm text-white mt-2">
                <strong>Night:</strong> {result.civil.set} to {result.civil.rise} (next day)
              </p>
            )}
          </div>

          {/* Currency Reminder */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <h4 className="text-blue-400 font-medium mb-2">🌙 Night Currency (91.57)</h4>
            <p className="text-sm text-slate-300">
              Night landings for currency: 1 hour after sunset to 1 hour before sunrise
            </p>
            {result.official && (
              <p className="text-sm text-white mt-2">
                <strong>Currency period:</strong> After {addHour(result.official.set)} until {subtractHour(result.official.rise)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reference */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-4">
        <p>Civil twilight: Sun 6° below horizon</p>
        <p>Times shown in local time (UTC{parseInt(timezone) >= 0 ? '+' : ''}{timezone})</p>
      </div>
    </div>
  );
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  let newH = h + 1;
  if (newH >= 24) newH -= 24;
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function subtractHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  let newH = h - 1;
  if (newH < 0) newH += 24;
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
