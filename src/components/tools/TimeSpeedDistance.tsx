'use client';

import { useState, useMemo } from 'react';

type SolveFor = 'time' | 'speed' | 'distance';
type DistanceUnit = 'nm' | 'sm' | 'km';
type SpeedUnit = 'knots' | 'mph' | 'kmh';

const DISTANCE_CONVERSIONS: Record<DistanceUnit, number> = {
  nm: 1,
  sm: 1.15078,
  km: 1.852
};

const SPEED_CONVERSIONS: Record<SpeedUnit, number> = {
  knots: 1,
  mph: 1.15078,
  kmh: 1.852
};

export default function TimeSpeedDistance() {
  const [solveFor, setSolveFor] = useState<SolveFor>('time');
  const [distance, setDistance] = useState<string>('100');
  const [speed, setSpeed] = useState<string>('120');
  const [hours, setHours] = useState<string>('0');
  const [minutes, setMinutes] = useState<string>('50');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('nm');
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('knots');

  const result = useMemo(() => {
    const d = parseFloat(distance) || 0;
    const s = parseFloat(speed) || 0;
    const h = parseFloat(hours) || 0;
    const m = parseFloat(minutes) || 0;
    const totalTimeHours = h + m / 60;

    // Convert to nautical miles and knots for calculation
    const distNm = d / DISTANCE_CONVERSIONS[distanceUnit];
    const speedKts = s / SPEED_CONVERSIONS[speedUnit];

    switch (solveFor) {
      case 'time': {
        if (speedKts <= 0) return null;
        const timeHours = distNm / speedKts;
        const resultHours = Math.floor(timeHours);
        const resultMinutes = Math.round((timeHours - resultHours) * 60);
        return {
          type: 'time',
          hours: resultHours,
          minutes: resultMinutes,
          totalMinutes: Math.round(timeHours * 60)
        };
      }
      case 'speed': {
        if (totalTimeHours <= 0) return null;
        const speedResult = distNm / totalTimeHours;
        return {
          type: 'speed',
          knots: speedResult,
          mph: speedResult * SPEED_CONVERSIONS.mph,
          kmh: speedResult * SPEED_CONVERSIONS.kmh
        };
      }
      case 'distance': {
        const distResult = speedKts * totalTimeHours;
        return {
          type: 'distance',
          nm: distResult,
          sm: distResult * DISTANCE_CONVERSIONS.sm,
          km: distResult * DISTANCE_CONVERSIONS.km
        };
      }
    }
  }, [solveFor, distance, speed, hours, minutes, distanceUnit, speedUnit]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Time / Speed / Distance</h3>
        <p className="text-sm text-slate-400">Calculate any value given the other two</p>
      </div>

      {/* Solve For Selection */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-3">Solve For</label>
        <div className="grid grid-cols-3 gap-2">
          {(['time', 'speed', 'distance'] as SolveFor[]).map((option) => (
            <button
              key={option}
              onClick={() => setSolveFor(option)}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                solveFor === option
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        {/* Distance Input */}
        {solveFor !== 'distance' && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Distance</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
                placeholder="0"
                min="0"
              />
              <select
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value as DistanceUnit)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white"
              >
                <option value="nm">NM</option>
                <option value="sm">SM</option>
                <option value="km">KM</option>
              </select>
            </div>
          </div>
        )}

        {/* Speed Input */}
        {solveFor !== 'speed' && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Speed</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
                placeholder="0"
                min="0"
              />
              <select
                value={speedUnit}
                onChange={(e) => setSpeedUnit(e.target.value as SpeedUnit)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white"
              >
                <option value="knots">KTS</option>
                <option value="mph">MPH</option>
                <option value="kmh">KM/H</option>
              </select>
            </div>
          </div>
        )}

        {/* Time Input */}
        {solveFor !== 'time' && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Time</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white text-lg text-center"
                placeholder="0"
                min="0"
              />
              <span className="text-slate-400">hrs</span>
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white text-lg text-center"
                placeholder="0"
                min="0"
                max="59"
              />
              <span className="text-slate-400">min</span>
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-400 mb-3 text-center">Result</h4>
          
          {result.type === 'time' && (
            <div className="text-center">
              <p className="text-3xl font-bold text-white">
                {(result as { hours: number }).hours}:{(result as { minutes: number }).minutes.toString().padStart(2, '0')}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {(result as { totalMinutes: number }).totalMinutes} total minutes
              </p>
            </div>
          )}

          {result.type === 'speed' && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{(result as { knots: number }).knots.toFixed(1)}</p>
                <p className="text-slate-400 text-sm">knots</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{(result as { mph: number }).mph.toFixed(1)}</p>
                <p className="text-slate-400 text-sm">mph</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{(result as { kmh: number }).kmh.toFixed(1)}</p>
                <p className="text-slate-400 text-sm">km/h</p>
              </div>
            </div>
          )}

          {result.type === 'distance' && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{(result as { nm: number }).nm.toFixed(1)}</p>
                <p className="text-slate-400 text-sm">nm</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{(result as { sm: number }).sm.toFixed(1)}</p>
                <p className="text-slate-400 text-sm">sm</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{(result as { km: number }).km.toFixed(1)}</p>
                <p className="text-slate-400 text-sm">km</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formula Reference */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-4">
        <p>Distance = Speed × Time</p>
        <p>1 NM = 1.15 SM = 1.852 KM</p>
      </div>
    </div>
  );
}
