// Browser-independent integrity helpers. These validate record structure, not
// aircraft performance, route safety, weather, or operational suitability.
export interface Waypoint {
  id: string;
  name: string;
  distance: number;
  trueCourse: number;
  altitude: number;
  windDirection: number;
  windSpeed: number;
}

export interface FlightPlan {
  id: string;
  name: string;
  departure: string;
  destination: string;
  waypoints: Waypoint[];
  aircraftTas: number;
  fuelBurnRate: number;
  fuelOnboard: number;
  reserveMinutes: number;
  createdAt: number;
  schemaVersion?: 2;
  date?: string | null;
  magneticVariation?: number | null;
}

export const BACKUP_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxPlans: 500,
  maxWaypointsPerPlan: 500,
  maxTotalWaypoints: 10000,
  maxStringLength: 10000,
  maxDepth: 16,
  maxNodes: 100000,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Existing local-storage compatibility is intentionally broader than import
// limits. Never rewrite, sanitize, or drop legacy/unknown fields while reading.
export function readPlans(raw: string | null): FlightPlan[] {
  const plans: unknown = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(plans) || !plans.every(plan => {
    if (!isRecord(plan)) return false;
    return ['id', 'name', 'departure', 'destination'].every(k => typeof plan[k] === 'string') && !!plan.id &&
      ['aircraftTas', 'fuelBurnRate', 'fuelOnboard', 'reserveMinutes', 'createdAt'].every(k => typeof plan[k] === 'number' && Number.isFinite(plan[k])) &&
      (plan.schemaVersion === undefined || plan.schemaVersion === 2) && validDate(plan.date) &&
      (plan.magneticVariation === undefined || plan.magneticVariation === null || (typeof plan.magneticVariation === 'number' && Number.isFinite(plan.magneticVariation))) &&
      Array.isArray(plan.waypoints) && plan.waypoints.every(wp => isRecord(wp) && typeof wp.id === 'string' && !!wp.id && typeof wp.name === 'string' &&
        ['distance', 'trueCourse', 'altitude', 'windDirection', 'windSpeed'].every(k => typeof wp[k] === 'number' && Number.isFinite(wp[k]))) &&
      new Set(plan.waypoints.map(wp => wp.id)).size === plan.waypoints.length;
  }) || new Set(plans.map(plan => plan.id)).size !== plans.length) {
    throw new Error('Unsupported or damaged saved plans');
  }
  return plans as FlightPlan[];
}

function checkSafeData(value: unknown): void {
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++nodes > BACKUP_LIMITS.maxNodes) throw new Error('Backup contains too many data fields.');
    if (item.depth > BACKUP_LIMITS.maxDepth) throw new Error('Backup data is nested too deeply.');
    if (typeof item.value === 'string' && item.value.length > BACKUP_LIMITS.maxStringLength) {
      throw new Error('Backup contains an oversized text field.');
    }
    if (typeof item.value === 'number' && (!Number.isFinite(item.value) || (Number.isInteger(item.value) && !Number.isSafeInteger(item.value)))) throw new Error('Backup contains an unsafe number.');
    if (item.value !== null && typeof item.value === 'object') {
      for (const [key, child] of Object.entries(item.value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Backup contains an unsafe data key.');
        if (key.length > BACKUP_LIMITS.maxStringLength) throw new Error('Backup contains an oversized text key.');
        pending.push({ value: child, depth: item.depth + 1 });
      }
    }
  }
}

export function parsePlanBackup(text: string): FlightPlan[] {
  // Check before parsing and count UTF-8 bytes rather than UTF-16 code units.
  if (text.length > BACKUP_LIMITS.maxBytes || new TextEncoder().encode(text).byteLength > BACKUP_LIMITS.maxBytes) {
    throw new Error('Backup exceeds the 2 MiB import limit. No plans were imported.');
  }
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Backup is not valid JSON. No plans were imported.'); }
  checkSafeData(value);
  let records: unknown = value;
  if (!Array.isArray(value)) {
    if (!isRecord(value) || value.format !== 'avweather-plan-backup' || value.version !== 1 ||
        Object.keys(value).some(key => !['format', 'version', 'plans'].includes(key))) {
      throw new Error('Unsupported plan backup format or version.');
    }
    records = value.plans;
  }
  if (!Array.isArray(records)) throw new Error('Backup must contain a list of saved plans.');
  if (records.length > BACKUP_LIMITS.maxPlans) throw new Error('Backup exceeds the limit of 500 plans per import.');
  let totalWaypoints = 0;
  for (const record of records) {
    if (isRecord(record) && Array.isArray(record.waypoints)) {
      totalWaypoints += record.waypoints.length;
      if (record.waypoints.length > BACKUP_LIMITS.maxWaypointsPerPlan || totalWaypoints > BACKUP_LIMITS.maxTotalWaypoints) {
        throw new Error('Backup exceeds the limit of 500 waypoints per plan or 10,000 waypoints per import.');
      }
    }
  }
  // Reuse the exact local schema, including uniqueness and historical optional
  // fields. All-or-nothing: a bad record cannot silently disappear from a file.
  return readPlans(JSON.stringify(records));
}

export function createPlanExport(raw: string | null): {
  content: string; filename: string; rawRecovery: boolean; count: number | null;
} {
  try {
    const plans = readPlans(raw);
    // Embed the original array text, rather than reserializing and silently
    // normalizing unknown fields (for example, 1e999 becoming null).
    const content = `{"format":"avweather-plan-backup","version":1,"plans":${raw ?? '[]'}}`;
    // A normal export must be directly importable. Anything else gets a lossless
    // recovery download, including future fields, damaged JSON and large stores.
    parsePlanBackup(content);
    return { content, filename: 'avweather-plans.json', rawRecovery: false, count: plans.length };
  } catch {
    return { content: raw ?? '', filename: 'avweather-plans-recovery.txt', rawRecovery: true, count: null };
  }
}

export function mergePlanCopies(existing: FlightPlan[], incoming: FlightPlan[], newId: () => string): FlightPlan[] {
  // Incoming records have already been validated. Clone them, not the originals;
  // preserve unknown fields, original creation timestamps and absent/null values.
  // Legacy reads intentionally tolerate unknown fields; do not let merging
  // normalize unsafe historical values (e.g. Infinity) during serialization.
  try { checkSafeData(existing); }
  catch { throw new Error('Existing plans contain unsafe or oversized data. Export a recovery backup before attempting repair. Nothing was imported.'); }
  checkSafeData(incoming);
  const copies = parsePlanBackup(JSON.stringify(incoming));
  const reserved = new Set([...existing, ...incoming].flatMap(plan => [plan.id, ...plan.waypoints.map(wp => wp.id)]));
  const uniqueId = () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const id = newId();
      if (typeof id === 'string' && id.length > 0 && id.length <= BACKUP_LIMITS.maxStringLength && !reserved.has(id)) {
        reserved.add(id);
        return id;
      }
    }
    throw new Error('Could not create unique IDs. Nothing was imported; try again.');
  };
  for (const plan of copies) {
    plan.id = uniqueId();
    for (const waypoint of plan.waypoints) waypoint.id = uniqueId();
  }
  return [...existing, ...copies];
}
