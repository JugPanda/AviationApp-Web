'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface FlightEntry {
  id: string;
  date: string;
  aircraft: string;
  aircraftType: string;
  from: string;
  to: string;
  route?: string;
  
  // Times
  totalTime: number;
  pic: number;
  sic: number;
  dual: number;
  solo: number;
  crossCountry: number;
  
  // Conditions
  dayTime: number;
  nightTime: number;
  actualInstrument: number;
  simulatedInstrument: number;
  
  // Landings
  dayLandings: number;
  nightLandings: number;
  
  // Approaches
  approaches: number;
  approachTypes?: string;
  
  // Misc
  holds: number;
  remarks?: string;
  
  createdAt: number;
  updatedAt: number;
}

interface CurrencyItem {
  name: string;
  description: string;
  requirement: string;
  status: 'current' | 'warning' | 'expired';
  expiresIn?: string;
  lastCompleted?: string;
}

const STORAGE_KEY = 'avweather-logbook';

function getEntries(): FlightEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: FlightEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function LogbookPage() {
  const [entries, setEntries] = useState<FlightEntry[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'currency' | 'totals'>('list');
  const [editingEntry, setEditingEntry] = useState<FlightEntry | null>(null);
  const [sortField, setSortField] = useState<'date' | 'totalTime'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setEntries(getEntries());
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        cmp = a.totalTime - b.totalTime;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [entries, sortField, sortDir]);

  const totals = useMemo(() => {
    return entries.reduce((acc, e) => ({
      totalTime: acc.totalTime + e.totalTime,
      pic: acc.pic + e.pic,
      sic: acc.sic + e.sic,
      dual: acc.dual + e.dual,
      solo: acc.solo + e.solo,
      crossCountry: acc.crossCountry + e.crossCountry,
      dayTime: acc.dayTime + e.dayTime,
      nightTime: acc.nightTime + e.nightTime,
      actualInstrument: acc.actualInstrument + e.actualInstrument,
      simulatedInstrument: acc.simulatedInstrument + e.simulatedInstrument,
      dayLandings: acc.dayLandings + e.dayLandings,
      nightLandings: acc.nightLandings + e.nightLandings,
      approaches: acc.approaches + e.approaches,
      holds: acc.holds + e.holds,
      flights: acc.flights + 1
    }), {
      totalTime: 0, pic: 0, sic: 0, dual: 0, solo: 0, crossCountry: 0,
      dayTime: 0, nightTime: 0, actualInstrument: 0, simulatedInstrument: 0,
      dayLandings: 0, nightLandings: 0, approaches: 0, holds: 0, flights: 0
    });
  }, [entries]);

  // Currency calculations
  const currency = useMemo((): CurrencyItem[] => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    // Recent entries for currency
    const recent = entries.filter(e => new Date(e.date) >= ninetyDaysAgo);
    const recentDayLandings = recent.reduce((sum, e) => sum + e.dayLandings, 0);
    const recentNightLandings = recent.reduce((sum, e) => sum + e.nightLandings, 0);
    const recentApproaches = recent.reduce((sum, e) => sum + e.approaches, 0);
    const recentHolds = recent.reduce((sum, e) => sum + e.holds, 0);
    
    // Find most recent night landing for currency expiration
    const nightEntries = entries.filter(e => e.nightLandings > 0).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastNightLanding = nightEntries[0];
    
    // Find most recent IFR flight
    const ifrEntries = entries.filter(e => e.approaches > 0 || e.holds > 0).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastIfrFlight = ifrEntries[0];

    const items: CurrencyItem[] = [];

    // Day currency (3 landings in 90 days)
    items.push({
      name: 'Day Passenger',
      description: '91.57(a)(1)',
      requirement: '3 landings in 90 days',
      status: recentDayLandings >= 3 ? 'current' : recentDayLandings >= 1 ? 'warning' : 'expired',
      lastCompleted: recent.find(e => e.dayLandings > 0)?.date
    });

    // Night currency (3 landings to full stop in 90 days)
    items.push({
      name: 'Night Passenger',
      description: '91.57(b)',
      requirement: '3 night landings in 90 days',
      status: recentNightLandings >= 3 ? 'current' : recentNightLandings >= 1 ? 'warning' : 'expired',
      lastCompleted: lastNightLanding?.date
    });

    // IFR currency (6 approaches + holds in 6 months)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const ifrRecent = entries.filter(e => new Date(e.date) >= sixMonthsAgo);
    const ifrApproaches = ifrRecent.reduce((sum, e) => sum + e.approaches, 0);
    const ifrHolds = ifrRecent.reduce((sum, e) => sum + e.holds, 0);
    
    items.push({
      name: 'IFR Currency',
      description: '61.57(c)',
      requirement: '6 approaches + holding in 6 months',
      status: ifrApproaches >= 6 && ifrHolds >= 1 ? 'current' : ifrApproaches >= 3 ? 'warning' : 'expired',
      lastCompleted: lastIfrFlight?.date
    });

    return items;
  }, [entries]);

  const handleSaveEntry = (entry: Omit<FlightEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingEntry) {
      // Update existing
      const updated = entries.map(e => 
        e.id === editingEntry.id 
          ? { ...entry, id: e.id, createdAt: e.createdAt, updatedAt: Date.now() }
          : e
      );
      setEntries(updated);
      saveEntries(updated);
    } else {
      // Create new
      const newEntry: FlightEntry = {
        ...entry,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const updated = [...entries, newEntry];
      setEntries(updated);
      saveEntries(updated);
    }
    setEditingEntry(null);
    setView('list');
  };

  const handleDeleteEntry = (id: string) => {
    if (!confirm('Delete this flight entry?')) return;
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
  };

  const handleExport = () => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logbook-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          const merged = [...entries];
          const existingIds = new Set(entries.map(e => e.id));
          
          for (const entry of imported) {
            if (!existingIds.has(entry.id)) {
              merged.push(entry);
            }
          }
          
          setEntries(merged);
          saveEntries(merged);
          alert(`Imported ${imported.length - (merged.length - entries.length)} flights (${merged.length - entries.length} new)`);
        }
      } catch {
        alert('Invalid logbook file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Map</span>
          </Link>
          
          <div className="flex-1">
            <h1 className="text-lg font-bold">✈️ Flight Logbook</h1>
            <p className="text-xs text-slate-400 hidden sm:block">{totals.flights} flights • {totals.totalTime.toFixed(1)} total hours</p>
          </div>

          <button
            onClick={() => { setEditingEntry(null); setView('add'); }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <span>+</span>
            <span className="hidden sm:inline">Add Flight</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-slate-900/50 border-b border-slate-700">
        <div className="flex overflow-x-auto">
          {[
            { key: 'list', label: '📋 Entries' },
            { key: 'totals', label: '📊 Totals' },
            { key: 'currency', label: '✅ Currency' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key as typeof view)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                view === key 
                  ? 'text-blue-400 border-blue-400 bg-slate-800/50' 
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {/* List View */}
        {view === 'list' && (
          <div className="space-y-4">
            {entries.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-4">✈️</p>
                <p className="text-lg">No flights logged yet</p>
                <p className="text-sm mt-2">Click "Add Flight" to log your first flight</p>
              </div>
            ) : (
              <>
                {/* Sort controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Sort by:</span>
                    <button
                      onClick={() => { setSortField('date'); setSortDir(prev => sortField === 'date' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}
                      className={`px-2 py-1 text-sm rounded ${sortField === 'date' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                    >
                      Date {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                    <button
                      onClick={() => { setSortField('totalTime'); setSortDir(prev => sortField === 'totalTime' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}
                      className={`px-2 py-1 text-sm rounded ${sortField === 'totalTime' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                    >
                      Time {sortField === 'totalTime' && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button onClick={handleExport} className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded">
                      Export
                    </button>
                    <label className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded cursor-pointer">
                      Import
                      <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Entries */}
                <div className="space-y-2">
                  {sortedEntries.map(entry => (
                    <div key={entry.id} className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{entry.from} → {entry.to}</span>
                            <span className="text-slate-400 text-sm">{entry.date}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                            <span>{entry.aircraft} ({entry.aircraftType})</span>
                            {entry.route && <span>via {entry.route}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{entry.totalTime.toFixed(1)}</p>
                          <p className="text-xs text-slate-400">hours</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3 text-sm">
                        {entry.pic > 0 && <MiniStat label="PIC" value={entry.pic.toFixed(1)} />}
                        {entry.dual > 0 && <MiniStat label="Dual" value={entry.dual.toFixed(1)} />}
                        {entry.crossCountry > 0 && <MiniStat label="XC" value={entry.crossCountry.toFixed(1)} />}
                        {entry.nightTime > 0 && <MiniStat label="Night" value={entry.nightTime.toFixed(1)} />}
                        {entry.actualInstrument > 0 && <MiniStat label="Actual" value={entry.actualInstrument.toFixed(1)} />}
                        {entry.dayLandings > 0 && <MiniStat label="Day Ldg" value={entry.dayLandings.toString()} />}
                        {entry.nightLandings > 0 && <MiniStat label="Night Ldg" value={entry.nightLandings.toString()} />}
                        {entry.approaches > 0 && <MiniStat label="Appr" value={entry.approaches.toString()} />}
                      </div>
                      
                      {entry.remarks && (
                        <p className="mt-2 text-sm text-slate-400 italic">{entry.remarks}</p>
                      )}
                      
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                        <button
                          onClick={() => { setEditingEntry(entry); setView('add'); }}
                          className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="px-3 py-1 text-sm text-red-400 hover:bg-red-900/30 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Totals View */}
        {view === 'totals' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Flight Time Totals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <TotalItem label="Total Time" value={totals.totalTime.toFixed(1)} unit="hrs" highlight />
                <TotalItem label="PIC" value={totals.pic.toFixed(1)} unit="hrs" />
                <TotalItem label="SIC" value={totals.sic.toFixed(1)} unit="hrs" />
                <TotalItem label="Dual Received" value={totals.dual.toFixed(1)} unit="hrs" />
                <TotalItem label="Solo" value={totals.solo.toFixed(1)} unit="hrs" />
                <TotalItem label="Cross-Country" value={totals.crossCountry.toFixed(1)} unit="hrs" />
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Conditions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <TotalItem label="Day" value={totals.dayTime.toFixed(1)} unit="hrs" />
                <TotalItem label="Night" value={totals.nightTime.toFixed(1)} unit="hrs" />
                <TotalItem label="Actual IMC" value={totals.actualInstrument.toFixed(1)} unit="hrs" />
                <TotalItem label="Simulated IMC" value={totals.simulatedInstrument.toFixed(1)} unit="hrs" />
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Landings & Approaches</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <TotalItem label="Day Landings" value={totals.dayLandings.toString()} />
                <TotalItem label="Night Landings" value={totals.nightLandings.toString()} />
                <TotalItem label="Approaches" value={totals.approaches.toString()} />
                <TotalItem label="Holds" value={totals.holds.toString()} />
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <TotalItem label="Total Flights" value={totals.flights.toString()} highlight />
                <TotalItem label="Total Landings" value={(totals.dayLandings + totals.nightLandings).toString()} />
              </div>
            </div>
          </div>
        )}

        {/* Currency View */}
        {view === 'currency' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-400 mb-4">
              Currency status based on logged flights. Always verify against official records.
            </div>
            
            {currency.map((item, i) => (
              <div key={i} className={`bg-slate-800/50 rounded-lg p-4 border-l-4 ${
                item.status === 'current' ? 'border-green-500' :
                item.status === 'warning' ? 'border-amber-500' :
                'border-red-500'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold">{item.name}</h4>
                    <p className="text-sm text-slate-400">{item.description}</p>
                    <p className="text-sm text-slate-500 mt-1">{item.requirement}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    item.status === 'current' ? 'bg-green-900/50 text-green-300' :
                    item.status === 'warning' ? 'bg-amber-900/50 text-amber-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {item.status === 'current' ? '✓ Current' :
                     item.status === 'warning' ? '⚠ Expiring' :
                     '✗ Expired'}
                  </span>
                </div>
                {item.lastCompleted && (
                  <p className="text-xs text-slate-500 mt-2">
                    Last: {item.lastCompleted}
                  </p>
                )}
              </div>
            ))}

            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mt-6">
              <h4 className="text-blue-400 font-medium mb-2">📋 Manual Tracking</h4>
              <p className="text-sm text-slate-300">
                Track these items separately:
              </p>
              <ul className="text-sm text-slate-400 mt-2 space-y-1 list-disc list-inside">
                <li>Flight Review (24 calendar months)</li>
                <li>Medical Certificate (Class depends on operation)</li>
                <li>IPC (if IFR currency lapsed)</li>
                <li>High Performance / Complex endorsements</li>
              </ul>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {view === 'add' && (
          <FlightEntryForm
            entry={editingEntry}
            onSave={handleSaveEntry}
            onCancel={() => { setEditingEntry(null); setView('list'); }}
          />
        )}
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-700/50 rounded px-2 py-1">
      <span className="text-slate-400 text-xs">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function TotalItem({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-slate-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-400' : 'text-white'}`}>
        {value}
        {unit && <span className="text-sm text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function FlightEntryForm({ 
  entry, 
  onSave, 
  onCancel 
}: { 
  entry: FlightEntry | null; 
  onSave: (entry: Omit<FlightEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    date: entry?.date || new Date().toISOString().split('T')[0],
    aircraft: entry?.aircraft || '',
    aircraftType: entry?.aircraftType || '',
    from: entry?.from || '',
    to: entry?.to || '',
    route: entry?.route || '',
    totalTime: entry?.totalTime || 0,
    pic: entry?.pic || 0,
    sic: entry?.sic || 0,
    dual: entry?.dual || 0,
    solo: entry?.solo || 0,
    crossCountry: entry?.crossCountry || 0,
    dayTime: entry?.dayTime || 0,
    nightTime: entry?.nightTime || 0,
    actualInstrument: entry?.actualInstrument || 0,
    simulatedInstrument: entry?.simulatedInstrument || 0,
    dayLandings: entry?.dayLandings || 0,
    nightLandings: entry?.nightLandings || 0,
    approaches: entry?.approaches || 0,
    approachTypes: entry?.approachTypes || '',
    holds: entry?.holds || 0,
    remarks: entry?.remarks || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold">{entry ? 'Edit Flight' : 'Log New Flight'}</h2>
      
      {/* Basic Info */}
      <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-slate-400">Flight Info</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Aircraft</label>
            <input
              type="text"
              value={form.aircraft}
              onChange={e => setForm({...form, aircraft: e.target.value.toUpperCase()})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="N12345"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Aircraft Type</label>
            <input
              type="text"
              value={form.aircraftType}
              onChange={e => setForm({...form, aircraftType: e.target.value.toUpperCase()})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="C172"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Total Time</label>
            <input
              type="number"
              step="0.1"
              value={form.totalTime || ''}
              onChange={e => setForm({...form, totalTime: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="1.5"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">From</label>
            <input
              type="text"
              value={form.from}
              onChange={e => setForm({...form, from: e.target.value.toUpperCase()})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="KJFK"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">To</label>
            <input
              type="text"
              value={form.to}
              onChange={e => setForm({...form, to: e.target.value.toUpperCase()})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="KBOS"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Via (optional)</label>
            <input
              type="text"
              value={form.route}
              onChange={e => setForm({...form, route: e.target.value.toUpperCase()})}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="KPHL"
            />
          </div>
        </div>
      </div>

      {/* Time Categories */}
      <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-slate-400">Time Categories</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {[
            { key: 'pic', label: 'PIC' },
            { key: 'sic', label: 'SIC' },
            { key: 'dual', label: 'Dual' },
            { key: 'solo', label: 'Solo' },
            { key: 'crossCountry', label: 'X-Country' },
            { key: 'dayTime', label: 'Day' },
            { key: 'nightTime', label: 'Night' },
            { key: 'actualInstrument', label: 'Actual IMC' },
            { key: 'simulatedInstrument', label: 'Sim IMC' }
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input
                type="number"
                step="0.1"
                value={(form as any)[key] || ''}
                onChange={e => setForm({...form, [key]: parseFloat(e.target.value) || 0})}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                placeholder="0.0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Landings & Approaches */}
      <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-slate-400">Landings & Approaches</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Day Landings</label>
            <input
              type="number"
              value={form.dayLandings || ''}
              onChange={e => setForm({...form, dayLandings: parseInt(e.target.value) || 0})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Night Landings</label>
            <input
              type="number"
              value={form.nightLandings || ''}
              onChange={e => setForm({...form, nightLandings: parseInt(e.target.value) || 0})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Approaches</label>
            <input
              type="number"
              value={form.approaches || ''}
              onChange={e => setForm({...form, approaches: parseInt(e.target.value) || 0})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Holds</label>
            <input
              type="number"
              value={form.holds || ''}
              onChange={e => setForm({...form, holds: parseInt(e.target.value) || 0})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
              placeholder="0"
            />
          </div>
        </div>
        {form.approaches > 0 && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Approach Types</label>
            <input
              type="text"
              value={form.approachTypes}
              onChange={e => setForm({...form, approachTypes: e.target.value})}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
              placeholder="ILS, VOR, GPS"
            />
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <label className="block text-sm text-slate-400 mb-1">Remarks</label>
        <textarea
          value={form.remarks}
          onChange={e => setForm({...form, remarks: e.target.value})}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white h-20 resize-none"
          placeholder="Flight notes, maneuvers, etc."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          {entry ? 'Update Flight' : 'Log Flight'}
        </button>
      </div>
    </form>
  );
}
