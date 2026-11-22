'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import AppShell, { useBrowserReady } from '@/components/AppShell';
import MapWrapper from '@/components/MapWrapper';
import SearchBar from '@/components/SearchBar';
import WorkspaceDialog from '@/components/WorkspaceDialog';
import './map.css';
import AirportInfo from '@/components/AirportInfo';
import FlightInfo from '@/components/FlightInfo';
import MapBrief from '@/components/MapBrief';
import PwaStatus from '@/components/PwaStatus';
import { FlightData } from '@/components/FlightMarkers';
import { MetarData } from '@/types';
import { formatCacheAge } from '@/lib/cache-freshness';
import { findBestTrackedFlight, getFlightDisplayLabel, getFlightSearchHint, getTrackedRefreshQuery, isFlightTracked, normalizeFlightIdentifier } from '@/lib/flight-tracking';
import { getFlightCategoryColor } from '@/lib/utils';
import { US_STATES, US_REGIONS } from '@/lib/airports';

const TRAFFIC_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LICENSED_TRAFFIC === 'true';
const FLIGHT_CATEGORIES = ['VFR', 'MVFR', 'IFR', 'LIFR'] as const;
const RECENT_BRIEFINGS_KEY = 'avweather-recent-briefings';

interface RecentBriefing {
  airport: MetarData;
  cachedAt: number;
}

function mergeFlightResults(...flightGroups: FlightData[][]): FlightData[] {
  const merged = new Map<string, FlightData>()

  for (const flights of flightGroups) {
    for (const flight of flights) {
      const key = normalizeFlightIdentifier(flight.icao24)
      if (!key) {
        continue
      }

      merged.set(key, flight)
    }
  }

  return [...merged.values()]
}

function loadRecentBriefings(): RecentBriefing[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(RECENT_BRIEFINGS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .slice(0, 6)
      .map((item) => {
        if (item?.airport?.icaoId) {
          return {
            airport: item.airport as MetarData,
            cachedAt: typeof item.cachedAt === 'number' ? item.cachedAt : Date.now(),
          } satisfies RecentBriefing;
        }

        if (item?.icaoId) {
          return {
            airport: item as MetarData,
            cachedAt: Date.now(),
          } satisfies RecentBriefing;
        }

        return null;
      })
      .filter((item): item is RecentBriefing => item !== null);
  } catch {
    return [];
  }
}

function saveRecentBriefings(briefings: RecentBriefing[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RECENT_BRIEFINGS_KEY, JSON.stringify(briefings.slice(0, 6)));
}

export default function Home() {
  const browserReady = useBrowserReady();
  const [airports, setAirports] = useState<MetarData[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<MetarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Location filters
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  // Flight category filters
  const [filters, setFilters] = useState<Record<string, boolean>>({
    VFR: true,
    MVFR: true,
    IFR: true,
    LIFR: true,
    Unknown: true,
  });

  // Flight tracking state
  const [showFlights, setShowFlights] = useState(false);
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);
  const [trackedFlight, setTrackedFlight] = useState<string | null>(null);
  const [trackedFlightQuery, setTrackedFlightQuery] = useState<string | null>(null);
  const [flightSearch, setFlightSearch] = useState('');
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightSearchSummary, setFlightSearchSummary] = useState<string | null>(null);

  // Map layer toggles
  const [showTFRs, setShowTFRs] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [showAirspace, setShowAirspace] = useState(false);
  const [showHazards, setShowHazards] = useState(false);

  // UI panels
  const briefingRef = useRef<HTMLElement>(null);
  const [expandedBriefing, setExpandedBriefing] = useState(false);
  const closeBriefing = useCallback(() => {
    setSelectedAirport(null); setSelectedFlight(null); setExpandedBriefing(false);
    document.getElementById('airport-search')?.focus();
  }, []);
  useEffect(() => {
    if (selectedAirport || selectedFlight) briefingRef.current?.querySelector<HTMLButtonElement>('.av-drawer-controls button:last-child')?.focus();
  }, [selectedAirport, selectedFlight]);
  const [showLayers, setShowLayers] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [recentBriefings, setRecentBriefings] = useState<RecentBriefing[]>(() => loadRecentBriefings());

  const handleAirportSelect = useCallback((airport: MetarData | null) => {
    setSelectedAirport(airport);
    if (!airport?.icaoId) return;
    const nextEntry = { airport, cachedAt: Date.now() };
    setRecentBriefings(prev => [nextEntry, ...prev.filter(item => item.airport.icaoId !== airport.icaoId)].slice(0, 6));
  }, []);

  const toggleFilter = (category: string) => {
    setFilters(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const fetchAirports = useCallback((ids?: string, isSearch = false) => {
    let url = '/api/metar';
    if (ids) {
      url = `/api/metar?ids=${ids}`;
    } else if (selectedStates.length > 0) {
      url = `/api/metar?states=${selectedStates.join(',')}`;
    } else if (selectedRegion) {
      url = `/api/metar?region=${selectedRegion}`;
    }

    return fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error(`Failed to fetch weather data (${res.status})`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
      })
      .then(data => {
        setError(null);
        if (Array.isArray(data) && data.length > 0) {
          if (isSearch) {
            setAirports(prev => prev.find(a => a.icaoId === data[0].icaoId) ? prev : [...prev, ...data]);
            handleAirportSelect(data[0]);
          } else {
            setAirports(data);
          }
          setLastUpdated(new Date());
        } else if (ids) {
          setError(`No data found for ${ids}`);
        }
      })
      .catch((err: unknown) => {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      })
      .finally(() => setIsLoading(false));
  }, [selectedStates, selectedRegion, handleAirportSelect]);

  useEffect(() => { fetchAirports(); }, [selectedStates, selectedRegion, fetchAirports]);
  useEffect(() => {
    saveRecentBriefings(recentBriefings);
  }, [recentBriefings]);
  useEffect(() => {
    const interval = setInterval(() => { setIsLoading(true); setError(null); void fetchAirports(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAirports]);

  const fetchFlights = useCallback((query?: string): Promise<FlightData[]> => {
    const generalTrafficRequest = fetch('/api/flights?bounds=24.396308,49.384358,-125.0,-66.93457').then(res => res.json());
    const trafficRequest: Promise<FlightData[] | null> = query
      ? Promise.all([
          generalTrafficRequest,
          fetch(`/api/flights?query=${encodeURIComponent(query)}`).then(res => res.json()),
        ]).then(([generalData, targetedData]) => mergeFlightResults(
          Array.isArray(generalData) ? generalData as FlightData[] : [],
          Array.isArray(targetedData) ? targetedData as FlightData[] : [],
        ))
      : generalTrafficRequest.then(data => Array.isArray(data) ? data as FlightData[] : null);

    return trafficRequest
      .then(data => {
        if (data === null) return [];
        setFlights(data);
        return data;
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch flights:', err);
        return [] as FlightData[];
      })
      .finally(() => setFlightsLoading(false));
  }, []);

  useEffect(() => {
    if (showFlights && TRAFFIC_ENABLED) {
      const refreshQuery = trackedFlightQuery ?? undefined;
      fetchFlights(refreshQuery);
      const interval = setInterval(() => { setFlightsLoading(true); void fetchFlights(refreshQuery); }, 15000);
      return () => clearInterval(interval);
    }
  }, [showFlights, fetchFlights, trackedFlightQuery]);

  const handleFlightSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = normalizeFlightIdentifier(flightSearch);
    if (!query) {
      return;
    }

    setFlightsLoading(true);
    const results = await fetchFlights(query);
    const bestMatch = findBestTrackedFlight(query, results);

    setTrackedFlightQuery(query);
    setTrackedFlight(bestMatch ? bestMatch.icao24 : null);
    setSelectedFlight(bestMatch);
    setSelectedAirport(null);
    setFlightSearchSummary(
      bestMatch
        ? `Tracking ${getFlightDisplayLabel(bestMatch)} • live traffic stays visible on the map`
        : `No live aircraft found for ${query}. Try the painted tail number, live callsign, or exact 6-character hex.`
    );
  };

  const handleFlightSelect = (flight: FlightData) => {
    setSelectedFlight(flight);
    setSelectedAirport(null);
  };

  const handleTrackFlight = async (flightId: string) => {
    if (trackedFlight === flightId) {
      setTrackedFlight(null);
      setTrackedFlightQuery(null);
      setFlightSearchSummary(null);
      if (showFlights) {
        setFlightsLoading(true);
        await fetchFlights();
      }
      return;
    }

    const selected = flights.find((flight) => normalizeFlightIdentifier(flight.icao24) === normalizeFlightIdentifier(flightId)) ?? null;
    setTrackedFlight(flightId);
    setTrackedFlightQuery(getTrackedRefreshQuery(selected));
    setFlightSearchSummary(
      selected
        ? `Tracking ${getFlightDisplayLabel(selected)}`
        : 'Tracking selected flight'
    );

    if (selected) {
      setSelectedFlight(selected);
      setFlightsLoading(true);
      await fetchFlights(getTrackedRefreshQuery(selected) ?? undefined);
    }
  };

  const handleSearch = (icao: string) => { setIsLoading(true); setError(null); return fetchAirports(icao, true); };
  const handleRefresh = () => { setIsLoading(true); setError(null); return fetchAirports(); };
  const toggleFlights = () => {
    setFlightsLoading(!showFlights);
    setShowFlights(!showFlights);
  };

  const handleRegionChange = (region: string) => {
    if (region !== selectedRegion || selectedStates.length > 0) { setIsLoading(true); setError(null); }
    setSelectedRegion(region);
    setSelectedStates([]);
  };

  const handleStateToggle = (stateCode: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedStates(prev =>
      prev.includes(stateCode) ? prev.filter(s => s !== stateCode) : [...prev, stateCode]
    );
    setSelectedRegion('');
  };

  const clearLocationFilters = () => {
    setIsLoading(true);
    setError(null);
    setSelectedRegion('');
    setSelectedStates([]);
  };

  const categoryCounts = useMemo(() =>
    airports.reduce((acc, a) => {
      const cat = a.fltCat || 'Unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    [airports]
  );

  const visibleCount = useMemo(() =>
    airports.filter(a => filters[a.fltCat || 'Unknown'] !== false).length,
    [airports, filters]
  );

  const sortedStates = useMemo(() =>
    Object.entries(US_STATES).sort((a, b) => a[1].name.localeCompare(b[1].name)),
    []
  );

  const activeLayerCount = [showFlights, showTFRs, showRadar, showAirspace, showHazards].filter(Boolean).length;
  const scopeLabel = selectedStates.length > 0
    ? `${selectedStates.length} state${selectedStates.length === 1 ? '' : 's'}`
    : selectedRegion
      ? (US_REGIONS[selectedRegion]?.name ?? 'Region')
      : 'All US';
  const trackedFlightLabel = selectedFlight
    ? getFlightDisplayLabel(selectedFlight)
    : trackedFlight
      ? normalizeFlightIdentifier(trackedFlight)
      : null;
  const flightSearchHint = getFlightSearchHint(flightSearch);

  return (
    <AppShell map>
      <main id="workspace-content" tabIndex={-1} className="av-map-content">
        <header className="av-weather-toolbar">
          <div className="av-weather-heading"><div><p className="av-eyebrow">01 / Airport weather</p><h1>Weather map</h1></div><p>Find an airport. Check the report time, then the conditions.</p></div>
          <div className="av-weather-actions">
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            <div className="av-weather-controls" role="group" aria-label="Map controls">
              <button onClick={() => setShowLayers(true)}>Weather layers <span>{activeLayerCount || '＋'}</span></button>
              <button onClick={() => setShowFiltersPanel(true)}>Filters <span>{scopeLabel}</span></button>
              <button onClick={() => setShowQuickActions(true)}>Overview <span aria-hidden="true">↗</span></button>
              <button className="av-map-refresh" aria-label="Refresh aviation weather map" onClick={handleRefresh} disabled={isLoading}>{isLoading ? 'Loading…' : 'Refresh'}</button>
            </div>
          </div>
        </header>
        {error && <div role="alert" className="av-weather-error"><span>{error}</span><button aria-label="Dismiss weather error" onClick={() => setError(null)}>Dismiss</button></div>}
        {showFlights && !TRAFFIC_ENABLED && <p role="status" className="av-weather-warning">Flight traffic is held pending provider permissions. No traffic feed is requested in this preview.</p>}
        {showFlights && TRAFFIC_ENABLED && <div className="av-flight-search">
          <form onSubmit={handleFlightSearch}><label htmlFor="flight-identifier">Tail number, callsign or hex</label><div><input id="flight-identifier" value={flightSearch} onChange={e => setFlightSearch(e.target.value.toUpperCase())} aria-describedby="flight-search-help" placeholder="e.g. N576FX" /><button type="submit">Track flight</button></div></form>
          <p id="flight-search-help">{flightSearchHint}</p><p role="status">{flightSearchSummary}</p>
          {trackedFlight && <button onClick={async () => { setTrackedFlight(null); setTrackedFlightQuery(null); setFlightSearchSummary(null); setFlightsLoading(true); await fetchFlights(); }}>Stop tracking</button>}
        </div>}
        <div className="av-map-surface flex-1 relative min-h-0">
          <MapWrapper airports={airports} selectedAirport={selectedAirport} onAirportSelect={handleAirportSelect} filters={filters} flights={flights} trackedFlight={trackedFlight} onFlightSelect={handleFlightSelect} showFlights={showFlights && TRAFFIC_ENABLED} showTFRs={showTFRs} showRadar={showRadar} showAirspace={showAirspace} showHazards={showHazards} />
          {!isLoading && !error && visibleCount === 0 && <div role="status" className="av-map-empty">No airports match these filters. <button onClick={() => { clearLocationFilters(); setFilters({VFR:true,MVFR:true,IFR:true,LIFR:true,Unknown:true}); }}>Reset filters</button></div>}
        </div>
        <footer className="av-map-status"><span>{isLoading ? 'Retrieving weather…' : `${visibleCount} of ${airports.length} airports`} · {scopeLabel}</span><span>{lastUpdated ? `Retrieved ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No retrieval yet'} <span className="av-map-status-note">· observation times vary</span></span></footer>

        {showLayers && <WorkspaceDialog title="Map layers" onClose={() => setShowLayers(false)}>
          <p className="av-panel-intro">Add context to the weather map. Layers are supplemental; check coverage, currency and source limitations.</p>
          <div className="av-layer-list">
            <LayerControl label="Flights" description={TRAFFIC_ENABLED ? 'Aircraft traffic overlay' : 'Provider permissions pending · no traffic feed requested'} active={showFlights} onChange={toggleFlights} />
            <LayerControl label="TFRs" description="Temporary flight restrictions · verify official notices" active={showTFRs} onChange={() => setShowTFRs(!showTFRs)} />
            <LayerControl label="Radar" description="Precipitation overlay · availability and licensing pending in this preview" active={showRadar} onChange={() => setShowRadar(!showRadar)} />
            <LayerControl label="Airspace" description="Class B, C and D boundary reference" active={showAirspace} onChange={() => setShowAirspace(!showAirspace)} />
            <LayerControl label="Hazards" description="Pilot reports (PIREPs) and significant weather (SIGMETs)" active={showHazards} onChange={() => setShowHazards(!showHazards)} />
          </div>
          {showFlights && !TRAFFIC_ENABLED && <p className="av-weather-warning">Traffic remains unavailable until provider permissions are configured.</p>}
        </WorkspaceDialog>}

        {showFiltersPanel && <WorkspaceDialog title="Airport filters" onClose={() => {setShowFiltersPanel(false); setShowStateDropdown(false);}}>
          <p className="av-panel-intro">Choose the area and reported flight categories shown on the map. Category colors describe reported conditions—not permission to fly.</p>
          <section className="av-filter-section"><h3>1. Choose an area</h3><label htmlFor="weather-region">Region</label><select id="weather-region" value={selectedRegion} onChange={e => handleRegionChange(e.target.value)}><option value="">All US</option>{Object.entries(US_REGIONS).map(([id, region]) => <option key={id} value={id}>{region.name}</option>)}</select>
            <button className="av-states-disclosure" aria-expanded={showStateDropdown} onClick={() => setShowStateDropdown(!showStateDropdown)}>{selectedStates.length ? `${selectedStates.length} states selected` : 'Choose individual states'} <span aria-hidden="true">{showStateDropdown ? '−' : '+'}</span></button>
            {showStateDropdown && <div className="av-state-grid">{sortedStates.map(([code, state]) => <label key={code}><input type="checkbox" checked={selectedStates.includes(code)} onChange={() => handleStateToggle(code)} /><span>{state.name} <small>{code}</small></span></label>)}</div>}
            {(selectedRegion || selectedStates.length > 0) && <button className="av-clear-filter" onClick={clearLocationFilters}>Clear location filters</button>}
          </section>
          <section className="av-filter-section"><h3>2. Reported flight category</h3><div className="av-category-grid">{([...FLIGHT_CATEGORIES, 'Unknown'] as const).map(cat => <button key={cat} aria-pressed={filters[cat]} onClick={() => toggleFilter(cat)}><span className="av-category-dot" style={{backgroundColor:getFlightCategoryColor(cat === 'Unknown' ? null : cat)}} /><span><strong>{cat}</strong><small>{categoryNames[cat]}</small></span><span>{categoryCounts[cat] || 0}</span></button>)}</div><p className="av-panel-intro">{visibleCount} of {airports.length} airports shown. Turning off a category hides those reports; it does not change conditions.</p></section>
        </WorkspaceDialog>}

        {showQuickActions && <WorkspaceDialog title="Map overview" onClose={() => setShowQuickActions(false)}>
          <MapBrief scopeLabel={scopeLabel} visibleCount={visibleCount} totalCount={airports.length} activeLayerCount={activeLayerCount} trackedFlightLabel={trackedFlightLabel} lastUpdated={lastUpdated} flightsLoading={flightsLoading} flightSearchSummary={flightSearchSummary} />
          <p className="av-panel-intro">Retrieval time is not the observation time. Read the timestamp inside each airport report before using it.</p><PwaStatus />
          <section className="av-filter-section"><h3>Recent reports</h3><p className="av-panel-intro">Saved in this browser. Reopening a saved report does not refresh its weather.</p>
          {browserReady && recentBriefings.length ? <div className="av-recent-list">{recentBriefings.map(briefing => <button key={briefing.airport.icaoId} onClick={() => {setSelectedAirport(briefing.airport);setShowQuickActions(false);}}><strong>{briefing.airport.icaoId}</strong><span>{briefing.airport.name || 'Airport report'}</span><small>{formatCacheAge(briefing.cachedAt)} · saved copy</small></button>)}</div> : <p className="av-panel-intro">Search an airport to open your first report.</p>}</section>
          <div className="av-map-related"><Link href="/plan">Build a manual flight plan ↗</Link><Link href="/tools">Open pilot tools ↗</Link></div>
        </WorkspaceDialog>}

        {(selectedAirport || selectedFlight) && <aside ref={briefingRef} className={`av-map-sidebar av-airport-drawer${expandedBriefing ? ' is-expanded' : ''}`} role="dialog" aria-modal="false" aria-label={selectedAirport ? `Airport briefing for ${selectedAirport.icaoId}` : `Flight details for ${selectedFlight?.callsign || selectedFlight?.icao24}`} onKeyDown={e => { if (e.key === 'Escape') {e.stopPropagation();closeBriefing();} }}>
          <div className="av-drawer-controls"><span>Report details</span><button className="av-drawer-expand" onClick={() => setExpandedBriefing(!expandedBriefing)} aria-expanded={expandedBriefing}>{expandedBriefing ? 'Reduce panel' : 'Expand panel'}</button><button onClick={closeBriefing} aria-label={selectedAirport ? 'Close airport briefing' : 'Close flight details'}>Close ×</button></div>
          {selectedAirport ? <AirportInfo key={selectedAirport.icaoId} airport={selectedAirport} onClose={closeBriefing} /> : selectedFlight && <FlightInfo key={selectedFlight.icao24} flight={selectedFlight} onClose={closeBriefing} onTrack={handleTrackFlight} isTracking={isFlightTracked(selectedFlight, trackedFlight)} />}
        </aside>}
      </main>
    </AppShell>
  );
}

const categoryNames: Record<string,string> = {VFR:'Visual flight rules',MVFR:'Marginal VFR',IFR:'Instrument flight rules',LIFR:'Low IFR',Unknown:'Category not reported'};
function LayerControl({label,description,active,onChange}:{label:string;description:string;active:boolean;onChange:()=>void}) {
  return <button className="av-layer-control" aria-label={label} aria-pressed={active} onClick={onChange}><span><strong>{label}</strong><small>{description}</small></span><span className="av-layer-state">{active ? 'On' : 'Off'}</span></button>;
}
