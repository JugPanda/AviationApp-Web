// Aircraft Profile Management for Weight & Balance
import { isAircraftSnapshot, normalizeEnvelope, validateAircraft } from './weight-balance-validation';

export interface CustomAircraft {
  name: string;
  emptyWeight: number;
  emptyArm: number;
  maxGross: number;
  fuelArm: number;
  fuelCapacity: number;
  fuelWeight: number;
  stations: { name: string; arm: number; maxWeight?: number }[];
  envelope: { points: { weight: number; cgMin: number; cgMax: number }[] };
}

export interface AircraftProfile {
  id: string;
  name: string;
  aircraftType: string;
  customAircraft?: CustomAircraft;
  fuelGallons: number;
  stationWeights: number[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'avweather-profiles';
const CUSTOM_AIRCRAFT_KEY = 'avweather-custom-aircraft';
const MAX_PROFILES = 20;
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function isProfile(value: unknown): value is AircraftProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as AircraftProfile;
  return typeof p.id === 'string' && !!p.id && typeof p.name === 'string' && !!p.name.trim()
    && typeof p.aircraftType === 'string' && !!p.aircraftType && finite(p.fuelGallons)
    && Array.isArray(p.stationWeights) && p.stationWeights.every(finite)
    && finite(p.createdAt) && finite(p.updatedAt)
    && (p.customAircraft === undefined || isAircraftSnapshot(p.customAircraft));
}

function readCollection<T>(key: string, guard: (value: unknown) => value is T, identity: (value: T) => string): { raw: string | null; records: T[] } {
  if (typeof window === 'undefined') throw new Error('Local storage is unavailable. Nothing was saved.');
  let raw: string | null;
  try { raw = localStorage.getItem(key); }
  catch { throw new Error('Unable to read local storage. Existing records are protected; nothing was saved.'); }
  if (raw === null) return { raw, records: [] };
  try {
    const records: unknown = JSON.parse(raw);
    if (!Array.isArray(records) || !records.every(guard) || new Set(records.map(identity)).size !== records.length) throw new Error();
    return { raw, records };
  } catch {
    throw new Error(`Stored ${key === STORAGE_KEY ? 'profiles' : 'custom aircraft'} data is damaged or unsupported. It has not been overwritten. Back up the original storage before repairing it.`);
  }
}
const readProfiles = () => readCollection(STORAGE_KEY, isProfile, profile => profile.id);
const readAircraft = () => readCollection(CUSTOM_AIRCRAFT_KEY, isAircraftSnapshot, aircraft => aircraft.name);

// Public reads fail closed. UI catches errors and can still use the calculator in memory.
export function getProfiles(): AircraftProfile[] { return readProfiles().records; }
export function getCustomAircraft(): CustomAircraft[] { return readAircraft().records; }

function writeCollection(key: string, before: string | null, records: unknown[]): void {
  const next = JSON.stringify(records);
  try {
    if (localStorage.getItem(key) !== before) throw new Error('conflict');
    localStorage.setItem(key, next);
    if (localStorage.getItem(key) !== next) throw new Error('conflict');
  } catch (error) {
    if (error instanceof Error && error.message === 'conflict') throw new Error('Records changed in another tab. Reopen the dialog and review the latest records before trying again.');
    throw new Error('Unable to save to local storage. Your changes are not saved; keep this page open and retry or copy your draft.');
  }
}
function assertUnchanged<T>(current: T | undefined, expected: T | undefined): void {
  if (!current || !expected || JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error('This record changed or was deleted in another tab. Your draft is not saved. Cancel and reopen the dialog to review the latest record.');
  }
}

export function createProfile(profile: Omit<AircraftProfile, 'id' | 'createdAt' | 'updatedAt'>): AircraftProfile | null {
  const { raw, records } = readProfiles();
  if (records.length >= MAX_PROFILES) throw new Error(`Maximum ${MAX_PROFILES} profiles reached. Export or remove a profile before saving another.`);
  const next: AircraftProfile = { ...profile, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() };
  if (!isProfile(next) || next.fuelGallons < 0 || next.stationWeights.some(weight => weight < 0)) throw new Error('Profile contains invalid loading data; nothing was saved.');
  writeCollection(STORAGE_KEY, raw, [...records, next]);
  return next;
}

export function updateProfile(id: string, updates: Partial<Omit<AircraftProfile, 'id' | 'createdAt'>>, expected?: AircraftProfile): AircraftProfile | null {
  const { raw, records } = readProfiles();
  const index = records.findIndex(profile => profile.id === id);
  assertUnchanged(records[index], expected);
  const next = { ...records[index], ...updates, id: records[index].id, createdAt: records[index].createdAt, updatedAt: Math.max(Date.now(), records[index].updatedAt + 1) };
  if (!isProfile(next)) throw new Error('Profile contains invalid data; nothing was saved.');
  records[index] = next;
  writeCollection(STORAGE_KEY, raw, records);
  return next;
}

export function deleteProfile(id: string, expected?: AircraftProfile): boolean {
  const { raw, records } = readProfiles();
  assertUnchanged(records.find(profile => profile.id === id), expected);
  writeCollection(STORAGE_KEY, raw, records.filter(profile => profile.id !== id));
  return true;
}
export function getProfile(id: string): AircraftProfile | null { return getProfiles().find(profile => profile.id === id) || null; }
export function exportProfiles(): string {
  // Preserve even a damaged raw value so the user can recover it outside this tool.
  try { return localStorage.getItem(STORAGE_KEY) ?? '[]'; }
  catch { throw new Error('Unable to read profiles for export. No backup was created.'); }
}
export function importProfiles(jsonString: string): { success: boolean; imported: number; error?: string } {
  try {
    const imported: unknown = JSON.parse(jsonString);
    if (!Array.isArray(imported) || !imported.every(isProfile)) throw new Error('Invalid profile format. Import cancelled; existing records were not changed.');
    const { raw, records } = readProfiles();
    if (records.length + imported.length > MAX_PROFILES) throw new Error(`Import would exceed ${MAX_PROFILES} profiles. No records were imported.`);
    const ids = new Set(records.map(profile => profile.id));
    const additions = imported.map(profile => {
      const next = { ...profile };
      while (ids.has(next.id)) next.id = generateId();
      ids.add(next.id);
      return next;
    });
    writeCollection(STORAGE_KEY, raw, [...records, ...additions]);
    return { success: true, imported: additions.length };
  } catch (error) {
    return { success: false, imported: 0, error: error instanceof Error ? error.message : 'Import failed. Nothing was saved.' };
  }
}

export function saveCustomAircraft(aircraft: CustomAircraft): void {
  const { raw, records } = readAircraft();
  const errors = validateAircraft(aircraft);
  if (errors.length) throw new Error(errors.join(' '));
  if (records.some(existing => existing.name === aircraft.name.trim())) throw new Error('An aircraft with this name already exists. Choose a different name to preserve its saved definition.');
  const next = { ...aircraft, name: aircraft.name.trim(), envelope: { points: normalizeEnvelope(aircraft.envelope.points).points } };
  writeCollection(CUSTOM_AIRCRAFT_KEY, raw, [...records, next]);
}
export function deleteCustomAircraft(name: string, expected?: CustomAircraft): boolean {
  const { raw, records } = readAircraft();
  assertUnchanged(records.find(aircraft => aircraft.name === name), expected);
  writeCollection(CUSTOM_AIRCRAFT_KEY, raw, records.filter(aircraft => aircraft.name !== name));
  return true;
}
