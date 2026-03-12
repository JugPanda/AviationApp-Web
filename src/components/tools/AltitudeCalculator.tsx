'use client';

import { useState, useMemo } from 'react';

type CalculationMode = 'pressure' | 'density' | 'true' | 'tas';

export default function AltitudeCalculator() {
  const [mode, setMode] = useState<CalculationMode>('pressure');
  
  // Common inputs
  const [indicatedAlt, setIndicatedAlt] = useState<string>('5000');
  const [altimeterSetting, setAltimeterSetting] = useState<string>('29.92');
  const [oat, setOat] = useState<string>('15');
  const [oatUnit, setOatUnit] = useState<'C' | 'F'>('C');
  
  // TAS specific
  const [cas, setCas] = useState<string>('120');

  const oatCelsius = useMemo(() => {
    const temp = parseFloat(oat) || 0;
    return oatUnit === 'C' ? temp : (temp - 32) * 5/9;
  }, [oat, oatUnit]);

  const result = useMemo(() => {
    const ia = parseFloat(indicatedAlt) || 0;
    const altSetting = parseFloat(altimeterSetting) || 29.92;
    const casKts = parseFloat(cas) || 0;

    // Pressure Altitude = Indicated Altitude + ((29.92 - Altimeter Setting) × 1000)
    const pressureAlt = ia + ((29.92 - altSetting) * 1000);

    // Standard temperature at pressure altitude
    // ISA: 15°C at sea level, decreasing 2°C per 1000ft
    const stdTemp = 15 - (pressureAlt / 1000) * 2;
    const tempDeviation = oatCelsius - stdTemp;

    // Density Altitude = Pressure Altitude + (120 × (OAT - Standard Temp))
    const densityAlt = pressureAlt + (120 * tempDeviation);

    // True Altitude (approximate)
    // True Altitude = Indicated Altitude + (4 × Temp Deviation × (Indicated Altitude / 1000))
    const trueAlt = ia + (4 * tempDeviation * (ia / 1000));

    // True Airspeed
    // TAS ≈ CAS × (1 + (Pressure Alt / 60000) + (OAT_deviation / 400))
    // More accurate: TAS = CAS × sqrt(density_ratio)
    // Using simplified: TAS ≈ CAS × (1 + 0.02 × PA/1000)
    const tasRatio = 1 + (pressureAlt / 1000) * 0.02;
    const tas = casKts * tasRatio * (1 + tempDeviation / 400);
    
    // Mach number (approximate)
    // Speed of sound ≈ 661.47 × sqrt((OAT_K) / 288.15) knots
    const oatKelvin = oatCelsius + 273.15;
    const speedOfSound = 661.47 * Math.sqrt(oatKelvin / 288.15);
    const mach = tas / speedOfSound;

    return {
      pressureAlt: Math.round(pressureAlt),
      densityAlt: Math.round(densityAlt),
      trueAlt: Math.round(trueAlt),
      stdTemp: Math.round(stdTemp),
      tempDeviation: Math.round(tempDeviation),
      tas: Math.round(tas),
      mach: mach.toFixed(2),
      speedOfSound: Math.round(speedOfSound)
    };
  }, [indicatedAlt, altimeterSetting, oatCelsius, cas]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Altitude & Airspeed Calculator</h3>
        <p className="text-sm text-slate-400">Pressure, density, true altitude & TAS</p>
      </div>

      {/* Mode Selection */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-400 mb-3">View</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'pressure', label: 'Press Alt' },
            { key: 'density', label: 'Dens Alt' },
            { key: 'true', label: 'True Alt' },
            { key: 'tas', label: 'TAS' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key as CalculationMode)}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Indicated Altitude (ft)</label>
          <input
            type="number"
            value={indicatedAlt}
            onChange={(e) => setIndicatedAlt(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="5000"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Altimeter Setting (inHg)</label>
          <input
            type="number"
            value={altimeterSetting}
            onChange={(e) => setAltimeterSetting(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
            placeholder="29.92"
            step="0.01"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">Outside Air Temperature</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={oat}
              onChange={(e) => setOat(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
              placeholder="15"
            />
            <div className="flex bg-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setOatUnit('C')}
                className={`px-4 py-3 text-sm transition-colors ${
                  oatUnit === 'C' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                °C
              </button>
              <button
                onClick={() => setOatUnit('F')}
                className={`px-4 py-3 text-sm transition-colors ${
                  oatUnit === 'F' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                °F
              </button>
            </div>
          </div>
        </div>

        {mode === 'tas' && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Calibrated Airspeed (CAS/KIAS)</label>
            <input
              type="number"
              value={cas}
              onChange={(e) => setCas(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg"
              placeholder="120"
            />
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Primary Result */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            {mode === 'pressure' && (
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{result.pressureAlt.toLocaleString()} ft</p>
                <p className="text-slate-400 mt-1">Pressure Altitude</p>
                <p className="text-xs text-slate-500 mt-2">
                  {result.pressureAlt > parseFloat(indicatedAlt) ? 'Higher' : 'Lower'} than indicated by{' '}
                  {Math.abs(result.pressureAlt - (parseFloat(indicatedAlt) || 0)).toLocaleString()} ft
                </p>
              </div>
            )}

            {mode === 'density' && (
              <div className="text-center">
                <p className={`text-4xl font-bold ${
                  result.densityAlt > result.pressureAlt ? 'text-amber-400' : 'text-green-400'
                }`}>
                  {result.densityAlt.toLocaleString()} ft
                </p>
                <p className="text-slate-400 mt-1">Density Altitude</p>
                <p className="text-xs text-slate-500 mt-2">
                  Std temp: {result.stdTemp}°C | Deviation: {result.tempDeviation > 0 ? '+' : ''}{result.tempDeviation}°C
                </p>
              </div>
            )}

            {mode === 'true' && (
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{result.trueAlt.toLocaleString()} ft</p>
                <p className="text-slate-400 mt-1">True Altitude (MSL)</p>
                <p className="text-xs text-slate-500 mt-2">
                  Correction: {result.trueAlt - (parseFloat(indicatedAlt) || 0) > 0 ? '+' : ''}
                  {(result.trueAlt - (parseFloat(indicatedAlt) || 0)).toLocaleString()} ft
                </p>
              </div>
            )}

            {mode === 'tas' && (
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{result.tas} kts</p>
                <p className="text-slate-400 mt-1">True Airspeed</p>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xl font-bold text-blue-400">M{result.mach}</p>
                    <p className="text-slate-400 text-sm">Mach Number</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-300">{result.speedOfSound} kts</p>
                    <p className="text-slate-400 text-sm">Speed of Sound</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary Table */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-700">
                <tr className={mode === 'pressure' ? 'bg-blue-900/20' : ''}>
                  <td className="px-4 py-2 text-slate-400">Pressure Altitude</td>
                  <td className="px-4 py-2 text-right text-white font-medium">
                    {result.pressureAlt.toLocaleString()} ft
                  </td>
                </tr>
                <tr className={mode === 'density' ? 'bg-blue-900/20' : ''}>
                  <td className="px-4 py-2 text-slate-400">Density Altitude</td>
                  <td className={`px-4 py-2 text-right font-medium ${
                    result.densityAlt > result.pressureAlt + 500 ? 'text-amber-400' : 'text-white'
                  }`}>
                    {result.densityAlt.toLocaleString()} ft
                  </td>
                </tr>
                <tr className={mode === 'true' ? 'bg-blue-900/20' : ''}>
                  <td className="px-4 py-2 text-slate-400">True Altitude</td>
                  <td className="px-4 py-2 text-right text-white font-medium">
                    {result.trueAlt.toLocaleString()} ft
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-slate-400">Standard Temp</td>
                  <td className="px-4 py-2 text-right text-slate-300">{result.stdTemp}°C</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-slate-400">Temp Deviation</td>
                  <td className={`px-4 py-2 text-right ${
                    result.tempDeviation > 0 ? 'text-red-400' : result.tempDeviation < 0 ? 'text-blue-400' : 'text-slate-300'
                  }`}>
                    {result.tempDeviation > 0 ? '+' : ''}{result.tempDeviation}°C
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formula Reference */}
      <div className="text-center text-xs text-slate-500 border-t border-slate-700 pt-4 space-y-1">
        <p>PA = IA + ((29.92 - altimeter) × 1000)</p>
        <p>DA = PA + (120 × temp deviation)</p>
        <p>ISA: 15°C at SL, -2°C per 1000ft</p>
      </div>
    </div>
  );
}
