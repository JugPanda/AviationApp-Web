import type { CustomAircraft } from './profiles';

export type EnvelopePoint = CustomAircraft['envelope']['points'][number];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// Structural guards protect stored records without silently repairing their values.
export function isAircraftSnapshot(value: unknown): value is CustomAircraft {
  if (!object(value) || typeof value.name !== 'string') return false;
  if (!['emptyWeight', 'emptyArm', 'maxGross', 'fuelArm', 'fuelCapacity', 'fuelWeight'].every(key => finite(value[key]))) return false;
  return Array.isArray(value.stations) && value.stations.every(station => object(station) && typeof station.name === 'string' && finite(station.arm) && (station.maxWeight === undefined || finite(station.maxWeight)))
    && object(value.envelope) && Array.isArray(value.envelope.points) && value.envelope.points.every(point => object(point) && finite(point.weight) && finite(point.cgMin) && finite(point.cgMax));
}

export function normalizeEnvelope(points: EnvelopePoint[]): { points: EnvelopePoint[]; errors: string[] } {
  const errors: string[] = [];
  if (points.length < 2) errors.push('Envelope requires at least two points.');
  if (points.some(point => !nonnegative(point.weight) || point.weight === 0 || !finite(point.cgMin) || !finite(point.cgMax) || point.cgMin >= point.cgMax)) {
    errors.push('Envelope weights must be finite and positive; forward and aft limits must be finite with forward less than aft.');
  }
  const sorted = points.map(point => ({ ...point })).sort((a, b) => a.weight - b.weight);
  if (sorted.some((point, index) => index > 0 && point.weight === sorted[index - 1].weight)) errors.push('Envelope point weights must be unique; remove duplicate weights.');
  if (sorted.length && (!finite(sorted[sorted.length - 1].weight - sorted[0].weight) || !finite(Math.max(...sorted.map(point => point.cgMax)) - Math.min(...sorted.map(point => point.cgMin))))) errors.push('Envelope ranges must be finite; check the entered limits.');
  return { points: sorted, errors };
}

export function validateAircraft(aircraft: CustomAircraft): string[] {
  const errors: string[] = [];
  if (!aircraft.name.trim()) errors.push('Aircraft name is required.');
  for (const [label, value] of [['Empty weight', aircraft.emptyWeight], ['Maximum gross weight', aircraft.maxGross], ['Fuel weight per gallon', aircraft.fuelWeight]] as const) {
    if (!finite(value) || value <= 0) errors.push(`${label} must be finite and positive.`);
  }
  if (aircraft.emptyWeight > aircraft.maxGross) errors.push('Empty weight must not exceed maximum gross weight.');
  if (!nonnegative(aircraft.fuelCapacity)) errors.push('Fuel capacity must be finite and nonnegative.');
  // Signed arms are permitted: the datum may be aft of a station.
  if (!finite(aircraft.emptyArm) || !finite(aircraft.fuelArm)) errors.push('Aircraft arms must be finite numbers.');
  if (!aircraft.stations.length) errors.push('At least one payload station is required.');
  aircraft.stations.forEach((station, index) => {
    if (!station.name.trim() || !finite(station.arm)) errors.push(`Station ${index + 1} requires a name and finite arm.`);
    if (station.maxWeight !== undefined && !nonnegative(station.maxWeight)) errors.push(`Station ${index + 1} maximum weight must be finite and nonnegative.`);
  });
  errors.push(...normalizeEnvelope(aircraft.envelope.points).errors);
  return errors;
}

export function validateLoading(aircraft: CustomAircraft, fuel: number, weights: number[]): string[] {
  const errors = validateAircraft(aircraft);
  if (!nonnegative(fuel)) errors.push('Fuel must be a finite, nonnegative number.');
  else if (fuel > aircraft.fuelCapacity) errors.push(`Fuel exceeds capacity of ${aircraft.fuelCapacity} gallons.`);
  if (weights.length !== aircraft.stations.length) errors.push('Payload station count does not match the aircraft snapshot.');
  aircraft.stations.forEach((station, index) => {
    const weight = weights[index];
    if (!nonnegative(weight)) errors.push(`${station.name}: a finite, nonnegative weight is required.`);
    else if (station.maxWeight !== undefined && weight > station.maxWeight) errors.push(`${station.name}: ${weight} lbs exceeds maximum ${station.maxWeight} lbs.`);
  });
  const total = aircraft.emptyWeight + fuel * aircraft.fuelWeight + weights.reduce((sum, weight) => sum + weight, 0);
  const moment = aircraft.emptyWeight * aircraft.emptyArm + fuel * aircraft.fuelWeight * aircraft.fuelArm + weights.reduce((sum, weight, index) => sum + weight * (aircraft.stations[index]?.arm ?? 0), 0);
  if (!finite(total) || !finite(moment)) errors.push('Loading totals must be finite; check the entered values.');
  return errors;
}

export function envelopeLimits(points: EnvelopePoint[], weight: number): { cgMin: number; cgMax: number } | null {
  const normalized = normalizeEnvelope(points);
  if (normalized.errors.length || !finite(weight)) return null;
  const sorted = normalized.points;
  // No extrapolation beyond the entered envelope.
  if (weight < sorted[0].weight || weight > sorted[sorted.length - 1].weight) return null;
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (weight <= current.weight) {
      const ratio = (weight - previous.weight) / (current.weight - previous.weight);
      return { cgMin: previous.cgMin + ratio * (current.cgMin - previous.cgMin), cgMax: previous.cgMax + ratio * (current.cgMax - previous.cgMax) };
    }
  }
  return null;
}
