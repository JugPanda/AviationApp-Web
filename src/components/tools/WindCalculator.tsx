'use client';

import { useState, useMemo } from 'react';
import { solveWindTriangle } from '@/lib/wind-triangle';

export default function WindCalculator() {
  const [trueCourse, setTrueCourse] = useState<string>('360');
  const [trueAirspeed, setTrueAirspeed] = useState<string>('120');
  const [windDirection, setWindDirection] = useState<string>('270');
  const [windSpeed, setWindSpeed] = useState<string>('15');

  const solution = useMemo(() => solveWindTriangle(
    parseFloat(trueCourse), parseFloat(trueAirspeed), parseFloat(windDirection), parseFloat(windSpeed),
  ), [trueCourse, trueAirspeed, windDirection, windSpeed]);
  const result = solution.ok ? solution : null;

  // Wind triangle SVG visualization
  const renderWindTriangle = () => {
    if (!result) return null;

    const centerX = 150;
    const centerY = 120;
    const scale = 0.8;
    const tas = parseFloat(trueAirspeed) || 100;

    // Normalize for display
    const maxLen = 80;
    const tasLen = maxLen;
    const gsLen = (result.groundSpeed / tas) * maxLen;

    // Convert angles (0° = up, clockwise positive)
    const tcAngle = ((parseFloat(trueCourse) - 90) * Math.PI) / 180;
    const thAngle = ((result.trueHeading - 90) * Math.PI) / 180;

    // Course line (where we want to go)
    const courseEndX = centerX + Math.cos(tcAngle) * gsLen * scale;
    const courseEndY = centerY + Math.sin(tcAngle) * gsLen * scale;

    // Heading line (where we point)
    const headingEndX = centerX + Math.cos(thAngle) * tasLen * scale;
    const headingEndY = centerY + Math.sin(thAngle) * tasLen * scale;

    // Heading/TAS + wind TO vector = course/GS vector.
    const windStartX = headingEndX;
    const windStartY = headingEndY;

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

        {/* Wind line (red - from heading to course) */}
        <line
          x1={windStartX}
          y1={windStartY}
          x2={courseEndX}
          y2={courseEndY}
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
      {/* Inputs */}
      <div className="av-tools-inputs grid grid-cols-2 gap-4">
        <h3 className="av-tools-section-title">Inputs</h3>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label htmlFor="av-tools-windcalculator-0" className="block text-sm font-medium text-slate-400 mb-2">True Course (°)</label>
          <input id="av-tools-windcalculator-0"
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
          <label htmlFor="av-tools-windcalculator-1" className="block text-sm font-medium text-slate-400 mb-2">True Airspeed (kts)</label>
          <input id="av-tools-windcalculator-1"
            type="number"
            value={trueAirspeed}
            onChange={(e) => setTrueAirspeed(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="120"
            min="0"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <label htmlFor="av-tools-windcalculator-2" className="block text-sm font-medium text-slate-400 mb-2">Wind From (°)</label>
          <input id="av-tools-windcalculator-2"
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
          <label htmlFor="av-tools-windcalculator-3" className="block text-sm font-medium text-slate-400 mb-2">Wind Speed (kts)</label>
          <input id="av-tools-windcalculator-3"
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
        {renderWindTriangle()}
      </div>

      {/* Results */}
      {!solution.ok && <p role="alert" className="bg-amber-900/30 border border-amber-700 rounded-lg p-4">{solution.error} Heading and groundspeed withheld.</p>}
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
        <p>Wind from left → correct left (negative WCA)</p>
        <p>Wind from right → correct right (positive WCA)</p>
      </div>
    </div>
  );
}
