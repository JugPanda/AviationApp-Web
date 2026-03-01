'use client';

import { MetarData } from '@/types';
import { 
  getFlightCategoryColor, 
  formatVisibility, 
  formatWind, 
  formatTemperature, 
  formatAltimeter, 
  formatObsTime,
  cn
} from '@/lib/utils';

interface AirportInfoProps {
  airport: MetarData | null;
  onClose: () => void;
}

export default function AirportInfo({ airport, onClose }: AirportInfoProps) {
  if (!airport) return null;

  const fltCat = airport.fltCat ?? null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{airport.icaoId || 'Unknown'}</h2>
            <span 
              className="px-3 py-1 rounded-full text-white text-sm font-bold"
              style={{ backgroundColor: getFlightCategoryColor(fltCat) }}
            >
              {fltCat || 'N/A'}
            </span>
          </div>
          <p className="text-slate-400 mt-1">{airport.name || 'Unknown Airport'}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Weather Data */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <InfoItem label="Visibility" value={formatVisibility(airport.visib)} />
        <InfoItem label="Wind" value={formatWind(airport.wdir, airport.wspd, airport.wgst)} />
        <InfoItem label="Temperature" value={formatTemperature(airport.temp)} />
        <InfoItem 
          label="Dewpoint" 
          value={airport.dewp != null ? `${Math.round(airport.dewp)}°C` : '--'} 
        />
        <InfoItem label="Altimeter" value={formatAltimeter(airport.altim)} />
        <InfoItem label="Observed" value={formatObsTime(airport.obsTime)} />
      </div>

      {/* Clouds */}
      {airport.clouds && airport.clouds.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-sm text-slate-400 mb-2">Cloud Layers</h3>
          <div className="flex flex-wrap gap-2">
            {airport.clouds.map((cloud, i) => (
              <span 
                key={i}
                className="px-2 py-1 bg-slate-700 rounded text-sm"
              >
                {cloud.cover} @ {cloud.base?.toLocaleString() ?? '--'} ft
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Raw METAR */}
      {airport.rawOb && (
        <div className="p-4 border-t border-slate-700">
          <h3 className="text-sm text-slate-400 mb-2">Raw METAR</h3>
          <pre className="text-xs bg-slate-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
            {airport.rawOb}
          </pre>
        </div>
      )}

      {/* Flight Category Legend */}
      <div className="p-4 border-t border-slate-700">
        <h3 className="text-sm text-slate-400 mb-2">Flight Categories</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <LegendItem color="bg-vfr" label="VFR" desc=">3000ft, >5SM" />
          <LegendItem color="bg-mvfr" label="MVFR" desc="1000-3000ft, 3-5SM" />
          <LegendItem color="bg-ifr" label="IFR" desc="500-1000ft, 1-3SM" />
          <LegendItem color="bg-lifr" label="LIFR" desc="<500ft, <1SM" />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400 text-sm">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function LegendItem({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-3 h-3 rounded-full', color)} />
      <span className="font-medium">{label}</span>
      <span className="text-slate-500">{desc}</span>
    </div>
  );
}
