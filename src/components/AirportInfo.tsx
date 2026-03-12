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
import WindDisplay from '@/components/weather/WindDisplay';
import CloudVisualization from '@/components/weather/CloudVisualization';

interface AirportInfoProps {
  airport: MetarData | null;
  onClose: () => void;
}

interface AirportDetails {
  airport: {
    ident: string;
    type: string;
    name: string;
    elevation_ft: number | null;
    municipality: string;
    iso_region: string;
    home_link: string;
    wikipedia_link: string;
  };
  runways: {
    le_ident: string;
    he_ident: string;
    length_ft: number | null;
    width_ft: number | null;
    surface: string;
    lighted: boolean;
    closed: boolean;
    le_heading_degT: number | null;
  }[];
  frequencies: {
    type: string;
    description: string;
    frequency_mhz: string;
  }[];
}

interface TafData {
  icaoId: string;
  rawTaf: string;
  issueTime: string;
  validFrom: string;
  validTo: string;
  forecasts: {
    type: string;
    raw: string;
    wind?: { direction: number | string; speed: number; gust?: number };
    visibility?: { value: number; unit: string };
    clouds?: { cover: string; base: number }[];
    weather?: string[];
  }[];
}

interface NotamData {
  id: string;
  icaoId: string;
  type: string;
  text: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high';
}

// Convert ICAO to FAA identifier for US airports
function icaoToFaa(icao: string): string {
  if (icao.startsWith('K') && icao.length === 4) {
    return icao.slice(1);
  }
  return icao;
}

export default function AirportInfo({ airport, onClose }: AirportInfoProps) {
  const [activeTab, setActiveTab] = useState<'weather' | 'taf' | 'notams' | 'info' | 'runways' | 'frequencies'>('weather');
  const [details, setDetails] = useState<AirportDetails | null>(null);
  const [tafData, setTafData] = useState<TafData | null>(null);
  const [notams, setNotams] = useState<NotamData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tafLoading, setTafLoading] = useState(false);
  const [notamLoading, setNotamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!airport?.icaoId) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`/api/airport/${airport.icaoId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load airport details');
        return res.json();
      })
      .then(data => {
        setDetails(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load airport details:', err);
        setError('Could not load airport details');
        setLoading(false);
      });
  }, [airport?.icaoId]);

  // Fetch TAF when TAF tab is selected
  useEffect(() => {
    if (activeTab !== 'taf' || !airport?.icaoId) return;
    if (tafData?.icaoId === airport.icaoId) return;
    
    setTafLoading(true);
    fetch(`/api/taf?ids=${airport.icaoId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTafData(data[0]);
        }
        setTafLoading(false);
      })
      .catch(() => setTafLoading(false));
  }, [activeTab, airport?.icaoId, tafData?.icaoId]);

  // Fetch NOTAMs when NOTAMs tab is selected
  useEffect(() => {
    if (activeTab !== 'notams' || !airport?.icaoId) return;
    if (notams.length > 0 && notams[0]?.icaoId === airport.icaoId) return;
    
    setNotamLoading(true);
    fetch(`/api/notam/${airport.icaoId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotams(data);
        }
        setNotamLoading(false);
      })
      .catch(() => setNotamLoading(false));
  }, [activeTab, airport?.icaoId, notams]);
  
  if (!airport) return null;

  const fltCat = airport.fltCat ?? null;
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
      
      {/* Airport name & location */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <p className="text-slate-300 text-sm">{airport.name || details?.airport?.name || 'Unknown Airport'}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
          {details?.airport?.municipality && (
            <span>{details.airport.municipality}, {details.airport.iso_region?.split('-')[1]}</span>
          )}
          {details?.airport?.elevation_ft && (
            <span>• Elev: {details.airport.elevation_ft.toLocaleString()} ft</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        <TabButton active={activeTab === 'weather'} onClick={() => setActiveTab('weather')}>
          ☁️ METAR
        </TabButton>
        <TabButton active={activeTab === 'taf'} onClick={() => setActiveTab('taf')}>
          📋 TAF
        </TabButton>
        <TabButton active={activeTab === 'notams'} onClick={() => setActiveTab('notams')}>
          ⚠️ NOTAMs
        </TabButton>
        <TabButton active={activeTab === 'runways'} onClick={() => setActiveTab('runways')}>
          🛬 Runways
        </TabButton>
        <TabButton active={activeTab === 'frequencies'} onClick={() => setActiveTab('frequencies')}>
          📻 Freq
        </TabButton>
      </div>

      {/* Weather Tab */}
      {activeTab === 'weather' && (
        <>
          <div className="p-3 sm:p-4 grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4">
            <InfoItem label="Visibility" value={formatVisibility(airport.visib)} />
            <InfoItem label="Wind" value={formatWind(airport.wdir, airport.wspd, airport.wgst)} />
            <InfoItem label="Temp" value={formatTemperature(airport.temp)} />
            <InfoItem label="Dewpoint" value={airport.dewp != null ? `${Math.round(airport.dewp)}°C` : '--'} />
            <InfoItem label="Altimeter" value={formatAltimeter(airport.altim)} />
            <InfoItem label="Observed" value={formatObsTime(airport.obsTime)} />
          </div>

          {/* Wind Display */}
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <h3 className="text-xs text-slate-400 mb-2">Wind</h3>
            <WindDisplay 
              direction={airport.wdir} 
              speed={airport.wspd} 
              gust={airport.wgst}
              size="md"
              showLabel={true}
            />
          </div>

          {/* Clouds Visualization */}
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <h3 className="text-xs text-slate-400 mb-2">Cloud Layers</h3>
            <CloudVisualization 
              clouds={airport.clouds} 
              compact={true}
              showScale={true}
            />
          </div>

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

      {/* TAF Tab */}
      {activeTab === 'taf' && (
        <div className="p-3 sm:p-4">
          {tafLoading && <div className="text-center text-slate-400 py-4">Loading TAF...</div>}
          
          {!tafLoading && !tafData && (
            <div className="text-center text-slate-400 py-4">No TAF available for this airport</div>
          )}
          
          {tafData && (
            <div className="space-y-4">
              {/* TAF Header */}
              <div className="text-xs text-slate-400">
                Valid: {formatTafTime(tafData.validFrom)} to {formatTafTime(tafData.validTo)}
              </div>

              {/* Forecast Periods */}
              <div className="space-y-3">
                {tafData.forecasts.map((fc, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "bg-slate-700/50 rounded-lg p-3",
                      fc.type === 'TEMPO' && "border-l-2 border-amber-500",
                      fc.type === 'PROB' && "border-l-2 border-orange-500",
                      fc.type === 'FM' && "border-l-2 border-blue-500"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded",
                        fc.type === 'BASE' && "bg-slate-600 text-slate-200",
                        fc.type === 'FM' && "bg-blue-900/50 text-blue-300",
                        fc.type === 'TEMPO' && "bg-amber-900/50 text-amber-300",
                        fc.type === 'BECMG' && "bg-purple-900/50 text-purple-300",
                        fc.type === 'PROB' && "bg-orange-900/50 text-orange-300"
                      )}>
                        {fc.type}
                      </span>
                    </div>
                    
                    {/* Parsed conditions */}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {fc.wind && (
                        <div>
                          <span className="text-slate-400 text-xs">Wind</span>
                          <p className="font-medium">
                            {fc.wind.direction}° @ {fc.wind.speed}kt
                            {fc.wind.gust && <span className="text-amber-400"> G{fc.wind.gust}</span>}
                          </p>
                        </div>
                      )}
                      {fc.visibility && (
                        <div>
                          <span className="text-slate-400 text-xs">Visibility</span>
                          <p className="font-medium">{fc.visibility.value} {fc.visibility.unit}</p>
                        </div>
                      )}
                      {fc.clouds && fc.clouds.length > 0 && (
                        <div>
                          <span className="text-slate-400 text-xs">Clouds</span>
                          <p className="font-medium">
                            {fc.clouds.map(c => `${c.cover}${Math.round(c.base / 100).toString().padStart(3, '0')}`).join(' ')}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Weather phenomena */}
                    {fc.weather && fc.weather.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-slate-400">Weather: </span>
                        <span className="text-sm">{fc.weather.join(', ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Raw TAF */}
              <details className="border-t border-slate-700 pt-3">
                <summary className="text-sm text-slate-400 cursor-pointer hover:text-white">
                  Raw TAF
                </summary>
                <pre className="mt-2 text-xs bg-slate-900 p-3 rounded overflow-x-auto whitespace-pre-wrap break-all">
                  {tafData.rawTaf}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {/* NOTAMs Tab */}
      {activeTab === 'notams' && (
        <div className="p-3 sm:p-4">
          {notamLoading && <div className="text-center text-slate-400 py-4">Loading NOTAMs...</div>}
          
          {!notamLoading && notams.length === 0 && (
            <div className="text-center text-slate-400 py-4">No NOTAMs found</div>
          )}
          
          {notams.length > 0 && (
            <div className="space-y-3">
              {/* Sort by severity and type */}
              {[...notams]
                .sort((a, b) => {
                  const sevOrder = { high: 0, medium: 1, low: 2 };
                  return sevOrder[a.severity] - sevOrder[b.severity];
                })
                .map((notam) => (
                <div 
                  key={notam.id}
                  className={cn(
                    "bg-slate-700/50 rounded-lg p-3",
                    notam.severity === 'high' && "border-l-2 border-red-500",
                    notam.severity === 'medium' && "border-l-2 border-amber-500",
                    notam.severity === 'low' && "border-l-2 border-slate-500"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded",
                      notam.type === 'TFR' && "bg-red-900/50 text-red-300",
                      notam.type === 'Runway' && "bg-amber-900/50 text-amber-300",
                      notam.type === 'Airport' && "bg-blue-900/50 text-blue-300",
                      notam.type === 'Obstacle' && "bg-orange-900/50 text-orange-300",
                      notam.type === 'Airspace' && "bg-purple-900/50 text-purple-300",
                      notam.type === 'Other' && "bg-slate-600 text-slate-300"
                    )}>
                      {notam.type}
                    </span>
                    {!notam.isActive && (
                      <span className="text-xs text-slate-500">(Inactive)</span>
                    )}
                  </div>
                  
                  <p className="text-sm font-mono whitespace-pre-wrap break-all">
                    {notam.text}
                  </p>
                  
                  {(notam.effectiveStart || notam.effectiveEnd) && (
                    <div className="mt-2 text-xs text-slate-400">
                      {notam.effectiveStart && <span>From: {formatNotamDate(notam.effectiveStart)}</span>}
                      {notam.effectiveStart && notam.effectiveEnd && <span> | </span>}
                      {notam.effectiveEnd && <span>To: {formatNotamDate(notam.effectiveEnd)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="p-3 sm:p-4 space-y-4">
          {loading && <div className="text-center text-slate-400 py-4">Loading...</div>}
          {error && <div className="text-center text-red-400 py-4">{error}</div>}
          
          {details && (
            <>
              <div>
                <h3 className="text-xs text-slate-400 mb-2">Airport Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="ICAO" value={airport.icaoId || '--'} />
                  <InfoItem label="FAA/Local" value={faaId || '--'} />
                  <InfoItem label="Type" value={formatAirportType(details.airport.type)} />
                  <InfoItem label="Elevation" value={details.airport.elevation_ft ? `${details.airport.elevation_ft.toLocaleString()} ft` : '--'} />
                </div>
              </div>

              {(details.airport.home_link || details.airport.wikipedia_link) && (
                <div>
                  <h3 className="text-xs text-slate-400 mb-2">External Links</h3>
                  <div className="space-y-2">
                    {details.airport.home_link && (
                      <ExternalLink href={details.airport.home_link} icon="🌐">
                        Airport Website
                      </ExternalLink>
                    )}
                    {details.airport.wikipedia_link && (
                      <ExternalLink href={details.airport.wikipedia_link} icon="📖">
                        Wikipedia
                      </ExternalLink>
                    )}
                    <ExternalLink href={`https://skyvector.com/airport/${airport.icaoId}`} icon="🗺️">
                      SkyVector Chart
                    </ExternalLink>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Flight Category Legend */}
          <div>
            <h3 className="text-xs text-slate-400 mb-2">Flight Categories</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <LegendItem color="bg-vfr" label="VFR" desc=">3000', >5SM" />
              <LegendItem color="bg-mvfr" label="MVFR" desc="1-3k', 3-5SM" />
              <LegendItem color="bg-ifr" label="IFR" desc="500-1k', 1-3SM" />
              <LegendItem color="bg-lifr" label="LIFR" desc="<500', <1SM" />
            </div>
          </div>
        </div>
      )}

      {/* Runways Tab */}
      {activeTab === 'runways' && (
        <div className="p-3 sm:p-4">
          {loading && <div className="text-center text-slate-400 py-4">Loading...</div>}
          {error && <div className="text-center text-red-400 py-4">{error}</div>}
          
          {details && details.runways.length === 0 && (
            <div className="text-center text-slate-400 py-4">No runway data available</div>
          )}
          
          {details && details.runways.length > 0 && (
            <div className="space-y-3">
              {details.runways.map((rwy, i) => (
                <div key={i} className={cn(
                  "bg-slate-700/50 rounded-lg p-3",
                  rwy.closed && "opacity-50"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-lg">
                      {rwy.le_ident}/{rwy.he_ident}
                      {rwy.closed && <span className="ml-2 text-xs text-red-400">(CLOSED)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {rwy.lighted && (
                        <span className="text-yellow-400 text-xs">💡 Lighted</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-slate-400 text-xs">Length</span>
                      <p className="font-medium">{rwy.length_ft?.toLocaleString() || '--'} ft</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs">Width</span>
                      <p className="font-medium">{rwy.width_ft || '--'} ft</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs">Surface</span>
                      <p className="font-medium">{formatSurface(rwy.surface)}</p>
                    </div>
                  </div>
                  {rwy.le_heading_degT && (
                    <div className="mt-2 text-xs text-slate-400">
                      Heading: {Math.round(rwy.le_heading_degT)}° / {Math.round((rwy.le_heading_degT + 180) % 360)}°
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Frequencies Tab */}
      {activeTab === 'frequencies' && (
        <div className="p-3 sm:p-4">
          {loading && <div className="text-center text-slate-400 py-4">Loading...</div>}
          {error && <div className="text-center text-red-400 py-4">{error}</div>}
          
          {details && details.frequencies.length === 0 && (
            <div className="text-center text-slate-400 py-4">No frequency data available</div>
          )}
          
          {details && details.frequencies.length > 0 && (
            <div className="space-y-2">
              {/* Group and sort frequencies by type */}
              {sortFrequencies(details.frequencies).map((freq, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                  <div>
                    <div className="font-medium text-sm">{freq.description || freq.type}</div>
                    <div className="text-xs text-slate-400">{formatFreqType(freq.type)}</div>
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-400">
                    {freq.frequency_mhz}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatTafTime(isoTime: string | undefined): string {
  if (!isoTime) return '--';
  try {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return isoTime;
  }
}

function formatNotamDate(isoTime: string | undefined): string {
  if (!isoTime) return '--';
  try {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  } catch {
    return isoTime;
  }
}

function getWindDirection(degrees: number): string {
  const directions = ['North', 'NNE', 'NE', 'ENE', 'East', 'ESE', 'SE', 'SSE', 
                      'South', 'SSW', 'SW', 'WSW', 'West', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function formatAirportType(type: string): string {
  const types: Record<string, string> = {
    'large_airport': 'Large Airport',
    'medium_airport': 'Medium Airport',
    'small_airport': 'Small Airport',
    'heliport': 'Heliport',
    'seaplane_base': 'Seaplane Base',
    'closed': 'Closed',
  };
  return types[type] || type;
}

function formatSurface(surface: string): string {
  if (!surface) return '--';
  const surfaces: Record<string, string> = {
    'ASP': 'Asphalt',
    'CON': 'Concrete',
    'GRS': 'Grass',
    'TURF': 'Turf',
    'GVL': 'Gravel',
    'DIRT': 'Dirt',
    'WATER': 'Water',
  };
  return surfaces[surface.toUpperCase()] || surface;
}

function formatFreqType(type: string): string {
  const types: Record<string, string> = {
    'ATIS': 'ATIS',
    'ASOS': 'ASOS',
    'AWOS': 'AWOS',
    'TWR': 'Tower',
    'GND': 'Ground',
    'DEL': 'Clearance Delivery',
    'APP': 'Approach',
    'DEP': 'Departure',
    'CTAF': 'CTAF',
    'UNICOM': 'UNICOM',
    'MULTICOM': 'MULTICOM',
  };
  return types[type] || type;
}

function sortFrequencies(freqs: { type: string; description: string; frequency_mhz: string }[]) {
  const order = ['ATIS', 'ASOS', 'AWOS', 'DEL', 'GND', 'TWR', 'APP', 'DEP', 'CTAF', 'UNICOM'];
  return [...freqs].sort((a, b) => {
    const aIdx = order.indexOf(a.type);
    const bIdx = order.indexOf(b.type);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
        active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      )}
    >
      {children}
    </button>
  );
}

function ExternalLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm transition-colors w-full"
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
