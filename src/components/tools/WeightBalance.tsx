'use client';

import { containDialogTab } from '@/lib/dialog-focus';
import { envelopeLimits, normalizeEnvelope, validateAircraft, validateLoading } from '@/lib/weight-balance-validation';

import { useState, useEffect, useMemo, useCallback, useId, useRef, useSyncExternalStore } from 'react';
import {
  AircraftProfile,
  CustomAircraft,
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getCustomAircraft,
  saveCustomAircraft,
  deleteCustomAircraft,
  exportProfiles,
  importProfiles,
} from '@/lib/profiles';

// Illustrative, unverified templates; not individual-aircraft operational records.
interface Station {
  name: string;
  arm: number; // inches from datum
  minWeight?: number;
  maxWeight?: number;
  defaultWeight?: number;
}

interface CGEnvelope {
  points: { weight: number; cgMin: number; cgMax: number }[];
}

interface AircraftData {
  name: string;
  emptyWeight: number;
  emptyArm: number;
  maxGross: number;
  fuelArm: number;
  fuelCapacity: number; // gallons
  fuelWeight: number; // lbs per gallon
  stations: Station[];
  envelope: CGEnvelope;
}

const AIRCRAFT_DATABASE: Record<string, AircraftData> = {
  'C172S': {
    name: 'Cessna 172S Skyhawk SP',
    emptyWeight: 1680,
    emptyArm: 39.0,
    maxGross: 2550,
    fuelArm: 48.0,
    fuelCapacity: 53,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
      { name: 'Baggage Area 1', arm: 95.0, maxWeight: 120 },
      { name: 'Baggage Area 2', arm: 123.0, maxWeight: 50 },
    ],
    envelope: {
      points: [
        { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
        { weight: 1950, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  },
  'C182T': {
    name: 'Cessna 182T Skylane',
    emptyWeight: 1970,
    emptyArm: 39.5,
    maxGross: 3100,
    fuelArm: 46.0,
    fuelCapacity: 87,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 74.0, maxWeight: 400 },
      { name: 'Baggage Area 1', arm: 97.0, maxWeight: 200 },
      { name: 'Baggage Area 2', arm: 120.0, maxWeight: 50 },
    ],
    envelope: {
      points: [
        { weight: 1800, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2350, cgMin: 35.0, cgMax: 47.3 },
        { weight: 3100, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  },
  'PA28-181': {
    name: 'Piper PA-28-181 Archer',
    emptyWeight: 1540,
    emptyArm: 83.7,
    maxGross: 2550,
    fuelArm: 95.0,
    fuelCapacity: 50,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 80.5, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 118.1, maxWeight: 400 },
      { name: 'Baggage', arm: 142.8, maxWeight: 200 },
    ],
    envelope: {
      points: [
        { weight: 1400, cgMin: 78.0, cgMax: 93.0 },
        { weight: 1800, cgMin: 78.0, cgMax: 93.0 },
        { weight: 2550, cgMin: 84.0, cgMax: 93.0 },
      ]
    }
  }
};

interface StationInput {
  weight: number;
}

interface WeightBalancePreferences {
  fuelGallons: number;
  stationWeights: StationInput[];
  error?: string;
}

const DEFAULT_AIRCRAFT_ID = 'C172S';

function getDefaultStationWeights(aircraft: AircraftData): StationInput[] {
  return aircraft.stations.map((station) => ({ weight: station.defaultWeight || 0 }));
}

function normalizeStationWeights(rawStations: unknown, aircraft: AircraftData): StationInput[] {
  if (!Array.isArray(rawStations) || rawStations.length !== aircraft.stations.length) {
    return aircraft.stations.map(() => ({ weight: NaN }));
  }

  return aircraft.stations.map((_, index) => {
    const candidate = rawStations[index];
    const weight = typeof candidate === 'object' && candidate !== null && 'weight' in candidate && typeof candidate.weight === 'number'
      ? candidate.weight
      : NaN;

    return { weight };
  });
}

function getStoredPreferences(aircraftId: string, aircraft: AircraftData): WeightBalancePreferences {
  const fallback = {
    fuelGallons: Math.min(40, aircraft.fuelCapacity),
    stationWeights: getDefaultStationWeights(aircraft),
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  let saved: string | null;
  try { saved = localStorage.getItem(`wb-${aircraftId}`); }
  catch { return { ...fallback, error: 'Unable to read loading preferences. Using defaults in memory; nothing is saved.' }; }
  try {
    if (saved === null) {
      return fallback;
    }

    const data = JSON.parse(saved);
    const nextFuel = typeof data.fuel === 'number' && Number.isFinite(data.fuel)
      ? data.fuel
      : NaN;

    return {
      fuelGallons: nextFuel,
      stationWeights: normalizeStationWeights(data.stations, aircraft),
    };
  } catch {
    return { fuelGallons: NaN, stationWeights: getDefaultStationWeights(aircraft), error: 'Saved loading preferences are damaged. Original data is preserved; repair or back it up before saving.' };
  }
}

// Native modal semantics keep focus inside the dialog and restore it on close.
function Modal({ isOpen, onClose, title, children }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={containDialogTab}
      className="av-tools-dialog"
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
    >
      {isOpen && <>
        <div className="av-tools-dialog-heading">
          <h3 id={titleId}>{title}</h3>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="px-3 text-slate-400">✕</button>
        </div>
        <div className="av-tools-dialog-content">{children}</div>
      </>}
    </dialog>
  );
}

function computeWeightBalance(aircraft: AircraftData, fuelGallons: number, stationWeights: StationInput[]) {
  if (validateLoading(aircraft, fuelGallons, stationWeights.map(station => station.weight)).length) return null;

  const emptyMoment = aircraft.emptyWeight * aircraft.emptyArm;
  const fuelWeight = fuelGallons * aircraft.fuelWeight;
  const fuelMoment = fuelWeight * aircraft.fuelArm;
  const stationMoments = stationWeights.map((station, index) => ({
    weight: station.weight,
    arm: aircraft.stations[index]?.arm || 0,
    moment: station.weight * (aircraft.stations[index]?.arm || 0),
  }));

  const totalStationWeight = stationMoments.reduce((sum, station) => sum + station.weight, 0);
  const totalStationMoment = stationMoments.reduce((sum, station) => sum + station.moment, 0);
  const totalWeight = aircraft.emptyWeight + fuelWeight + totalStationWeight;
  const totalMoment = emptyMoment + fuelMoment + totalStationMoment;
  const cg = totalMoment / totalWeight;

  const limits = envelopeLimits(aircraft.envelope.points, totalWeight);
  const cgMin = limits?.cgMin ?? NaN;
  const cgMax = limits?.cgMax ?? NaN;

  const withinWeight = totalWeight <= aircraft.maxGross;
  const withinCG = !!limits && cg >= cgMin && cg <= cgMax;

  return {
    emptyWeight: aircraft.emptyWeight,
    emptyMoment,
    fuelWeight,
    fuelMoment,
    stationMoments,
    totalStationWeight,
    totalWeight,
    totalMoment,
    cg,
    cgMin,
    cgMax,
    withinEnvelopeWeight: !!limits,
    withinWeight,
    withinCG,
    isValid: withinWeight && withinCG,
    overweight: totalWeight - aircraft.maxGross,
  };
}

function EnvelopeChart({ envelope, calculations }: { envelope: CGEnvelope; calculations: NonNullable<ReturnType<typeof computeWeightBalance>> }) {
  const patternId = useId();
  const points = normalizeEnvelope(envelope.points).points;
  const padding = 30;
  const width = 280;
  const height = 200;
  const minWeight = Math.min(points[0].weight, calculations.totalWeight);
  const maxWeight = Math.max(points[points.length - 1].weight, calculations.totalWeight);
  const minCG = Math.min(...points.map((point) => point.cgMin), calculations.cg) - 2;
  const maxCG = Math.max(...points.map((point) => point.cgMax), calculations.cg) + 2;

  const scaleX = (cg: number) => padding + ((cg - minCG) / (maxCG - minCG)) * (width - 2 * padding);
  const scaleY = (weight: number) => height - padding - ((weight - minWeight) / (maxWeight - minWeight)) * (height - 2 * padding);
  const fwdPoints = points.map((point) => `${scaleX(point.cgMin)},${scaleY(point.weight)}`);
  const aftPoints = [...points].reverse().map((point) => `${scaleX(point.cgMax)},${scaleY(point.weight)}`);
  const envelopePath = `M ${fwdPoints.join(' L ')} L ${aftPoints.join(' L ')} Z`;
  const cgX = scaleX(calculations.cg);
  const cgY = scaleY(calculations.totalWeight);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="av-tools-envelope-chart mx-auto">
      <defs>
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={padding} y="10" width={width - 2 * padding} height={height - 2 * padding} fill={`url(#${patternId})`} />
      <path d={envelopePath} fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="2" />
      <circle cx={cgX} cy={cgY} r="6" fill={calculations.isValid ? '#22c55e' : '#ef4444'} stroke="white" strokeWidth="2" />
      <text x={width / 2} y={height - 5} textAnchor="middle" className="text-xs fill-slate-400">CG (inches)</text>
      <text x="10" y={height / 2} textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`} className="text-xs fill-slate-400">Weight (lbs)</text>
      <text x={padding} y={height - 10} textAnchor="start" className="text-[10px] fill-slate-500">{minCG.toFixed(0)}</text>
      <text x={width - padding} y={height - 10} textAnchor="end" className="text-[10px] fill-slate-500">{maxCG.toFixed(0)}</text>
      <text x={padding - 5} y={scaleY(minWeight)} textAnchor="end" className="text-[10px] fill-slate-500">{minWeight}</text>
      <text x={padding - 5} y={scaleY(maxWeight)} textAnchor="end" className="text-[10px] fill-slate-500">{maxWeight}</text>
    </svg>
  );
}

function initialRecords() {
  const errors: string[] = [];
  let profiles: AircraftProfile[] = [];
  let aircraft: CustomAircraft[] = [];
  if (typeof window === 'undefined') return { profiles, aircraft, error: '' };
  try { profiles = getProfiles(); } catch (error) { errors.push((error as Error).message); }
  try { aircraft = getCustomAircraft(); } catch (error) { errors.push((error as Error).message); }
  return { profiles, aircraft, error: errors.join(' ') };
}

const subscribeToHydration = () => () => {};
export default function WeightBalance() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? <WeightBalanceEditor /> : <p role="status">Loading weight and balance inputs…</p>;
}

function WeightBalanceEditor() {
  const [initial] = useState(initialRecords);
  const [storageError, setStorageError] = useState(initial.error);
  const [actionError, setActionError] = useState('');
  const [preferenceError, setPreferenceError] = useState(() => getStoredPreferences(DEFAULT_AIRCRAFT_ID, AIRCRAFT_DATABASE[DEFAULT_AIRCRAFT_ID]).error ?? '');
  const [loadedSnapshot, setLoadedSnapshot] = useState<CustomAircraft | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<AircraftProfile | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState(DEFAULT_AIRCRAFT_ID);
  const [fuelGallons, setFuelGallons] = useState(() => getStoredPreferences(DEFAULT_AIRCRAFT_ID, AIRCRAFT_DATABASE[DEFAULT_AIRCRAFT_ID]).fuelGallons);
  const [stationWeights, setStationWeights] = useState<StationInput[]>(() => getStoredPreferences(DEFAULT_AIRCRAFT_ID, AIRCRAFT_DATABASE[DEFAULT_AIRCRAFT_ID]).stationWeights);
  
  // Profile management state
  const [profiles, setProfiles] = useState<AircraftProfile[]>(initial.profiles);
  const [customAircraftList, setCustomAircraftList] = useState<CustomAircraft[]>(initial.aircraft);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  
  // Modal states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCustomAircraftModal, setShowCustomAircraftModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  
  // Form states
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  
  // Custom aircraft form
  const [customAircraftForm, setCustomAircraftForm] = useState<CustomAircraft>({
    name: '',
    emptyWeight: 1680,
    emptyArm: 39.0,
    maxGross: 2550,
    fuelArm: 48.0,
    fuelCapacity: 53,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
      { name: 'Baggage', arm: 95.0, maxWeight: 120 },
    ],
    envelope: {
      points: [
        { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  });

  // Combined aircraft database (built-in + custom)
  const allAircraft = useMemo(() => {
    const combined: Record<string, AircraftData> = { ...AIRCRAFT_DATABASE };
    customAircraftList.forEach(custom => {
      combined[`custom-${custom.name}`] = {
        ...custom,
        stations: custom.stations.map(s => ({ ...s })),
      };
    });
    return combined;
  }, [customAircraftList]);

  const aircraft = loadedSnapshot ?? allAircraft[selectedAircraft] ?? AIRCRAFT_DATABASE[DEFAULT_AIRCRAFT_ID];

  const applyAircraftSelection = useCallback((aircraftId: string, nextAircraft?: AircraftData) => {
    const resolvedAircraft = nextAircraft ?? allAircraft[aircraftId] ?? AIRCRAFT_DATABASE[DEFAULT_AIRCRAFT_ID];
    const preferences = getStoredPreferences(aircraftId, resolvedAircraft);
    setLoadedSnapshot(null);
    setPreferenceError(preferences.error ?? '');
    setSelectedAircraft(aircraftId);
    setFuelGallons(preferences.fuelGallons);
    setStationWeights(preferences.stationWeights);
  }, [allAircraft]);

  // Save preferences
  useEffect(() => {
    // Loaded profiles are immutable snapshots, not updates to the aircraft library's preferences.
    if (selectedProfile || loadedSnapshot || validateLoading(aircraft, fuelGallons, stationWeights.map(station => station.weight)).length) return;
    try {
      const raw = localStorage.getItem(`wb-${selectedAircraft}`);
      if (raw !== null) {
        const stored = JSON.parse(raw);
        if (!stored || !Number.isFinite(stored.fuel) || !Array.isArray(stored.stations) || !stored.stations.every((station: StationInput) => station && Number.isFinite(station.weight))) {
          throw new Error('Damaged preferences');
        }
      }
      localStorage.setItem(`wb-${selectedAircraft}`, JSON.stringify({
        fuel: fuelGallons,
        stations: stationWeights
      }));
      // Report the outcome of this external storage synchronization, not derived UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferenceError('');
    } catch {
      setPreferenceError('Loading changes are not saved. Local storage is unavailable, full, or contains damaged preferences. Existing saved profiles are unchanged; keep this page open to retain your inputs.');
    }
  }, [fuelGallons, stationWeights, selectedAircraft, selectedProfile, loadedSnapshot, aircraft]);

  const updateStationWeight = (index: number, weight: number) => {
    const newWeights = [...stationWeights];
    newWeights[index] = { weight };
    setStationWeights(newWeights);
  };

  // Profile handlers
  const handleLoadProfile = useCallback((profileId: string) => {
    if (!profileId) {
      setSelectedProfile('');
      return;
    }
    
    let profile: AircraftProfile | undefined;
    try {
      const latest = getProfiles();
      setProfiles(latest);
      profile = latest.find(p => p.id === profileId);
      if (!profile) throw new Error('This profile was deleted. Choose another profile.');
      if (!profile.customAircraft && !AIRCRAFT_DATABASE[profile.aircraftType]) throw new Error('This profile is missing its aircraft snapshot. It cannot be loaded safely.');
    } catch (error) { setActionError((error as Error).message); return; }
    if (!profile) return;
    setActionError('');
    setSelectedProfile(profileId);

    if (profile.customAircraft) {
      const customKey = `custom-${profile.customAircraft.name}`;
      setSelectedAircraft(customKey);
      setLoadedSnapshot(profile.customAircraft);
      setFuelGallons(profile.fuelGallons);
      setStationWeights(profile.stationWeights.map((weight) => ({ weight })));
      return;
    }

    applyAircraftSelection(profile.aircraftType);
    setFuelGallons(profile.fuelGallons);
    setStationWeights(profile.stationWeights.map((weight) => ({ weight })));
  }, [applyAircraftSelection]);

  const handleSaveProfile = useCallback(() => {
    if (!profileName.trim()) return;
    try {
      if (editingProfileId && editingSnapshot) {
        // Manage → Edit only renames the saved record, never the active loading.
        updateProfile(editingProfileId, { name: profileName.trim() }, editingSnapshot);
      } else {
        const errors = validateLoading(aircraft, fuelGallons, stationWeights.map(station => station.weight));
        if (errors.length) throw new Error(errors.join(' '));
        createProfile({
          name: profileName.trim(), aircraftType: selectedAircraft,
          customAircraft: selectedAircraft.startsWith('custom-') ? aircraft : undefined,
          fuelGallons, stationWeights: stationWeights.map(station => station.weight),
        });
      }
      setProfiles(getProfiles());
      setShowSaveModal(false);
      setProfileName('');
      setEditingProfileId(null);
      setEditingSnapshot(null);
      setActionError('');
    } catch (error) { setActionError((error as Error).message); }
  }, [profileName, selectedAircraft, aircraft, fuelGallons, stationWeights, editingProfileId, editingSnapshot]);

  const handleDeleteProfile = useCallback((id: string) => {
    if (confirm('Delete this profile?')) {
      try {
        deleteProfile(id, profiles.find(profile => profile.id === id));
        setProfiles(getProfiles());
        setActionError('');
        if (selectedProfile === id) setSelectedProfile('');
      } catch (error) { setActionError((error as Error).message); }
    }
  }, [selectedProfile, profiles]);

  const handleEditProfile = useCallback((profile: AircraftProfile) => {
    setEditingSnapshot(profile);
    setActionError('');
    setProfileName(profile.name);
    setEditingProfileId(profile.id);
    setShowManageModal(false);
    setShowSaveModal(true);
  }, []);

  // Custom aircraft handlers
  const handleSaveCustomAircraft = useCallback(() => {
    if (!customAircraftForm.name.trim()) return;
    const nextAircraft = { ...customAircraftForm, name: customAircraftForm.name.trim(), envelope: { points: normalizeEnvelope(customAircraftForm.envelope.points).points } };
    try {
      const errors = validateAircraft(nextAircraft);
      if (errors.length) throw new Error(errors.join(' '));
      saveCustomAircraft(nextAircraft);
      setCustomAircraftList(getCustomAircraft());
    } catch (error) { setActionError((error as Error).message); return; }
    setActionError('');
    setSelectedProfile('');
    applyAircraftSelection(`custom-${nextAircraft.name}`, nextAircraft);
    setShowCustomAircraftModal(false);
    
    // Reset form
    setCustomAircraftForm({
      name: '',
      emptyWeight: 1680,
      emptyArm: 39.0,
      maxGross: 2550,
      fuelArm: 48.0,
      fuelCapacity: 53,
      fuelWeight: 6.0,
      stations: [
        { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
        { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
        { name: 'Baggage', arm: 95.0, maxWeight: 120 },
      ],
      envelope: {
        points: [
          { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
          { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
        ]
      }
    });
  }, [customAircraftForm, applyAircraftSelection]);

  const handleDeleteCustomAircraft = useCallback((name: string) => {
    if (confirm(`Delete custom aircraft "${name}"?`)) {
      try {
        deleteCustomAircraft(name, customAircraftList.find(aircraft => aircraft.name === name));
        setCustomAircraftList(getCustomAircraft());
        setActionError('');
        if (selectedAircraft === `custom-${name}` && !loadedSnapshot) applyAircraftSelection(DEFAULT_AIRCRAFT_ID);
      } catch (error) { setActionError((error as Error).message); }
    }
  }, [selectedAircraft, applyAircraftSelection, customAircraftList, loadedSnapshot]);

  // Import/Export handlers
  const handleExport = useCallback(() => {
    let json: string;
    try { json = exportProfiles(); } catch (error) { setActionError((error as Error).message); return; }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'avweather-profiles.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const result = importProfiles(importText);
    if (result.success) {
      setProfiles(getProfiles());
      setShowImportExportModal(false);
      setImportText('');
      alert(`Successfully imported ${result.imported} profile(s)`);
    } else {
      setActionError(`Import failed: ${result.error}`);
    }
  }, [importText]);

  // Calculate totals
  const calculations = useMemo(
    () => computeWeightBalance(aircraft, fuelGallons, stationWeights),
    [aircraft, fuelGallons, stationWeights]
  );
  const validationErrors = validateLoading(aircraft, fuelGallons, stationWeights.map(station => station.weight));
  const refreshRecords = () => {
    const latest = initialRecords();
    if (!latest.error) { setProfiles(latest.profiles); setCustomAircraftList(latest.aircraft); }
    setStorageError(latest.error);
  };

  return (
    <div className="space-y-6">
      <aside aria-label="Weight and balance data limitations" className="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-100">
        <h3 className="font-semibold">Illustrative templates — unverified</h3>
        <p className="mt-2">
          Built-in aircraft data is for illustration, not an individual-aircraft weight and balance record.
          C182T is not T182T; C172S is not 172N. Do not substitute these templates for another model or aircraft.
        </p>
        <p className="mt-2">
          Verify all values against the specific aircraft’s current approved weight and balance record and POH/AFM,
          including equipment, station limits and loading envelope. Custom entries and saved profiles are user-supplied, not verified by this app.
          Results are not a determination that an aircraft is safe to fly.
        </p>
      </aside>
      {(storageError || preferenceError || actionError) && <div role="alert" className="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-sm text-amber-100">{storageError} {preferenceError} {actionError}</div>}
      {/* Profile Quick Actions */}
      <div className="av-tools-profile-actions">
        <div>
        <label htmlFor="av-tools-profile">Saved aircraft profiles</label>
        <select id="av-tools-profile"
          value={selectedProfile}
          onChange={(e) => handleLoadProfile(e.target.value)}
          className="w-full sm:flex-1 sm:min-w-[140px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Load Profile...</option>
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        </div>
        
        <button
          onClick={() => {
            setProfileName('');
            setEditingProfileId(null);
            setEditingSnapshot(null);
            setActionError('');
            setShowSaveModal(true);
          }}
          className="flex-1 sm:flex-none justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save profile
        </button>
        
        <button
          onClick={() => { refreshRecords(); setActionError(''); setShowManageModal(true); }}
          className="flex-1 sm:flex-none px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
        >
          Manage profiles
        </button>
      </div>

      {/* Aircraft Selection */}
      <div className="av-tools-inputs space-y-6">
      <h3 className="av-tools-section-title">Loading inputs</h3>
      <div>
        <label htmlFor="av-tools-wb-0" className="block text-sm font-medium text-slate-400 mb-2">Aircraft Type</label>
        <div className="flex gap-2">
          <select id="av-tools-wb-0"
            value={loadedSnapshot ? 'saved-profile-snapshot' : selectedAircraft}
            onChange={(e) => {
              applyAircraftSelection(e.target.value);
              setSelectedProfile('');
            }}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {loadedSnapshot && <option value="saved-profile-snapshot">{loadedSnapshot.name} — saved snapshot</option>}
            <optgroup label="Illustrative templates (unverified)">
              {Object.entries(AIRCRAFT_DATABASE).map(([id, data]) => (
                <option key={id} value={id}>{data.name} — illustrative</option>
              ))}
            </optgroup>
            {customAircraftList.length > 0 && (
              <optgroup label="Custom Aircraft">
                {customAircraftList.map(custom => (
                  <option key={custom.name} value={`custom-${custom.name}`}>
                    {custom.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          
          <button
            onClick={() => { setActionError(''); setShowCustomAircraftModal(true); }}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            aria-label="Add custom aircraft"
            title="Add Custom Aircraft"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Fuel Input */}
      <div>
        <label htmlFor="av-tools-wb-1" className="block text-sm font-medium text-slate-400 mb-2">
          Fuel ({Number.isFinite(fuelGallons) ? fuelGallons : 'Invalid'} gal = {Number.isFinite(fuelGallons * aircraft.fuelWeight) ? (fuelGallons * aircraft.fuelWeight).toFixed(0) : 'Unavailable'} lbs)
        </label>
        <input id="av-tools-wb-1"
          type="range"
          min="0"
          max={aircraft.fuelCapacity}
          value={Number.isFinite(fuelGallons) ? fuelGallons : 0}
          onChange={(e) => setFuelGallons(e.target.valueAsNumber)}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Empty</span>
          <span>Tabs ({Math.round(aircraft.fuelCapacity * 0.75)})</span>
          <span>Full ({aircraft.fuelCapacity})</span>
        </div>
      </div>

      {/* Station Inputs */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-400">Payload</label>
        {aircraft.stations.map((station, index) => (
          <div key={index} className="flex items-center gap-3">
            <label htmlFor={`av-tools-payload-${index}`} className="text-sm text-slate-300 flex-1">{station.name} (lbs)</label>
            <input id={`av-tools-payload-${index}`}
              type="number"
              value={Number.isFinite(stationWeights[index]?.weight) ? stationWeights[index].weight : ''}
              onChange={(e) => updateStationWeight(index, e.target.valueAsNumber)}
              className="w-24 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-right"
              min="0"
              max={station.maxWeight}
            />
            <span className="text-xs text-slate-500 w-12">lbs</span>
          </div>
        ))}
      </div>

      </div>

      {validationErrors.length > 0 && <div role="alert" className="rounded-lg border border-red-700 bg-red-950/40 p-4 text-sm text-red-200">
        <h3 className="font-semibold">Invalid loading — results unavailable</h3>
        <ul className="list-disc pl-5">{validationErrors.map(error => <li key={error}>{error}</li>)}</ul>
        <p>Correct these inputs before saving a profile or using the results.</p>
      </div>}
      {loadedSnapshot && <p className="text-sm text-amber-100">Using the saved profile’s aircraft snapshot, not the current custom-aircraft library definition. Reselect an aircraft type to use library data.</p>}
      {/* Results */}
      {calculations && (
        <div className="space-y-4">
          <h3 className="av-tools-section-title">Loading results</h3>
          {/* CG Envelope Chart */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">CG Envelope — selected data, unverified</h4>
            <EnvelopeChart envelope={aircraft.envelope} calculations={calculations} />
          </div>

          {/* Summary Table */}
          <div className="av-tools-table bg-slate-800/50 rounded-lg" tabIndex={0} role="region" aria-label="Weight and balance breakdown, scroll horizontally on small screens">
            <table className="w-full text-sm">
              <caption className="sr-only">Loading breakdown: weight in pounds, arm in inches, moment in pound-inches</caption>
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-left px-4 py-2 text-slate-400">Item</th>
                  <th className="text-right px-4 py-2 text-slate-400">Weight (lb)</th>
                  <th className="text-right px-4 py-2 text-slate-400">Arm (in)</th>
                  <th className="text-right px-4 py-2 text-slate-400">Moment (lb·in)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                <tr>
                  <td className="px-4 py-2">Empty Weight</td>
                  <td className="text-right px-4 py-2">{calculations.emptyWeight}</td>
                  <td className="text-right px-4 py-2">{aircraft.emptyArm.toFixed(1)}</td>
                  <td className="text-right px-4 py-2">{calculations.emptyMoment.toFixed(0)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Fuel</td>
                  <td className="text-right px-4 py-2">{calculations.fuelWeight.toFixed(0)}</td>
                  <td className="text-right px-4 py-2">{aircraft.fuelArm.toFixed(1)}</td>
                  <td className="text-right px-4 py-2">{calculations.fuelMoment.toFixed(0)}</td>
                </tr>
                {calculations.stationMoments.map((s, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{aircraft.stations[i]?.name || `Station ${i+1}`}</td>
                    <td className="text-right px-4 py-2">{s.weight}</td>
                    <td className="text-right px-4 py-2">{s.arm.toFixed(1)}</td>
                    <td className="text-right px-4 py-2">{s.moment.toFixed(0)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 font-medium">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className={`text-right px-4 py-2 ${calculations.withinWeight ? 'text-green-400' : 'text-red-400'}`}>
                    {calculations.totalWeight.toFixed(0)}
                  </td>
                  <td className="text-right px-4 py-2"></td>
                  <td className="text-right px-4 py-2">{calculations.totalMoment.toFixed(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CG Result */}
          <div className={`rounded-lg p-4 ${calculations.isValid ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Center of Gravity</p>
                <p className={`text-2xl font-bold ${calculations.withinCG ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.cg.toFixed(2)} in
                </p>
                <p className="text-xs text-slate-500">
                  {calculations.withinEnvelopeWeight ? `Limits: ${calculations.cgMin.toFixed(1)} in to ${calculations.cgMax.toFixed(1)} in` : 'Weight outside entered envelope — CG limits unavailable'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Gross Weight</p>
                <p className={`text-2xl font-bold ${calculations.withinWeight ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.totalWeight.toFixed(0)} lbs
                </p>
                <p className="text-xs text-slate-500">
                  Max: {aircraft.maxGross} lbs
                  {!calculations.withinWeight && (
                    <span className="text-red-400"> (+{calculations.overweight.toFixed(0)})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-center">
              {calculations.isValid ? (
                <span className="text-green-400 font-medium">Within selected weight/CG limits only — unverified</span>
              ) : (
                <span className="text-red-400 font-medium">Outside selected weight/CG limits</span>
              )}
              <p className="mt-2 text-xs text-slate-300">This check does not establish operational loading compliance or flight safety.</p>
            </div>
          </div>
        </div>
      )}

      {/* Save Profile Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setProfileName('');
          setEditingProfileId(null);
        }}
        title={editingProfileId ? 'Edit Profile' : 'Save Profile'}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="av-tools-wb-3" className="block text-sm font-medium text-slate-400 mb-2">Profile Name</label>
            <input id="av-tools-wb-3"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g., Solo Training, Full Pax, Checkride"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          
          {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
          <div className="text-sm text-slate-400 space-y-1">
            {editingSnapshot ? <>
              <p>Rename only: the original aircraft snapshot, fuel and payload will be preserved. To save different loading, load the profile, change inputs, then choose Save profile to create a separate record.</p>
              <p><strong>Aircraft:</strong> {editingSnapshot.customAircraft?.name ?? AIRCRAFT_DATABASE[editingSnapshot.aircraftType]?.name ?? editingSnapshot.aircraftType}</p>
              <p><strong>Fuel:</strong> {editingSnapshot.fuelGallons} gallons</p>
            </> : <>
              <p><strong>Aircraft:</strong> {aircraft.name}</p>
              <p><strong>Fuel:</strong> {Number.isFinite(fuelGallons) ? fuelGallons : 'Invalid'} gallons</p>
              <p><strong>Total Weight:</strong> {calculations?.totalWeight.toFixed(0) ?? 'Unavailable'} lbs</p>
            </>}
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setShowSaveModal(false);
                setProfileName('');
                setEditingProfileId(null);
              }}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={!profileName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {editingProfileId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage Profiles Modal */}
      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title="Manage Profiles"
      >
        <div className="space-y-4">
          {(actionError || storageError) && <p role="alert" className="text-sm text-red-300">{actionError || storageError}</p>}
          {profiles.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No saved profiles yet</p>
          ) : (
            <div className="space-y-2">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-white">{profile.name}</p>
                    <p className="text-xs text-slate-400">
                      {profile.customAircraft?.name || AIRCRAFT_DATABASE[profile.aircraftType]?.name || profile.aircraftType} • {profile.fuelGallons}gal
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        handleLoadProfile(profile.id);
                        setShowManageModal(false);
                      }}
                      className="p-2 text-blue-400 hover:bg-slate-600 rounded transition-colors"
                      title="Load"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditProfile(profile)}
                      className="p-2 text-slate-400 hover:bg-slate-600 rounded transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="p-2 text-red-400 hover:bg-slate-600 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 pt-2 border-t border-slate-700">
            <button
              onClick={() => {
                setShowManageModal(false);
                setShowImportExportModal(true);
              }}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              Import/Export
            </button>
          </div>
        </div>
      </Modal>

      {/* Import/Export Modal */}
      <Modal
        isOpen={showImportExportModal}
        onClose={() => {
          setShowImportExportModal(false);
          setImportText('');
        }}
        title="Import/Export Profiles"
      >
        <div className="space-y-4">
          {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
          <div>
            <button
              onClick={handleExport}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export All Profiles
            </button>
          </div>
          
          <div className="border-t border-slate-700 pt-4">
            <label htmlFor="av-tools-wb-4" className="block text-sm font-medium text-slate-400 mb-2">Import JSON</label>
            <textarea id="av-tools-wb-4"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste exported JSON here..."
              className="w-full h-32 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="w-full mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Import Profiles
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Aircraft Modal */}
      <Modal
        isOpen={showCustomAircraftModal}
        onClose={() => setShowCustomAircraftModal(false)}
        title="Add Custom Aircraft"
      >
        <div className="space-y-4">
          {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
          <div>
            <label htmlFor="av-tools-wb-5" className="block text-sm font-medium text-slate-400 mb-1">Aircraft Name</label>
            <input id="av-tools-wb-5"
              type="text"
              value={customAircraftForm.name}
              onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, name: e.target.value })}
              placeholder="e.g., N12345 (My C172)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="av-tools-wb-6" className="block text-xs font-medium text-slate-400 mb-1">Empty Weight (lbs)</label>
              <input id="av-tools-wb-6"
                type="number"
                value={Number.isFinite(customAircraftForm.emptyWeight) ? customAircraftForm.emptyWeight : ''}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, emptyWeight: e.target.valueAsNumber })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="av-tools-wb-7" className="block text-xs font-medium text-slate-400 mb-1">Empty Arm (in)</label>
              <input id="av-tools-wb-7"
                type="number"
                step="0.1"
                value={Number.isFinite(customAircraftForm.emptyArm) ? customAircraftForm.emptyArm : ''}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, emptyArm: e.target.valueAsNumber })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="av-tools-wb-8" className="block text-xs font-medium text-slate-400 mb-1">Max Gross (lbs)</label>
              <input id="av-tools-wb-8"
                type="number"
                value={Number.isFinite(customAircraftForm.maxGross) ? customAircraftForm.maxGross : ''}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, maxGross: e.target.valueAsNumber })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="av-tools-wb-9" className="block text-xs font-medium text-slate-400 mb-1">Fuel Capacity (gal)</label>
              <input id="av-tools-wb-9"
                type="number"
                value={Number.isFinite(customAircraftForm.fuelCapacity) ? customAircraftForm.fuelCapacity : ''}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, fuelCapacity: e.target.valueAsNumber })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="av-tools-wb-10" className="block text-xs font-medium text-slate-400 mb-1">Fuel Arm (in)</label>
              <input id="av-tools-wb-10"
                type="number"
                step="0.1"
                value={Number.isFinite(customAircraftForm.fuelArm) ? customAircraftForm.fuelArm : ''}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, fuelArm: e.target.valueAsNumber })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label htmlFor="av-tools-wb-11" className="block text-xs font-medium text-slate-400 mb-1">Fuel Weight (lb/gal)</label>
              <input id="av-tools-wb-11"
                type="number"
                step="0.1"
                value={Number.isFinite(customAircraftForm.fuelWeight) ? customAircraftForm.fuelWeight : ''}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, fuelWeight: e.target.valueAsNumber })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          
          <div className="border-t border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-400">Payload stations</p>
              <button
                onClick={() => setCustomAircraftForm({
                  ...customAircraftForm,
                  stations: [...customAircraftForm.stations, { name: 'New Station', arm: 50, maxWeight: 200 }]
                })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Station
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">Name · Arm (inches) · Maximum weight (lbs)</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {customAircraftForm.stations.map((station, i) => (
                <div key={i} className="av-tools-custom-row">
                  <input aria-label={`Station ${i + 1} name`}
                    type="text"
                    value={station.name}
                    onChange={(e) => {
                      const newStations = [...customAircraftForm.stations];
                      newStations[i] = { ...newStations[i], name: e.target.value };
                      setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                    }}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Name"
                  />
                  <input aria-label={`Station ${i + 1} arm (inches)`}
                    type="number"
                    step="0.1"
                    value={Number.isFinite(station.arm) ? station.arm : ''}
                    onChange={(e) => {
                      const newStations = [...customAircraftForm.stations];
                      newStations[i] = { ...newStations[i], arm: e.target.valueAsNumber };
                      setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                    }}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Arm"
                  />
                  <input aria-label={`Station ${i + 1} maximum weight (lbs)`}
                    type="number"
                    value={Number.isFinite(station.maxWeight) ? station.maxWeight : ''}
                    onChange={(e) => {
                      const newStations = [...customAircraftForm.stations];
                      newStations[i] = { ...newStations[i], maxWeight: e.target.valueAsNumber };
                      setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                    }}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Max"
                  />
                  {customAircraftForm.stations.length > 1 && (
                    <button aria-label={`Remove station ${i + 1}`}
                      onClick={() => {
                        const newStations = customAircraftForm.stations.filter((_, idx) => idx !== i);
                        setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-slate-700 pt-3">
            <label className="text-sm font-medium text-slate-400 mb-2 block">CG Envelope (Forward/Aft Limits)</label>
            <p className="text-xs text-slate-400 mb-2">Weight (lbs) · Forward limit (inches) · Aft limit (inches)</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {customAircraftForm.envelope.points.map((point, i) => (
                <div key={i} className="av-tools-envelope-row flex gap-2 items-center">
                  <input aria-label={`Envelope point ${i + 1} weight (lbs)`}
                    type="number"
                    value={Number.isFinite(point.weight) ? point.weight : ''}
                    onChange={(e) => {
                      const newPoints = [...customAircraftForm.envelope.points];
                      newPoints[i] = { ...newPoints[i], weight: e.target.valueAsNumber };
                      setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                    }}
                    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Weight"
                  />
                  <span className="text-slate-500 text-xs">lbs @</span>
                  <input aria-label={`Envelope point ${i + 1} forward limit (inches)`}
                    type="number"
                    step="0.1"
                    value={Number.isFinite(point.cgMin) ? point.cgMin : ''}
                    onChange={(e) => {
                      const newPoints = [...customAircraftForm.envelope.points];
                      newPoints[i] = { ...newPoints[i], cgMin: e.target.valueAsNumber };
                      setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                    }}
                    className="w-14 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Fwd"
                  />
                  <span className="text-slate-500 text-xs">-</span>
                  <input aria-label={`Envelope point ${i + 1} aft limit (inches)`}
                    type="number"
                    step="0.1"
                    value={Number.isFinite(point.cgMax) ? point.cgMax : ''}
                    onChange={(e) => {
                      const newPoints = [...customAircraftForm.envelope.points];
                      newPoints[i] = { ...newPoints[i], cgMax: e.target.valueAsNumber };
                      setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                    }}
                    className="w-14 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Aft"
                  />
                  <span className="text-slate-500 text-xs">in</span>
                  {customAircraftForm.envelope.points.length > 2 && (
                    <button aria-label={`Remove envelope point ${i + 1}`}
                      onClick={() => {
                        const newPoints = customAircraftForm.envelope.points.filter((_, idx) => idx !== i);
                        setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCustomAircraftForm({
                  ...customAircraftForm,
                  envelope: {
                    points: [...customAircraftForm.envelope.points, { weight: 2000, cgMin: 35, cgMax: 47 }]
                  }
                })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Point
              </button>
            </div>
          </div>
          
          {/* Custom aircraft delete list */}
          {customAircraftList.length > 0 && (
            <div className="border-t border-slate-700 pt-3">
              <label className="text-sm font-medium text-slate-400 mb-2 block">Saved Custom Aircraft</label>
              <div className="space-y-1">
                {customAircraftList.map(ac => (
                  <div key={ac.name} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                    <span className="text-sm text-white">{ac.name}</span>
                    <button
                      onClick={() => handleDeleteCustomAircraft(ac.name)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowCustomAircraftModal(false)}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCustomAircraft}
              disabled={!customAircraftForm.name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Save Aircraft
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
