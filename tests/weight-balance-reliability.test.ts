import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { envelopeLimits, normalizeEnvelope, validateAircraft, validateLoading } from '@/lib/weight-balance-validation';
import WeightBalance from '@/components/tools/WeightBalance';
import { createProfile, updateProfile, deleteProfile, getProfiles, importProfiles, saveCustomAircraft, type AircraftProfile, type CustomAircraft } from '@/lib/profiles';

const profile: AircraftProfile = { id: 'kept', name: 'Archer saved', aircraftType: 'PA28-181', fuelGallons: 12, stationWeights: [175, 80, 25], createdAt: 1, updatedAt: 1 };
const aircraft: CustomAircraft = { name: 'N-TEST', emptyWeight: 1500, emptyArm: 40, maxGross: 2550, fuelArm: 40, fuelCapacity: 53, fuelWeight: 6, stations: [{ name: 'Pilot', arm: 40, maxWeight: 400 }], envelope: { points: [{ weight: 1500, cgMin: 35, cgMax: 47 }, { weight: 2550, cgMin: 41, cgMax: 47 }, { weight: 2000, cgMin: 42, cgMax: 47 }] } };
let root: Root | undefined;
let container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('confirm', () => true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  container = document.createElement('div'); document.body.append(container);
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount() { root = createRoot(container); await act(async () => root!.render(createElement(WeightBalance))); }
async function click(name: string, attribute?: string) {
  const button = [...container.querySelectorAll('button')].find(b => attribute ? b.getAttribute(attribute) === name : b.textContent?.trim() === name);
  expect(button, name).toBeTruthy(); await act(async () => button!.click());
}
async function fill(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function select(selector: string, value: string) {
  const input = container.querySelector<HTMLSelectElement>(selector)!;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}
function seed(p = profile) { localStorage.setItem('avweather-profiles', JSON.stringify([p])); }

describe('W&B record integrity', () => {
  it('hydrates without default overwrites or recoverable errors', async () => {
    const preferences = JSON.stringify({ fuel: 21, stations: [{ weight: 180 }, { weight: 100 }, { weight: 20 }, { weight: 0 }] });
    localStorage.setItem('wb-C172S', preferences); seed();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const recoverable = vi.fn();
    container.innerHTML = renderToString(createElement(StrictMode, null, createElement(WeightBalance)));
    await act(async () => { root = hydrateRoot(container, createElement(StrictMode, null, createElement(WeightBalance)), { onRecoverableError: recoverable }); });
    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('#av-tools-payload-0')?.value).toBe('180');
    expect(writes.mock.calls.filter(([key]) => key === 'wb-C172S').every(([, value]) => value === preferences)).toBe(true);
    expect(localStorage.getItem('avweather-profiles')).toBe(JSON.stringify([profile]));
  });
  it('continues in memory when storage reads are denied', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    await mount(); await fill('#av-tools-payload-0', '180');
    expect(container.textContent).toContain('Unable to read');
    expect(container.querySelector<HTMLInputElement>('#av-tools-payload-0')?.value).toBe('180');
  });
  it('preserves corrupt custom library and loading preference bytes', async () => {
    localStorage.setItem('avweather-custom-aircraft', '[null]'); localStorage.setItem('wb-C172S', '{broken');
    await mount();
    expect(container.textContent).toMatch(/damaged/);
    expect(container.textContent).not.toContain('Within selected weight/CG limits only');
    expect(() => saveCustomAircraft(aircraft)).toThrow(/damaged/);
    expect(localStorage.getItem('avweather-custom-aircraft')).toBe('[null]');
    expect(localStorage.getItem('wb-C172S')).toBe('{broken');
  });
  it('merges independent creates and preserves unknown existing record fields', () => {
    localStorage.setItem('avweather-profiles', JSON.stringify([{ ...profile, aircraftRecordRevision: 'keep-me' }]));
    createProfile({ name: 'First', aircraftType: 'C172S', fuelGallons: 0, stationWeights: [0, 0, 0, 0] });
    createProfile({ name: 'Second', aircraftType: 'C172S', fuelGallons: 0, stationWeights: [0, 0, 0, 0] });
    expect(getProfiles()).toHaveLength(3);
    expect(getProfiles()[0]).toMatchObject({ aircraftRecordRevision: 'keep-me' });
  });
  it('renames an unloaded profile without replacing its aircraft or payload', async () => {
    seed(); await mount(); await click('Manage profiles'); await click('Edit', 'title');
    await fill('#av-tools-wb-3', 'Renamed'); await click('Update');
    expect(getProfiles()[0]).toMatchObject({ ...profile, name: 'Renamed', updatedAt: expect.any(Number) });
  });
  it('loads and resaves the embedded snapshot, not a same-name library aircraft', async () => {
    const p = { ...profile, aircraftType: 'custom-N-TEST', customAircraft: aircraft, fuelGallons: 20, stationWeights: [170] };
    seed(p); localStorage.setItem('avweather-custom-aircraft', JSON.stringify([{ ...aircraft, emptyWeight: 1800 }]));
    await mount(); await select('#av-tools-profile', p.id);
    expect(container.querySelector('tbody tr')?.textContent).toContain('1500');
    await click('Save profile'); await fill('#av-tools-wb-3', 'Copy'); await click('Save');
    expect(getProfiles()[1].customAircraft?.emptyWeight).toBe(1500);
    expect(JSON.parse(localStorage.getItem('avweather-custom-aircraft')!)[0].emptyWeight).toBe(1800);
    expect(container.querySelector<HTMLSelectElement>('#av-tools-wb-0')?.value).toBe('saved-profile-snapshot');
    await select('#av-tools-wb-0', 'custom-N-TEST');
    expect(container.querySelector('tbody tr')?.textContent).toContain('1800');
  });
  it('rejects edits and deletes from a stale record snapshot', () => {
    seed(); const original = getProfiles()[0];
    updateProfile(profile.id, { name: 'Newer' }, original);
    expect(() => updateProfile(profile.id, { name: 'Stale' }, original)).toThrow(/changed|conflict/i);
    expect(() => deleteProfile(profile.id, original)).toThrow(/changed|conflict/i);
    expect(getProfiles()[0].name).toBe('Newer');
  });
  it('keeps stale dialog input and newer record intact on conflict', async () => {
    seed(); await mount(); await click('Manage profiles'); await click('Edit', 'title');
    await fill('#av-tools-wb-3', 'My draft');
    updateProfile(profile.id, { name: 'Newer' }, profile);
    await click('Update');
    expect(container.textContent).toMatch(/changed|conflict/i);
    expect(container.querySelector<HTMLInputElement>('#av-tools-wb-3')?.value).toBe('My draft');
    expect(getProfiles()[0].name).toBe('Newer');
  });
  it.each(['[{"id":"damaged"', '{}', '[null]', JSON.stringify([profile, profile])])('protects corrupt storage %s', raw => {
    localStorage.setItem('avweather-profiles', raw);
    expect(() => createProfile({ name: 'New', aircraftType: 'C172S', fuelGallons: 40, stationWeights: [0, 0, 0, 0] })).toThrow();
    expect(importProfiles(JSON.stringify([profile])).success).toBe(false);
    expect(localStorage.getItem('avweather-profiles')).toBe(raw);
  });
  it('does not replace an existing custom aircraft merely because its name matches', () => {
    saveCustomAircraft(aircraft);
    expect(() => saveCustomAircraft({ ...aircraft, emptyWeight: 1800 })).toThrow(/already exists/i);
  });
  it('does not silently truncate an import or overwrite profiles at the storage limit', () => {
    const records = Array.from({ length: 20 }, (_, index) => ({ ...profile, id: `id-${index}` }));
    const raw = JSON.stringify(records); localStorage.setItem('avweather-profiles', raw);
    expect(() => createProfile({ name: 'Extra', aircraftType: 'C172S', fuelGallons: 0, stationWeights: [0, 0, 0, 0] })).toThrow(/Maximum 20/);
    expect(importProfiles(JSON.stringify([profile]))).toMatchObject({ success: false, imported: 0 });
    expect(localStorage.getItem('avweather-profiles')).toBe(raw);
  });
  it('keeps the tool and save draft available when writes fail', async () => {
    seed(); const raw = localStorage.getItem('avweather-profiles');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await mount(); expect(container.textContent).toContain('Loading inputs');
    await click('Save profile'); await fill('#av-tools-wb-3', 'Unsaved'); await click('Save');
    expect(container.textContent).toMatch(/not saved|unable to save/i);
    expect(container.querySelector<HTMLInputElement>('#av-tools-wb-3')?.value).toBe('Unsaved');
    expect(localStorage.getItem('avweather-profiles')).toBe(raw);
  });
});

describe('W&B loading validation', () => {
  it.each([-1, 54])('rejects saved fuel outside bounds without changing the record: %s', async fuelGallons => {
    seed({ ...profile, fuelGallons }); await mount(); await select('#av-tools-profile', profile.id);
    expect(container.textContent).toMatch(/Fuel (must|exceeds)/);
    expect(container.textContent).not.toContain('Within selected weight/CG limits only');
    expect(getProfiles()[0].fuelGallons).toBe(fuelGallons);
  });
  it('normalizes without mutating the snapshot and rejects extrapolation', () => {
    const before = JSON.stringify(aircraft.envelope.points);
    expect(envelopeLimits(aircraft.envelope.points, 2000)).toEqual({ cgMin: 42, cgMax: 47 });
    expect(normalizeEnvelope(aircraft.envelope.points).points.map(point => point.weight)).toEqual([1500, 2000, 2550]);
    expect(JSON.stringify(aircraft.envelope.points)).toBe(before);
    expect(envelopeLimits(aircraft.envelope.points, 1400)).toBeNull();
    expect(envelopeLimits(aircraft.envelope.points, 2600)).toBeNull();
  });
  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid loading numbers %s', value => {
    expect(validateLoading(aircraft, value, [0]).length).toBeGreaterThan(0);
    expect(validateLoading(aircraft, 0, [value]).length).toBeGreaterThan(0);
  });
  it('rejects malformed aircraft limits and totals overflow while allowing signed datum arms', () => {
    expect(validateAircraft({ ...aircraft, emptyArm: -5, fuelArm: -10 })).toEqual([]);
    for (const key of ['emptyWeight', 'maxGross', 'fuelWeight', 'fuelCapacity'] as const) expect(validateAircraft({ ...aircraft, [key]: -1 }).length).toBeGreaterThan(0);
    expect(validateAircraft({ ...aircraft, stations: [{ name: 'Zero max', arm: 40, maxWeight: 0 }] })).toEqual([]);
    expect(validateLoading({ ...aircraft, stations: [{ name: 'Zero max', arm: 40, maxWeight: 0 }] }, 0, [1])).toContain('Zero max: 1 lbs exceeds maximum 0 lbs.');
    expect(validateLoading({ ...aircraft, fuelWeight: Number.MAX_VALUE }, 50, [0])).toContain('Loading totals must be finite; check the entered values.');
  });
  it('explicitly warns for baggage121/max120 at fuel40/front180 and removes green success', async () => {
    await mount(); await fill('#av-tools-payload-0', '180'); await fill('#av-tools-payload-2', '121');
    expect(container.textContent).toMatch(/Baggage Area 1.*120/);
    expect(container.textContent).not.toContain('Within selected weight/CG limits only');
  });
  it.each(['-1', ''])('does not silently coerce invalid payload %s to zero', async value => {
    await mount(); await fill('#av-tools-payload-0', value);
    expect(container.textContent).toMatch(/finite|nonnegative|required/i);
    expect(container.textContent).not.toContain('Within selected weight/CG limits only');
  });
  it('uses the appended intermediate envelope point for both calculation and chart', async () => {
    seed({ ...profile, aircraftType: 'custom-N-TEST', customAircraft: aircraft, fuelGallons: 50, stationWeights: [200] });
    await mount(); await select('#av-tools-profile', profile.id);
    expect(container.textContent).toContain('Limits: 42.0 in to 47.0 in');
    expect(container.textContent).toContain('Outside selected weight/CG limits');
    const chart = container.querySelector('svg.av-tools-envelope-chart')!;
    expect(chart.textContent).toContain('2550');
    expect(chart.querySelector('circle')?.getAttribute('fill')).toBe('#ef4444');
  });
  it('rejects duplicate envelope weights without replacing stored data', async () => {
    await mount(); await click('Add custom aircraft', 'aria-label'); await fill('#av-tools-wb-5', 'Duplicate');
    await fill('[aria-label="Envelope point 2 weight (lbs)"]', '1500'); await click('Save Aircraft');
    expect(container.textContent).toMatch(/unique|duplicate/i);
    expect(localStorage.getItem('avweather-custom-aircraft')).toBeNull();
  });
});
