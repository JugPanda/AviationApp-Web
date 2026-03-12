'use client';

import { useState, useMemo } from 'react';

export default function WindCalculator() {
  const [trueCourse, setTrueCourse] = useState<string>('360');
  const [trueAirspeed, setTrueAirspeed] = useState<string>('120');
  const [windDirection, setWindDirection] = useState<string>('270');
  const [windSpeed, setWindSpeed] = useState<string>('15');

  const result = useMemo(() => {
    const tc = parseFloat(trueCourse) || 0;
    const tas = parseFloat(trueAirspeed) || 0;
    const wd = parseFloat(windDirection) || 0;
    const ws = parseFloat(windSpeed) || 0;

    if (tas <= 0) return null;

    // Convert to radians
    const tcRad = (tc * Math.PI) / 180;
    const wdRad = (wd * Math.PI) / 180;

    // Wind components relative to course
    // Wind is "from" direction, so we need to reverse it
    const windFromRad = wdRad;
    
    // Calculate wind correction angle
    // sin(WCA) = (Wind Speed * sin(Wind Direction - True Course)) / TAS
    const angleFromCourse = windFromRad - tcRad;
    const crosswindComponent = ws * Math.sin(angleFromCourse);
    const headwindComponent = ws * Math.cos(angleFromCourse);

    const wcaRad = Math.asin(Math.max(-1, Math.min(1, crosswindComponent / tas)));
    const wca = (wcaRad * 180) / Math.PI;

    // True heading = True Course + WCA
    let th = tc + wca;
    if (th < 0) th += 360;
    if (th >= 360) th -= 360;

    // Ground speed calculation
    // GS = TAS * cos(WCA) - headwind component
    const gs = tas * Math.cos(wcaRad) - headwindComponent;

    return {
      trueHeading: th,
      windCorrectionAngle: wca,
      groundSpeed: Math.max(0, gs),
      crosswindComponent: Math.abs(crosswindComponent),
      crosswindDirection: crosswindComponent > 0 ? 'left' : 'right',
      headwindComponent: headwindComponent,
      isHeadwind: headwindComponent > 0
    };
  }, [trueCourse, trueAirspeed, windDirection, windSpeed]);

  // Wind triangle SVG visualization
  const WindTriangle = () => {
    if (!result) return null;

    const centerX = 150;
    const centerY = 120;
    const scale = 0.8;
    const tas = parseFloat(trueAirspeed) || 100;
    const ws = parseFloat(windSpeed) || 15;
    const tc = parseFloat(trueCourse) || 0;
    const wd = parseFloat(windDirection) || 0;

    // Normalize for display
    const maxLen = 80;
    const tasLen = maxLen;
    const wsLen = (ws / tas) * maxLen * 2;
    const gsLen = (result.groundSpeed / tas) * maxLen;

    // Convert angles (0° = up, clockwise positive)
    const tcAngle = ((tc - 90) * Math.PI) / 180;
    const thAngle = ((result.trueHeading - 90) * Math.PI) / 180;
    const wdAngle = ((wd + 180 - 90) * Math.PI) / 180; // Wind TO direction

    // Course line (where we want to go)
    const courseEndX = centerX + Math.cos(tcAngle) * gsLen * scale;
    const courseEndY = centerY + Math.sin(tcAngle) * gsLen * scale;

    // Heading line (where we point)
    const headingEndX = centerX + Math.cos(thAngle) * tasLen * scale;
    const headingEndY = centerY + Math.sin(thAngle) * tasLen * scale;

    // Wind line (from course end back to heading end)
    const windStartX = courseEndX;
    const windStartY = courseEndY;

    return (
      <svg viewBox="0 0 300 240" className="w-full max-w-xs mx-auto">
        {/* Background */}
        <circle cx={centerX} cy={centerY} r="100" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        
        {/* Compass rose */}
        <text x={centerX} y="25" textAnchor="middle" className="text-xs fill-slate-500">N</text>
        <text x={centerX} y="220" textAnchor="middle" className="text-xs fill-slate-500">S</text>
        <text x="55" y={centerY + 4} textAnchor="middle" className="text-xs fill-slate-500">W</text>
        <text x="245" y={centerY + 4} textAnchor="middle" className="text-xs fill-slate-500">E</text>

        {/* Course line (green - ground track) */}
        <line
          x1={centerX}
          y1={centerY}
          x2={courseEndX}
          y2={courseEndY}
          stroke="#22c55e"
          strokeWidth="3"
          markerEnd="url(#arrowGreen)"
        />

        {/* Heading line (blue - where we point) */}
        <line
          x1={centerX}
          y1={centerY}
          x2={headingEndX}
          y2={headingEndY}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="6,3"
          markerEnd="url(#arrowBlue)"
        />

        {/* Wind line (red - from course to heading) */}
        <line
          x1={windStartX}
          y1={windStartY}
          x2={headingEndX}
          y2={headingEndY}
          stroke="#ef4444"
          strokeWidth="2"
          markerEnd="url(#arrowRed)"
        />

        {/* Arrow markers */}
        <defs>
          <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
          </marker>
          <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
          </marker>
          <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
          </marker>
        </defs>

        {/* Legend */}
        <g transform="translate(10, 200)">
          <line x1="0" y1="0" x2="20" y2="0" stroke="#22c55e" strokeWidth="2" />
          <text x="25" y="4" className="text-[10px] fill-slate-400">Course/GS</text>
          <line x1="80" y1="0" x2="100" y2="0" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,2" />
          <text x="105" y="4" className="text-[10px] fill-slate-400">Heading/TAS</text>
          <line x1="180" y1="0" x2="200" y2="0" stroke="#ef4444" strokeWidth="2" />
          <text x="205" y="4" className="text-[10px] fill-slate-400">Wind</text>
        </g>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Wind Calculator</h3>
        <p className="text-sm text-slate-400">Calculate heading and ground speed with wind correction</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">True Course (°)</label>
          <input
            type="number"
            value={trueCourse}
            onChange={(e) => setTrueCourse(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="360"
            min="0"
            max="360"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">True Airspeed (kts)</label>
          <input
            type="number"
            value={trueAirspeed}
            onChange={(e) => setTrueAirspeed(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="120"
            min="0"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Wind From (°)</label>
          <input
            type="number"
            value={windDirection}
            onChange={(e) => setWindDirection(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="270"
            min="0"
            max="360"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Wind Speed (kts)</label>
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="15"
            min="0"
          />
        </div>
      </div>

      {/* Wind Triangle Visualization */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">Wind Triangle</h4>
        <WindTriangle />
      </div>

      {/* Results */}
      {result && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{result.trueHeading.toFixed(0)}°</p>
              <p className="text-slate-400 text-sm">True Heading</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{result.groundSpeed.toFixed(0)} kts</p>
              <p className="text-slate-400 text-sm">Ground Speed</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700">
            <div className="text-center">
              <p className={`text-lg font-bold ${result.windCorrectionAngle >= 0 ? 'text-amber-400' : 'text-amber-400'}`}>
                {result.windCorrectionAngle >= 0 ? '+' : ''}{result.windCorrectionAngle.toFixed(1)}°
              </p>
              <p className="text-slate-400 text-xs">WCA ({result.windCorrectionAngle >= 0 ? 'R' : 'L'})</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${result.isHeadwind ? 'text-red-400' : 'text-green-400'}`}>
                {result.headwindComponent.toFixed(0)} kts
              </p>
              <p className="text-slate-400 text-xs">{result.isHeadwind ? 'Headwind' : 'Tailwind'}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-400">
                {result.crosswindComponent.toFixed(0)} kts
              </p>
              <p className="text-slate-400 text-xs">Crosswind</p>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-4">
        <p>Wind from left → correct right (positive WCA)</p>
        <p>Wind from right → correct left (negative WCA)</p>
      </div>
    </div>
  );
}
