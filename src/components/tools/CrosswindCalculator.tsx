'use client';

import { useState, useMemo } from 'react';

export default function CrosswindCalculator() {
  const [runwayHeading, setRunwayHeading] = useState(270);
  const [windDirection, setWindDirection] = useState(300);
  const [windSpeed, setWindSpeed] = useState(15);
  const [gustSpeed, setGustSpeed] = useState<number | ''>('');

  const calculations = useMemo(() => {
    // Calculate the angle between wind and runway
    let angleDiff = windDirection - runwayHeading;
    
    // Normalize to -180 to 180
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    const angleRad = Math.abs(angleDiff) * (Math.PI / 180);

    // Crosswind = Wind Speed × sin(angle)
    // Headwind = Wind Speed × cos(angle)
    const crosswind = Math.abs(windSpeed * Math.sin(angleRad));
    const headwindComponent = windSpeed * Math.cos(angleRad);
    
    // Determine if headwind or tailwind
    const isHeadwind = Math.abs(angleDiff) <= 90;
    const headwind = isHeadwind ? headwindComponent : 0;
    const tailwind = isHeadwind ? 0 : Math.abs(headwindComponent);

    // Gust calculations
    let gustCrosswind = 0;
    let gustHeadwind = 0;
    let gustTailwind = 0;
    if (gustSpeed !== '' && gustSpeed > windSpeed) {
      gustCrosswind = Math.abs(gustSpeed * Math.sin(angleRad));
      const gustHeadwindComponent = gustSpeed * Math.cos(angleRad);
      gustHeadwind = isHeadwind ? gustHeadwindComponent : 0;
      gustTailwind = isHeadwind ? 0 : Math.abs(gustHeadwindComponent);
    }

    // Crosswind limit assessment (common limits)
    const limits = {
      student: 7,
      private: 12,
      commercial: 15,
      transport: 20,
    };

    const maxCrosswind = gustSpeed !== '' ? gustCrosswind : crosswind;

    return {
      angleDiff,
      crosswind: Math.round(crosswind * 10) / 10,
      headwind: Math.round(headwind * 10) / 10,
      tailwind: Math.round(tailwind * 10) / 10,
      gustCrosswind: Math.round(gustCrosswind * 10) / 10,
      gustHeadwind: Math.round(gustHeadwind * 10) / 10,
      gustTailwind: Math.round(gustTailwind * 10) / 10,
      isHeadwind,
      windFromLeft: angleDiff > 0,
      limits,
      maxCrosswind,
      exceedsStudent: maxCrosswind > limits.student,
      exceedsPrivate: maxCrosswind > limits.private,
      exceedsCommercial: maxCrosswind > limits.commercial,
    };
  }, [runwayHeading, windDirection, windSpeed, gustSpeed]);

  // Visual runway/wind diagram
  const WindDiagram = () => {
    const size = 200;
    const center = size / 2;
    const runwayLength = 70;
    const windArrowLength = 60;

    // Runway angle (rotated so 0° is up)
    const runwayAngle = (runwayHeading - 90) * (Math.PI / 180);
    
    // Wind arrow angle
    const windAngle = (windDirection - 90) * (Math.PI / 180);

    // Runway endpoints
    const rwyX1 = center + Math.cos(runwayAngle) * runwayLength;
    const rwyY1 = center + Math.sin(runwayAngle) * runwayLength;
    const rwyX2 = center - Math.cos(runwayAngle) * runwayLength;
    const rwyY2 = center - Math.sin(runwayAngle) * runwayLength;

    // Wind arrow (coming FROM direction, so arrow points opposite)
    const windFromAngle = windAngle + Math.PI;
    const windX = center + Math.cos(windFromAngle) * windArrowLength;
    const windY = center + Math.sin(windFromAngle) * windArrowLength;

    return (
      <svg width={size} height={size} className="mx-auto">
        {/* Background circle */}
        <circle cx={center} cy={center} r="90" fill="#1e293b" stroke="#334155" strokeWidth="2" />
        
        {/* Compass marks */}
        {[0, 90, 180, 270].map((deg) => {
          const angle = (deg - 90) * (Math.PI / 180);
          const x1 = center + Math.cos(angle) * 85;
          const y1 = center + Math.sin(angle) * 85;
          const x2 = center + Math.cos(angle) * 90;
          const y2 = center + Math.sin(angle) * 90;
          const labels = ['N', 'E', 'S', 'W'];
          const labelX = center + Math.cos(angle) * 75;
          const labelY = center + Math.sin(angle) * 75;
          return (
            <g key={deg}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="2" />
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="text-xs fill-slate-500">
                {labels[deg / 90]}
              </text>
            </g>
          );
        })}

        {/* Runway */}
        <line 
          x1={rwyX1} y1={rwyY1} 
          x2={rwyX2} y2={rwyY2} 
          stroke="#94a3b8" 
          strokeWidth="12" 
          strokeLinecap="round"
        />
        <line 
          x1={rwyX1} y1={rwyY1} 
          x2={rwyX2} y2={rwyY2} 
          stroke="#475569" 
          strokeWidth="2" 
          strokeDasharray="8 8"
        />

        {/* Runway number */}
        <text 
          x={rwyX1} 
          y={rwyY1} 
          textAnchor="middle" 
          dominantBaseline="middle" 
          className="text-xs fill-white font-bold"
          transform={`rotate(${runwayHeading}, ${rwyX1}, ${rwyY1})`}
        >
          {Math.round(runwayHeading / 10).toString().padStart(2, '0')}
        </text>

        {/* Wind arrow */}
        <defs>
          <marker id="windArrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
          </marker>
        </defs>
        <line 
          x1={center} y1={center}
          x2={windX} y2={windY}
          stroke="#3b82f6" 
          strokeWidth="3"
          markerEnd="url(#windArrow)"
        />
        
        {/* Wind label */}
        <text 
          x={windX} 
          y={windY - 10} 
          textAnchor="middle" 
          className="text-xs fill-blue-400 font-medium"
        >
          {windSpeed}kt
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Runway Heading (°)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={runwayHeading}
              onChange={(e) => setRunwayHeading(Math.max(0, Math.min(360, Number(e.target.value))))}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
              min="0"
              max="360"
            />
            <span className="flex items-center text-slate-400 px-2">
              RWY {Math.round(runwayHeading / 10).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Wind Direction (°)
          </label>
          <input
            type="number"
            value={windDirection}
            onChange={(e) => setWindDirection(Math.max(0, Math.min(360, Number(e.target.value))))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            min="0"
            max="360"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Wind Speed (kt)
          </label>
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(Math.max(0, Number(e.target.value)))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Gust Speed (kt, optional)
          </label>
          <input
            type="number"
            value={gustSpeed}
            onChange={(e) => setGustSpeed(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            min="0"
            placeholder="—"
          />
        </div>
      </div>

      {/* Wind Diagram */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">Wind Diagram</h4>
        <WindDiagram />
        <p className="text-center text-xs text-slate-500 mt-2">
          Wind from {windDirection}° at {windSpeed}kt
          {gustSpeed !== '' && ` gusting ${gustSpeed}kt`}
        </p>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-lg p-4 text-center ${calculations.crosswind > 15 ? 'bg-red-900/30 border border-red-700' : 'bg-slate-800/50'}`}>
          <p className="text-sm text-slate-400 mb-1">Crosswind</p>
          <p className={`text-3xl font-bold ${calculations.crosswind > 15 ? 'text-red-400' : calculations.crosswind > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
            {calculations.crosswind}
          </p>
          <p className="text-xs text-slate-500">
            knots from {calculations.windFromLeft ? 'left' : 'right'}
          </p>
          {gustSpeed !== '' && calculations.gustCrosswind > calculations.crosswind && (
            <p className="text-xs text-orange-400 mt-1">
              G{calculations.gustCrosswind}kt
            </p>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-400 mb-1">
            {calculations.isHeadwind ? 'Headwind' : 'Tailwind'}
          </p>
          <p className={`text-3xl font-bold ${calculations.isHeadwind ? 'text-green-400' : 'text-red-400'}`}>
            {calculations.isHeadwind ? calculations.headwind : calculations.tailwind}
          </p>
          <p className="text-xs text-slate-500">knots</p>
          {gustSpeed !== '' && (
            <p className="text-xs text-orange-400 mt-1">
              G{calculations.isHeadwind ? calculations.gustHeadwind : calculations.gustTailwind}kt
            </p>
          )}
        </div>
      </div>

      {/* Crosswind Limits Reference */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-400 mb-3">Crosswind Limits (Typical)</h4>
        <div className="space-y-2">
          {Object.entries(calculations.limits).map(([level, limit]) => {
            const exceeded = calculations.maxCrosswind > limit;
            return (
              <div key={level} className="flex items-center justify-between">
                <span className="text-sm capitalize text-slate-300">{level}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{limit}kt</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${exceeded ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                    {exceeded ? 'EXCEEDED' : 'OK'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick METAR format helper */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">💡 METAR Wind Format</h4>
        <p className="text-sm text-slate-300">
          <code className="bg-slate-800 px-2 py-1 rounded">{String(windDirection).padStart(3, '0')}{String(windSpeed).padStart(2, '0')}{gustSpeed !== '' ? `G${String(gustSpeed).padStart(2, '0')}` : ''}KT</code>
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Example: 30015G25KT = Wind from 300° at 15kt gusting 25kt
        </p>
      </div>
    </div>
  );
}
