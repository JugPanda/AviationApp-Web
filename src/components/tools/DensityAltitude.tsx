'use client';

import { useState, useEffect, useMemo } from 'react';

export default function DensityAltitude() {
  const [fieldElevation, setFieldElevation] = useState(0);
  const [temperature, setTemperature] = useState(15);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [altimeter, setAltimeter] = useState(29.92);
  const [dewpoint, setDewpoint] = useState<number | ''>('');

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem('density-alt-prefs');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.fieldElevation) setFieldElevation(data.fieldElevation);
        if (data.tempUnit) setTempUnit(data.tempUnit);
      } catch {}
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('density-alt-prefs', JSON.stringify({
      fieldElevation,
      tempUnit
    }));
  }, [fieldElevation, tempUnit]);

  const calculations = useMemo(() => {
    // Convert temperature to Celsius if needed
    const tempC = tempUnit === 'F' ? (temperature - 32) * 5/9 : temperature;
    const dewpointC = dewpoint !== '' 
      ? (tempUnit === 'F' ? (dewpoint - 32) * 5/9 : dewpoint)
      : null;

    // Pressure altitude calculation
    // PA = Field Elevation + ((29.92 - Altimeter) × 1000)
    const pressureAltitude = fieldElevation + ((29.92 - altimeter) * 1000);

    // Standard temperature at pressure altitude
    // ISA temp decreases 2°C per 1000 ft from 15°C at sea level
    const standardTemp = 15 - (pressureAltitude / 1000) * 2;
    const tempDeviation = tempC - standardTemp;

    // Density altitude (simplified Koch method)
    // DA = PA + (120 × (OAT - ISA_Temp))
    let densityAltitude = pressureAltitude + (120 * tempDeviation);

    // Humidity correction if dewpoint provided
    let humidityCorrection = 0;
    if (dewpointC !== null) {
      // Calculate relative humidity effect on density altitude
      // Higher humidity = higher DA (but effect is relatively small)
      const spreadC = tempC - dewpointC;
      // Approximate correction: about 50-100ft per 10°C spread at sea level
      if (spreadC >= 0 && spreadC < 20) {
        humidityCorrection = (20 - spreadC) * 5; // Max ~100ft correction
        densityAltitude += humidityCorrection;
      }
    }

    // Performance impact assessment
    let performanceImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
    let performanceColor: string;
    let performanceDescription: string;

    const daDiff = densityAltitude - fieldElevation;

    if (daDiff < 1000) {
      performanceImpact = 'minimal';
      performanceColor = 'text-green-400';
      performanceDescription = 'Near standard conditions';
    } else if (daDiff < 2500) {
      performanceImpact = 'moderate';
      performanceColor = 'text-yellow-400';
      performanceDescription = 'Expect longer takeoff roll';
    } else if (daDiff < 4000) {
      performanceImpact = 'significant';
      performanceColor = 'text-orange-400';
      performanceDescription = 'Significantly reduced performance';
    } else {
      performanceImpact = 'severe';
      performanceColor = 'text-red-400';
      performanceDescription = 'Severely reduced performance - use caution!';
    }

    // Estimate performance reductions
    // Rule of thumb: ~10% performance loss per 3000ft density altitude
    const performanceFactor = densityAltitude / 3000 * 0.10;
    const takeoffRollIncrease = Math.round(performanceFactor * 100);
    const climbRateReduction = Math.round(performanceFactor * 100);

    return {
      tempC,
      pressureAltitude: Math.round(pressureAltitude),
      standardTemp: Math.round(standardTemp),
      tempDeviation: Math.round(tempDeviation),
      densityAltitude: Math.round(densityAltitude),
      humidityCorrection: Math.round(humidityCorrection),
      performanceImpact,
      performanceColor,
      performanceDescription,
      takeoffRollIncrease,
      climbRateReduction,
      daDiff: Math.round(daDiff)
    };
  }, [fieldElevation, temperature, tempUnit, altimeter, dewpoint]);

  // Visual gauge for density altitude
  const DensityAltitudeGauge = () => {
    const maxDA = 12000;
    const percentage = Math.min(Math.max(calculations.densityAltitude / maxDA, 0), 1);
    const circumference = 2 * Math.PI * 80;
    const offset = circumference * (1 - percentage * 0.75);

    // Color based on DA
    let gaugeColor = '#22c55e';
    if (calculations.densityAltitude > 8000) gaugeColor = '#ef4444';
    else if (calculations.densityAltitude > 5000) gaugeColor = '#f97316';
    else if (calculations.densityAltitude > 3000) gaugeColor = '#eab308';

    return (
      <div className="relative w-48 h-48 mx-auto">
        <svg className="w-full h-full transform -rotate-[135deg]" viewBox="0 0 180 180">
          {/* Background arc */}
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke="#334155"
            strokeWidth="12"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: gaugeColor }}>
            {calculations.densityAltitude.toLocaleString()}
          </span>
          <span className="text-sm text-slate-400">feet</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Field Elevation (ft)
          </label>
          <input
            type="number"
            value={fieldElevation}
            onChange={(e) => setFieldElevation(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Altimeter Setting (inHg)
          </label>
          <input
            type="number"
            step="0.01"
            value={altimeter}
            onChange={(e) => setAltimeter(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            placeholder="29.92"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Temperature
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              <button
                onClick={() => setTempUnit('C')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${tempUnit === 'C' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                °C
              </button>
              <button
                onClick={() => setTempUnit('F')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${tempUnit === 'F' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                °F
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Dewpoint (optional)
          </label>
          <input
            type="number"
            value={dewpoint}
            onChange={(e) => setDewpoint(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500"
            placeholder={`°${tempUnit}`}
          />
        </div>
      </div>

      {/* Results */}
      <div className="bg-slate-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-center mb-4">Density Altitude</h3>
        <DensityAltitudeGauge />
        
        <div className={`text-center mt-4 ${calculations.performanceColor}`}>
          <span className="font-medium">{calculations.performanceDescription}</span>
        </div>
      </div>

      {/* Calculation breakdown */}
      <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-slate-400">Calculation Breakdown</h4>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Field Elevation:</span>
            <span className="font-medium">{fieldElevation.toLocaleString()} ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Pressure Altitude:</span>
            <span className="font-medium">{calculations.pressureAltitude.toLocaleString()} ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Std Temp @ PA:</span>
            <span className="font-medium">{calculations.standardTemp}°C</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Temp Deviation:</span>
            <span className={`font-medium ${calculations.tempDeviation > 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {calculations.tempDeviation > 0 ? '+' : ''}{calculations.tempDeviation}°C
            </span>
          </div>
          {calculations.humidityCorrection > 0 && (
            <div className="flex justify-between col-span-2">
              <span className="text-slate-400">Humidity Correction:</span>
              <span className="font-medium text-blue-400">+{calculations.humidityCorrection} ft</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 pt-3 mt-3">
          <div className="flex justify-between text-lg">
            <span className="text-slate-300">Density Altitude:</span>
            <span className="font-bold">{calculations.densityAltitude.toLocaleString()} ft</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {calculations.daDiff > 0 
              ? `+${calculations.daDiff.toLocaleString()} ft above field elevation`
              : `${calculations.daDiff.toLocaleString()} ft relative to field`}
          </p>
        </div>
      </div>

      {/* Performance impact indicators */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-400 mb-1">Takeoff Roll</p>
          <p className="text-2xl font-bold text-orange-400">
            +{calculations.takeoffRollIncrease}%
          </p>
          <p className="text-xs text-slate-500">estimated increase</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-400 mb-1">Rate of Climb</p>
          <p className="text-2xl font-bold text-orange-400">
            -{calculations.climbRateReduction}%
          </p>
          <p className="text-xs text-slate-500">estimated reduction</p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Tips</h4>
        <ul className="text-sm text-slate-300 space-y-1">
          <li>• High density altitude = reduced aircraft performance</li>
          <li>• Consider takeoff in cooler parts of the day</li>
          <li>• Verify takeoff distance using POH performance charts</li>
          <li>• Factor in runway slope and surface conditions</li>
        </ul>
      </div>
    </div>
  );
}
