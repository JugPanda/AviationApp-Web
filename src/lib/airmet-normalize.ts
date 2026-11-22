import { isSigmetRing, normalizeSigmet, validity, type SigmetData } from './sigmet-normalize';

type Result = { items: SigmetData[]; incomplete: boolean };
const invalid = (): Result => ({ items: [], incomplete: true });
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | undefined => typeof v === 'string' && v.trim() ? v : undefined;
// Only this adapter accepts AWC G-AIRMET decimal strings. Do not weaken SIGMET validation.
const decimal = (v: unknown): number => typeof v === 'number' ? v :
  typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : NaN;
const hundredsOfFeet = (v: unknown): number | undefined =>
  typeof v === 'string' && /^\d{3}$/.test(v) ? Number(v) * 100 : undefined;
const altitudeLabel = (v: unknown): string => v === 'SFC' ? 'surface' : v === 'FZL' ? 'freezing level' :
  hundredsOfFeet(v) !== undefined ? `${hundredsOfFeet(v)} ft MSL` : 'not specified';

/** A snapshot is a single instant, NOT issue-to-expiry hazard validity. */
export function normalizeGairmet(value: unknown, sourceId: string): Result {
  if (!record(value)) return invalid();
  const snapshotTime = validity(value.validTime);
  const issuedAt = validity(value.issueTime);
  const productExpiresAt = validity(value.expireTime);
  const hazard = text(value.hazard);
  if (!snapshotTime || !issuedAt || !productExpiresAt || !hazard ||
    Date.parse(issuedAt) > Date.now() ||
    Date.parse(issuedAt) >= Date.parse(productExpiresAt) || Date.parse(snapshotTime) > Date.parse(productExpiresAt) ||
    !['NRML', 'AMD', 'COR'].includes(String(value.status)) ||
    // Observed FZLVL has geometryType AREA but geom LINE. Never fill those contours.
    (value.geom ?? value.geometryType) !== 'AREA' || !Array.isArray(value.coords)) return invalid();
  const coords = value.coords.map(p => record(p) ? { lat: decimal(p.lat), lng: decimal(p.lon) } : null);
  if (!isSigmetRing(coords)) return invalid();
  for (const field of ['base', 'top', 'fzlbase', 'fzltop', 'level']) {
    if (value[field] != null && value[field] !== 'SFC' && value[field] !== 'FZL' && hundredsOfFeet(value[field]) === undefined) return invalid();
  }
  for (const [low, high] of [['base', 'top'], ['fzlbase', 'fzltop']]) {
    const bottom = hundredsOfFeet(value[low]);
    const top = hundredsOfFeet(value[high]);
    if (bottom !== undefined && top !== undefined && bottom > top) return invalid();
  }
  const altitudeDescription = [
    value.base != null || value.top != null ? `Base: ${altitudeLabel(value.base)}; top: ${altitudeLabel(value.top)}.` : '',
    value.fzlbase != null || value.fzltop != null ? `Freezing level: ${altitudeLabel(value.fzlbase)} to ${altitudeLabel(value.fzltop)}.` : '',
    value.level != null ? `Level: ${altitudeLabel(value.level)}.` : '',
  ].filter(Boolean).join(' ') || undefined;
  return { incomplete: false, items: [{
    id: `${sourceId}:${text(value.product) ?? ''}:${text(value.tag) ?? ''}:${hazard}:${snapshotTime}:${issuedAt}`,
    type: 'AIRMET', product: 'G-AIRMET', timeKind: 'snapshot', subType: hazard, hazard,
    severity: text(value.severity), snapshotTime, issuedAt, productExpiresAt,
    // Retain string fields for old clients; a zero-length range can never be mistaken for active validity.
    validFrom: snapshotTime, validTo: snapshotTime, isActive: false,
    altitudeLow: hundredsOfFeet(value.base), altitudeHigh: hundredsOfFeet(value.top), altitudeDescription,
    rawText: text(value.due_to) ?? '', coords,
  }] };
}

/** Alaska GeoJSON contains forecast-zone outlines, not a detailed hazard boundary. */
export function normalizeAlaskaAirmet(value: unknown, sourceId: string, now = Date.now()): Result {
  if (!record(value) || value.type !== 'Feature' || !record(value.properties) || !record(value.geometry)) return invalid();
  const p = value.properties;
  const g = value.geometry;
  if (p.airmetType !== 'AIRMET' || !text(p.region) || !text(p.zone) || !Array.isArray(g.coordinates)) return invalid();
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  if (!polygons.length) return invalid();
  const result: Result = { items: [], incomplete: false };
  polygons.forEach((polygon, index) => {
    // Holes cannot be represented by the existing flat-ring contract. Do not fill them.
    if (!Array.isArray(polygon) || polygon.length !== 1) { result.incomplete = true; return; }
    const normalized = normalizeSigmet({
      validTimeFrom: p.validTimeFrom, validTimeTo: p.validTimeTo, airSigmetType: 'AIRMET',
      hazard: p.hazard, geom: 'AREA', coords: polygon[0],
    }, `${sourceId}:${p.region}:${index}`, now);
    result.incomplete ||= normalized.incomplete;
    result.items.push(...normalized.items.map(item => ({
      ...item, product: 'Alaska AIRMET' as const, timeKind: 'period' as const, zone: String(p.zone),
      // JSON has 300/400 while IWXXM labels those FT but its TAC says FL300-FL400.
      // Do not guess a conversion from contradictory provider representations.
      altitudeDescription: 'Altitude units unverified in this feed; consult the official Alaska forecast.',
      rawText: JSON.stringify(p, null, 2),
    })));
  });
  return { ...result, incomplete: result.incomplete || result.items.length === 0 };
}
