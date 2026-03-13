'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';

interface Waypoint {
  id: string;
  name: string;
  distance: number; // nm from previous
  trueCourse: number; // degrees
  altitude: number; // ft
  windDirection: number;
  windSpeed: number;
}

interface LegResult {
  waypoint: Waypoint;
  trueHeading: number;
  groundSpeed: number;
  wca: number;
  ete: number; // minutes
  fuelBurn: number; // gallons
  cumulativeDistance: number;
  cumulativeTime: number;
  cumulativeFuel: number;
}

interface FlightPlan {
  id: string;
  name: string;
  departure: string;
  destination: string;
  waypoints: Waypoint[];
  aircraftTas: number;
  fuelBurnRate: number;
  fuelOnboard: number;
  reserveMinutes: number;
  createdAt: number;
}

const STORAGE_KEY = 'avweather-flightplans';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function getPlans(): FlightPlan[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function savePlans(plans: FlightPlan[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export default function PlanPage() {
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: generateId(), name: '', distance: 0, trueCourse: 0, altitude: 3000, windDirection: 0, windSpeed: 0 }
  ]);
  const [tas, setTas] = useState<number>(120);
  const [fuelBurnRate, setFuelBurnRate] = useState<number>(10);
  const [fuelOnboard, setFuelOnboard] = useState<number>(40);
  const [reserveMinutes, setReserveMinutes] = useState<number>(45);
  const [magneticVariation, setMagneticVariation] = useState<number>(0);
  
  // Saved plans
  const [savedPlans, setSavedPlans] = useState<FlightPlan[]>([]);
  const [planName, setPlanName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  
  useEffect(() => {
    setSavedPlans(getPlans());
  }, []);

  const addWaypoint = useCallback(() => {
    setWaypoints(prev => [...prev, {
      id: generateId(),
      name: '',
      distance: 0,
      trueCourse: 0,
      altitude: prev[prev.length - 1]?.altitude || 3000,
      windDirection: prev[prev.length - 1]?.windDirection || 0,
      windSpeed: prev[prev.length - 1]?.windSpeed || 0
    }]);
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints(prev => prev.filter(w => w.id !== id));
  }, []);

  const updateWaypoint = useCallback((id: string, field: keyof Waypoint, value: string | number) => {
    setWaypoints(prev => prev.map(w => 
      w.id === id ? { ...w, [field]: typeof value === 'string' && field !== 'name' ? parseFloat(value) || 0 : value } : w
    ));
  }, []);

  // Calculate all legs
  const legs: LegResult[] = useMemo(() => {
    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    let cumulativeFuel = 0;

    return waypoints.filter(w => w.distance > 0).map((waypoint) => {
      // Wind correction calculation
      const tcRad = (waypoint.trueCourse * Math.PI) / 180;
      const wdRad = (waypoint.windDirection * Math.PI) / 180;
      
      const crosswind = waypoint.windSpeed * Math.sin(wdRad - tcRad);
      const headwind = waypoint.windSpeed * Math.cos(wdRad - tcRad);
      
      const wcaRad = Math.asin(Math.max(-1, Math.min(1, crosswind / tas)));
      const wca = (wcaRad * 180) / Math.PI;
      
      const trueHeading = waypoint.trueCourse + wca;
      const groundSpeed = Math.max(1, tas * Math.cos(wcaRad) - headwind);
      
      // Time and fuel
      const ete = (waypoint.distance / groundSpeed) * 60; // minutes
      const fuelBurn = (ete / 60) * fuelBurnRate;
      
      cumulativeDistance += waypoint.distance;
      cumulativeTime += ete;
      cumulativeFuel += fuelBurn;
      
      return {
        waypoint,
        trueHeading: normalizeHeading(trueHeading),
        groundSpeed: Math.round(groundSpeed),
        wca: Math.round(wca * 10) / 10,
        ete: Math.round(ete * 10) / 10,
        fuelBurn: Math.round(fuelBurn * 10) / 10,
        cumulativeDistance,
        cumulativeTime: Math.round(cumulativeTime * 10) / 10,
        cumulativeFuel: Math.round(cumulativeFuel * 10) / 10
      };
    });
  }, [waypoints, tas, fuelBurnRate]);

  // Totals
  const totals = useMemo(() => {
    if (legs.length === 0) return null;
    
    const lastLeg = legs[legs.length - 1];
    const reserveFuel = (reserveMinutes / 60) * fuelBurnRate;
    const totalFuelRequired = lastLeg.cumulativeFuel + reserveFuel;
    const fuelRemaining = fuelOnboard - totalFuelRequired;
    
    return {
      totalDistance: lastLeg.cumulativeDistance,
      totalTime: lastLeg.cumulativeTime,
      totalFuel: lastLeg.cumulativeFuel,
      reserveFuel: Math.round(reserveFuel * 10) / 10,
      totalFuelRequired: Math.round(totalFuelRequired * 10) / 10,
      fuelRemaining: Math.round(fuelRemaining * 10) / 10,
      sufficient: fuelRemaining >= 0,
      avgGroundSpeed: Math.round(lastLeg.cumulativeDistance / (lastLeg.cumulativeTime / 60))
    };
  }, [legs, fuelBurnRate, fuelOnboard, reserveMinutes]);

  // Save plan
  const handleSave = () => {
    if (!planName.trim()) return;
    
    const plan: FlightPlan = {
      id: generateId(),
      name: planName.trim(),
      departure,
      destination,
      waypoints,
      aircraftTas: tas,
      fuelBurnRate,
      fuelOnboard,
      reserveMinutes,
      createdAt: Date.now()
    };
    
    const plans = [...savedPlans, plan];
    savePlans(plans);
    setSavedPlans(plans);
    setShowSaveModal(false);
    setPlanName('');
  };

  // Load plan
  const handleLoad = (plan: FlightPlan) => {
    setDeparture(plan.departure);
    setDestination(plan.destination);
    setWaypoints(plan.waypoints);
    setTas(plan.aircraftTas);
    setFuelBurnRate(plan.fuelBurnRate);
    setFuelOnboard(plan.fuelOnboard);
    setReserveMinutes(plan.reserveMinutes);
    setShowLoadModal(false);
  };

  const handleDeletePlan = (id: string) => {
    if (!confirm('Delete this flight plan?')) return;
    const plans = savedPlans.filter(p => p.id !== id);
    savePlans(plans);
    setSavedPlans(plans);
  };

  const formatTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Print view
  if (showPrintView) {
    return (
      <div className="min-h-screen bg-white text-black p-8 print:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-6 print:mb-4">
            <div>
              <h1 className="text-2xl font-bold">Navigation Log</h1>
              <p className="text-gray-600">{departure || '____'} → {destination || '____'}</p>
              <p className="text-gray-500 text-sm">{new Date().toLocaleDateString()}</p>
            </div>
            <button 
              onClick={() => { window.print(); }}
              className="print:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🖨️ Print
            </button>
          </div>

          {/* Aircraft Info */}
          <div className="grid grid-cols-4 gap-4 mb-6 p-3 border rounded text-sm">
            <div><strong>TAS:</strong> {tas} kts</div>
            <div><strong>Fuel Rate:</strong> {fuelBurnRate} gal/hr</div>
            <div><strong>Fuel Onboard:</strong> {fuelOnboard} gal</div>
            <div><strong>Reserve:</strong> {reserveMinutes} min</div>
          </div>
          
          {/* NavLog Table */}
          <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">Waypoint</th>
                <th className="border border-gray-300 px-2 py-1">Alt</th>
                <th className="border border-gray-300 px-2 py-1">TC</th>
                <th className="border border-gray-300 px-2 py-1">WCA</th>
                <th className="border border-gray-300 px-2 py-1">TH</th>
                <th className="border border-gray-300 px-2 py-1">MH</th>
                <th className="border border-gray-300 px-2 py-1">Wind</th>
                <th className="border border-gray-300 px-2 py-1">GS</th>
                <th className="border border-gray-300 px-2 py-1">Dist</th>
                <th className="border border-gray-300 px-2 py-1">ETE</th>
                <th className="border border-gray-300 px-2 py-1">Fuel</th>
                <th className="border border-gray-300 px-2 py-1">Rem</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{leg.waypoint.name || `WPT ${i + 1}`}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.waypoint.altitude}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.waypoint.trueCourse}°</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.wca > 0 ? '+' : ''}{leg.wca}°</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{Math.round(leg.trueHeading)}°</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{Math.round(normalizeHeading(leg.trueHeading + magneticVariation))}°</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.waypoint.windDirection}°/{leg.waypoint.windSpeed}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.groundSpeed}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.waypoint.distance}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{formatTime(leg.ete)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{leg.fuelBurn}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{Math.round((fuelOnboard - leg.cumulativeFuel) * 10) / 10}</td>
                </tr>
              ))}
              {totals && (
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-gray-300 px-2 py-1">TOTALS</td>
                  <td className="border border-gray-300 px-2 py-1"></td>
                  <td className="border border-gray-300 px-2 py-1"></td>
                  <td className="border border-gray-300 px-2 py-1"></td>
                  <td className="border border-gray-300 px-2 py-1"></td>
                  <td className="border border-gray-300 px-2 py-1"></td>
                  <td className="border border-gray-300 px-2 py-1"></td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{totals.avgGroundSpeed}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{totals.totalDistance}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{formatTime(totals.totalTime)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{totals.totalFuel}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{totals.fuelRemaining}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Fuel Summary */}
          {totals && (
            <div className="grid grid-cols-2 gap-4 p-3 border rounded text-sm mb-6">
              <div>
                <p><strong>Trip Fuel:</strong> {totals.totalFuel} gal</p>
                <p><strong>Reserve Fuel:</strong> {totals.reserveFuel} gal ({reserveMinutes} min)</p>
                <p><strong>Total Required:</strong> {totals.totalFuelRequired} gal</p>
              </div>
              <div>
                <p><strong>Fuel Onboard:</strong> {fuelOnboard} gal</p>
                <p className={totals.sufficient ? 'text-green-700' : 'text-red-700'}>
                  <strong>Remaining:</strong> {totals.fuelRemaining} gal
                  {!totals.sufficient && ' ⚠️ INSUFFICIENT'}
                </p>
              </div>
            </div>
          )}

          {/* Remarks area */}
          <div className="border rounded p-3">
            <h3 className="font-bold mb-2">Remarks / Notes</h3>
            <div className="h-20 border-b border-dotted border-gray-300 mb-2"></div>
            <div className="h-20 border-b border-dotted border-gray-300"></div>
          </div>
          
          <button 
            onClick={() => setShowPrintView(false)}
            className="print:hidden mt-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            ← Back to Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Map</span>
          </Link>
          
          <div className="flex-1">
            <h1 className="text-lg font-bold">📋 NavLog Generator</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Flight planning & navigation log</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowLoadModal(true)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
              Load
            </button>
            <button onClick={() => setShowSaveModal(true)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
              Save
            </button>
            <button 
              onClick={() => setShowPrintView(true)}
              disabled={legs.length === 0}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm"
            >
              🖨️ Print
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-5xl mx-auto space-y-6">
        {/* Route Header */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Departure</label>
              <input
                type="text"
                value={departure}
                onChange={(e) => setDeparture(e.target.value.toUpperCase())}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-lg font-bold"
                placeholder="KJFK"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-lg font-bold"
                placeholder="KBOS"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Mag Variation</label>
              <input
                type="number"
                value={magneticVariation}
                onChange={(e) => setMagneticVariation(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="0"
                step="0.5"
              />
              <p className="text-xs text-slate-500 mt-1">West = negative</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Date</label>
              <input
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Aircraft Settings */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Aircraft Performance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">TAS (kts)</label>
              <input
                type="number"
                value={tas}
                onChange={(e) => setTas(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fuel Burn (gal/hr)</label>
              <input
                type="number"
                value={fuelBurnRate}
                onChange={(e) => setFuelBurnRate(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fuel Onboard (gal)</label>
              <input
                type="number"
                value={fuelOnboard}
                onChange={(e) => setFuelOnboard(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Reserve (min)</label>
              <input
                type="number"
                value={reserveMinutes}
                onChange={(e) => setReserveMinutes(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Waypoints */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Waypoints / Legs</h3>
            <button
              onClick={addWaypoint}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              + Add Waypoint
            </button>
          </div>

          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 text-xs text-slate-500 px-1">
            <div className="col-span-2">Waypoint</div>
            <div>Dist (nm)</div>
            <div>TC (°)</div>
            <div>Alt (ft)</div>
            <div>Wind Dir</div>
            <div>Wind Spd</div>
            <div>TH</div>
            <div>GS</div>
            <div>ETE</div>
            <div>Fuel</div>
            <div></div>
          </div>

          {/* Waypoint rows */}
          <div className="space-y-2">
            {waypoints.map((wp, index) => {
              const leg = legs.find(l => l.waypoint.id === wp.id);
              
              return (
                <div key={wp.id} className="bg-slate-700/50 rounded-lg p-3 sm:p-2">
                  {/* Mobile label */}
                  <div className="sm:hidden text-xs text-slate-400 mb-2">Leg {index + 1}</div>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-12 gap-2">
                    {/* Waypoint name */}
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={wp.name}
                        onChange={(e) => updateWaypoint(wp.id, 'name', e.target.value.toUpperCase())}
                        className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-white text-sm"
                        placeholder={`WPT ${index + 1}`}
                      />
                    </div>
                    
                    {/* Distance */}
                    <div>
                      <input
                        type="number"
                        value={wp.distance || ''}
                        onChange={(e) => updateWaypoint(wp.id, 'distance', e.target.value)}
                        className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-white text-sm"
                        placeholder="nm"
                        min="0"
                      />
                    </div>
                    
                    {/* True Course */}
                    <div>
                      <input
                        type="number"
                        value={wp.trueCourse || ''}
                        onChange={(e) => updateWaypoint(wp.id, 'trueCourse', e.target.value)}
                        className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-white text-sm"
                        placeholder="°"
                        min="0"
                        max="360"
                      />
                    </div>
                    
                    {/* Altitude */}
                    <div>
                      <input
                        type="number"
                        value={wp.altitude || ''}
                        onChange={(e) => updateWaypoint(wp.id, 'altitude', e.target.value)}
                        className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-white text-sm"
                        placeholder="ft"
                        step="500"
                      />
                    </div>
                    
                    {/* Wind Direction */}
                    <div>
                      <input
                        type="number"
                        value={wp.windDirection || ''}
                        onChange={(e) => updateWaypoint(wp.id, 'windDirection', e.target.value)}
                        className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-white text-sm"
                        placeholder="W/Dir"
                        min="0"
                        max="360"
                      />
                    </div>
                    
                    {/* Wind Speed */}
                    <div>
                      <input
                        type="number"
                        value={wp.windSpeed || ''}
                        onChange={(e) => updateWaypoint(wp.id, 'windSpeed', e.target.value)}
                        className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-white text-sm"
                        placeholder="W/Spd"
                        min="0"
                      />
                    </div>
                    
                    {/* Computed: TH */}
                    <div className="flex items-center justify-center text-sm font-mono">
                      {leg ? (
                        <span className="text-blue-400">{Math.round(leg.trueHeading)}°</span>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </div>
                    
                    {/* Computed: GS */}
                    <div className="flex items-center justify-center text-sm font-mono">
                      {leg ? (
                        <span className="text-green-400">{leg.groundSpeed}</span>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </div>
                    
                    {/* Computed: ETE */}
                    <div className="flex items-center justify-center text-sm font-mono">
                      {leg ? (
                        <span className="text-white">{formatTime(leg.ete)}</span>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </div>
                    
                    {/* Computed: Fuel */}
                    <div className="flex items-center justify-center text-sm font-mono">
                      {leg ? (
                        <span className="text-amber-400">{leg.fuelBurn}g</span>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </div>
                    
                    {/* Delete */}
                    <div className="flex items-center justify-center">
                      {waypoints.length > 1 && (
                        <button
                          onClick={() => removeWaypoint(wp.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        {totals && (
          <div className={`rounded-lg p-4 ${totals.sufficient ? 'bg-green-900/20 border border-green-700' : 'bg-red-900/20 border border-red-700'}`}>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Flight Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{totals.totalDistance} nm</p>
                <p className="text-slate-400 text-sm">Total Distance</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{formatTime(totals.totalTime)}</p>
                <p className="text-slate-400 text-sm">Total Time</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{totals.totalFuelRequired} gal</p>
                <p className="text-slate-400 text-sm">Fuel Required (w/ reserve)</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${totals.sufficient ? 'text-green-400' : 'text-red-400'}`}>
                  {totals.fuelRemaining >= 0 ? '+' : ''}{totals.fuelRemaining} gal
                </p>
                <p className="text-slate-400 text-sm">
                  {totals.sufficient ? 'Fuel Remaining' : '⚠️ FUEL SHORTAGE'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
              <div className="text-center text-sm">
                <span className="text-slate-400">Avg GS: </span>
                <span className="text-white font-bold">{totals.avgGroundSpeed} kts</span>
              </div>
              <div className="text-center text-sm">
                <span className="text-slate-400">Trip Fuel: </span>
                <span className="text-white font-bold">{totals.totalFuel} gal</span>
              </div>
              <div className="text-center text-sm">
                <span className="text-slate-400">Reserve: </span>
                <span className="text-white font-bold">{totals.reserveFuel} gal</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Save Flight Plan</h3>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Plan name (e.g. JFK to BOS)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveModal(false)} className="flex-1 px-4 py-2 bg-slate-700 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={!planName.trim()} className="flex-1 px-4 py-2 bg-blue-600 rounded-lg disabled:bg-slate-600">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Load Flight Plan</h3>
            {savedPlans.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No saved plans</p>
            ) : (
              <div className="space-y-2">
                {savedPlans.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="cursor-pointer flex-1" onClick={() => handleLoad(plan)}>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-slate-400">{plan.departure} → {plan.destination} • {plan.waypoints.length} legs</p>
                    </div>
                    <button onClick={() => handleDeletePlan(plan.id)} className="text-red-400 hover:text-red-300 p-2">✕</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowLoadModal(false)} className="w-full mt-4 px-4 py-2 bg-slate-700 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

function normalizeHeading(heading: number): number {
  let h = heading;
  while (h < 0) h += 360;
  while (h >= 360) h -= 360;
  return h;
}
