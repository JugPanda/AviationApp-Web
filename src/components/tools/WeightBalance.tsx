'use client';

import { useState, useEffect, useMemo } from 'react';

// Aircraft weight & balance data
interface Station {
  name: string;
  arm: number; // inches from datum
  minWeight?: number;
  maxWeight?: number;
  defaultWeight?: number;
}

interface CGEnvelope {
  points: { weight: number; cgMin: number; cgMax: number }[];
}

interface AircraftData {
  name: string;
  emptyWeight: number;
  emptyArm: number;
  maxGross: number;
  fuelArm: number;
  fuelCapacity: number; // gallons
  fuelWeight: number; // lbs per gallon
  stations: Station[];
  envelope: CGEnvelope;
}

const AIRCRAFT_DATABASE: Record<string, AircraftData> = {
  'C172S': {
    name: 'Cessna 172S Skyhawk SP',
    emptyWeight: 1680,
    emptyArm: 39.0,
    maxGross: 2550,
    fuelArm: 48.0,
    fuelCapacity: 53,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
      { name: 'Baggage Area 1', arm: 95.0, maxWeight: 120 },
      { name: 'Baggage Area 2', arm: 123.0, maxWeight: 50 },
    ],
    envelope: {
      points: [
        { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
        { weight: 1950, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  },
  'C182T': {
    name: 'Cessna 182T Skylane',
    emptyWeight: 1970,
    emptyArm: 39.5,
    maxGross: 3100,
    fuelArm: 46.0,
    fuelCapacity: 87,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 74.0, maxWeight: 400 },
      { name: 'Baggage Area 1', arm: 97.0, maxWeight: 200 },
      { name: 'Baggage Area 2', arm: 120.0, maxWeight: 50 },
    ],
    envelope: {
      points: [
        { weight: 1800, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2350, cgMin: 35.0, cgMax: 47.3 },
        { weight: 3100, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  },
  'PA28-181': {
    name: 'Piper PA-28-181 Archer',
    emptyWeight: 1540,
    emptyArm: 83.7,
    maxGross: 2550,
    fuelArm: 95.0,
    fuelCapacity: 50,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 80.5, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 118.1, maxWeight: 400 },
      { name: 'Baggage', arm: 142.8, maxWeight: 200 },
    ],
    envelope: {
      points: [
        { weight: 1400, cgMin: 78.0, cgMax: 93.0 },
        { weight: 1800, cgMin: 78.0, cgMax: 93.0 },
        { weight: 2550, cgMin: 84.0, cgMax: 93.0 },
      ]
    }
  }
};

interface StationInput {
  weight: number;
}

export default function WeightBalance() {
  const [selectedAircraft, setSelectedAircraft] = useState('C172S');
  const [fuelGallons, setFuelGallons] = useState(40);
  const [stationWeights, setStationWeights] = useState<StationInput[]>([]);

  const aircraft = AIRCRAFT_DATABASE[selectedAircraft];

  // Initialize station weights when aircraft changes
  useEffect(() => {
    setStationWeights(aircraft.stations.map(s => ({ weight: s.defaultWeight || 0 })));
    // Load saved preferences
    const saved = localStorage.getItem(`wb-${selectedAircraft}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFuelGallons(data.fuel || 40);
        if (data.stations) setStationWeights(data.stations);
      } catch {}
    }
  }, [aircraft, selectedAircraft]);

  // Save preferences
  useEffect(() => {
    if (stationWeights.length > 0) {
      localStorage.setItem(`wb-${selectedAircraft}`, JSON.stringify({
        fuel: fuelGallons,
        stations: stationWeights
      }));
    }
  }, [fuelGallons, stationWeights, selectedAircraft]);

  const updateStationWeight = (index: number, weight: number) => {
    const newWeights = [...stationWeights];
    newWeights[index] = { weight: Math.max(0, weight) };
    setStationWeights(newWeights);
  };

  // Calculate totals
  const calculations = useMemo(() => {
    if (stationWeights.length === 0) return null;

    // Empty weight
    const emptyMoment = aircraft.emptyWeight * aircraft.emptyArm;

    // Fuel
    const fuelWeight = fuelGallons * aircraft.fuelWeight;
    const fuelMoment = fuelWeight * aircraft.fuelArm;

    // Stations
    const stationMoments = stationWeights.map((s, i) => ({
      weight: s.weight,
      arm: aircraft.stations[i].arm,
      moment: s.weight * aircraft.stations[i].arm
    }));

    const totalStationWeight = stationMoments.reduce((sum, s) => sum + s.weight, 0);
    const totalStationMoment = stationMoments.reduce((sum, s) => sum + s.moment, 0);

    // Totals
    const totalWeight = aircraft.emptyWeight + fuelWeight + totalStationWeight;
    const totalMoment = emptyMoment + fuelMoment + totalStationMoment;
    const cg = totalMoment / totalWeight;

    // Check envelope
    const envelope = aircraft.envelope;
    let cgMin = envelope.points[0].cgMin;
    let cgMax = envelope.points[0].cgMax;

    // Interpolate CG limits based on weight
    for (let i = 1; i < envelope.points.length; i++) {
      const prev = envelope.points[i - 1];
      const curr = envelope.points[i];
      if (totalWeight >= prev.weight && totalWeight <= curr.weight) {
        const ratio = (totalWeight - prev.weight) / (curr.weight - prev.weight);
        cgMin = prev.cgMin + ratio * (curr.cgMin - prev.cgMin);
        cgMax = prev.cgMax + ratio * (curr.cgMax - prev.cgMax);
        break;
      } else if (totalWeight > curr.weight && i === envelope.points.length - 1) {
        cgMin = curr.cgMin;
        cgMax = curr.cgMax;
      }
    }

    const withinWeight = totalWeight <= aircraft.maxGross;
    const withinCG = cg >= cgMin && cg <= cgMax;
    const isValid = withinWeight && withinCG;

    return {
      emptyWeight: aircraft.emptyWeight,
      emptyMoment,
      fuelWeight,
      fuelMoment,
      stationMoments,
      totalStationWeight,
      totalWeight,
      totalMoment,
      cg,
      cgMin,
      cgMax,
      withinWeight,
      withinCG,
      isValid,
      overweight: totalWeight - aircraft.maxGross
    };
  }, [aircraft, fuelGallons, stationWeights]);

  // SVG CG Envelope visualization
  const EnvelopeChart = () => {
    if (!calculations) return null;

    const envelope = aircraft.envelope;
    const padding = 30;
    const width = 280;
    const height = 200;
    
    // Find bounds
    const minWeight = envelope.points[0].weight;
    const maxWeight = envelope.points[envelope.points.length - 1].weight;
    const minCG = Math.min(...envelope.points.map(p => p.cgMin)) - 2;
    const maxCG = Math.max(...envelope.points.map(p => p.cgMax)) + 2;

    const scaleX = (cg: number) => padding + ((cg - minCG) / (maxCG - minCG)) * (width - 2 * padding);
    const scaleY = (w: number) => height - padding - ((w - minWeight) / (maxWeight - minWeight)) * (height - 2 * padding);

    // Build envelope path
    const fwdPoints = envelope.points.map(p => `${scaleX(p.cgMin)},${scaleY(p.weight)}`);
    const aftPoints = [...envelope.points].reverse().map(p => `${scaleX(p.cgMax)},${scaleY(p.weight)}`);
    const envelopePath = `M ${fwdPoints.join(' L ')} L ${aftPoints.join(' L ')} Z`;

    // Current CG point
    const cgX = scaleX(calculations.cg);
    const cgY = scaleY(Math.min(calculations.totalWeight, maxWeight));

    return (
      <svg width={width} height={height} className="mx-auto">
        {/* Grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect x={padding} y="10" width={width - 2*padding} height={height - 2*padding} fill="url(#grid)" />
        
        {/* Envelope */}
        <path 
          d={envelopePath} 
          fill="rgba(34, 197, 94, 0.2)" 
          stroke="#22c55e" 
          strokeWidth="2"
        />
        
        {/* CG Point */}
        <circle 
          cx={cgX} 
          cy={cgY} 
          r="6" 
          fill={calculations.isValid ? '#22c55e' : '#ef4444'}
          stroke="white"
          strokeWidth="2"
        />
        
        {/* Axes labels */}
        <text x={width/2} y={height - 5} textAnchor="middle" className="text-xs fill-slate-400">CG (inches)</text>
        <text x="10" y={height/2} textAnchor="middle" transform={`rotate(-90, 10, ${height/2})`} className="text-xs fill-slate-400">Weight (lbs)</text>
        
        {/* Min/Max labels */}
        <text x={padding} y={height - 10} textAnchor="start" className="text-[10px] fill-slate-500">{minCG.toFixed(0)}</text>
        <text x={width - padding} y={height - 10} textAnchor="end" className="text-[10px] fill-slate-500">{maxCG.toFixed(0)}</text>
        <text x={padding - 5} y={scaleY(minWeight)} textAnchor="end" className="text-[10px] fill-slate-500">{minWeight}</text>
        <text x={padding - 5} y={scaleY(maxWeight)} textAnchor="end" className="text-[10px] fill-slate-500">{maxWeight}</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Aircraft Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">Aircraft Type</label>
        <select
          value={selectedAircraft}
          onChange={(e) => setSelectedAircraft(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Object.entries(AIRCRAFT_DATABASE).map(([id, data]) => (
            <option key={id} value={id}>{data.name}</option>
          ))}
        </select>
      </div>

      {/* Fuel Input */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Fuel ({fuelGallons} gal = {(fuelGallons * aircraft.fuelWeight).toFixed(0)} lbs)
        </label>
        <input
          type="range"
          min="0"
          max={aircraft.fuelCapacity}
          value={fuelGallons}
          onChange={(e) => setFuelGallons(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Empty</span>
          <span>Tabs ({Math.round(aircraft.fuelCapacity * 0.75)})</span>
          <span>Full ({aircraft.fuelCapacity})</span>
        </div>
      </div>

      {/* Station Inputs */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-400">Payload</label>
        {aircraft.stations.map((station, index) => (
          <div key={index} className="flex items-center gap-3">
            <label className="text-sm text-slate-300 flex-1">{station.name}</label>
            <input
              type="number"
              value={stationWeights[index]?.weight || 0}
              onChange={(e) => updateStationWeight(index, Number(e.target.value))}
              className="w-24 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-right"
              min="0"
              max={station.maxWeight}
            />
            <span className="text-xs text-slate-500 w-12">lbs</span>
          </div>
        ))}
      </div>

      {/* Results */}
      {calculations && (
        <div className="space-y-4">
          {/* CG Envelope Chart */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">CG Envelope</h4>
            <EnvelopeChart />
          </div>

          {/* Summary Table */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-left px-4 py-2 text-slate-400">Item</th>
                  <th className="text-right px-4 py-2 text-slate-400">Weight</th>
                  <th className="text-right px-4 py-2 text-slate-400">Arm</th>
                  <th className="text-right px-4 py-2 text-slate-400">Moment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                <tr>
                  <td className="px-4 py-2">Empty Weight</td>
                  <td className="text-right px-4 py-2">{calculations.emptyWeight}</td>
                  <td className="text-right px-4 py-2">{aircraft.emptyArm.toFixed(1)}</td>
                  <td className="text-right px-4 py-2">{calculations.emptyMoment.toFixed(0)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Fuel</td>
                  <td className="text-right px-4 py-2">{calculations.fuelWeight.toFixed(0)}</td>
                  <td className="text-right px-4 py-2">{aircraft.fuelArm.toFixed(1)}</td>
                  <td className="text-right px-4 py-2">{calculations.fuelMoment.toFixed(0)}</td>
                </tr>
                {calculations.stationMoments.map((s, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{aircraft.stations[i].name}</td>
                    <td className="text-right px-4 py-2">{s.weight}</td>
                    <td className="text-right px-4 py-2">{s.arm.toFixed(1)}</td>
                    <td className="text-right px-4 py-2">{s.moment.toFixed(0)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 font-medium">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className={`text-right px-4 py-2 ${calculations.withinWeight ? 'text-green-400' : 'text-red-400'}`}>
                    {calculations.totalWeight.toFixed(0)}
                  </td>
                  <td className="text-right px-4 py-2"></td>
                  <td className="text-right px-4 py-2">{calculations.totalMoment.toFixed(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CG Result */}
          <div className={`rounded-lg p-4 ${calculations.isValid ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Center of Gravity</p>
                <p className={`text-2xl font-bold ${calculations.withinCG ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.cg.toFixed(2)}" 
                </p>
                <p className="text-xs text-slate-500">
                  Limits: {calculations.cgMin.toFixed(1)}" to {calculations.cgMax.toFixed(1)}"
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Gross Weight</p>
                <p className={`text-2xl font-bold ${calculations.withinWeight ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.totalWeight.toFixed(0)} lbs
                </p>
                <p className="text-xs text-slate-500">
                  Max: {aircraft.maxGross} lbs
                  {!calculations.withinWeight && (
                    <span className="text-red-400"> (+{calculations.overweight.toFixed(0)})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-center">
              {calculations.isValid ? (
                <span className="text-green-400 font-medium">✓ Within Limits</span>
              ) : (
                <span className="text-red-400 font-medium">✗ Out of Limits</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
