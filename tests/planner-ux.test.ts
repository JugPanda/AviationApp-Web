import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from '@/app/plan/page';

vi.mock('@/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => children }));

// Isolated jsdom data only. Dialog shims exercise render/state, not native
// focus containment; real keyboard and responsive checks live in the spec.
let container: HTMLDivElement;
let root: Root;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(PlanPage)));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  localStorage.clear();
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fill(label: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, label).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function click(name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(element => (element.getAttribute('aria-label') || element.textContent)?.trim() === name);
  expect(button, name).toBeDefined();
  await act(async () => button!.click());
}
function value(selector: string, label: string) {
  const row = Array.from(container.querySelectorAll(`${selector} dl > div`)).find(element => element.querySelector('dt')?.textContent?.includes(label));
  return row?.querySelector('dd')?.textContent;
}

async function enterLeg() {
  await fill('Leg 1: Distance in nautical miles', '50');
  await fill('Leg 1: True course in degrees', '90');
  await fill('Leg 1: Wind direction in degrees', '90');
  await fill('Leg 1: Wind speed in knots', '20');
}

describe('planner component regression with isolated browser data', () => {
  it('renders clear empty states and assumptions without anonymous result placeholders', () => {
    expect(container.querySelectorAll('.av-plan-section-heading')).toHaveLength(4);
    expect(container.textContent).toContain('Starting values are placeholders, not aircraft-specific data.');
    expect(container.textContent).toContain('does not generate or validate a geographical route');
    expect(container.textContent).toContain('Your totals will appear here');
    expect(container.querySelector('.av-plan-leg')?.textContent).not.toContain('--');
    expect(container.querySelectorAll('.av-plan-leg-results')).toHaveLength(0);
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Preview printable navigation log"]')?.disabled).toBe(true);
  });

  it('recomputes the existing headwind and fuel formulas as a leg is edited', async () => {
    await enterLeg();
    expect(value('.av-plan-leg-results', 'True heading')).toBe('90°');
    expect(value('.av-plan-leg-results', 'Groundspeed')).toBe('100 kt');
    expect(value('.av-plan-leg-results', 'Leg time')).toBe('0:30');
    expect(value('.av-plan-leg-results', 'Leg fuel')).toBe('5 gal');
    expect(value('.av-plan-review', 'Fuel required')).toBe('12.5 gal');
    expect(value('.av-plan-review', 'Fuel after trip & reserve')).toBe('+27.5 gal');
    await fill('Leg 1: Distance in nautical miles', '100');
    expect(value('.av-plan-leg-results', 'Leg time')).toBe('1:00');
    expect(value('.av-plan-review', 'Fuel required')).toBe('17.5 gal');
    await fill('Fuel Onboard (gal)', '12');
    expect(value('.av-plan-review', 'FUEL SHORTAGE')).toBe('-5.5 gal');
    await click('+ Add waypoint');
    expect(container.textContent).toContain('1 of 2 legs included');
    expect(container.textContent).toContain('excluded from these totals');
    await click('Remove leg 2');
    expect(container.textContent).toContain('1 of 1 leg included');
  });

  it('saves the existing schema and restores a named plan into a fresh editor', async () => {
    await fill('Departure', 'KLOU');
    await fill('Destination', 'KLEX');
    await enterLeg();
    await click('Save plan');
    await fill('Plan name', 'Isolated browser data — unit regression');
    await click('Save');
    const saved = JSON.parse(localStorage.getItem('avweather-flightplans') || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ departure: 'KLOU', destination: 'KLEX', aircraftTas: 120, fuelBurnRate: 10, fuelOnboard: 40, reserveMinutes: 45 });
    expect(Object.keys(saved[0]).sort()).toEqual(['id', 'name', 'departure', 'destination', 'waypoints', 'aircraftTas', 'fuelBurnRate', 'fuelOnboard', 'reserveMinutes', 'createdAt'].sort());
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(createElement(PlanPage)));
    await click('Load plan');
    await click('Load Isolated browser data — unit regression');
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Departure"]')?.value).toBe('KLOU');
    expect(value('.av-plan-review', 'Fuel required')).toBe('12.5 gal');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('not stored with plans');
    await click('Preview printable navigation log');
    expect(container.querySelector('h1')?.textContent).toBe('Navigation Log');
    expect(container.querySelector('table')?.textContent).toContain('0:30');
    await click('← Back to Editor');
    expect(value('.av-plan-review', 'Fuel required')).toBe('12.5 gal');
  });
});
