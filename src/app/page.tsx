'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import MapWrapper from '@/components/MapWrapper';
import SearchBar from '@/components/SearchBar';
import AirportInfo from '@/components/AirportInfo';
import FlightInfo from '@/components/FlightInfo';
import { FlightData } from '@/components/FlightMarkers';
import { MetarData } from '@/types';
import { findBestTrackedFlight, getTrackedRefreshQuery, isFlightTracked, normalizeFlightIdentifier } from '@/lib/flight-tracking';
import { getFlightCategoryColor } from '@/lib/utils';
import { US_STATES, US_REGIONS } from '@/lib/airports';

const FLIGHT_CATEGORIES = ['VFR', 'MVFR', 'IFR', 'LIFR'] as const;

export default function Home() {
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
  const [showLayers, setShowLayers] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<string>('map');

  const toggleFilter = (category: string) => {
    setFilters(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const fetchAirports = useCallback(async (ids?: string, isSearch = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let url = '/api/metar';
      if (ids) {
        url = `/api/metar?ids=${ids}`;
      } else if (selectedStates.length > 0) {
        url = `/api/metar?states=${selectedStates.join(',')}`;
      } else if (selectedRegion) {
        url = `/api/metar?region=${selectedRegion}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch weather data (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (Array.isArray(data) && data.length > 0) {
        if (isSearch) {
          setAirports(prev => {
            const exists = prev.find(a => a.icaoId === data[0].icaoId);
            if (exists) return prev;
            return [...prev, ...data];
          });
          setSelectedAirport(data[0]);
        } else {
          setAirports(data);
        }
        setLastUpdated(new Date());
      } else if (ids) {
        setError(`No data found for ${ids}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedStates, selectedRegion]);

  useEffect(() => { fetchAirports(); }, [selectedStates, selectedRegion, fetchAirports]);
  useEffect(() => {
    const interval = setInterval(() => fetchAirports(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAirports]);

  const fetchFlights = useCallback(async (callsign?: string) => {
    setFlightsLoading(true);
    try {
      let url = '/api/flights?bounds=24.396308,49.384358,-125.0,-66.93457';
      if (callsign) url = `/api/flights?callsign=${encodeURIComponent(callsign)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setFlights(data);
        return data as FlightData[];
      }
      return [] as FlightData[];
    } catch (err) {
      console.error('Failed to fetch flights:', err);
      return [] as FlightData[];
    } finally {
      setFlightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showFlights) {
      const refreshQuery = trackedFlightQuery ?? undefined;
      fetchFlights(refreshQuery);
      const interval = setInterval(() => fetchFlights(refreshQuery), 15000);
      return () => clearInterval(interval);
    }
  }, [showFlights, fetchFlights, trackedFlightQuery]);

  const handleFlightSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = normalizeFlightIdentifier(flightSearch);
    if (!query) {
      return;
    }

    const results = await fetchFlights(query);
    const bestMatch = findBestTrackedFlight(query, results);

    setTrackedFlightQuery(query);
    setTrackedFlight(bestMatch ? bestMatch.icao24 : null);
    setSelectedFlight(bestMatch);
    setSelectedAirport(null);
    setFlightSearchSummary(
      bestMatch
        ? `Tracking ${normalizeFlightIdentifier(bestMatch.callsign) || bestMatch.icao24} • ${results.length} match${results.length === 1 ? '' : 'es'}`
        : `No live flight match found for ${query}`
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
        await fetchFlights();
      }
      return;
    }

    const selected = flights.find((flight) => normalizeFlightIdentifier(flight.icao24) === normalizeFlightIdentifier(flightId)) ?? null;
    setTrackedFlight(flightId);
    setTrackedFlightQuery(getTrackedRefreshQuery(selected));
    setFlightSearchSummary(
      selected
        ? `Tracking ${normalizeFlightIdentifier(selected.callsign) || selected.icao24}`
        : 'Tracking selected flight'
    );

    if (selected) {
      setSelectedFlight(selected);
      await fetchFlights(getTrackedRefreshQuery(selected) ?? undefined);
    }
  };

  const handleSearch = (icao: string) => fetchAirports(icao, true);
  const handleRefresh = () => fetchAirports();

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    setSelectedStates([]);
  };

  const handleStateToggle = (stateCode: string) => {
    setSelectedStates(prev => 
      prev.includes(stateCode) ? prev.filter(s => s !== stateCode) : [...prev, stateCode]
    );
    setSelectedRegion('');
  };

  const clearLocationFilters = () => {
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

  return (
    <main className="h-[100dvh] flex flex-col bg-slate-950">
      {/* ===== HEADER — Clean & Minimal ===== */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 px-3 py-2.5 sm:px-4 sm:py-3 z-20">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0 border border-slate-600/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="#334155" strokeWidth="1.5"/>
              <line x1="12" y1="2" x2="12" y2="4" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <line x1="12" y1="20" x2="12" y2="22" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <line x1="2" y1="12" x2="4" y2="12" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <line x1="20" y1="12" x2="22" y2="12" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <polygon points="12,4 14,16 12,14 10,16" fill="white"/>
              <polygon points="12,10 18,13 18,14 12,12" fill="white"/>
              <polygon points="12,10 6,13 6,14 12,12" fill="white"/>
            </svg>
          </div>
          
          {/* Title - desktop only */}
          <div className="hidden md:block min-w-0">
            <h1 className="text-base font-bold leading-tight truncate">Aviation Weather</h1>
          </div>
          
          {/* Search — fills available space */}
          <div className="flex-1 min-w-0">
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
          </div>

          {/* Desktop-only toolbar buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <ToolbarButton 
              active={showFlights} 
              onClick={() => setShowFlights(!showFlights)}
              label="Flights"
              activeColor="bg-amber-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </ToolbarButton>
            <ToolbarButton 
              active={showTFRs} 
              onClick={() => setShowTFRs(!showTFRs)}
              label="TFRs"
              activeColor="bg-red-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </ToolbarButton>
            <ToolbarButton 
              active={showRadar} 
              onClick={() => setShowRadar(!showRadar)}
              label="Radar"
              activeColor="bg-blue-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </ToolbarButton>
            <ToolbarButton 
              active={showAirspace} 
              onClick={() => setShowAirspace(!showAirspace)}
              label="Airspace"
              activeColor="bg-purple-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </ToolbarButton>
            <ToolbarButton 
              active={showHazards} 
              onClick={() => setShowHazards(!showHazards)}
              label="Hazards"
              activeColor="bg-orange-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </ToolbarButton>
            
            <div className="w-px h-6 bg-slate-700 mx-1" />
            
            <Link href="/tools" className="p-2 hover:bg-slate-800 rounded-lg transition-colors" title="Pilot Tools">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <Link href="/plan" className="p-2 hover:bg-slate-800 rounded-lg transition-colors" title="NavLog">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </Link>
            <Link href="/logbook" className="p-2 hover:bg-slate-800 rounded-lg transition-colors" title="Logbook">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </Link>

            <button onClick={handleRefresh} disabled={isLoading} className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Flight Tracker Bar (when enabled) — both mobile & desktop */}
        {showFlights && (
          <div className="flex items-center gap-2 mt-2.5 p-2.5 bg-slate-800/80 rounded-xl">
            <span className="text-amber-400 text-xs font-semibold whitespace-nowrap">✈️</span>
            <form onSubmit={handleFlightSearch} className="flex-1 flex gap-2">
              <input
                type="text"
                value={flightSearch}
                onChange={(e) => setFlightSearch(e.target.value.toUpperCase())}
                placeholder="Callsign (e.g. UAL123)"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 min-w-0"
              />
              <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium shrink-0">
                Track
              </button>
            </form>
            {trackedFlight && (
              <button
                onClick={async () => {
                  setTrackedFlight(null);
                  setTrackedFlightQuery(null);
                  setFlightSearchSummary(null);
                  await fetchFlights();
                }}
                className="text-xs text-slate-400 hover:text-white shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        )}
        {showFlights && flightSearchSummary && (
          <div className="mt-2 text-xs text-slate-400">
            {flightSearchSummary}
          </div>
        )}

        {/* Desktop: Inline filter bar */}
        <div className="hidden sm:flex flex-wrap items-center gap-2 mt-2.5">
          <select
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All US</option>
            {Object.entries(US_REGIONS).map(([id, region]) => (
              <option key={id} value={id}>{region.name}</option>
            ))}
          </select>

          <div className="relative">
            <button
              onClick={() => setShowStateDropdown(!showStateDropdown)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5"
            >
              {selectedStates.length > 0 ? `${selectedStates.length} states` : 'States'}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showStateDropdown && (
              <div className="absolute z-50 mt-1 w-72 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
                <div className="p-2 border-b border-slate-700 flex justify-between sticky top-0 bg-slate-800">
                  <button onClick={() => setSelectedStates(Object.keys(US_STATES))} className="text-xs text-blue-400">Select All</button>
                  <button onClick={() => setSelectedStates([])} className="text-xs text-slate-400">Clear</button>
                </div>
                <div className="grid grid-cols-3 gap-1 p-2">
                  {sortedStates.map(([code]) => (
                    <label key={code} className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-700 cursor-pointer text-xs">
                      <input type="checkbox" checked={selectedStates.includes(code)} onChange={() => handleStateToggle(code)} className="rounded border-slate-600 w-3 h-3" />
                      {code}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(selectedRegion || selectedStates.length > 0) && (
            <button onClick={clearLocationFilters} className="text-xs text-slate-400 hover:text-white">✕ Clear</button>
          )}

          <span className="text-slate-600">|</span>

          {FLIGHT_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleFilter(cat)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${filters[cat] ? 'bg-slate-800' : 'bg-slate-800/30 opacity-50'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getFlightCategoryColor(cat) }} />
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}

          <span className="text-xs text-slate-500 ml-auto">
            {visibleCount}/{airports.length}
            {lastUpdated && ` • ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
      </header>

      {/* Click outside to close dropdowns */}
      {showStateDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowStateDropdown(false)} />}

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-3 py-2 text-red-200 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* ===== MAP (fills remaining space) ===== */}
      <div className="flex-1 relative min-h-0">
        <MapWrapper 
          airports={airports} 
          selectedAirport={selectedAirport}
          onAirportSelect={setSelectedAirport}
          filters={filters}
          flights={flights}
          trackedFlight={trackedFlight}
          onFlightSelect={handleFlightSelect}
          showFlights={showFlights}
          showTFRs={showTFRs}
          showRadar={showRadar}
          showAirspace={showAirspace}
          showHazards={showHazards}
        />
        
        {/* Mobile: Floating status pill (top-left) */}
        <div className="sm:hidden absolute top-3 left-3 bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2 shadow-lg">
          <span>{visibleCount} airports</span>
          {activeLayerCount > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-blue-400">{activeLayerCount} layer{activeLayerCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {/* Mobile: Floating refresh button (top-right) */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="sm:hidden absolute top-3 right-3 w-10 h-10 bg-slate-900/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* ===== MOBILE BOTTOM NAV BAR ===== */}
      <nav className="sm:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-around">
          <BottomNavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
            label="Map"
            active={!showLayers && !showFiltersPanel}
            onClick={() => { setShowLayers(false); setShowFiltersPanel(false); }}
          />
          <BottomNavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            }
            label="Filters"
            active={showFiltersPanel}
            badge={FLIGHT_CATEGORIES.filter(c => !filters[c]).length + (selectedRegion ? 1 : 0) + selectedStates.length}
            onClick={() => { setShowFiltersPanel(!showFiltersPanel); setShowLayers(false); }}
          />
          <BottomNavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            label="Layers"
            active={showLayers}
            badge={activeLayerCount}
            onClick={() => { setShowLayers(!showLayers); setShowFiltersPanel(false); }}
          />
          <BottomNavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            label="Tools"
            href="/tools"
          />
          <BottomNavItem 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            }
            label="More"
            onClick={() => {/* could open a sheet with Plan, Logbook, etc */}}
            moreMenu={
              <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-48">
                <Link href="/plan" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="text-sm">Flight Plan</span>
                </Link>
                <Link href="/logbook" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-sm">Logbook</span>
                </Link>
              </div>
            }
          />
        </div>
      </nav>

      {/* ===== MOBILE: Layers Sheet ===== */}
      {showLayers && (
        <>
          <div className="sm:hidden fixed inset-0 bg-black/40 z-[999]" onClick={() => setShowLayers(false)} />
          <div className="sm:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-slate-900 border-t border-slate-700 rounded-t-2xl z-[1000] max-h-[60vh] overflow-y-auto">
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <div className="px-4 pb-4 space-y-1">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Map Layers</h3>
              
              <LayerToggle 
                label="Live Flights"
                description="ADS-B flight tracking"
                active={showFlights}
                onChange={() => setShowFlights(!showFlights)}
                color="amber"
                icon="✈️"
              />
              <LayerToggle 
                label="TFRs"
                description="Temporary Flight Restrictions"
                active={showTFRs}
                onChange={() => setShowTFRs(!showTFRs)}
                color="red"
                icon="⚠️"
              />
              <LayerToggle 
                label="Weather Radar"
                description="Precipitation overlay"
                active={showRadar}
                onChange={() => setShowRadar(!showRadar)}
                color="blue"
                icon="🌧️"
              />
              <LayerToggle 
                label="Airspace"
                description="Class B, C, D boundaries"
                active={showAirspace}
                onChange={() => setShowAirspace(!showAirspace)}
                color="purple"
                icon="🗺️"
              />
              <LayerToggle 
                label="PIREPs & SIGMETs"
                description="Pilot reports & significant weather"
                active={showHazards}
                onChange={() => setShowHazards(!showHazards)}
                color="orange"
                icon="⚡"
              />
            </div>
          </div>
        </>
      )}

      {/* ===== MOBILE: Filters Sheet ===== */}
      {showFiltersPanel && (
        <>
          <div className="sm:hidden fixed inset-0 bg-black/40 z-[999]" onClick={() => setShowFiltersPanel(false)} />
          <div className="sm:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-slate-900 border-t border-slate-700 rounded-t-2xl z-[1000] max-h-[60vh] overflow-y-auto">
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <div className="px-4 pb-4">
              {/* Region / State Filters */}
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Location</h3>
              <div className="space-y-3 mb-5">
                <select
                  value={selectedRegion}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm"
                >
                  <option value="">All Regions</option>
                  {Object.entries(US_REGIONS).map(([id, region]) => (
                    <option key={id} value={id}>{region.name}</option>
                  ))}
                </select>
                
                <button
                  onClick={() => setShowStateDropdown(!showStateDropdown)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between"
                >
                  <span>{selectedStates.length > 0 ? `${selectedStates.length} states selected` : 'Select states'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showStateDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showStateDropdown && (
                  <div className="bg-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto">
                    <div className="flex justify-between mb-2">
                      <button onClick={() => setSelectedStates(Object.keys(US_STATES))} className="text-xs text-blue-400 font-medium">All</button>
                      <button onClick={() => setSelectedStates([])} className="text-xs text-slate-400 font-medium">Clear</button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {sortedStates.map(([code]) => (
                        <button
                          key={code}
                          onClick={() => handleStateToggle(code)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            selectedStates.includes(code) 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedRegion || selectedStates.length > 0) && (
                  <button onClick={clearLocationFilters} className="text-sm text-red-400 hover:text-red-300 font-medium">
                    Clear location filters
                  </button>
                )}
              </div>
              
              {/* Flight Category Filters */}
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Flight Categories</h3>
              <div className="grid grid-cols-2 gap-2">
                {FLIGHT_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleFilter(cat)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      filters[cat] 
                        ? 'bg-slate-800 border border-slate-700' 
                        : 'bg-slate-800/30 border border-slate-800 opacity-50'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getFlightCategoryColor(cat) }} />
                    <span>{cat}</span>
                    <span className="text-slate-500 ml-auto">{categoryCounts[cat] || 0}</span>
                  </button>
                ))}
              </div>
              
              <div className="text-xs text-slate-500 text-center mt-4">
                Showing {visibleCount} of {airports.length} airports
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Airport Info Bottom Sheet (mobile) / Sidebar (desktop) ===== */}
      {selectedAirport && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-[1000]" onClick={() => setSelectedAirport(null)} />
          <div className="fixed md:static bottom-0 left-0 right-0 md:w-96 max-h-[70vh] md:max-h-none bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto z-[1001] rounded-t-2xl md:rounded-none">
            <div className="md:hidden flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <AirportInfo airport={selectedAirport} onClose={() => setSelectedAirport(null)} />
          </div>
        </>
      )}

      {/* ===== Flight Info Bottom Sheet (mobile) / Sidebar (desktop) ===== */}
      {selectedFlight && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-[1000]" onClick={() => setSelectedFlight(null)} />
          <div className="fixed md:static bottom-0 left-0 right-0 md:w-96 max-h-[70vh] md:max-h-none bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto z-[1001] rounded-t-2xl md:rounded-none">
            <div className="md:hidden flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <FlightInfo 
              flight={selectedFlight} 
              onClose={() => setSelectedFlight(null)}
              onTrack={handleTrackFlight}
              isTracking={isFlightTracked(selectedFlight, trackedFlight)}
            />
          </div>
        </>
      )}
    </main>
  );
}


/* ===== Sub-components ===== */

function ToolbarButton({ 
  active, onClick, label, activeColor, children 
}: { 
  active: boolean; onClick: () => void; label: string; activeColor: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all text-xs font-medium flex items-center gap-1.5 ${
        active ? `${activeColor} text-white shadow-lg` : 'hover:bg-slate-800 text-slate-400 hover:text-white'
      }`}
      title={label}
    >
      {children}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function BottomNavItem({ 
  icon, label, active, badge, onClick, href, moreMenu 
}: { 
  icon: React.ReactNode; label: string; active?: boolean; badge?: number; 
  onClick?: () => void; href?: string; moreMenu?: React.ReactNode;
}) {
  const [showMore, setShowMore] = useState(false);

  if (href) {
    return (
      <Link href={href} className="flex flex-col items-center justify-center min-w-[3rem] py-1 relative">
        <div className="text-slate-400">{icon}</div>
        <span className="text-[10px] text-slate-500 mt-0.5">{label}</span>
      </Link>
    );
  }

  return (
    <button 
      onClick={moreMenu ? () => setShowMore(!showMore) : onClick}
      className={`flex flex-col items-center justify-center min-w-[3rem] py-1 relative transition-colors ${
        active ? 'text-blue-400' : ''
      }`}
    >
      <div className={`relative ${active ? 'text-blue-400' : 'text-slate-400'}`}>
        {icon}
        {!!badge && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-blue-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] mt-0.5 ${active ? 'text-blue-400' : 'text-slate-500'}`}>{label}</span>
      
      {showMore && moreMenu && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={(e) => { e.stopPropagation(); setShowMore(false); }} />
          <div className="z-[999]">{moreMenu}</div>
        </>
      )}
    </button>
  );
}

function LayerToggle({ 
  label, description, active, onChange, color, icon 
}: { 
  label: string; description: string; active: boolean; onChange: () => void; color: string; icon: string;
}) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <button
      onClick={onChange}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
        active ? 'bg-slate-800 border border-slate-600' : 'bg-slate-800/40 border border-transparent'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <div className="flex-1 text-left">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <div className={`w-10 h-6 rounded-full relative transition-colors ${active ? colorMap[color] : 'bg-slate-700'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4.5 left-auto right-0.5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
