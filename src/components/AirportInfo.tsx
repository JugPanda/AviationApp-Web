'use client';

import { useState, useEffect } from 'react';
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

// Convert ICAO to FAA identifier for US airports
function icaoToFaa(icao: string): string {
  if (icao.startsWith('K') && icao.length === 4) {
    return icao.slice(1); // KJFK -> JFK
  }
  return icao;
}

// External resource links
function getAirportLinks(icao: string) {
  const faa = icaoToFaa(icao);
  return {
    airnav: `https://www.airnav.com/airport/${faa}`,
    skyvector: `https://skyvector.com/airport/${icao}`,
    faaCharts: `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/search/results/?cycle=current&ident=${faa}`,
    flightaware: `https://flightaware.com/live/airport/${icao}`,
    aopa: `https://www.aopa.org/destinations/airports/${faa}/details`,
  };
}

export default function AirportInfo({ airport, onClose }: AirportInfoProps) {
  const [activeTab, setActiveTab] = useState<'weather' | 'info' | 'charts'>('weather');
  
  if (!airport) return null;

  const fltCat = airport.fltCat ?? null;
  const links = getAirportLinks(airport.icaoId || '');
  const faaId = icaoToFaa(airport.icaoId || '');

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
        <p className="text-slate-500 text-xs mt-0.5">
          {airport.lat?.toFixed(4)}°, {airport.lon?.toFixed(4)}°
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <TabButton active={activeTab === 'weather'} onClick={() => setActiveTab('weather')}>
          ☁️ Weather
        </TabButton>
        <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
          ℹ️ Info
        </TabButton>
        <TabButton active={activeTab === 'charts'} onClick={() => setActiveTab('charts')}>
          🗺️ Charts
        </TabButton>
      </div>

      {/* Weather Tab */}
      {activeTab === 'weather' && (
        <>
          {/* Weather Data - compact grid */}
          <div className="p-3 sm:p-4 grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4">
            <InfoItem label="Visibility" value={formatVisibility(airport.visib)} />
            <InfoItem label="Wind" value={formatWind(airport.wdir, airport.wspd, airport.wgst)} />
            <InfoItem label="Temp" value={formatTemperature(airport.temp)} />
            <InfoItem label="Dewpoint" value={airport.dewp != null ? `${Math.round(airport.dewp)}°C` : '--'} />
            <InfoItem label="Altimeter" value={formatAltimeter(airport.altim)} />
            <InfoItem label="Observed" value={formatObsTime(airport.obsTime)} />
          </div>

          {/* Wind Direction Indicator */}
          {airport.wdir != null && airport.wspd != null && airport.wspd > 0 && (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3">
                <div 
                  className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center"
                  style={{ transform: `rotate(${airport.wdir}deg)` }}
                >
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M16 4 L16 28 M16 4 L10 12 M16 4 L22 12" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {airport.wdir}° at {airport.wspd} kt
                    {airport.wgst && <span className="text-yellow-400"> G{airport.wgst}</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    From the {getWindDirection(airport.wdir)}
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {/* Raw METAR */}
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
        </>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="p-3 sm:p-4 space-y-4">
          <div>
            <h3 className="text-xs text-slate-400 mb-2">Quick Links</h3>
            <div className="grid grid-cols-2 gap-2">
              <ExternalLink href={links.airnav} icon="🛫">
                AirNav Details
              </ExternalLink>
              <ExternalLink href={links.skyvector} icon="🧭">
                SkyVector
              </ExternalLink>
              <ExternalLink href={links.flightaware} icon="✈️">
                Live Traffic
              </ExternalLink>
              <ExternalLink href={links.aopa} icon="📋">
                AOPA Info
              </ExternalLink>
            </div>
          </div>

          <div>
            <h3 className="text-xs text-slate-400 mb-2">Identifier</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="ICAO" value={airport.icaoId || '--'} />
              <InfoItem label="FAA/Local" value={faaId || '--'} />
            </div>
          </div>

          {/* Flight Category Legend */}
          <div>
            <h3 className="text-xs text-slate-400 mb-2">Flight Categories</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <LegendItem color="bg-vfr" label="VFR" desc=">3000ft, >5SM" />
              <LegendItem color="bg-mvfr" label="MVFR" desc="1000-3000ft, 3-5SM" />
              <LegendItem color="bg-ifr" label="IFR" desc="500-1000ft, 1-3SM" />
              <LegendItem color="bg-lifr" label="LIFR" desc="<500ft, <1SM" />
            </div>
          </div>
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <div className="p-3 sm:p-4 space-y-4">
          <div>
            <h3 className="text-xs text-slate-400 mb-2">Airport Diagrams & Charts</h3>
            <div className="space-y-2">
              <ExternalLink href={links.faaCharts} icon="📄" fullWidth>
                FAA Airport Diagram (d-TPP)
              </ExternalLink>
              <ExternalLink 
                href={`https://skyvector.com/airport/${airport.icaoId}`} 
                icon="🗺️" 
                fullWidth
              >
                Sectional Chart View
              </ExternalLink>
              <ExternalLink 
                href={`https://www.airnav.com/airport/${faaId}#fuel`} 
                icon="⛽" 
                fullWidth
              >
                FBO & Fuel Prices
              </ExternalLink>
              <ExternalLink 
                href={`https://www.airnav.com/airport/${faaId}#runways`} 
                icon="🛬" 
                fullWidth
              >
                Runway Information
              </ExternalLink>
              <ExternalLink 
                href={`https://www.airnav.com/airport/${faaId}#comm`} 
                icon="📻" 
                fullWidth
              >
                Radio Frequencies
              </ExternalLink>
            </div>
          </div>

          <div className="text-xs text-slate-500 text-center">
            Links open in a new tab to official sources
          </div>
        </div>
      )}
    </div>
  );
}

// Get cardinal direction from degrees
function getWindDirection(degrees: number): string {
  const directions = ['North', 'NNE', 'NE', 'ENE', 'East', 'ESE', 'SE', 'SSE', 
                      'South', 'SSW', 'SW', 'WSW', 'West', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      )}
    >
      {children}
    </button>
  );
}

function ExternalLink({ href, icon, children, fullWidth }: { href: string; icon: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm transition-colors',
        fullWidth && 'w-full'
      )}
    >
      <span>{icon}</span>
      <span className="flex-1">{children}</span>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
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
