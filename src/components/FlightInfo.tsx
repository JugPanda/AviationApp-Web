'use client';

import { FlightData } from './FlightMarkers';

interface FlightInfoProps {
  flight: FlightData;
  onClose: () => void;
  onTrack: (flightId: string) => void;
  isTracking: boolean;
}

// Convert m/s to knots
const msToKnots = (ms: number) => Math.round(ms * 1.944);

// Convert meters to feet
const metersToFeet = (m: number) => Math.round(m * 3.281);

// Convert m/s to fpm
const msToFpm = (ms: number) => Math.round(ms * 196.85);

const formatCoordinate = (value: number, positiveLabel: string, negativeLabel: string) => {
  const hemisphere = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(4)}°${hemisphere}`;
};

export default function FlightInfo({ flight, onClose, onTrack, isTracking }: FlightInfoProps) {
  return (
    <div className="p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 hover:bg-slate-800 rounded"
        aria-label={`Close flight details for ${flight.callsign || flight.icao24}`}
        title="Close flight details"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Flight ID */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl">✈️</span>
            {flight.callsign}
          </h2>
          <p className="text-sm text-slate-400">
            {[flight.registration, flight.icao24, flight.aircraftType, flight.originCountry].filter(Boolean).join(' • ')}
          </p>
        </div>
        
        <button
          onClick={() => onTrack(flight.icao24)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isTracking 
              ? 'bg-amber-600 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
          }`}
        >
          {isTracking ? '📍 Tracking' : '📍 Track'}
        </button>
      </div>

      {/* Status Badge */}
      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
        flight.onGround 
          ? 'bg-slate-700 text-slate-300' 
          : 'bg-blue-600 text-white'
      }`}>
        {flight.onGround ? '🛬 On Ground' : '🛫 In Flight'}
      </div>

      {/* Flight Data */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Altitude</div>
            <div className="text-xl font-bold">
              {flight.onGround ? '—' : `${metersToFeet(flight.altitude).toLocaleString()}`}
            </div>
            <div className="text-xs text-slate-500">feet MSL</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Ground Speed</div>
            <div className="text-xl font-bold">{msToKnots(flight.velocity)}</div>
            <div className="text-xs text-slate-500">knots</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Heading</div>
            <div className="text-xl font-bold">{Math.round(flight.heading)}°</div>
            <div className="text-xs text-slate-500">magnetic</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Vertical Speed</div>
            <div className="text-xl font-bold flex items-center gap-1">
              {flight.verticalRate > 50 && <span className="text-green-400">↑</span>}
              {flight.verticalRate < -50 && <span className="text-red-400">↓</span>}
              {Math.abs(flight.verticalRate) <= 50 && <span className="text-slate-500">—</span>}
              {Math.abs(msToFpm(flight.verticalRate))}
            </div>
            <div className="text-xs text-slate-500">ft/min</div>
          </div>
        </div>

        {/* Position */}
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Position</div>
          <div className="font-mono text-sm">
            {formatCoordinate(flight.latitude, 'N', 'S')}, {formatCoordinate(flight.longitude, 'E', 'W')}
          </div>
        </div>

        {/* Last Update */}
        <div className="text-xs text-slate-500 text-center">
          Last updated: {new Date(flight.lastUpdate * 1000).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
