'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import AppShell, { useBrowserReady } from '@/components/AppShell';
import './logbook.css';

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

const numericFields = ['totalTime', 'pic', 'sic', 'dual', 'solo', 'crossCountry', 'dayTime', 'nightTime', 'actualInstrument', 'simulatedInstrument', 'dayLandings', 'nightLandings', 'approaches', 'holds', 'createdAt', 'updatedAt'] as const;

// Validate the existing shape without coercing, repairing or migrating records.
function isFlightEntry(value: unknown): value is FlightEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return ['id', 'date', 'aircraft', 'aircraftType', 'from', 'to'].every(key => typeof entry[key] === 'string')
    && typeof entry.id === 'string' && entry.id.length > 0
    && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(Date.parse(entry.date))
    && numericFields.every(key => typeof entry[key] === 'number' && Number.isFinite(entry[key]))
    && ['route', 'approachTypes', 'remarks'].every(key => entry[key] === undefined || typeof entry[key] === 'string');
}

function parseEntries(raw: string): FlightEntry[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(isFlightEntry)) throw new Error('Invalid logbook format');
  if (new Set(value.map(entry => entry.id)).size !== value.length) throw new Error('Duplicate entry IDs');
  return value;
}

function loadLogbook(): { entries: FlightEntry[]; raw: string | null; error: string } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return { entries: raw === null ? [] : parseEntries(raw), raw, error: '' };
  } catch {
    return {
      entries: [], raw,
      error: raw === null
        ? 'Browser storage could not be read. Saving and importing are paused to protect any existing records. Allow browser storage, then reload.'
        : 'Your stored logbook could not be opened. It has not been changed. Download the stored data before repairing the file; saving and importing are paused.',
    };
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

type Feedback = { kind: 'success' | 'error' | 'info'; text: string } | null;

export default function LogbookPage() {
  const browserReady = useBrowserReady();
  return <AppShell>{browserReady ? <LocalLogbook /> : (
    <main id="workspace-content" tabIndex={-1} className="av-logbook">
      <h1>Flight logbook</h1><p role="status">Opening your local logbook…</p>
    </main>
  )}</AppShell>;
}

function LocalLogbook() {
  const [loaded] = useState(loadLogbook);
  const [entries, setEntries] = useState<FlightEntry[]>(loaded.entries);
  const storedSnapshot = useRef(loaded.raw);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<'list' | 'add' | 'currency' | 'totals'>('list');
  const [editingEntry, setEditingEntry] = useState<FlightEntry | null>(null);
  const [sortField, setSortField] = useState<'date' | 'totalTime'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const contentHeading = useRef<HTMLHeadingElement>(null);
  const focusNextView = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const locked = Boolean(loaded.error) || importing;

  useEffect(() => {
    if (focusNextView.current) {
      contentHeading.current?.focus();
      focusNextView.current = false;
    }
  }, [view]);

  const changeView = (next: typeof view) => {
    focusNextView.current = true;
    setView(next);
  };


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
      description: '61.57(a)(1)',
      requirement: '3 landings in 90 days',
      status: recentDayLandings >= 3 ? 'current' : recentDayLandings >= 1 ? 'warning' : 'expired',
      lastCompleted: recent.find(e => e.dayLandings > 0)?.date
    });

    // Night currency (3 landings to full stop in 90 days)
    items.push({
      name: 'Night Passenger',
      description: '61.57(b)',
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

  // Commit to storage before changing the visible records. A failed write keeps
  // both the saved list and the open draft intact, rather than claiming success.
  const persist = (updated: FlightEntry[]): boolean => {
    if (loaded.error) return false;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== storedSnapshot.current) {
        setFeedback({ kind: 'error', text: 'The stored logbook changed in another tab. Nothing was overwritten. Copy any unsaved notes, then reload to see the latest records.' });
        return false;
      }
      const raw = JSON.stringify(updated);
      localStorage.setItem(STORAGE_KEY, raw);
      storedSnapshot.current = raw;
      setEntries(updated);
      return true;
    } catch {
      setFeedback({ kind: 'error', text: 'Could not save to this browser. Your saved records are unchanged and any open draft is still here. Check available storage or browser permissions, then try again. Export a backup of saved records before clearing data.' });
      return false;
    }
  };

  const handleSaveEntry = (entry: Omit<FlightEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const updated = editingEntry
      ? entries.map(e => e.id === editingEntry.id ? { ...e, ...entry, updatedAt: Date.now() } : e)
      : [...entries, { ...entry, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() }];
    if (!persist(updated)) return;
    setFeedback({ kind: 'success', text: editingEntry ? 'Flight updated in this browser.' : 'Flight saved in this browser.' });
    setEditingEntry(null);
    changeView('list');
  };

  const handleDeleteEntry = (entry: FlightEntry) => {
    if (!confirm(`Delete the flight on ${entry.date}, ${entry.from} → ${entry.to}? This cannot be undone. Export a backup first if you need a copy.`)) {
      setFeedback({ kind: 'info', text: 'Deletion canceled. Your flight is unchanged.' });
      return;
    }
    if (persist(entries.filter(e => e.id !== entry.id))) {
      setFeedback({ kind: 'success', text: 'Flight deleted from this browser.' });
      contentHeading.current?.focus();
    }
  };

  const handleExport = () => {
    try {
      const json = loaded.error ? loaded.raw : JSON.stringify(entries, null, 2);
      if (json === null) return;
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `logbook-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({ kind: 'info', text: 'Backup download requested. Check your downloads before clearing browser data. Unsaved form changes are not included.' });
    } catch {
      setFeedback({ kind: 'error', text: 'The backup download could not start. Your records have not changed. Try again in a browser that allows downloads.' });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || locked || view === 'add') return;
    setImporting(true);
    setFeedback({ kind: 'info', text: 'Reading logbook backup…' });
    try {
      const imported = parseEntries(await file.text());
      const existingIds = new Set(entries.map(e => e.id));
      const additions = imported.filter(entry => !existingIds.has(entry.id));
      const skipped = imported.length - additions.length;
      if (additions.length && !persist([...entries, ...additions])) return;
      setFeedback({ kind: 'success', text: `Imported ${additions.length} new ${additions.length === 1 ? 'flight' : 'flights'}; ${skipped} existing ${skipped === 1 ? 'ID' : 'IDs'} skipped. Existing records were not replaced.` });
    } catch {
      setFeedback({ kind: 'error', text: 'This file could not be imported. Choose an AV Weather JSON export with complete flight records and unique IDs. No records were changed.' });
    } finally {
      setImporting(false);
    }
  };

  const startEntry = (entry: FlightEntry | null = null) => {
    setEditingEntry(entry);
    setFeedback(null);
    changeView('add');
  };

  return (
    <main id="workspace-content" tabIndex={-1} className="av-logbook">
      <header className="av-logbook-header">
        <div>
          <p className="av-logbook-eyebrow">04 / Your flying record</p>
          <h1>Flight logbook</h1>
          <p className="av-logbook-description">A record of your flights, time and recent activity.</p>
        </div>
        {view !== 'add' && <button className="av-logbook-button av-logbook-primary" disabled={locked} onClick={() => startEntry()}>+ Add Flight</button>}
      </header>

      <section className="av-logbook-storage" aria-label="Local storage and backups">
        <div>
          <strong>Stored in this browser only</strong>
          <p>No account or device sync. Export a backup before clearing browser data.</p>
        </div>
        <div className="av-logbook-actions">
          <button className="av-logbook-button" onClick={handleExport} disabled={Boolean(loaded.error) && loaded.raw === null}>
            {loaded.error ? 'Download stored data' : 'Export backup'}
          </button>
          <button className="av-logbook-button av-logbook-quiet" disabled={locked || view === 'add'} onClick={() => importInput.current?.click()}>Import JSON</button>
          <input ref={importInput} className="av-logbook-file" type="file" accept=".json,application/json" aria-label="Import logbook JSON file" tabIndex={-1} disabled={locked || view === 'add'} onChange={handleImport} />
        </div>
        <p className="av-logbook-backup-help">Import adds new IDs and skips existing IDs; it never replaces an existing flight.</p>
      </section>

      {loaded.error && <p className="av-logbook-feedback av-logbook-error" role="alert">{loaded.error}</p>}
      {view !== 'add' && <FeedbackMessage feedback={feedback} />}

      {!loaded.error && <>
        <div className="av-logbook-overview" aria-label="Logbook summary">
          <div><span>Flights recorded</span><strong>{totals.flights}</strong></div>
          <div><span>Total flight time</span><strong>{totals.totalTime.toFixed(1)} <small>hours</small></strong></div>
          <div><span>Landings logged</span><strong>{totals.dayLandings + totals.nightLandings}</strong></div>
        </div>

        <nav className="av-logbook-nav" aria-label="Logbook views">
          {([{ key: 'list', label: 'Entries' }, { key: 'totals', label: 'Totals' }, { key: 'currency', label: 'Recency' }] as const).map(({ key, label }) => (
            <button key={key} aria-pressed={view === key} aria-controls="av-logbook-content" disabled={view === 'add' || importing} onClick={() => changeView(key)}>{label}</button>
          ))}
        </nav>
        {view === 'add' && <p className="av-logbook-form-note">Save or cancel this entry to return to your records. Drafts are not saved automatically.</p>}

        <section id="av-logbook-content" className="av-logbook-content" aria-labelledby="av-logbook-view-title">
          <div className="av-logbook-section-heading">
            <div>
              <h2 id="av-logbook-view-title" ref={contentHeading} tabIndex={-1}>{view === 'list' ? 'Flight entries' : view === 'totals' ? 'Your logged totals' : view === 'currency' ? 'Recency indicators' : editingEntry ? 'Edit Flight' : 'Log New Flight'}</h2>
              {view === 'list' && <p>{entries.length ? 'Review a flight or edit its details. Your newest flights appear first by default.' : 'Start with one flight, or restore a JSON backup using Import JSON above.'}</p>}
              {view === 'totals' && <p>All saved entries in this browser. Time categories can overlap; they are not added together to calculate total time.</p>}
            </div>
            {view === 'list' && entries.length > 0 && <div className="av-logbook-sort-control">
              <label htmlFor="av-logbook-sort">Order entries</label>
              <select id="av-logbook-sort" value={`${sortField}-${sortDir}`} onChange={e => {
                const [field, direction] = e.target.value.split('-');
                setSortField(field as typeof sortField); setSortDir(direction as typeof sortDir);
              }}>
                <option value="date-desc">Newest date first</option><option value="date-asc">Oldest date first</option>
                <option value="totalTime-desc">Longest flight first</option><option value="totalTime-asc">Shortest flight first</option>
              </select>
            </div>}
          </div>

          {view === 'list' && (entries.length === 0 ? (
            <div className="av-logbook-empty">
              <span className="av-logbook-empty-mark" aria-hidden="true">01</span>
              <div><h3>No flights logged yet</h3><p>Add the date, aircraft, route and total time. Include other time categories and notes when you need them.</p>
                <button className="av-logbook-button av-logbook-primary" disabled={locked} onClick={() => startEntry()}>Log your first flight</button>
              </div>
              <div className="av-logbook-empty-aside"><strong>Your records, kept local.</strong><p>There are no sample flights here. Only entries you add or import will appear.</p></div>
            </div>
          ) : <div className="av-logbook-entry-list">
            {sortedEntries.map(entry => <article key={entry.id} className="av-logbook-entry" aria-label={`Flight ${entry.date}, ${entry.from} to ${entry.to}`}>
              <div className="av-logbook-entry-top">
                <div><time dateTime={entry.date}>{entry.date}</time><h3>{entry.from} <span aria-hidden="true">→</span><span className="av-logbook-sr"> to </span> {entry.to}</h3><p>{entry.aircraft} <span className="av-logbook-muted">/ {entry.aircraftType}</span></p>{entry.route && <p className="av-logbook-muted">Via {entry.route}</p>}</div>
                <p className="av-logbook-entry-hours"><strong>{entry.totalTime.toFixed(1)}</strong><span>total hours</span></p>
              </div>
              <dl className="av-logbook-mini-stats">
                {entry.pic > 0 && <MiniStat label="PIC hours" value={entry.pic.toFixed(1)} />}
                {entry.dual > 0 && <MiniStat label="Dual hours" value={entry.dual.toFixed(1)} />}
                {entry.crossCountry > 0 && <MiniStat label="Cross-country hours" value={entry.crossCountry.toFixed(1)} />}
                {entry.nightTime > 0 && <MiniStat label="Night hours" value={entry.nightTime.toFixed(1)} />}
                {entry.actualInstrument > 0 && <MiniStat label="Actual instrument hours" value={entry.actualInstrument.toFixed(1)} />}
                {entry.dayLandings > 0 && <MiniStat label="Day landings" value={String(entry.dayLandings)} />}
                {entry.nightLandings > 0 && <MiniStat label="Night landings" value={String(entry.nightLandings)} />}
                {entry.approaches > 0 && <MiniStat label="Approaches" value={String(entry.approaches)} />}
              </dl>
              {entry.remarks && <p className="av-logbook-remarks">{entry.remarks}</p>}
              <div className="av-logbook-entry-actions">
                <button className="av-logbook-button" disabled={locked} onClick={() => startEntry(entry)}>Edit flight</button>
                <button className="av-logbook-button av-logbook-danger" disabled={locked} onClick={() => handleDeleteEntry(entry)}>Delete</button>
              </div>
            </article>)}
          </div>)}

          {view === 'totals' && <div className="av-logbook-total-panels">
            <section className="av-logbook-panel"><h3>Flight time</h3><dl className="av-logbook-totals">
              <TotalItem label="Total time" value={totals.totalTime.toFixed(1)} unit="hours" highlight />
              <TotalItem label="Pilot in command (PIC)" value={totals.pic.toFixed(1)} unit="hours" />
              <TotalItem label="Second in command (SIC)" value={totals.sic.toFixed(1)} unit="hours" />
              <TotalItem label="Dual received" value={totals.dual.toFixed(1)} unit="hours" />
              <TotalItem label="Solo" value={totals.solo.toFixed(1)} unit="hours" />
              <TotalItem label="Cross-country" value={totals.crossCountry.toFixed(1)} unit="hours" />
            </dl></section>
            <section className="av-logbook-panel"><h3>Conditions</h3><dl className="av-logbook-totals">
              <TotalItem label="Day" value={totals.dayTime.toFixed(1)} unit="hours" /><TotalItem label="Night" value={totals.nightTime.toFixed(1)} unit="hours" />
              <TotalItem label="Actual instrument" value={totals.actualInstrument.toFixed(1)} unit="hours" /><TotalItem label="Simulated instrument" value={totals.simulatedInstrument.toFixed(1)} unit="hours" />
            </dl></section>
            <section className="av-logbook-panel"><h3>Landings & approaches</h3><dl className="av-logbook-totals">
              <TotalItem label="Day landings" value={String(totals.dayLandings)} /><TotalItem label="Night landings" value={String(totals.nightLandings)} />
              <TotalItem label="Approaches" value={String(totals.approaches)} /><TotalItem label="Holds" value={String(totals.holds)} />
            </dl></section>
            <section className="av-logbook-panel"><h3>Summary</h3><dl className="av-logbook-totals">
              <TotalItem label="Total flights" value={String(totals.flights)} highlight /><TotalItem label="Total landings" value={String(totals.dayLandings + totals.nightLandings)} />
            </dl></section>
          </div>}

          {view === 'currency' && <div className="av-logbook-recency">
            <div className="av-logbook-caution"><h3>Incomplete checks, not clearance to fly</h3><p>These simplified estimates use your logged entries, not a complete regulatory assessment. They do not establish legal currency or fitness to fly. Verify all requirements and official records independently.</p><p>The existing counters do not verify takeoffs, full-stop landings, aircraft category or class, instrument tracking/intercepting, or calendar-month rules. A count being met is not a determination of eligibility.</p></div>
            <div className="av-logbook-recency-grid">{currency.map((item, i) => <section key={item.name} className="av-logbook-panel">
              <p className="av-logbook-eyebrow">Logged activity / {item.description}</p>
              <h3>{['Day landings', 'Night landings', 'Instrument activity'][i]}</h3>
              <span className={`av-logbook-count av-logbook-count-${item.status}`}>{item.status === 'current' ? 'Count met' : item.status === 'warning' ? 'Partial count' : 'Count not met'}</span>
              <p>Counter: {item.requirement}</p>
              <p className="av-logbook-muted">{item.lastCompleted ? `Matching logged entry: ${item.lastCompleted}` : 'No matching logged entry.'}</p>
            </section>)}</div>
            <section className="av-logbook-panel"><h3>Keep a separate record</h3><p>This logbook does not assess flight reviews, medical eligibility, instrument proficiency checks, endorsements or operation-specific requirements. Verify what applies to your flight using official records and current rules.</p></section>
          </div>}

          {view === 'add' && <FlightEntryForm key={editingEntry?.id ?? 'new'} entry={editingEntry} feedback={feedback} onSave={handleSaveEntry} onCancel={() => {
            setEditingEntry(null); changeView('list');
            setFeedback({ kind: 'info', text: 'Entry canceled. No changes were saved.' });
          }} />}
        </section>
      </>}
    </main>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <p className={`av-logbook-feedback av-logbook-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}</p>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function TotalItem({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return <div className={highlight ? 'av-logbook-highlight' : undefined}><dt>{label}</dt><dd>{value}{unit && <small> {unit}</small>}</dd></div>;
}

type FlightDraft = Omit<FlightEntry, 'id' | 'createdAt' | 'updatedAt'>;
const timeFields = [
  ['pic', 'Pilot in command (PIC)'], ['sic', 'Second in command (SIC)'], ['dual', 'Dual received'],
  ['solo', 'Solo'], ['crossCountry', 'Cross-country'], ['dayTime', 'Day'], ['nightTime', 'Night'],
  ['actualInstrument', 'Actual instrument'], ['simulatedInstrument', 'Simulated instrument'],
] as const;
type CountField = 'dayLandings' | 'nightLandings' | 'approaches' | 'holds';

function FlightEntryForm({ entry, onSave, onCancel, feedback }: {
  entry: FlightEntry | null;
  onSave: (entry: FlightDraft) => void;
  onCancel: () => void;
  feedback: Feedback;
}) {
  const [form, setForm] = useState<FlightDraft>({
    date: entry?.date || new Date().toISOString().split('T')[0],
    aircraft: entry?.aircraft || '', aircraftType: entry?.aircraftType || '',
    from: entry?.from || '', to: entry?.to || '', route: entry?.route || '',
    totalTime: entry?.totalTime || 0, pic: entry?.pic || 0, sic: entry?.sic || 0,
    dual: entry?.dual || 0, solo: entry?.solo || 0, crossCountry: entry?.crossCountry || 0,
    dayTime: entry?.dayTime || 0, nightTime: entry?.nightTime || 0,
    actualInstrument: entry?.actualInstrument || 0, simulatedInstrument: entry?.simulatedInstrument || 0,
    dayLandings: entry?.dayLandings || 0, nightLandings: entry?.nightLandings || 0,
    approaches: entry?.approaches || 0, approachTypes: entry?.approachTypes || '', holds: entry?.holds || 0, remarks: entry?.remarks || '',
  });
  const [dirty, setDirty] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState('');

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    // Catch same-origin workspace links too; beforeunload alone misses SPA navigation.
    const warnBeforeNavigation = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href]');
      if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.hasAttribute('download') || link.getAttribute('target') === '_blank') return;
      if (!confirm('Leave this unsaved flight? Your changes will be lost.')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    document.addEventListener('click', warnBeforeNavigation, true);
    return () => { window.removeEventListener('beforeunload', warnBeforeLeaving); document.removeEventListener('click', warnBeforeNavigation, true); };
  }, [dirty]);

  const update = <K extends keyof FlightDraft>(key: K, value: FlightDraft[K]) => {
    setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setCancelFeedback('');
  };
  const textField = (key: 'date' | 'aircraft' | 'aircraftType' | 'from' | 'to' | 'route', label: string, placeholder?: string, required = false) => (
    <div className="av-logbook-field" key={key}>
      <label htmlFor={`av-logbook-${key}`}>{label}{required ? ' *' : ''}</label>
      <input id={`av-logbook-${key}`} name={key} type={key === 'date' ? 'date' : 'text'} value={form[key]} required={required} placeholder={placeholder} onChange={e => update(key, key === 'date' ? e.target.value : e.target.value.toUpperCase())} />
    </div>
  );
  const numberField = (key: typeof timeFields[number][0] | CountField | 'totalTime', label: string, count = false, required = false) => (
    <div className="av-logbook-field" key={key}>
      <label htmlFor={`av-logbook-${key}`}>{label} ({count ? 'count' : 'hours'}){required ? ' *' : ''}</label>
      <input id={`av-logbook-${key}`} name={key} type="number" inputMode={count ? 'numeric' : 'decimal'} min="0" step={count ? '1' : '0.1'} value={form[key] || ''} placeholder={count ? '0' : '0.0'} required={required} onChange={e => update(key, e.target.value === '' ? 0 : Number(e.target.value))} />
    </div>
  );

  return <form className="av-logbook-form" aria-label={entry ? 'Edit flight' : 'New flight'} onSubmit={e => { e.preventDefault(); onSave(form); }}>
    <p className="av-logbook-muted">Fields marked * are required. Enter time in decimal hours, for example 1.5 for one hour and 30 minutes. Optional number fields left blank are saved as zero.</p>
    <fieldset className="av-logbook-panel"><legend>01 / Flight details</legend>
      <div className="av-logbook-fields">
        {textField('date', 'Date', undefined, true)}{numberField('totalTime', 'Total time', false, true)}
        {textField('aircraft', 'Aircraft registration', 'e.g. N12345', true)}{textField('aircraftType', 'Aircraft type', 'e.g. C172', true)}
        {textField('from', 'From — departure', 'e.g. KJFK', true)}{textField('to', 'To — destination', 'e.g. KBOS', true)}
      </div>
    </fieldset>
    <fieldset className="av-logbook-panel"><legend>02 / Time & landings</legend>
      <p className="av-logbook-muted">Optional. Record only the categories that apply; they can overlap. These fields are not filled from total time.</p>
      <div className="av-logbook-fields">
        {numberField('pic', 'Pilot in command (PIC)')}{numberField('dual', 'Dual received')}
        {numberField('dayLandings', 'Day landings', true)}{numberField('nightLandings', 'Night landings', true)}
      </div>
      <details className="av-logbook-disclosure" open={entry && timeFields.some(([key]) => key !== 'pic' && key !== 'dual' && entry[key] !== 0) ? true : undefined}>
        <summary>More time categories <span>Solo, SIC, cross-country, night & instrument</span></summary>
        <div className="av-logbook-fields">{timeFields.filter(([key]) => key !== 'pic' && key !== 'dual').map(([key, label]) => numberField(key, label))}</div>
      </details>
    </fieldset>
    <details className="av-logbook-panel av-logbook-disclosure" open={entry && (entry.approaches !== 0 || entry.holds !== 0 || entry.approachTypes || entry.route) ? true : undefined}>
      <summary>03 / Route & instrument details <span>Optional approaches, holds and intermediate stops</span></summary>
      <div className="av-logbook-fields">
        {textField('route', 'Via — intermediate stops (optional)', 'e.g. KPHL')}
        {numberField('approaches', 'Approaches', true)}{numberField('holds', 'Holds', true)}
        <div className="av-logbook-field"><label htmlFor="av-logbook-approachTypes">Approach types (optional)</label><input id="av-logbook-approachTypes" value={form.approachTypes} onChange={e => update('approachTypes', e.target.value)} placeholder="e.g. ILS, VOR, GPS" /></div>
      </div>
    </details>
    <div className="av-logbook-panel av-logbook-field"><label htmlFor="av-logbook-remarks">Remarks (optional)</label><textarea id="av-logbook-remarks" value={form.remarks} onChange={e => update('remarks', e.target.value)} rows={3} placeholder="Flight notes, maneuvers or details to remember" /></div>
    <div className="av-logbook-form-footer">
      <FeedbackMessage feedback={feedback} />
      {cancelFeedback && <p className="av-logbook-feedback" role="status">{cancelFeedback}</p>}
      <p>Saved to this browser only. No cloud backup.</p>
      <div className="av-logbook-actions">
        <button type="submit" className="av-logbook-button av-logbook-primary">{entry ? 'Update Flight' : 'Log Flight'}</button>
        <button type="button" className="av-logbook-button" onClick={() => {
          if (dirty && !confirm('Discard unsaved changes to this flight?')) { setCancelFeedback('Still editing. Your unsaved changes are here.'); return; }
          onCancel();
        }}>Cancel</button>
      </div>
    </div>
  </form>;
}
