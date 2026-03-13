'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import MapWrapper from '@/components/MapWrapper';
import SearchBar from '@/components/SearchBar';
import AirportInfo from '@/components/AirportInfo';
import FlightInfo from '@/components/FlightInfo';
import { FlightData } from '@/components/FlightMarkers';
import { MetarData } from '@/types';
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
  const [showFilters, setShowFilters] = useState(false);
  
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
  const [flightSearch, setFlightSearch] = useState('');
  const [flightsLoading, setFlightsLoading] = useState(false);
  
  // TFR state
  const [showTFRs, setShowTFRs] = useState(false);
  
  // Weather radar state
  const [showRadar, setShowRadar] = useState(false);
  
  // Airspace state
  const [showAirspace, setShowAirspace] = useState(false);
  
  // PIREPs & SIGMETs state
  const [showHazards, setShowHazards] = useState(false);

  const toggleFilter = (category: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
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
      
      if (!res.ok) {
        throw new Error(`Failed to fetch weather data (${res.status})`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
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

  useEffect(() => {
    fetchAirports();
  }, [selectedStates, selectedRegion, fetchAirports]);

  useEffect(() => {
    const interval = setInterval(() => fetchAirports(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAirports]);

  // Fetch flights when enabled
  const fetchFlights = useCallback(async (callsign?: string) => {
    setFlightsLoading(true);
    try {
      let url = '/api/flights?bounds=24.396308,49.384358,-125.0,-66.93457'; // US bounds
      if (callsign) {
        url = `/api/flights?callsign=${callsign}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setFlights(data);
      }
    } catch (err) {
      console.error('Failed to fetch flights:', err);
    } finally {
      setFlightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showFlights) {
      fetchFlights();
      const interval = setInterval(() => fetchFlights(), 15000); // Update every 15 seconds
      return () => clearInterval(interval);
    }
  }, [showFlights, fetchFlights]);

  const handleFlightSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (flightSearch.trim()) {
      fetchFlights(flightSearch.trim());
      setTrackedFlight(flightSearch.trim().toUpperCase());
    }
  };

  const handleFlightSelect = (flight: FlightData) => {
    setSelectedFlight(flight);
    setSelectedAirport(null); // Close airport panel if open
  };

  const handleTrackFlight = (callsign: string) => {
    if (trackedFlight === callsign) {
      setTrackedFlight(null);
    } else {
      setTrackedFlight(callsign);
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
      prev.includes(stateCode)
        ? prev.filter(s => s !== stateCode)
        : [...prev, stateCode]
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

  const activeFiltersCount = (selectedRegion ? 1 : 0) + selectedStates.length + 
    FLIGHT_CATEGORIES.filter(c => !filters[c]).length;

  return (
    <main className="h-[100dvh] flex flex-col bg-slate-950">
      {/* Compact Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Logo - airplane compass design matching favicon */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0 border border-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24">
              {/* Compass ring */}
              <circle cx="12" cy="12" r="10" fill="none" stroke="#334155" strokeWidth="1.5"/>
              {/* Cardinal marks */}
              <line x1="12" y1="2" x2="12" y2="4" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <line x1="12" y1="20" x2="12" y2="22" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <line x1="2" y1="12" x2="4" y2="12" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              <line x1="20" y1="12" x2="22" y2="12" stroke="#64748b" strokeWidth="1" strokeLinecap="round"/>
              {/* Airplane */}
              <polygon points="12,4 14,16 12,14 10,16" fill="white"/>
              <polygon points="12,10 18,13 18,14 12,12" fill="white"/>
              <polygon points="12,10 6,13 6,14 12,12" fill="white"/>
            </svg>
          </div>
          
          {/* Title - hidden on very small screens */}
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold leading-tight">Aviation Weather</h1>
            <p className="text-xs text-slate-400">Real-time METAR</p>
          </div>
          
          {/* Search - grows to fill */}
          <div className="flex-1 min-w-0">
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />
          </div>

          {/* Filter toggle button (mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`sm:hidden p-2 rounded-lg transition-colors relative ${showFilters ? 'bg-blue-600' : 'bg-slate-800'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Flight Tracker Toggle */}
          <button
            onClick={() => setShowFlights(!showFlights)}
            className={`p-2 rounded-lg transition-colors ${showFlights ? 'bg-amber-600 text-white' : 'hover:bg-slate-800'}`}
            title={showFlights ? 'Hide flights' : 'Show flights'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>

          {/* TFR Toggle */}
          <button
            onClick={() => setShowTFRs(!showTFRs)}
            className={`p-2 rounded-lg transition-colors ${showTFRs ? 'bg-red-600 text-white' : 'hover:bg-slate-800'}`}
            title={showTFRs ? 'Hide TFRs' : 'Show TFRs'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>

          {/* Radar Toggle */}
          <button
            onClick={() => setShowRadar(!showRadar)}
            className={`p-2 rounded-lg transition-colors ${showRadar ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
            title={showRadar ? 'Hide Radar' : 'Show Radar'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </button>

          {/* Airspace Toggle */}
          <button
            onClick={() => setShowAirspace(!showAirspace)}
            className={`p-2 rounded-lg transition-colors ${showAirspace ? 'bg-purple-600 text-white' : 'hover:bg-slate-800'}`}
            title={showAirspace ? 'Hide Airspace' : 'Show Airspace'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </button>

          {/* PIREPs & SIGMETs Toggle */}
          <button
            onClick={() => setShowHazards(!showHazards)}
            className={`p-2 rounded-lg transition-colors ${showHazards ? 'bg-orange-600 text-white' : 'hover:bg-slate-800'}`}
            title={showHazards ? 'Hide PIREPs/SIGMETs' : 'Show PIREPs/SIGMETs'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {/* Tools Link */}
          <Link
            href="/tools"
            className="p-2 rounded-lg transition-colors hover:bg-slate-800"
            title="Pilot Tools"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {/* Flight Plan Link */}
          <Link
            href="/plan"
            className="p-2 rounded-lg transition-colors hover:bg-slate-800"
            title="NavLog / Flight Plan"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </Link>

          {/* Logbook Link */}
          <Link
            href="/logbook"
            className="p-2 rounded-lg transition-colors hover:bg-slate-800"
            title="Flight Logbook"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </Link>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Flight Tracker Bar (when enabled) */}
        {showFlights && (
          <div className="flex items-center gap-3 mt-3 p-2 bg-slate-800 rounded-lg">
            <span className="text-amber-400 text-sm font-medium">✈️ Flight Tracker</span>
            <form onSubmit={handleFlightSearch} className="flex-1 flex gap-2">
              <input
                type="text"
                value={flightSearch}
                onChange={(e) => setFlightSearch(e.target.value.toUpperCase())}
                placeholder="Search callsign (e.g. UAL123)"
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded text-sm font-medium"
              >
                Track
              </button>
            </form>
            <span className="text-xs text-slate-400">
              {flightsLoading ? 'Loading...' : `${flights.length} flights`}
            </span>
            {trackedFlight && (
              <button
                onClick={() => setTrackedFlight(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Clear tracking
              </button>
            )}
          </div>
        )}

        {/* Desktop filters - always visible */}
        <div className="hidden sm:flex flex-wrap items-center gap-2 mt-3">
          <select
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
          >
            <option value="">All US</option>
            {Object.entries(US_REGIONS).map(([id, region]) => (
              <option key={id} value={id}>{region.name}</option>
            ))}
          </select>

          <div className="relative">
            <button
              onClick={() => setShowStateDropdown(!showStateDropdown)}
              className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm flex items-center gap-1"
            >
              {selectedStates.length > 0 ? `${selectedStates.length} states` : 'States'}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showStateDropdown && (
              <div className="absolute z-50 mt-1 w-72 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-md shadow-lg">
                <div className="p-2 border-b border-slate-700 flex justify-between sticky top-0 bg-slate-800">
                  <button onClick={() => setSelectedStates(Object.keys(US_STATES))} className="text-xs text-blue-400">Select All</button>
                  <button onClick={() => setSelectedStates([])} className="text-xs text-slate-400">Clear</button>
                </div>
                <div className="grid grid-cols-3 gap-1 p-2">
                  {sortedStates.map(([code]) => (
                    <label key={code} className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-700 cursor-pointer text-xs">
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
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${filters[cat] ? 'bg-slate-800' : 'bg-slate-800/30 opacity-50'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getFlightCategoryColor(cat) }} />
              {cat} ({categoryCounts[cat] || 0})
            </button>
          ))}

          <span className="text-xs text-slate-500 ml-auto">
            {visibleCount}/{airports.length} airports
            {lastUpdated && ` • ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>

        {/* Mobile filters panel */}
        {showFilters && (
          <div className="sm:hidden mt-3 p-3 bg-slate-800 rounded-lg space-y-3">
            <div className="flex gap-2">
              <select
                value={selectedRegion}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Regions</option>
                {Object.entries(US_REGIONS).map(([id, region]) => (
                  <option key={id} value={id}>{region.name}</option>
                ))}
              </select>
              
              <button
                onClick={() => setShowStateDropdown(!showStateDropdown)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-left"
              >
                {selectedStates.length > 0 ? `${selectedStates.length} states` : 'Select states'}
              </button>
            </div>

            {showStateDropdown && (
              <div className="bg-slate-700 rounded-md p-2 max-h-40 overflow-y-auto">
                <div className="flex justify-between mb-2">
                  <button onClick={() => setSelectedStates(Object.keys(US_STATES))} className="text-xs text-blue-400">All</button>
                  <button onClick={() => setSelectedStates([])} className="text-xs text-slate-400">Clear</button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {sortedStates.map(([code]) => (
                    <label key={code} className={`flex items-center justify-center p-1.5 rounded text-xs cursor-pointer ${selectedStates.includes(code) ? 'bg-blue-600' : 'bg-slate-600'}`}>
                      <input type="checkbox" checked={selectedStates.includes(code)} onChange={() => handleStateToggle(code)} className="sr-only" />
                      {code}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {FLIGHT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleFilter(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${filters[cat] ? 'bg-slate-700' : 'bg-slate-700/30 opacity-50'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getFlightCategoryColor(cat) }} />
                  {cat}
                  <span className="text-slate-400">({categoryCounts[cat] || 0})</span>
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 text-center">
              Showing {visibleCount} of {airports.length} airports
            </div>
          </div>
        )}
      </header>

      {/* Click outside to close dropdowns */}
      {showStateDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowStateDropdown(false)} />}

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-3 py-2 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Map */}
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
        
        {/* Mobile airport count badge */}
        <div className="sm:hidden absolute top-2 left-2 bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-slate-300">
          {visibleCount} airports
        </div>
      </div>

      {/* Mobile bottom sheet for airport info */}
      {selectedAirport && (
        <>
          {/* Backdrop */}
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-[1000]"
            onClick={() => setSelectedAirport(null)}
          />
          
          {/* Bottom sheet (mobile) / Sidebar (desktop) */}
          <div className="fixed md:static bottom-0 left-0 right-0 md:w-96 max-h-[70vh] md:max-h-none bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto z-[1001] rounded-t-2xl md:rounded-none">
            {/* Drag handle (mobile only) */}
            <div className="md:hidden flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <AirportInfo 
              airport={selectedAirport} 
              onClose={() => setSelectedAirport(null)}
            />
          </div>
        </>
      )}

      {/* Mobile bottom sheet for flight info */}
      {selectedFlight && (
        <>
          {/* Backdrop */}
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-[1000]"
            onClick={() => setSelectedFlight(null)}
          />
          
          {/* Bottom sheet (mobile) / Sidebar (desktop) */}
          <div className="fixed md:static bottom-0 left-0 right-0 md:w-96 max-h-[70vh] md:max-h-none bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto z-[1001] rounded-t-2xl md:rounded-none">
            {/* Drag handle (mobile only) */}
            <div className="md:hidden flex justify-center py-2">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <FlightInfo 
              flight={selectedFlight} 
              onClose={() => setSelectedFlight(null)}
              onTrack={handleTrackFlight}
              isTracking={trackedFlight === selectedFlight.callsign}
            />
          </div>
        </>
      )}
    </main>
  );
}
