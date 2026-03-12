'use client';

import { useState, useMemo } from 'react';

type HoldingDirection = 'right' | 'left';
type EntryType = 'direct' | 'teardrop' | 'parallel';

export default function HoldingPattern() {
  const [inboundCourse, setInboundCourse] = useState<string>('360');
  const [aircraftHeading, setAircraftHeading] = useState<string>('180');
  const [holdingDirection, setHoldingDirection] = useState<HoldingDirection>('right');
  const [legTime, setLegTime] = useState<string>('1');
  const [tas, setTas] = useState<string>('120');
  const [windDirection, setWindDirection] = useState<string>('270');
  const [windSpeed, setWindSpeed] = useState<string>('20');

  const result = useMemo(() => {
    const inbound = parseFloat(inboundCourse) || 0;
    const heading = parseFloat(aircraftHeading) || 0;
    const isRight = holdingDirection === 'right';
    
    // Calculate relative bearing to the fix
    // The entry depends on the angle between aircraft heading and inbound course
    let relativeBearing = heading - inbound;
    if (relativeBearing < 0) relativeBearing += 360;
    if (relativeBearing >= 360) relativeBearing -= 360;

    // Determine entry type based on relative bearing
    // For right-hand holds:
    // - Direct: 0° to 110° (from the holding side)
    // - Teardrop: 110° to 180°
    // - Parallel: 180° to 360° (or 0°)
    
    // For left-hand holds, the sectors are mirrored
    
    let entryType: EntryType;
    let entryDescription: string;
    
    if (isRight) {
      // Right-hand hold
      if (relativeBearing >= 0 && relativeBearing < 70) {
        entryType = 'direct';
        entryDescription = 'Turn right to the outbound heading and fly the hold';
      } else if (relativeBearing >= 70 && relativeBearing < 110) {
        // Could be direct or teardrop - pilot's choice
        entryType = 'direct'; // Default to direct in the overlap zone
        entryDescription = 'Direct entry preferred (teardrop also acceptable)';
      } else if (relativeBearing >= 110 && relativeBearing < 180) {
        entryType = 'teardrop';
        entryDescription = `Turn to ${normalizeHeading(inbound + 150)}°, fly 1 min, then turn right to intercept inbound`;
      } else if (relativeBearing >= 180 && relativeBearing < 250) {
        entryType = 'parallel';
        entryDescription = `Turn left to ${normalizeHeading(inbound + 180)}°, fly 1 min, then turn left 225° to intercept inbound`;
      } else if (relativeBearing >= 250 && relativeBearing < 290) {
        // Could be parallel or direct - pilot's choice
        entryType = 'parallel';
        entryDescription = 'Parallel entry preferred (direct also acceptable)';
      } else {
        entryType = 'direct';
        entryDescription = 'Turn right to the outbound heading and fly the hold';
      }
    } else {
      // Left-hand hold - mirror the sectors
      if (relativeBearing >= 290 || relativeBearing < 70) {
        entryType = 'direct';
        entryDescription = 'Turn left to the outbound heading and fly the hold';
      } else if (relativeBearing >= 70 && relativeBearing < 110) {
        // Could be parallel or direct
        entryType = 'parallel';
        entryDescription = 'Parallel entry preferred (direct also acceptable)';
      } else if (relativeBearing >= 110 && relativeBearing < 180) {
        entryType = 'parallel';
        entryDescription = `Turn right to ${normalizeHeading(inbound + 180)}°, fly 1 min, then turn right 225° to intercept inbound`;
      } else if (relativeBearing >= 180 && relativeBearing < 250) {
        entryType = 'teardrop';
        entryDescription = `Turn to ${normalizeHeading(inbound - 150)}°, fly 1 min, then turn left to intercept inbound`;
      } else {
        entryType = 'direct';
        entryDescription = 'Turn left to the outbound heading and fly the hold';
      }
    }

    // Calculate outbound heading
    const outboundHeading = normalizeHeading(inbound + 180);

    // Wind correction (simplified)
    const ws = parseFloat(windSpeed) || 0;
    const wd = parseFloat(windDirection) || 0;
    const tasVal = parseFloat(tas) || 120;
    
    // Calculate wind correction angle for inbound leg
    const inboundRad = (inbound * Math.PI) / 180;
    const windRad = (wd * Math.PI) / 180;
    const crosswind = ws * Math.sin(windRad - inboundRad);
    const wca = Math.asin(Math.min(1, Math.max(-1, crosswind / tasVal))) * (180 / Math.PI);
    
    // Triple the WCA for outbound leg (common rule of thumb)
    const outboundWCA = wca * 3;
    
    // Adjusted headings
    const inboundHeading = normalizeHeading(inbound + wca);
    const outboundHeadingCorrected = normalizeHeading(outboundHeading - outboundWCA);

    return {
      entryType,
      entryDescription,
      relativeBearing: Math.round(relativeBearing),
      outboundHeading,
      inboundCourse: inbound,
      wca: Math.round(wca),
      outboundWCA: Math.round(outboundWCA),
      inboundHeading: Math.round(inboundHeading),
      outboundHeadingCorrected: Math.round(outboundHeadingCorrected)
    };
  }, [inboundCourse, aircraftHeading, holdingDirection, tas, windDirection, windSpeed]);

  // Holding pattern visualization
  const HoldingDiagram = () => {
    const inbound = parseFloat(inboundCourse) || 0;
    const isRight = holdingDirection === 'right';
    
    const centerX = 150;
    const centerY = 150;
    const legLength = 60;
    const turnRadius = 25;
    
    // Calculate positions based on inbound course
    // Rotate everything so inbound is from bottom
    const rotation = inbound - 180; // Rotate so inbound comes from bottom
    
    // Fix position (where we hold)
    const fixX = centerX;
    const fixY = centerY + 20;
    
    // Create path for holding pattern
    // Standard right-hand hold: inbound from bottom, outbound to top, turn right
    const outboundEnd = {
      x: fixX,
      y: fixY - legLength
    };
    
    // For SVG arc: right turn = clockwise = sweep-flag 1
    // Turn positions
    const turn1Center = {
      x: fixX + (isRight ? turnRadius : -turnRadius),
      y: fixY - legLength
    };
    const turn2Center = {
      x: fixX + (isRight ? turnRadius : -turnRadius),
      y: fixY
    };
    
    const sweepFlag = isRight ? 1 : 0;
    const turn1End = {
      x: fixX + (isRight ? turnRadius * 2 : -turnRadius * 2),
      y: fixY - legLength
    };
    const abeamPoint = {
      x: fixX + (isRight ? turnRadius * 2 : -turnRadius * 2),
      y: fixY
    };

    return (
      <svg viewBox="0 0 300 300" className="w-full max-w-xs mx-auto">
        {/* Background compass rose */}
        <circle cx={centerX} cy={centerY} r="120" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        
        {/* Transform group for rotation */}
        <g transform={`rotate(${rotation}, ${centerX}, ${centerY})`}>
          {/* Inbound leg */}
          <line
            x1={fixX}
            y1={fixY + legLength}
            x2={fixX}
            y2={fixY}
            stroke="#22c55e"
            strokeWidth="3"
            markerEnd="url(#arrowGreen)"
          />
          
          {/* Outbound leg */}
          <line
            x1={fixX}
            y1={fixY}
            x2={outboundEnd.x}
            y2={outboundEnd.y}
            stroke="#3b82f6"
            strokeWidth="2"
          />
          
          {/* Turn at outbound end */}
          <path
            d={`M ${outboundEnd.x},${outboundEnd.y} A ${turnRadius},${turnRadius} 0 0,${sweepFlag} ${turn1End.x},${turn1End.y}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          
          {/* Abeam leg */}
          <line
            x1={turn1End.x}
            y1={turn1End.y}
            x2={abeamPoint.x}
            y2={abeamPoint.y}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4,2"
          />
          
          {/* Turn back to inbound */}
          <path
            d={`M ${abeamPoint.x},${abeamPoint.y} A ${turnRadius},${turnRadius} 0 0,${sweepFlag} ${fixX},${fixY}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          
          {/* Fix point */}
          <circle cx={fixX} cy={fixY} r="5" fill="white" stroke="#22c55e" strokeWidth="2" />
          
          {/* Labels (counter-rotate so they're readable) */}
          <g transform={`rotate(${-rotation}, ${fixX}, ${fixY - 30})`}>
            <text x={fixX} y={fixY - 30} textAnchor="middle" className="text-xs fill-slate-400">OUTBOUND</text>
          </g>
          <g transform={`rotate(${-rotation}, ${fixX}, ${fixY + legLength + 15})`}>
            <text x={fixX} y={fixY + legLength + 15} textAnchor="middle" className="text-xs fill-green-400">INBOUND</text>
          </g>
        </g>
        
        {/* North indicator (fixed) */}
        <text x={centerX} y="25" textAnchor="middle" className="text-xs fill-slate-500">N</text>
        <text x={centerX} y="285" textAnchor="middle" className="text-xs fill-slate-500">S</text>
        <text x="25" y={centerY + 4} textAnchor="middle" className="text-xs fill-slate-500">W</text>
        <text x="275" y={centerY + 4} textAnchor="middle" className="text-xs fill-slate-500">E</text>
        
        {/* Inbound course label */}
        <text x={centerX} y="15" textAnchor="middle" className="text-xs fill-slate-300">
          Inbound: {inboundCourse}°
        </text>
        
        {/* Arrow markers */}
        <defs>
          <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
          </marker>
        </defs>
      </svg>
    );
  };

  // Entry visualization
  const EntryDiagram = () => {
    const { entryType } = result;
    const inbound = parseFloat(inboundCourse) || 0;
    const heading = parseFloat(aircraftHeading) || 0;
    const isRight = holdingDirection === 'right';
    
    const centerX = 100;
    const centerY = 100;
    const fixX = centerX;
    const fixY = centerY;
    
    // Aircraft approach vector
    const approachAngle = ((heading + 180) * Math.PI) / 180;
    const approachLen = 50;
    const aircraftX = fixX + Math.sin(approachAngle) * approachLen;
    const aircraftY = fixY - Math.cos(approachAngle) * approachLen;

    return (
      <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto">
        {/* Entry sectors */}
        <g transform={`rotate(${inbound}, ${fixX}, ${fixY})`}>
          {/* Direct sector (green) */}
          <path
            d={`M ${fixX},${fixY} L ${fixX + 70},${fixY} A 70,70 0 0,0 ${fixX + 70 * Math.cos((70 * Math.PI) / 180)},${fixY - 70 * Math.sin((70 * Math.PI) / 180)} Z`}
            fill="rgba(34, 197, 94, 0.2)"
            stroke="#22c55e"
            strokeWidth="1"
            transform={isRight ? '' : `scale(-1, 1) translate(${-2 * fixX}, 0)`}
          />
          
          {/* Teardrop sector (yellow) */}
          <path
            d={`M ${fixX},${fixY} L ${fixX + 70 * Math.cos((70 * Math.PI) / 180)},${fixY - 70 * Math.sin((70 * Math.PI) / 180)} A 70,70 0 0,0 ${fixX},${fixY - 70} Z`}
            fill="rgba(234, 179, 8, 0.2)"
            stroke="#eab308"
            strokeWidth="1"
            transform={isRight ? '' : `scale(-1, 1) translate(${-2 * fixX}, 0)`}
          />
          
          {/* Parallel sector (blue) */}
          <path
            d={`M ${fixX},${fixY} L ${fixX},${fixY - 70} A 70,70 0 0,0 ${fixX - 70},${fixY} Z`}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#3b82f6"
            strokeWidth="1"
            transform={isRight ? '' : `scale(-1, 1) translate(${-2 * fixX}, 0)`}
          />
          
          {/* Inbound course line */}
          <line x1={fixX} y1={fixY + 60} x2={fixX} y2={fixY} stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrowG)" />
        </g>
        
        {/* Aircraft position */}
        <circle cx={aircraftX} cy={aircraftY} r="4" fill="white" stroke="#f59e0b" strokeWidth="2" />
        <line x1={aircraftX} y1={aircraftY} x2={fixX} y2={fixY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" />
        
        {/* Fix */}
        <circle cx={fixX} cy={fixY} r="5" fill="white" stroke="white" strokeWidth="2" />
        
        {/* Entry type label */}
        <text x={fixX} y="190" textAnchor="middle" className={`text-sm font-bold ${
          entryType === 'direct' ? 'fill-green-400' :
          entryType === 'teardrop' ? 'fill-yellow-400' :
          'fill-blue-400'
        }`}>
          {entryType.toUpperCase()}
        </text>
        
        <defs>
          <marker id="arrowG" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#22c55e" />
          </marker>
        </defs>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Holding Pattern Calculator</h3>
        <p className="text-sm text-slate-400">Determine entry type and wind corrections</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Inbound Course (°)</label>
          <input
            type="number"
            value={inboundCourse}
            onChange={(e) => setInboundCourse(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            min="0"
            max="360"
          />
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Your Heading (°)</label>
          <input
            type="number"
            value={aircraftHeading}
            onChange={(e) => setAircraftHeading(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            min="0"
            max="360"
          />
        </div>
      </div>

      {/* Hold Direction */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-2">Hold Direction</label>
        <div className="flex gap-2">
          <button
            onClick={() => setHoldingDirection('right')}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              holdingDirection === 'right' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            ↻ Standard (Right)
          </button>
          <button
            onClick={() => setHoldingDirection('left')}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              holdingDirection === 'left' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            ↺ Non-Standard (Left)
          </button>
        </div>
      </div>

      {/* Entry Result */}
      {result && (
        <div className={`rounded-lg p-4 border ${
          result.entryType === 'direct' ? 'bg-green-900/20 border-green-700' :
          result.entryType === 'teardrop' ? 'bg-amber-900/20 border-amber-700' :
          'bg-blue-900/20 border-blue-700'
        }`}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className={`text-2xl font-bold ${
                result.entryType === 'direct' ? 'text-green-400' :
                result.entryType === 'teardrop' ? 'text-amber-400' :
                'text-blue-400'
              }`}>
                {result.entryType.charAt(0).toUpperCase() + result.entryType.slice(1)} Entry
              </p>
              <p className="text-sm text-slate-300 mt-1">{result.entryDescription}</p>
            </div>
            <EntryDiagram />
          </div>
        </div>
      )}

      {/* Holding Pattern Diagram */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">Holding Pattern</h4>
        <HoldingDiagram />
        <div className="grid grid-cols-2 gap-4 mt-4 text-center text-sm">
          <div>
            <p className="text-slate-400">Outbound Heading</p>
            <p className="text-xl font-bold text-white">{result.outboundHeading}°</p>
          </div>
          <div>
            <p className="text-slate-400">Inbound Course</p>
            <p className="text-xl font-bold text-green-400">{result.inboundCourse}°</p>
          </div>
        </div>
      </div>

      {/* Wind Correction */}
      <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-medium text-slate-400">Wind Correction</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Wind From (°)</label>
            <input
              type="number"
              value={windDirection}
              onChange={(e) => setWindDirection(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
              max="360"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Wind Speed (kts)</label>
            <input
              type="number"
              value={windSpeed}
              onChange={(e) => setWindSpeed(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">TAS (kts)</label>
            <input
              type="number"
              value={tas}
              onChange={(e) => setTas(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              min="0"
            />
          </div>
        </div>
        
        {result.wca !== 0 && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
            <div className="text-center">
              <p className="text-slate-400 text-sm">Inbound Heading</p>
              <p className="text-xl font-bold text-white">{result.inboundHeading}°</p>
              <p className="text-xs text-slate-500">WCA: {result.wca > 0 ? '+' : ''}{result.wca}°</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">Outbound Heading</p>
              <p className="text-xl font-bold text-white">{result.outboundHeadingCorrected}°</p>
              <p className="text-xs text-slate-500">WCA: {-result.outboundWCA > 0 ? '+' : ''}{-result.outboundWCA}°</p>
            </div>
          </div>
        )}
      </div>

      {/* Reference */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-4 space-y-1">
        <p>Standard hold: Right turns | Leg time: 1 min below 14,000 ft</p>
        <p>Triple WCA on outbound for wind correction</p>
      </div>
    </div>
  );
}

function normalizeHeading(heading: number): number {
  let h = heading;
  while (h < 0) h += 360;
  while (h >= 360) h -= 360;
  return Math.round(h);
}
