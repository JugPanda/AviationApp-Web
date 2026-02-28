'use client';

import { useState, useEffect, useCallback } from 'react';
import MapWrapper from '@/components/MapWrapper';
import SearchBar from '@/components/SearchBar';
import AirportInfo from '@/components/AirportInfo';
import { MetarData } from '@/types';
import { getFlightCategoryColor } from '@/lib/utils';

export default function Home() {
  const [airports, setAirports] = useState<MetarData[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<MetarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAirports = useCallback(async (ids?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const url = ids ? `/api/metar?ids=${ids}` : '/api/metar';
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const data = await res.json();
      
      if (Array.isArray(data) && data.length > 0) {
        if (ids && ids.split(',').length === 1) {
          // Single airport search - add to existing if not already there
          const existing = airports.find(a => a.icaoId === data[0].icaoId);
          if (!existing) {
            setAirports(prev => [...prev, ...data]);
          }
          setSelectedAirport(data[0]);
        } else {
          setAirports(data);
        }
        setLastUpdated(new Date());
      } else if (ids) {
        setError(`No data found for ${ids}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [airports]);

  // Initial load
  useEffect(() => {
    fetchAirports();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (airports.length > 0) {
        const ids = airports.map(a => a.icaoId).join(',');
        fetchAirports(ids);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [airports, fetchAirports]);

  const handleSearch = (icao: string) => {
    fetchAirports(icao);
  };

  const handleRefresh = () => {
    if (airports.length > 0) {
      const ids = airports.map(a => a.icaoId).join(',');
      fetchAirports(ids);
    } else {
      fetchAirports();
    }
  };

  // Count airports by category
  const categoryCounts = airports.reduce((acc, a) => {
    const cat = a.fltCat || 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">Aviation Weather</h1>
                <p className="text-sm text-slate-400">Real-time METAR & Flight Categories</p>
              </div>
            </div>
            
            <div className="flex-1 max-w-md">
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              {lastUpdated && (
                <span className="text-xs text-slate-500 hidden md:block">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Category summary */}
          <div className="flex gap-4 mt-4 text-sm">
            {(['VFR', 'MVFR', 'IFR', 'LIFR'] as const).map(cat => (
              <div key={cat} className="flex items-center gap-1.5">
                <span 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getFlightCategoryColor(cat) }}
                />
                <span className="font-medium">{cat}</span>
                <span className="text-slate-500">({categoryCounts[cat] || 0})</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapWrapper 
            airports={airports} 
            selectedAirport={selectedAirport}
            onAirportSelect={setSelectedAirport}
          />
        </div>

        {/* Sidebar */}
        {selectedAirport && (
          <div className="md:w-96 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 overflow-y-auto">
            <AirportInfo 
              airport={selectedAirport} 
              onClose={() => setSelectedAirport(null)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
