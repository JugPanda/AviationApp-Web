import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from '@/app/plan/page';
import WindCalculator from '@/components/tools/WindCalculator';
import { normalizeHeading, solveWindTriangle } from '@/lib/wind-triangle';

vi.mock('@/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => children }));
const key = 'avweather-flightplans';
const legacy = { id: 'legacy', name: 'Legacy fixture', departure: 'KLOU', destination: 'KLEX', waypoints: [{ id: 'wp', name: 'TEST', distance: 50, trueCourse: 90, altitude: 3000, windDirection: 90, windSpeed: 20 }], aircraftTas: 120, fuelBurnRate: 10, fuelOnboard: 40, reserveMinutes: 45, createdAt: 1 };
let root: Root;
let container: HTMLDivElement;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  // jsdom lacks native dialog methods; browser specs exercise the real APIs.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
async function mount(component = PlanPage) { await act(async () => root.render(createElement(component))); }
async function fill(label: string, value: string) {
  const input = Array.from(container.querySelectorAll('input')).find(i => i.getAttribute('aria-label') === label || (i.id && container.querySelector(`label[for="${i.id}"]`)?.textContent === label));
  expect(input, label).toBeDefined();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true })); input!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function click(name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || b.textContent)?.trim() === name);
  expect(button, name).toBeDefined(); await act(async () => button!.click());
}
async function save(name = 'Draft fixture') { await click('Save plan'); await fill('Plan name', name); await click('Save'); }
async function distance() { await fill('Leg 1: Distance in nautical miles', '10'); }

describe('planner reliability — isolated synthetic component fixtures', () => {
  it.each([['-10', '90', '100°'], ['10', '90', '80°'], ['0', '90', '90°'], ['10', '5', '355°'], ['-10', '355', '5°']])('prints MH = TH - variation (%s, %s)', async (variation, course, expected) => {
    await mount(); await distance(); await fill('Leg 1: True course in degrees', course); await fill('Mag Variation', variation);
    await click('Preview printable navigation log');
    expect(container.querySelector('tbody tr td:nth-child(6)')?.textContent).toBe(expected);
  });
  it.each([['120', '150', 'crosswind'], ['0', '120', 'groundspeed'], ['0', '150', 'groundspeed']])('rejects impossible wind %s/%s and withholds plan totals', async (direction, speed, reason) => {
    await mount(); await distance(); await fill('Leg 1: Wind direction in degrees', direction); await fill('Leg 1: Wind speed in knots', speed);
    expect(container.textContent?.toLowerCase()).toContain(reason);
    expect(container.textContent).toContain('Plan totals withheld');
    expect(container.querySelectorAll('.av-plan-review-metrics, .av-plan-leg-results')).toHaveLength(0);
    await click('Preview printable navigation log');
    expect(container.textContent).toContain('Plan totals withheld'); expect(container.textContent).not.toContain('TOTALS');
  });
  it('wind tool rejects the same impossible triangle and recovers after correction', async () => {
    await mount(WindCalculator); await fill('True Course (°)', '0'); await fill('Wind From (°)', '120'); await fill('Wind Speed (kts)', '150');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('crosswind');
    expect(container.textContent).not.toContain('Ground Speed');
    await fill('Wind Speed (kts)', '0'); expect(container.textContent).toContain('120 kts');
  });
  it('saves and restores selected date and variation, and prints the selected date', async () => {
    await mount(); await distance(); await fill('Date', '2030-05-07'); await fill('Mag Variation', '-10'); await save();
    expect(JSON.parse(localStorage.getItem(key)!)[0]).toMatchObject({ schemaVersion: 2, date: '2030-05-07', magneticVariation: -10 });
    await fill('Date', '2031-01-02'); await fill('Mag Variation', '5'); await click('Load plan'); await click('Load Draft fixture');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Date"]')?.value).toBe('2030-05-07');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Mag Variation"]')?.value).toBe('-10');
    await click('Preview printable navigation log'); expect(container.textContent).toContain('2030-05-07');
  });
  it('loads old records with date and variation explicitly unset, without mutating them', async () => {
    const raw = JSON.stringify([legacy]); localStorage.setItem(key, raw); await mount();
    await fill('Mag Variation', '12'); await fill('Date', '2030-01-02'); await click('Load plan'); await click('Load Legacy fixture');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Date"]')?.value).toBe('');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Mag Variation"]')?.value).toBe('');
    expect(container.textContent).toContain('not stored'); expect(localStorage.getItem(key)).toBe(raw);
    await click('Preview printable navigation log'); expect(container.textContent).toContain('Date not set');
    expect(container.querySelector('tbody tr td:nth-child(6)')?.textContent).toBe('Not set');
  });
  it('blocks a stale save, preserves the draft, then refreshes the list without replacing the editor', async () => {
    await mount(); await fill('Departure', 'DRAFT'); const raw = JSON.stringify([legacy]); localStorage.setItem(key, raw);
    await save(); expect(localStorage.getItem(key)).toBe(raw); expect(container.textContent).toContain('changed in another tab');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Plan name"]')?.value).toBe('Draft fixture');
    await click('Refresh saved plans'); await click('Save');
    expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(2);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Departure"]')?.value).toBe('DRAFT');
  });
  it('blocks stale deletion without deleting a newer record', async () => {
    localStorage.setItem(key, JSON.stringify([legacy])); await mount(); await click('Load plan');
    const raw = JSON.stringify([legacy, { ...legacy, id: 'newer', name: 'Newer' }]); localStorage.setItem(key, raw); vi.spyOn(window, 'confirm').mockReturnValue(true);
    await click('Delete Legacy fixture'); expect(localStorage.getItem(key)).toBe(raw); expect(container.textContent).toContain('changed in another tab');
  });
  it.each(['{broken', '{}', '[{"id":"broken"}]', JSON.stringify([{ ...legacy, date: '2030-02-30' }]), JSON.stringify([legacy, legacy])])('protects corrupt or unsupported records (%s)', async raw => {
    localStorage.setItem(key, raw); await mount(); await save();
    expect(localStorage.getItem(key)).toBe(raw); expect(container.textContent).toContain('cannot be read safely');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Plan name"]')?.value).toBe('Draft fixture');
  });
  it('denied writes retain saved bytes and the open draft', async () => {
    const raw = JSON.stringify([legacy]); localStorage.setItem(key, raw); await mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied', 'QuotaExceededError'); });
    await save(); expect(localStorage.getItem(key)).toBe(raw); expect(container.textContent).toContain('Could not save');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Plan name"]')?.value).toBe('Draft fixture');
  });
  it('denied reads do not crash or permit writes', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem'); vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    await mount(); await save(); expect(container.textContent).toContain('cannot be read safely'); expect(write).not.toHaveBeenCalled();
  });
});

describe('shared wind triangle mathematical boundaries', () => {
  it.each([[90, 120, 90, 20, 90, 100], [90, 120, 270, 20, 90, 140], [360, 120, 0, 0, 0, 120]])('solves known headwind, tailwind and calm cases (%s, %s, %s, %s)', (course, tas, direction, speed, heading, gs) => {
    const result = solveWindTriangle(course, tas, direction, speed);
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.trueHeading).toBeCloseTo(heading, 10); expect(result.groundSpeed).toBeCloseTo(gs, 10); }
  });
  it.each([90, 270])('corrects INTO crosswind from %s and closes the vector triangle', direction => {
    const result = solveWindTriangle(0, 120, direction, 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.sign(result.windCorrectionAngle)).toBe(direction === 90 ? 1 : -1);
    const heading = result.trueHeading * Math.PI / 180;
    const wind = direction * Math.PI / 180;
    expect(120 * Math.sin(heading) - 30 * Math.sin(wind)).toBeCloseTo(0, 10);
    expect(120 * Math.cos(heading) - 30 * Math.cos(wind)).toBeCloseTo(result.groundSpeed, 10);
  });
  it.each([[0, 120, 90, 120], [0, 120, 120, 150], [0, 120, 0, 120], [0, 120, 0, 150], [0, 0, 0, 0], [0, 120, 0, -1], [NaN, 120, 0, 0], [0, Infinity, 0, 0], [361, 120, 0, 0]])('rejects infeasible or invalid inputs %j', (course, tas, direction, speed) => {
    expect(solveWindTriangle(course, tas, direction, speed).ok).toBe(false);
  });
  it('keeps a near-limit feasible crosswind solution and normalizes headings', () => {
    const result = solveWindTriangle(0, 120, 90, 119.9);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.groundSpeed).toBeGreaterThan(0);
    expect(normalizeHeading(-10)).toBe(350); expect(normalizeHeading(720)).toBe(0);
  });
});
