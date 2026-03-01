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
    <div className="bg-slate-800 md:rounded-lg md:border md:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-slate-700 flex items-start justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">{airport.icaoId || 'Unknown'}</h2>
          <span 
            className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-white text-xs sm:text-sm font-bold"
            style={{ backgroundColor: getFlightCategoryColor(fltCat) }}
          >
            {fltCat || 'N/A'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Airport name */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <p className="text-slate-300 text-sm">{airport.name || 'Unknown Airport'}</p>
      </div>

      {/* Weather Data - compact grid */}
      <div className="p-3 sm:p-4 grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4">
        <InfoItem label="Visibility" value={formatVisibility(airport.visib)} />
        <InfoItem label="Wind" value={formatWind(airport.wdir, airport.wspd, airport.wgst)} />
        <InfoItem label="Temp" value={formatTemperature(airport.temp)} />
        <InfoItem label="Dewpoint" value={airport.dewp != null ? `${Math.round(airport.dewp)}°C` : '--'} />
        <InfoItem label="Altimeter" value={formatAltimeter(airport.altim)} />
        <InfoItem label="Observed" value={formatObsTime(airport.obsTime)} />
      </div>

      {/* Clouds */}
      {airport.clouds && airport.clouds.length > 0 && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <h3 className="text-xs text-slate-400 mb-1.5 sm:mb-2">Clouds</h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {airport.clouds.map((cloud, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-700 rounded text-xs sm:text-sm">
                {cloud.cover} @ {cloud.base?.toLocaleString() ?? '--'} ft
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Raw METAR - collapsible on mobile */}
      {airport.rawOb && (
        <details className="border-t border-slate-700">
          <summary className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-slate-400 cursor-pointer hover:bg-slate-700/50">
            Raw METAR
          </summary>
          <pre className="mx-3 sm:mx-4 mb-3 sm:mb-4 text-xs bg-slate-900 p-2 sm:p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
            {airport.rawOb}
          </pre>
        </details>
      )}

      {/* Flight Category Legend - hidden on mobile */}
      <div className="hidden sm:block p-4 border-t border-slate-700">
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
      <span className="text-slate-400 text-xs">{label}</span>
      <p className="font-medium text-sm sm:text-base">{value}</p>
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
