export interface SigmetData {
  id: string;
  type: 'SIGMET' | 'AIRMET';
  subType: string;
  hazard: string;
  severity?: string;
  validFrom: string;
  validTo: string;
  altitudeLow?: number;
  altitudeHigh?: number;
  rawText: string;
  coords: { lat: number; lng: number }[];
  isActive: boolean;
  product?: 'G-AIRMET' | 'Alaska AIRMET';
  timeKind?: 'period' | 'snapshot';
  snapshotTime?: string;
  issuedAt?: string;
  productExpiresAt?: string;
  altitudeDescription?: string;
  zone?: string;
}

type Point = SigmetData['coords'][number];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
const altitude = (...values: unknown[]): number | undefined => values.find(finite);

// AWC JSON validTime* are epoch SECONDS, not JavaScript milliseconds.
// https://aviationweather.gov/data/schema/openapi.yaml (ISigmetJSON/AirSigmetJSON).
export function validity(value: unknown): string | null {
  const milliseconds = finite(value) && Number.isInteger(value) && value >= 0 && value < 1e11
    ? value * 1000
    : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? Date.parse(value) : NaN;
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function longitude(value: unknown): unknown {
  return Array.isArray(value) && value.length === 2 ? value[0] : record(value) ? value.lon : undefined;
}

function point(value: unknown, longitudeOffset = 0): Point | null {
  const lat = Array.isArray(value) && value.length === 2 ? value[1] : record(value) ? value.lat : undefined;
  const rawLng = longitude(value);
  const lng = finite(rawLng) ? rawLng - longitudeOffset : undefined;
  return finite(lat) && finite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function isSigmetRing(value: unknown): value is Point[] {
  if (!Array.isArray(value) || value.length < 3 || !value.every(p =>
    record(p) && finite(p.lat) && finite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
  )) return false;
  const points = value as Point[];
  if (new Set(points.map(p => `${p.lat},${p.lng}`)).size < 3) return false;
  // Flat Leaflet rings do not split the antimeridian: a jump would cover the
  // wrong side of the world. Require provider-split rings, including closing edge.
  if (points.some((p, i) => Math.abs(p.lng - points[(i + 1) % points.length].lng) > 180)) return false;
  // Unwrap longitude only for degeneracy checking; preserve provider vertices.
  const longitudes = [points[0].lng];
  for (let i = 1; i < points.length; i++) {
    let lng = points[i].lng;
    while (lng - longitudes[i - 1] > 180) lng -= 360;
    while (lng - longitudes[i - 1] < -180) lng += 360;
    longitudes.push(lng);
  }
  const twiceArea = points.reduce((area, p, i) => {
    const j = (i + 1) % points.length;
    return area + longitudes[i] * points[j].lat - longitudes[j] * p.lat;
  }, 0);
  return Math.abs(twiceArea) > 1e-10;
}

export function isRenderableSigmet(value: unknown): value is SigmetData {
  if (!record(value)) return false;
  if (value.product !== undefined && value.product !== 'G-AIRMET' && value.product !== 'Alaska AIRMET') return false;
  if (value.product === 'Alaska AIRMET' && (value.type !== 'AIRMET' || value.timeKind !== 'period' || typeof value.zone !== 'string')) return false;
  if (value.timeKind !== undefined && value.timeKind !== 'period' && value.timeKind !== 'snapshot') return false;
  const snapshot = value.timeKind === 'snapshot';
  if (snapshot && (value.product !== 'G-AIRMET' || value.type !== 'AIRMET' || value.isActive !== false ||
    typeof value.issuedAt !== 'string' || typeof value.productExpiresAt !== 'string' ||
    value.snapshotTime !== value.validFrom || value.validFrom !== value.validTo ||
    !validity(value.issuedAt) || !validity(value.productExpiresAt) ||
    Date.parse(value.issuedAt) > Date.now() ||
    Date.parse(String(value.issuedAt)) >= Date.parse(String(value.productExpiresAt)) ||
    Date.parse(String(value.snapshotTime)) > Date.parse(String(value.productExpiresAt)))) return false;
  if (value.product === 'G-AIRMET' && !snapshot) return false;
  return typeof value.id === 'string' && (value.type === 'SIGMET' || value.type === 'AIRMET') &&
    typeof value.subType === 'string' && typeof value.hazard === 'string' && typeof value.rawText === 'string' &&
    typeof value.validFrom === 'string' && typeof value.validTo === 'string' &&
    validity(value.validFrom) !== null && validity(value.validTo) !== null &&
    (snapshot || Date.parse(value.validFrom) < Date.parse(value.validTo)) && typeof value.isActive === 'boolean' &&
    (value.altitudeDescription === undefined || typeof value.altitudeDescription === 'string') &&
    (value.zone === undefined || typeof value.zone === 'string') &&
    (value.altitudeLow === undefined || finite(value.altitudeLow)) &&
    (value.altitudeHigh === undefined || finite(value.altitudeHigh)) && isSigmetRing(value.coords);
}

/** Keep separate AWC AREAS separate; never flatten boundaries or repair bad vertices. */
export function normalizeSigmet(value: unknown, sourceId: string, now = Date.now()): { items: SigmetData[]; incomplete: boolean } {
  const invalid = { items: [], incomplete: true };
  if (!record(value)) return invalid;
  const validFrom = validity(value.validTimeFrom);
  const validTo = validity(value.validTimeTo);
  const hazard = text(value.hazard);
  if (!validFrom || !validTo || !hazard || Date.parse(validFrom) >= Date.parse(validTo)) return invalid;
  // LINE/POINT require a different renderer, not an invented polygon/buffer.
  if (value.geom !== undefined && value.geom !== 'AREA' && value.geom !== 'AREAS') return invalid;
  if (!Array.isArray(value.coords) || value.coords.length === 0) return invalid;

  const rings: unknown[] = value.geom === 'AREAS' ? value.coords : [value.coords];
  const items: SigmetData[] = [];
  let incomplete = false;
  rings.forEach((ring, index) => {
    if (!Array.isArray(ring)) { incomplete = true; return; }
    // Live AWC AREAS can split at +180 and encode the eastern half as 180..360.
    // Shift that ENTIRE dateline-anchored ring, including its +180 boundary;
    // wrapping vertices individually would draw a polygon across the world.
    const longitudeOffset = value.geom === 'AREAS' && ring.some(p => longitude(p) === 180) &&
      ring.every(p => { const lng = longitude(p); return finite(lng) && lng >= 180 && lng <= 360; }) ? 360 : 0;
    const coords = ring.map(p => point(p, longitudeOffset));
    if (!isSigmetRing(coords)) { incomplete = true; return; }
    items.push({
      id: `${sourceId}:${text(value.icaoId) ?? ''}:${text(value.firId) ?? ''}:${text(value.seriesId) ?? ''}:${validFrom}:${index}`,
      type: value.airSigmetType === 'AIRMET' ? 'AIRMET' : 'SIGMET',
      subType: hazard,
      hazard,
      severity: text(value.severity) ?? (finite(value.severity) ? String(value.severity) : undefined),
      validFrom,
      validTo,
      altitudeLow: altitude(value.base, value.altitudeLow1, value.altitudeLo1, value.altLow1, value.altitudeLo),
      altitudeHigh: altitude(value.top, value.altitudeHi1, value.altHi1, value.altitudeHi),
      rawText: text(value.rawSigmet) ?? text(value.rawAirSigmet) ?? text(value.rawText) ?? '',
      coords,
      isActive: Date.parse(validFrom) <= now && now < Date.parse(validTo),
    });
  });
  return { items, incomplete: incomplete || items.length === 0 };
}
