'use client';

import { useState } from 'react';

interface SearchBarProps { onSearch: (icao: string) => void; isLoading: boolean; }
export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  return <form className="av-airport-search" onSubmit={event => { event.preventDefault(); if(query.trim()) onSearch(query.trim().toUpperCase()); }}>
    <label htmlFor="airport-search">Search airport by ICAO code</label>
    <div><input id="airport-search" type="text" value={query} onChange={event => setQuery(event.target.value.toUpperCase())} placeholder="e.g. KLOU" maxLength={4} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="airport-search-help" /><button type="submit" disabled={isLoading || !query.trim()}>{isLoading ? 'Loading…' : 'Search'}</button></div>
    <span id="airport-search-help">Use the four-letter identifier. Open a map marker for its report.</span>
  </form>;
}
