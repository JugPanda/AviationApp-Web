'use client';

import { containDialogTab } from '@/lib/dialog-focus';

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import './plan.css';

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
  const [savedPlans, setSavedPlans] = useState<FlightPlan[]>(() => getPlans());
  const [planName, setPlanName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const [planStatus, setPlanStatus] = useState('');
  const [storageError, setStorageError] = useState('');
  

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
    return waypoints.filter(w => w.distance > 0).reduce<LegResult[]>((results, waypoint) => {
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
      const previousLeg = results[results.length - 1];
      const cumulativeDistance = (previousLeg?.cumulativeDistance ?? 0) + waypoint.distance;
      const cumulativeTime = (previousLeg?.cumulativeTime ?? 0) + ete;
      const cumulativeFuel = (previousLeg?.cumulativeFuel ?? 0) + fuelBurn;
      
      results.push({
        waypoint,
        trueHeading: normalizeHeading(trueHeading),
        groundSpeed: Math.round(groundSpeed),
        wca: Math.round(wca * 10) / 10,
        ete: Math.round(ete * 10) / 10,
        fuelBurn: Math.round(fuelBurn * 10) / 10,
        cumulativeDistance,
        cumulativeTime: Math.round(cumulativeTime * 10) / 10,
        cumulativeFuel: Math.round(cumulativeFuel * 10) / 10
      });

      return results;
    }, []);
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
    try {
      savePlans(plans);
    } catch {
      setStorageError('Could not save in this browser. Check available storage and browser permissions, then try again.');
      return;
    }
    setSavedPlans(plans);
    setStorageError('');
    setPlanStatus(`Saved “${plan.name}” in this browser.`);
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
    setPlanStatus(`Loaded “${plan.name}”. Check the date and magnetic variation; they are not stored with plans.`);
    setShowLoadModal(false);
  };

  const handleDeletePlan = (id: string) => {
    if (!confirm('Delete this flight plan?')) return;
    const plans = savedPlans.filter(p => p.id !== id);
    try {
      savePlans(plans);
    } catch {
      setStorageError('Could not delete this plan from browser storage. Try again.');
      return;
    }
    setSavedPlans(plans);
    setStorageError('');
    setPlanStatus('Deleted the saved plan from this browser.');
  };

  const formatTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Print view
  if (showPrintView) {
    return (
      <div className="av-plan-print min-h-screen bg-white text-black p-8 print:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-6 print:mb-4">
            <div>
              <h1 className="text-2xl font-bold">Navigation Log</h1>
              <p className="text-gray-600">{departure || '____'} → {destination || '____'}</p>
              <p className="text-gray-500 text-sm">{new Date().toLocaleDateString()}</p>
              <p className="text-gray-600 text-xs mt-2">Preview · Supplemental planning only. Independently verify inputs and calculations.</p>
            </div>
            <button 
              onClick={() => { window.print(); }}
              className="print:hidden px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              🖨️ Print
            </button>
          </div>

          {/* Aircraft Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 p-3 border rounded text-sm">
            <div><strong>TAS:</strong> {tas} kts</div>
            <div><strong>Fuel Rate:</strong> {fuelBurnRate} gal/hr</div>
            <div><strong>Fuel Onboard:</strong> {fuelOnboard} gal</div>
            <div><strong>Reserve:</strong> {reserveMinutes} min</div>
          </div>
          
          {/* NavLog Table */}
          <p className="av-plan-print-hint print:hidden">On a small screen, scroll the navigation table sideways to see every column.</p>
          <div className="av-plan-print-scroll" role="region" aria-label="Printable navigation table" tabIndex={0}>
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
          </div>

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
    <AppShell>
      <main id="workspace-content" tabIndex={-1} className="av-plan">
        <header className="av-page-heading">
          <div>
            <p className="av-eyebrow">02 / Route preparation</p>
            <h1>Flight planning</h1>
            <p className="av-page-description">Enter your route and aircraft figures, work through each leg, then review your navigation log.</p>
            <p className="av-local-note">Saved plans stay in this browser. No device sync.</p>
          </div>
          <div className="av-page-actions">
            <button onClick={() => { setStorageError(''); setShowLoadModal(true); }} className="av-plan-button">Load plan</button>
            <button onClick={() => { setStorageError(''); setShowSaveModal(true); }} className="av-plan-button av-plan-button--primary">Save plan</button>
            <button onClick={() => setShowPrintView(true)} disabled={legs.length === 0} className="av-plan-button" aria-label="Preview printable navigation log">Print</button>
          </div>
        </header>

        <div className="av-plan-workspace">
          <div className="av-plan-intro">
            <p><strong>A manually entered navigation log.</strong> Enter your own distances, courses and winds. This planner does not generate or validate a geographical route.</p>
            <p>Edits are not saved automatically. Save a named copy when you are ready.</p>
          </div>
          <p className="av-plan-status" role="status">{planStatus}</p>

          <div className="av-plan-setup">
            <section className="av-plan-panel" aria-labelledby="plan-route-title">
              <SectionHeading number="01" id="plan-route-title" title="Route" description="Name the endpoints of your plan." />
              <div className="av-plan-fields">
                <label className="av-plan-field">
                  <span>Departure</span>
                  <input aria-label="Departure" type="text" value={departure} onChange={e => setDeparture(e.target.value.toUpperCase())} placeholder="e.g. KJFK" autoCapitalize="characters" spellCheck={false} />
                </label>
                <label className="av-plan-field">
                  <span>Destination</span>
                  <input aria-label="Destination" type="text" value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} placeholder="e.g. KBOS" autoCapitalize="characters" spellCheck={false} />
                </label>
                <label className="av-plan-field">
                  <span>Mag variation <small>°</small></span>
                  <input aria-label="Mag Variation" aria-describedby="plan-variation-help" type="number" value={magneticVariation} onChange={e => setMagneticVariation(parseFloat(e.target.value) || 0)} step="0.5" />
                  <span id="plan-variation-help" className="av-plan-hint">West = negative</span>
                </label>
                <label className="av-plan-field">
                  <span>Date</span>
                  <input aria-label="Date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </label>
              </div>
              <p className="av-plan-footnote">Date and magnetic variation are not saved with plans. The printed log uses today’s date.</p>
            </section>

            <section className="av-plan-panel" aria-labelledby="plan-aircraft-title">
              <SectionHeading number="02" id="plan-aircraft-title" title="Aircraft assumptions" description="Use verified figures for the aircraft you will fly." />
              <p className="av-plan-caution">Starting values are placeholders, not aircraft-specific data. Enter verified performance and fuel figures.</p>
              <div className="av-plan-fields">
                <label className="av-plan-field">
                  <span>True airspeed <small>kt</small></span>
                  <input aria-label="True airspeed (TAS, kt)" type="number" value={tas} onChange={e => setTas(parseFloat(e.target.value) || 0)} />
                </label>
                <label className="av-plan-field">
                  <span>Fuel burn <small>gal/hr</small></span>
                  <input aria-label="Fuel Burn (gal/hr)" type="number" value={fuelBurnRate} onChange={e => setFuelBurnRate(parseFloat(e.target.value) || 0)} step="0.5" />
                </label>
                <label className="av-plan-field">
                  <span>Fuel onboard <small>gal</small></span>
                  <input aria-label="Fuel Onboard (gal)" type="number" value={fuelOnboard} onChange={e => setFuelOnboard(parseFloat(e.target.value) || 0)} />
                </label>
                <label className="av-plan-field">
                  <span>Reserve <small>min</small></span>
                  <input aria-label="Reserve (min)" type="number" value={reserveMinutes} onChange={e => setReserveMinutes(parseInt(e.target.value) || 0)} />
                </label>
              </div>
            </section>
          </div>

          <div className="av-plan-detail-layout">
            <section className="av-plan-panel av-plan-legs" aria-labelledby="plan-legs-title">
              <div className="av-plan-section-bar">
                <SectionHeading number="03" id="plan-legs-title" title="Waypoints & legs" description="Each distance runs from the previous point to this waypoint." />
                <span className="av-plan-count">{waypoints.length} {waypoints.length === 1 ? 'leg' : 'legs'}</span>
              </div>
              <p className="av-plan-footnote av-plan-leg-note">Course and wind direction are true degrees. Zero wind speed assumes calm conditions; winds are not fetched automatically.</p>
              <div className="av-plan-leg-list">
                {waypoints.map((wp, index) => {
                  const leg = legs.find(l => l.waypoint.id === wp.id);
                  return (
                    <article key={wp.id} className="av-plan-leg" aria-labelledby={`plan-leg-${index + 1}`}>
                      <div className="av-plan-leg-header">
                        <h3 id={`plan-leg-${index + 1}`}>Leg {index + 1}<span>{wp.name || 'New waypoint'}</span></h3>
                        {waypoints.length > 1 && <button aria-label={`Remove leg ${index + 1}`} onClick={() => removeWaypoint(wp.id)} className="av-plan-button av-plan-button--quiet">Remove</button>}
                      </div>
                      <div className="av-plan-fields av-plan-leg-fields">
                        <label className="av-plan-field av-plan-waypoint-field">
                          <span>Waypoint name</span>
                          <input type="text" aria-label={`Leg ${index + 1}: Waypoint name`} value={wp.name} onChange={e => updateWaypoint(wp.id, 'name', e.target.value.toUpperCase())} placeholder={`WPT ${index + 1}`} autoCapitalize="characters" spellCheck={false} />
                        </label>
                        <label className="av-plan-field">
                          <span>Distance <small>nm</small></span>
                          <input type="number" aria-label={`Leg ${index + 1}: Distance in nautical miles`} value={wp.distance || ''} onChange={e => updateWaypoint(wp.id, 'distance', e.target.value)} placeholder="Enter distance" min="0" />
                        </label>
                        <label className="av-plan-field">
                          <span>True course <small>°</small></span>
                          <input type="number" aria-label={`Leg ${index + 1}: True course in degrees`} value={wp.trueCourse} onChange={e => updateWaypoint(wp.id, 'trueCourse', e.target.value)} min="0" max="360" />
                        </label>
                        <label className="av-plan-field">
                          <span>Altitude <small>ft</small></span>
                          <input type="number" aria-label={`Leg ${index + 1}: Altitude in feet`} value={wp.altitude || ''} onChange={e => updateWaypoint(wp.id, 'altitude', e.target.value)} placeholder="Enter altitude" step="500" />
                        </label>
                        <label className="av-plan-field">
                          <span>Wind direction <small>°</small></span>
                          <input type="number" aria-label={`Leg ${index + 1}: Wind direction in degrees`} value={wp.windDirection} onChange={e => updateWaypoint(wp.id, 'windDirection', e.target.value)} min="0" max="360" />
                        </label>
                        <label className="av-plan-field">
                          <span>Wind speed <small>kt</small></span>
                          <input type="number" aria-label={`Leg ${index + 1}: Wind speed in knots`} value={wp.windSpeed} onChange={e => updateWaypoint(wp.id, 'windSpeed', e.target.value)} min="0" />
                        </label>
                      </div>
                      {leg ? (
                        <div className="av-plan-leg-results" role="group" aria-label={`Leg ${index + 1} calculated results`}>
                          <p className="av-plan-result-caption">Calculated from your inputs</p>
                          <dl className="av-plan-metrics">
                            <div><dt>True heading</dt><dd>{Math.round(leg.trueHeading)}°</dd></div>
                            <div><dt>Groundspeed</dt><dd>{leg.groundSpeed} <small>kt</small></dd></div>
                            <div><dt>Leg time <span>(h:mm)</span></dt><dd>{formatTime(leg.ete)}</dd></div>
                            <div><dt>Leg fuel</dt><dd>{leg.fuelBurn} <small>gal</small></dd></div>
                          </dl>
                        </div>
                      ) : (
                        <p className="av-plan-empty-leg">Enter a distance greater than zero to see heading, groundspeed, time and fuel for this leg.</p>
                      )}
                    </article>
                  );
                })}
              </div>
              <button onClick={addWaypoint} className="av-plan-button av-plan-add">+ Add waypoint</button>
            </section>

            <section className="av-plan-panel av-plan-review" aria-labelledby="plan-review-title">
              <SectionHeading number="04" id="plan-review-title" title="Review your plan" description="Check the totals before saving or printing." />
              {totals ? (
                <>
                  <p className="av-plan-review-count">{legs.length} of {waypoints.length} {waypoints.length === 1 ? 'leg' : 'legs'} included</p>
                  {legs.length < waypoints.length && <p className="av-plan-caution">Some legs have no positive distance and are excluded from these totals.</p>}
                  <dl className="av-plan-review-metrics">
                    <div><dt>Total distance</dt><dd>{totals.totalDistance} <small>nm</small></dd></div>
                    <div><dt>Total time <span>(h:mm)</span></dt><dd>{formatTime(totals.totalTime)}</dd></div>
                    <div><dt>Fuel required <span>including reserve</span></dt><dd>{totals.totalFuelRequired} <small>gal</small></dd></div>
                    <div><dt>{totals.sufficient ? 'Fuel after trip & reserve' : '⚠️ FUEL SHORTAGE'}</dt><dd className={totals.sufficient ? '' : 'av-plan-shortage'}>{totals.fuelRemaining >= 0 ? '+' : ''}{totals.fuelRemaining} <small>gal</small></dd></div>
                  </dl>
                  <dl className="av-plan-breakdown">
                    <div><dt>Average groundspeed</dt><dd>{totals.avgGroundSpeed} kt</dd></div>
                    <div><dt>Trip fuel</dt><dd>{totals.totalFuel} gal</dd></div>
                    <div><dt>Reserve ({reserveMinutes} min)</dt><dd>{totals.reserveFuel} gal</dd></div>
                    <div><dt>Fuel onboard</dt><dd>{fuelOnboard} gal</dd></div>
                  </dl>
                </>
              ) : (
                <div className="av-plan-empty-review">
                  <h3>Your totals will appear here</h3>
                  <p>Enter a distance for your first leg, then check its course and wind. Time and fuel update as you edit.</p>
                </div>
              )}
              <p className="av-plan-review-safety">Supplemental planning only. Independently verify inputs and calculations. These totals do not establish route safety or regulatory fuel compliance.</p>
              <button onClick={() => setShowPrintView(true)} disabled={legs.length === 0} className="av-plan-button av-plan-review-print">Preview navigation log</button>
              {!totals && <p className="av-plan-hint">Add a leg distance to enable print preview.</p>}
            </section>
          </div>
        </div>

        {showSaveModal && (
          <PlanDialog title="Save flight plan" onDismiss={() => setShowSaveModal(false)}>
            <p className="av-plan-dialog-description">Saved in this browser only, not across devices. Each save creates a new named copy.</p>
            <form onSubmit={event => { event.preventDefault(); handleSave(); }}>
              <label className="av-plan-field">
                <span>Plan name</span>
                <input type="text" aria-label="Plan name" value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. Weekend navigation practice" autoFocus required />
              </label>
              {storageError && <p className="av-plan-caution" role="alert">{storageError}</p>}
              <div className="av-plan-dialog-actions">
                <button type="button" onClick={() => setShowSaveModal(false)} className="av-plan-button">Cancel</button>
                <button type="submit" disabled={!planName.trim()} className="av-plan-button av-plan-button--primary">Save</button>
              </div>
            </form>
          </PlanDialog>
        )}
        {showLoadModal && (
          <PlanDialog title="Load flight plan" onDismiss={() => setShowLoadModal(false)}>
            <p className="av-plan-dialog-description">Loading replaces the current editor. Save any edits you want to keep first.</p>
            {savedPlans.length === 0 ? (
              <div className="av-plan-empty-review"><h3>No saved plans</h3><p>Save a named plan and it will appear here in this browser.</p></div>
            ) : (
              <ul className="av-plan-saved-list">
                {savedPlans.map(plan => (
                  <li key={plan.id}>
                    <button className="av-plan-saved-item" onClick={() => handleLoad(plan)} aria-label={`Load ${plan.name}`}>
                      <strong>{plan.name}</strong>
                      <span>{plan.departure || 'No departure'} → {plan.destination || 'No destination'} · {plan.waypoints.length} {plan.waypoints.length === 1 ? 'leg' : 'legs'}</span>
                      <span className="av-plan-saved-action">Load plan →</span>
                    </button>
                    <button aria-label={`Delete ${plan.name}`} onClick={() => handleDeletePlan(plan.id)} className="av-plan-button av-plan-button--quiet">Delete</button>
                  </li>
                ))}
              </ul>
            )}
            {storageError && <p className="av-plan-caution" role="alert">{storageError}</p>}
            <button onClick={() => setShowLoadModal(false)} className="av-plan-button av-plan-dialog-close">Close</button>
          </PlanDialog>
        )}
      </main>
    </AppShell>
  );
}

function SectionHeading({ number, id, title, description }: { number: string; id: string; title: string; description: string }) {
  return (
    <div className="av-plan-section-heading">
      <span className="av-plan-step" aria-hidden="true">{number}</span>
      <div><h2 id={id}>{title}</h2><p>{description}</p></div>
    </div>
  );
}

function PlanDialog({ title, onDismiss, children }: { title: string; onDismiss: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog onKeyDown={containDialogTab} ref={dialogRef} className="av-plan-dialog" aria-label={title} onCancel={event => { event.preventDefault(); onDismiss(); }}>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}

function normalizeHeading(heading: number): number {
  let h = heading;
  while (h < 0) h += 360;
  while (h >= 360) h -= 360;
  return h;
}
