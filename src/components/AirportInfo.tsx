'use client';

import { useState, useEffect, useRef } from 'react';
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
import { getCacheFreshness } from '@/lib/cache-freshness';
import { useHydrated } from '@/lib/use-hydrated';
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
  issueTime: string | number;
  validFrom: string | number;
  validTo: string | number;
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

interface NotamResponse {
  notams: NotamData[];
  unavailable?: boolean;
  message?: string;
}

// Convert ICAO to FAA identifier for US airports
function icaoToFaa(icao: string): string {
  if (icao.startsWith('K') && icao.length === 4) {
    return icao.slice(1);
  }
  return icao;
}

interface CachedBriefingPayload {
  details?: AirportDetails | null;
  taf?: TafData | null;
  notams?: NotamData[];
  notamNotice?: string | null;
  // Legacy shared time is retained, never used to infer product freshness.
  cachedAt?: number;
  detailsRetrievedAt?: number;
  tafRetrievedAt?: number;
  notamsRetrievedAt?: number;
}

function getBriefingCacheKey(icaoId: string) {
  return `avweather-briefing-${icaoId.toUpperCase()}`;
}

function loadCachedBriefing(icaoId: string): CachedBriefingPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(getBriefingCacheKey(icaoId));
    return saved ? JSON.parse(saved) as CachedBriefingPayload : null;
  } catch {
    return null;
  }
}

function saveCachedBriefing(icaoId: string, next: Partial<CachedBriefingPayload>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Read/merge at write time so concurrent product responses keep each
    // other's data. A failed read must not turn into an overwriting write.
    const saved = window.localStorage.getItem(getBriefingCacheKey(icaoId));
    const existing = saved ? JSON.parse(saved) as CachedBriefingPayload : {};
    window.localStorage.setItem(getBriefingCacheKey(icaoId), JSON.stringify({ ...existing, ...next }));
    return true;
  } catch {
    return false;
  }
}

function retrievalTime(value?: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Date.now() ? value : null;
}

// The API forwards AWC validity as epoch seconds; older fixtures use ISO.
// Accept milliseconds too, but never pass seconds directly to Date.
function tafTime(value: string | number | undefined): number | null {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : /^\d+(\.\d+)?$/.test(value) ? Number(value) : NaN;
  const time = Number.isFinite(numeric)
    ? numeric < 100_000_000_000 ? numeric * 1000 : numeric
    : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 && Number.isFinite(new Date(time).getTime()) ? time : null;
}

function validTafPeriod(taf: TafData) {
  const from = tafTime(taf.validFrom);
  const to = tafTime(taf.validTo);
  return from !== null && to !== null && from < to;
}

function tafFreshness(taf: TafData | null, retrievedAt: number | null) {
  const freshness = getCacheFreshness(retrievedAt);
  if (!taf) return freshness;
  if (!validTafPeriod(taf)) return 'unknown';
  const validTo = tafTime(taf.validTo);
  if ((validTo !== null && validTo <= Date.now()) || freshness === 'expired') return 'expired';
  if (freshness === 'stale') return 'stale';
  if (validTo === null) return 'unknown';
  return freshness;
}

type AirportTab = 'weather' | 'taf' | 'notams' | 'info' | 'runways' | 'frequencies';

export default function AirportInfo({ airport, onClose }: AirportInfoProps) {
  const [activeTab, setActiveTab] = useState<AirportTab>('weather');
  const hydrated = useHydrated();
  if (!airport) return null;
  if (!hydrated) return <p role="status">Loading saved briefing…</p>;

  // Airport-specific state must not leak across selections. Keep the tab in
  // the parent, but initialize each airport from its own cache before fetching.
  return <AirportBriefing key={airport.icaoId} airport={airport} onClose={onClose} activeTab={activeTab} setActiveTab={setActiveTab} />;
}

function AirportBriefing({ airport, onClose, activeTab, setActiveTab }: {
  airport: MetarData;
  onClose: () => void;
  activeTab: AirportTab;
  setActiveTab: (tab: AirportTab) => void;
}) {
  const [cached] = useState(() => loadCachedBriefing(airport.icaoId));
  const [details, setDetails] = useState<AirportDetails | null>(cached?.details ?? null);
  const [tafData, setTafData] = useState<TafData | null>(cached?.taf ?? null);
  const [notams, setNotams] = useState<NotamData[]>(cached?.notams ?? []);
  const [loading, setLoading] = useState(Boolean(airport.icaoId));
  const [tafLoading, setTafLoading] = useState(false);
  const [notamLoading, setNotamLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notamNotice, setNotamNotice] = useState<string | null>(cached?.notamNotice ?? null);
  const [detailsRetrievedAt, setDetailsRetrievedAt] = useState(() => retrievalTime(cached?.detailsRetrievedAt));
  const [tafRetrievedAt, setTafRetrievedAt] = useState(() => retrievalTime(cached?.tafRetrievedAt));
  const [notamsRetrievedAt, setNotamsRetrievedAt] = useState(() => retrievalTime(cached?.notamsRetrievedAt));
  const [tafError, setTafError] = useState(false);
  const [tafRetry, setTafRetry] = useState(0);
  const [notamRetry, setNotamRetry] = useState(0);
  const [storageWarning, setStorageWarning] = useState(false);
  // This request snapshot changes only on successful retrieval, not on metadata
  // updates. Keeping it outside effect dependencies prevents retry/render loops.
  const tafSnapshot = useRef({ data: tafData, retrievedAt: tafRetrievedAt });
  const lastTafRetry = useRef(0);

  // Re-evaluate visible age/validity as time passes, without automatically
  // retrying a failed provider. Selection or the retry button drives requests.
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick(value => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!airport.icaoId) return;
    let ignore = false;
    fetch(`/api/airport/${airport.icaoId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load airport details');
        return res.json();
      })
      .then(data => {
        if (ignore) return;
        const retrievedAt = Date.now();
        setDetails(data);
        setDetailsRetrievedAt(retrievedAt);
        if (!saveCachedBriefing(airport.icaoId, { details: data, detailsRetrievedAt: retrievedAt })) setStorageWarning(true);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError(cached?.details ? 'Airport details refresh unavailable. Showing saved details.' : 'Could not load airport details');
        setLoading(false);
      });
    return () => { ignore = true; };
  }, [airport.icaoId, cached]);

  useEffect(() => {
    if (activeTab !== 'taf' || !airport.icaoId) return;
    const snapshot = tafSnapshot.current;
    const force = lastTafRetry.current !== tafRetry;
    lastTafRetry.current = tafRetry;
    if (!force && tafFreshness(snapshot.data, snapshot.retrievedAt) === 'fresh') {
      setTafLoading(false);
      return;
    }
    let ignore = false;
    const loadTaf = async () => {
      setTafLoading(true);
      try {
        const res = await fetch(`/api/taf?ids=${airport.icaoId}`);
        if (!res.ok) throw new Error('Failed to load TAF');
        const data = res.status === 204 ? [] : await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid TAF response');
        const nextTaf = data.length === 0 ? null : data.find(item => item?.icaoId === airport.icaoId);
        if (data.length > 0 && (!nextTaf || typeof nextTaf.rawTaf !== 'string' || !nextTaf.rawTaf.trim() || !Array.isArray(nextTaf.forecasts) || !validTafPeriod(nextTaf))) {
          throw new Error('Invalid TAF response');
        }
        if (ignore) return;
        const retrievedAt = Date.now();
        tafSnapshot.current = { data: nextTaf, retrievedAt };
        setTafData(nextTaf);
        setTafRetrievedAt(retrievedAt);
        setTafError(false);
        if (!saveCachedBriefing(airport.icaoId, { taf: nextTaf, tafRetrievedAt: retrievedAt })) setStorageWarning(true);
      } catch {
        // Retain the last successful report and its original retrieval time.
        if (!ignore) setTafError(true);
      } finally {
        if (!ignore) setTafLoading(false);
      }
    };
    void loadTaf();
    return () => { ignore = true; };
  }, [activeTab, airport.icaoId, tafRetry]);

  useEffect(() => {
    if (activeTab !== 'notams' || !airport.icaoId) return;
    let ignore = false;
    const loadNotams = async () => {
      setNotamLoading(true);
      try {
        const res = await fetch(`/api/notam/${airport.icaoId}`);
        const data: NotamResponse = await res.json();
        if (data?.unavailable) throw new Error(data.message || 'Live NOTAM source unavailable right now.');
        if (!res.ok || !Array.isArray(data?.notams)) throw new Error('NOTAM source unavailable right now.');
        if (ignore) return;
        const retrievedAt = Date.now();
        setNotams(data.notams);
        setNotamNotice(null);
        setNotamsRetrievedAt(retrievedAt);
        if (!saveCachedBriefing(airport.icaoId, { notams: data.notams, notamNotice: null, notamsRetrievedAt: retrievedAt })) setStorageWarning(true);
      } catch (error) {
        if (!ignore) setNotamNotice(`${error instanceof Error ? error.message : 'NOTAM source unavailable right now.'} Verify with an official briefing. Any saved reports below are not a current briefing.`);
      } finally {
        if (!ignore) setNotamLoading(false);
      }
    };
    void loadNotams();
    return () => { ignore = true; };
  }, [activeTab, airport.icaoId, notamRetry]);
  
  if (!airport) return null;

  const fltCat = airport.fltCat ?? null;
  const faaId = icaoToFaa(airport.icaoId || '');
  const observationDate = airport.obsTime == null ? null : new Date(airport.obsTime * 1000);
  const observationLabel = observationDate && Number.isFinite(observationDate.getTime())
    ? observationDate.toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Not reported';
  const forecastFreshness = tafFreshness(tafData, tafRetrievedAt);

  return (
    <div className="av-airport-card bg-slate-800 md:rounded-lg md:border md:border-slate-700 overflow-hidden">
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
          aria-label={`Close airport briefing for ${airport.icaoId || 'selected airport'}`}
          title="Close airport briefing"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Airport name & location */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <p className="text-slate-300 text-sm">{airport.name || details?.airport?.name || 'Unknown Airport'}</p>
        <p className="av-observation-time"><strong>Observation:</strong> {observationLabel}<br /><span>Check report age. Retrieval time is not observation time.</span></p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
          {details?.airport?.municipality && (
            <span>{details.airport.municipality}, {details.airport.iso_region?.split('-')[1]}</span>
          )}
          {details?.airport?.elevation_ft && (
            <span>• Elev: {details.airport.elevation_ft.toLocaleString()} ft</span>
          )}
        </div>
        {storageWarning && (
          <p role="status" className="mt-2 break-words text-xs text-amber-100">
            Some retrieved data is not saved for offline use. Browser storage is unavailable or full.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        <TabButton active={activeTab === 'weather'} onClick={() => setActiveTab('weather')}>
          Conditions
        </TabButton>
        <TabButton active={activeTab === 'taf'} onClick={() => setActiveTab('taf')}>
          Forecast
        </TabButton>
        <TabButton active={activeTab === 'notams'} onClick={() => setActiveTab('notams')}>
          NOTAMs
        </TabButton>
        <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
          Airport
        </TabButton>
        <TabButton active={activeTab === 'runways'} onClick={() => setActiveTab('runways')}>
          Runways
        </TabButton>
        <TabButton active={activeTab === 'frequencies'} onClick={() => setActiveTab('frequencies')}>
          Frequencies
        </TabButton>
      </div>

      {(activeTab === 'info' || activeTab === 'runways' || activeTab === 'frequencies') && (
        <div className="px-3 sm:px-4 pt-3">
          <ProductRetrieval label="Airport details" retrievedAt={detailsRetrievedAt} />
        </div>
      )}

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
          <ProductRetrieval label="TAF" retrievedAt={tafRetrievedAt} />
          {tafLoading && <p role="status" className="my-3 text-sm text-slate-400">Refreshing TAF…</p>}
          {tafData && forecastFreshness !== 'fresh' && (
            <p role="status" className="my-3 break-words rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {forecastFreshness === 'expired' ? 'Expired TAF' : forecastFreshness === 'stale' ? 'Stale TAF' : 'TAF freshness unknown'} — do not rely on this as a current forecast. Verify with an official briefing.
            </p>
          )}
          {tafError && (
            <p role="alert" className="my-3 break-words text-sm text-amber-100">
              {tafData ? 'TAF refresh unavailable. Showing the last retrieved forecast.' : 'TAF unavailable. The source could not be checked; this does not mean no forecast was issued.'}
            </p>
          )}
          {!tafLoading && !tafError && !tafData && tafRetrievedAt !== null && (
            <p className="my-3 break-words text-sm text-slate-300">
              No TAF issued for this airport in the last successful source check.
              {forecastFreshness !== 'fresh' && ' That check is stale; refresh to verify current availability.'}
            </p>
          )}
          <button type="button" disabled={tafLoading} onClick={() => setTafRetry(value => value + 1)} className="mb-3 min-h-11 rounded border border-slate-500 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">
            {tafError ? 'Retry TAF' : 'Refresh TAF'}
          </button>
          {tafData && (
            <div className="space-y-4">
              {/* TAF Header */}
              <div className="text-xs text-slate-400">
                <p>Issued: {formatTafTime(tafData.issueTime)}</p>
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
          <ProductRetrieval label="NOTAMs" retrievedAt={notamsRetrievedAt} />
          {notamLoading && <div className="text-center text-slate-400 py-4">Loading NOTAMs...</div>}

          {notamNotice && (
            <div role="status" className="my-3 break-words rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {notamNotice}
            </div>
          )}
          {notamNotice && <button type="button" disabled={notamLoading} onClick={() => setNotamRetry(value => value + 1)} className="mb-3 min-h-11 rounded border border-slate-500 px-3 py-2 text-sm disabled:opacity-50">Retry NOTAMs</button>}
          
          {!notamLoading && notams.length === 0 && !notamNotice && notamsRetrievedAt !== null && (
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
function ProductRetrieval({ label, retrievedAt }: { label: string; retrievedAt: number | null }) {
  const freshness = getCacheFreshness(retrievedAt);
  return (
    <p className="mb-3 min-w-0 break-words text-xs leading-relaxed text-slate-300">
      <strong>{label} retrieved:</strong> {retrievedAt === null ? 'Unknown' : formatTafTime(retrievedAt)}
      {freshness !== 'fresh' && <span className="text-amber-100"> · {freshness === 'unknown' ? 'Freshness unknown' : freshness === 'expired' ? 'Retrieval expired' : 'Retrieval stale'}</span>}
    </p>
  );
}

function formatTafTime(value: string | number | undefined): string {
  const time = tafTime(value);
  if (time === null) return 'Unknown';
  return new Date(time).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
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
      aria-pressed={active}
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
