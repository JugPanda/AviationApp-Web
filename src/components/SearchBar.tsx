'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (icao: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim().toUpperCase());
      setQuery(''); // Clear after search on mobile
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value.toUpperCase())}
        placeholder="ICAO (KJFK)"
        className="flex-1 min-w-0 px-3 py-1.5 sm:py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm sm:text-base"
        maxLength={4}
      />
      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm sm:text-base flex-shrink-0"
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <span className="sm:hidden">→</span>
        )}
        <span className="hidden sm:inline">Search</span>
      </button>
    </form>
  );
}
