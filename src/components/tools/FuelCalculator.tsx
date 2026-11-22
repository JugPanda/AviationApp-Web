'use client';

import { useState, useMemo } from 'react';

type CalculationMode = 'endurance' | 'required' | 'range';
type FuelUnit = 'gal' | 'lbs' | 'liters';

const FUEL_WEIGHT = 6.0; // lbs per gallon (Avgas)

export default function FuelCalculator() {
  const [mode, setMode] = useState<CalculationMode>('endurance');
  const [fuelOnboard, setFuelOnboard] = useState<string>('40');
  const [fuelBurnRate, setFuelBurnRate] = useState<string>('10');
  const [tripTime, setTripTime] = useState<string>('2.5');
  const [tripDistance, setTripDistance] = useState<string>('300');
  const [groundSpeed, setGroundSpeed] = useState<string>('120');
  const [reserveMinutes, setReserveMinutes] = useState<string>('45');
  const [fuelUnit, setFuelUnit] = useState<FuelUnit>('gal');

  const convertToGallons = (value: number, unit: FuelUnit): number => {
    switch (unit) {
      case 'gal': return value;
      case 'lbs': return value / FUEL_WEIGHT;
      case 'liters': return value * 0.264172;
    }
  };

  const convertFromGallons = (gallons: number, unit: FuelUnit): number => {
    switch (unit) {
      case 'gal': return gallons;
      case 'lbs': return gallons * FUEL_WEIGHT;
      case 'liters': return gallons / 0.264172;
    }
  };

  const result = useMemo(() => {
    const fuel = convertToGallons(parseFloat(fuelOnboard) || 0, fuelUnit);
    const burnRate = convertToGallons(parseFloat(fuelBurnRate) || 0, fuelUnit);
    const time = parseFloat(tripTime) || 0;
    const distance = parseFloat(tripDistance) || 0;
    const gs = parseFloat(groundSpeed) || 0;
    const reserve = (parseFloat(reserveMinutes) || 0) / 60;

    switch (mode) {
      case 'endurance': {
        if (burnRate <= 0) return null;
        const totalEndurance = fuel / burnRate;
        const reserveFuel = burnRate * reserve;
        const usableFuel = fuel - reserveFuel;
        const usableEndurance = usableFuel / burnRate;
        const maxRange = usableEndurance * gs;
        
        return {
          type: 'endurance',
          totalEndurance,
          usableEndurance,
          reserveFuel: convertFromGallons(reserveFuel, fuelUnit),
          maxRange
        };
      }
      case 'required': {
        if (burnRate <= 0) return null;
        const tripFuel = burnRate * time;
        const reserveFuel = burnRate * reserve;
        const totalRequired = tripFuel + reserveFuel;
        const remaining = fuel - totalRequired;
        
        return {
          type: 'required',
          tripFuel: convertFromGallons(tripFuel, fuelUnit),
          reserveFuel: convertFromGallons(reserveFuel, fuelUnit),
          totalRequired: convertFromGallons(totalRequired, fuelUnit),
          remaining: convertFromGallons(remaining, fuelUnit),
          sufficient: remaining >= 0
        };
      }
      case 'range': {
        if (gs <= 0 || burnRate <= 0) return null;
        const tripTime = distance / gs;
        const tripFuel = burnRate * tripTime;
        const reserveFuel = burnRate * reserve;
        const totalRequired = tripFuel + reserveFuel;
        const remaining = fuel - totalRequired;
        
        return {
          type: 'range',
          tripTime,
          tripFuel: convertFromGallons(tripFuel, fuelUnit),
          reserveFuel: convertFromGallons(reserveFuel, fuelUnit),
          totalRequired: convertFromGallons(totalRequired, fuelUnit),
          remaining: convertFromGallons(remaining, fuelUnit),
          sufficient: remaining >= 0
        };
      }
    }
  }, [mode, fuelOnboard, fuelBurnRate, tripTime, tripDistance, groundSpeed, reserveMinutes, fuelUnit]);

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const unitLabel = fuelUnit === 'gal' ? 'gal' : fuelUnit === 'lbs' ? 'lbs' : 'L';
  const rateLabel = fuelUnit === 'gal' ? 'gal/hr' : fuelUnit === 'lbs' ? 'lbs/hr' : 'L/hr';

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-3">Calculate</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            aria-pressed={mode === 'endurance'}
            onClick={() => setMode('endurance')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'endurance' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Endurance
          </button>
          <button
            aria-pressed={mode === 'required'}
            onClick={() => setMode('required')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'required' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Fuel required
          </button>
          <button
            aria-pressed={mode === 'range'}
            onClick={() => setMode('range')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'range' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            For Distance
          </button>
        </div>
      </div>

      {/* Unit Selection */}
      <div className="flex gap-2 justify-center">
        {(['gal', 'lbs', 'liters'] as FuelUnit[]).map((unit) => (
          <button
            key={unit}
            aria-pressed={fuelUnit === unit}
            onClick={() => setFuelUnit(unit)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              fuelUnit === unit ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {unit === 'gal' ? 'Gallons' : unit === 'lbs' ? 'Pounds' : 'Liters'}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="av-tools-inputs space-y-4">
        <h3 className="av-tools-section-title">Inputs</h3>
        {/* Fuel Onboard */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label htmlFor="av-tools-fuelcalculator-0" className="block text-sm font-medium text-slate-400 mb-2">Fuel Onboard ({unitLabel})</label>
          <input id="av-tools-fuelcalculator-0"
            type="number"
            value={fuelOnboard}
            onChange={(e) => setFuelOnboard(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="0"
            min="0"
          />
        </div>

        {/* Fuel Burn Rate */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label htmlFor="av-tools-fuelcalculator-1" className="block text-sm font-medium text-slate-400 mb-2">Fuel Burn Rate ({rateLabel})</label>
          <input id="av-tools-fuelcalculator-1"
            type="number"
            value={fuelBurnRate}
            onChange={(e) => setFuelBurnRate(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="0"
            min="0"
            step="0.1"
          />
        </div>

        {/* Mode-specific inputs */}
        {mode === 'required' && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label htmlFor="av-tools-fuelcalculator-2" className="block text-sm font-medium text-slate-400 mb-2">Trip Time (hours)</label>
            <input id="av-tools-fuelcalculator-2"
              type="number"
              value={tripTime}
              onChange={(e) => setTripTime(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
              placeholder="0"
              min="0"
              step="0.1"
            />
          </div>
        )}

        {mode === 'range' && (
          <>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <label htmlFor="av-tools-fuelcalculator-3" className="block text-sm font-medium text-slate-400 mb-2">Distance (nm)</label>
              <input id="av-tools-fuelcalculator-3"
                type="number"
                value={tripDistance}
                onChange={(e) => setTripDistance(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
                placeholder="0"
                min="0"
              />
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <label htmlFor="av-tools-fuelcalculator-4" className="block text-sm font-medium text-slate-400 mb-2">Ground Speed (knots)</label>
              <input id="av-tools-fuelcalculator-4"
                type="number"
                value={groundSpeed}
                onChange={(e) => setGroundSpeed(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
                placeholder="0"
                min="0"
              />
            </div>
          </>
        )}

        {mode === 'endurance' && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label htmlFor="av-tools-fuelcalculator-5" className="block text-sm font-medium text-slate-400 mb-2">Ground Speed (for range, knots)</label>
            <input id="av-tools-fuelcalculator-5"
              type="number"
              value={groundSpeed}
              onChange={(e) => setGroundSpeed(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
              placeholder="0"
              min="0"
            />
          </div>
        )}

        {/* Reserve */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label htmlFor="av-tools-fuelcalculator-6" className="block text-sm font-medium text-slate-400 mb-2">Reserve (minutes)</label>
          <input id="av-tools-fuelcalculator-6"
            type="number"
            value={reserveMinutes}
            onChange={(e) => setReserveMinutes(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="45"
            min="0"
          />
          <p className="text-xs text-slate-500 mt-1">FAA VFR day: 30 min | VFR night: 45 min</p>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-lg p-4 ${
          result.type !== 'endurance' && !result.sufficient 
            ? 'bg-red-900/30 border border-red-700' 
            : 'bg-green-900/30 border border-green-700'
        }`}>
          <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">Result</h4>
          
          {result.type === 'endurance' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{formatTime((result as { totalEndurance: number }).totalEndurance)}</p>
                  <p className="text-slate-400 text-sm">Total Endurance</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{formatTime((result as { usableEndurance: number }).usableEndurance)}</p>
                  <p className="text-slate-400 text-sm">Usable (reserve excluded)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center pt-2 border-t border-slate-700">
                <div>
                  <p className="text-lg font-bold text-white">{(result as { reserveFuel: number }).reserveFuel.toFixed(1)} {unitLabel}</p>
                  <p className="text-slate-400 text-xs">Reserve Fuel</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{(result as { maxRange: number }).maxRange.toFixed(0)} nm</p>
                  <p className="text-slate-400 text-xs">Max Range (usable)</p>
                </div>
              </div>
            </div>
          )}

          {(result.type === 'required' || result.type === 'range') && (
            <div className="space-y-3">
              {result.type === 'range' && (
                <div className="text-center pb-2 border-b border-slate-700">
                  <p className="text-lg font-bold text-white">{formatTime((result as { tripTime: number }).tripTime)}</p>
                  <p className="text-slate-400 text-sm">Estimated Time</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-white">{(result as { tripFuel: number }).tripFuel.toFixed(1)}</p>
                  <p className="text-slate-400 text-xs">Trip ({unitLabel})</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{(result as { reserveFuel: number }).reserveFuel.toFixed(1)}</p>
                  <p className="text-slate-400 text-xs">Reserve ({unitLabel})</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-400">{(result as { totalRequired: number }).totalRequired.toFixed(1)}</p>
                  <p className="text-slate-400 text-xs">Total Req ({unitLabel})</p>
                </div>
              </div>
              <div className="text-center pt-2 border-t border-slate-700">
                <p className={`text-2xl font-bold ${(result as { sufficient: boolean }).sufficient ? 'text-green-400' : 'text-red-400'}`}>
                  {(result as { remaining: number }).remaining >= 0 ? '+' : ''}{(result as { remaining: number }).remaining.toFixed(1)} {unitLabel}
                </p>
                <p className="text-slate-400 text-sm">
                  {(result as { sufficient: boolean }).sufficient ? 'Extra fuel' : 'Fuel shortage!'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reference */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-4">
        <p>Avgas: 6.0 lbs/gal | Jet-A: 6.7 lbs/gal</p>
      </div>
    </div>
  );
}
