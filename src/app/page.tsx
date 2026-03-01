'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import MapWrapper from '@/components/MapWrapper';
import SearchBar from '@/components/SearchBar';
import AirportInfo from '@/components/AirportInfo';
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
          {/* Logo - smaller on mobile */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
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
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedAirport(null)}
          />
          
          {/* Bottom sheet (mobile) / Sidebar (desktop) */}
          <div className="fixed md:static bottom-0 left-0 right-0 md:w-96 max-h-[70vh] md:max-h-none bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto z-50 rounded-t-2xl md:rounded-none">
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
    </main>
  );
}
