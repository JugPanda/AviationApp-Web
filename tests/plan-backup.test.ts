import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from '@/app/plan/page';
import {
  BACKUP_LIMITS, createPlanExport, mergePlanCopies, parsePlanBackup, readPlans,
  type FlightPlan,
} from '@/lib/plan-backup';

// Synthetic local fixtures, not operational flight data.
const legacy: FlightPlan = {
  id: 'legacy', name: 'Legacy fixture', departure: 'KLOU', destination: 'KLEX',
  waypoints: [{ id: 'wp', name: 'TEST', distance: 50, trueCourse: 90, altitude: 3000, windDirection: 90, windSpeed: 20 }],
  aircraftTas: 120, fuelBurnRate: 10, fuelOnboard: 40, reserveMinutes: 45, createdAt: 1,
};
const modern: FlightPlan = { ...legacy, id: 'modern', schemaVersion: 2, date: '2030-05-07', magneticVariation: -10 };
const envelope = (plans: unknown) => JSON.stringify({ format: 'avweather-plan-backup', version: 1, plans });
vi.mock('@/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => children }));

// jsdom has no IndexedDB. These component tests isolate rendering/storage;
// real transactional coordination, denial, and recovery run in both browsers.
vi.mock('@/lib/plan-write-fence', () => ({
  fencedPlanWrite: async (_key: string, _expected: string | null, _next: string, commit: () => boolean) => commit(),
  getExportState: async (key: string) => ({ raw: localStorage.getItem(key), verified: true, recovery: null }),
  reconcilePlanFence: vi.fn(),
}));

describe('plan backup integrity', () => {
  it.each(['9007199254740993', '-9007199254740993', '9.007199254740993e15'])('rejects unsafe integer tokens without altering raw recovery bytes (%s)', token => {
    const raw = JSON.stringify([{ ...legacy, metadata: 0 }]).replace('"metadata":0', `"metadata":${token}`);
    expect(() => parsePlanBackup(raw)).toThrow(/unsafe number/i);
    expect(createPlanExport(raw)).toMatchObject({ rawRecovery: true, content: raw });
    expect(() => mergePlanCopies(readPlans(raw), [modern], () => 'fresh')).toThrow(/unsafe/i);
  });
  it('exports every record, preserves unknown fields and round-trips modern and legacy records', () => {
    const plans = [{ ...legacy, notes: { text: 'Keep this historical field' } }, modern];
    const raw = JSON.stringify(plans);
    const backup = createPlanExport(raw);
    expect(backup.rawRecovery).toBe(false);
    expect(backup.count).toBe(2);
    expect(backup.filename).toBe('avweather-plans.json');
    expect(parsePlanBackup(backup.content)).toEqual(plans);
    expect(raw).toBe(JSON.stringify(plans));
    expect(parsePlanBackup(raw)).toEqual(plans);
  });

  it('preserves absent versus null optional values without guessing a date or variation', () => {
    const plans = parsePlanBackup(envelope([legacy, { ...modern, date: null, magneticVariation: null }]));
    expect(Object.hasOwn(plans[0], 'schemaVersion')).toBe(false);
    expect(Object.hasOwn(plans[0], 'date')).toBe(false);
    expect(Object.hasOwn(plans[0], 'magneticVariation')).toBe(false);
    expect(plans[1]).toMatchObject({ date: null, magneticVariation: null });
  });

  it('exports an empty store as an explicit empty backup', () => {
    expect(createPlanExport(null)).toMatchObject({ count: 0, rawRecovery: false });
    expect(parsePlanBackup(createPlanExport(null).content)).toEqual([]);
  });

  it('does not normalize original JSON text or turn nonfinite unknown data into null on export', () => {
    const raw = ` [\n${JSON.stringify(legacy)}\n] `;
    expect(createPlanExport(raw).content).toContain(raw);
    const unsafe = JSON.stringify([{ ...legacy, metadata: 0 }]).replace('"metadata":0', '"metadata":1e999');
    expect(createPlanExport(unsafe)).toMatchObject({ rawRecovery: true, content: unsafe });
  });

  it.each(['{broken\n', '', '{}', '[{"id":"partial"}]', JSON.stringify([{ ...modern, schemaVersion: 3 }])])('provides exact raw recovery for damaged or unsupported stored bytes: %s', raw => {
    expect(createPlanExport(raw)).toMatchObject({ content: raw, rawRecovery: true, count: null, filename: 'avweather-plans-recovery.txt' });
  });

  it('merges detached copies with fresh plan and waypoint IDs, preserving originals and metadata', () => {
    const originals = [{ ...legacy, notes: { text: 'Original' } }];
    const imported = parsePlanBackup(envelope([legacy, modern]));
    const before = JSON.stringify({ originals, imported });
    const ids = ['legacy', 'modern', 'wp', 'copy-a', 'wp-a', 'copy-b', 'wp-b'];
    const merged = mergePlanCopies(originals, imported, () => ids.shift()!);
    expect(JSON.stringify({ originals, imported })).toBe(before);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toBe(originals[0]);
    expect(merged[1]).toEqual({ ...legacy, id: 'copy-a', waypoints: [{ ...legacy.waypoints[0], id: 'wp-a' }] });
    expect(merged[2]).toEqual({ ...modern, id: 'copy-b', waypoints: [{ ...modern.waypoints[0], id: 'wp-b' }] });
    expect(merged[1].waypoints[0]).not.toBe(imported[0].waypoints[0]);
    expect(Object.hasOwn(merged[1], 'date')).toBe(false);
    expect(readPlans(JSON.stringify(merged))).toEqual(merged);
  });

  it('refuses to normalize nonfinite or unsafe unknown fields in existing records while merging', () => {
    const existing = [{ ...legacy, notes: Infinity }];
    expect(() => mergePlanCopies(existing, [modern], () => 'fresh')).toThrow(/unsafe/i);
    expect(existing[0].notes).toBe(Infinity);
  });

  it('never reuses a conflicting ID and fails closed if the ID generator cannot provide unique IDs', () => {
    expect(() => mergePlanCopies([legacy], [modern], () => 'legacy')).toThrow(/unique/i);
    expect(() => mergePlanCopies([], [legacy], () => '')).toThrow(/unique/i);
  });

  it.each([
    '', '{broken', '{}', 'null', envelope({}),
    JSON.stringify({ format: 'another-app', version: 1, plans: [legacy] }),
    JSON.stringify({ format: 'avweather-plan-backup', version: 2, plans: [legacy] }),
    envelope([legacy, legacy]), envelope([{ ...legacy, waypoints: [legacy.waypoints[0], legacy.waypoints[0]] }]),
    envelope([{ ...legacy, name: 1 }]), envelope([{ ...legacy, id: '' }]),
    envelope([{ ...legacy, aircraftTas: '120' }]), envelope([{ ...legacy, fuelBurnRate: null }]),
    envelope([{ ...modern, date: '2030-02-30' }]), envelope([{ ...modern, date: '' }]),
    envelope([{ ...modern, magneticVariation: '10' }]), envelope([{ ...modern, schemaVersion: 3 }]),
    envelope([{ ...legacy, waypoints: [{ ...legacy.waypoints[0], distance: null }] }]),
    envelope([legacy]).replace('"aircraftTas":120', '"aircraftTas":1e999'),
  ])('rejects the whole malformed file, never salvaging a partial import (%s)', raw => {
    expect(() => parsePlanBackup(raw)).toThrow();
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects unsafe nested keys (%s) without prototype pollution', key => {
    const raw = envelope([{ ...legacy, metadata: JSON.parse(`{"${key}":{"polluted":true}}`) }]);
    expect(() => parsePlanBackup(raw)).toThrow(/unsafe/i);
    expect(createPlanExport(JSON.stringify(JSON.parse(raw).plans)).rawRecovery).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('renders textual markup as data rather than stripping or evaluating it', () => {
    const plan = { ...legacy, name: '<script>alert(1)</script>' };
    expect(parsePlanBackup(envelope([plan]))[0].name).toBe(plan.name);
  });

  it('rejects excessive size measured in UTF-8 bytes, excessive records, legs, strings and depth', () => {
    expect(() => parsePlanBackup(' '.repeat(BACKUP_LIMITS.maxBytes + 1))).toThrow(/2 MiB/i);
    expect(() => parsePlanBackup('é'.repeat(BACKUP_LIMITS.maxBytes / 2 + 1))).toThrow(/2 MiB/i);
    expect(() => parsePlanBackup(envelope(Array.from({ length: BACKUP_LIMITS.maxPlans + 1 }, (_, i) => ({ ...legacy, id: `p${i}` }))))).toThrow(/plans/i);
    expect(() => parsePlanBackup(envelope([{ ...legacy, waypoints: Array.from({ length: BACKUP_LIMITS.maxWaypointsPerPlan + 1 }, (_, i) => ({ ...legacy.waypoints[0], id: `w${i}` })) }]))).toThrow(/waypoints/i);
    expect(() => parsePlanBackup(envelope([{ ...legacy, name: 'x'.repeat(BACKUP_LIMITS.maxStringLength + 1) }]))).toThrow(/text/i);
    let nested: unknown = 'end';
    for (let i = 0; i < 25; i++) nested = { nested };
    expect(() => parsePlanBackup(envelope([{ ...legacy, nested }]))).toThrow(/nested/i);
  });

  it('preserves existing locally readable out-of-limit data via raw export rather than truncating', () => {
    const raw = JSON.stringify([{ ...legacy, name: 'x'.repeat(BACKUP_LIMITS.maxStringLength + 1) }]);
    expect(readPlans(raw)).toHaveLength(1);
    expect(createPlanExport(raw)).toMatchObject({ content: raw, rawRecovery: true });
  });
});

describe('backup import component integrity — isolated jsdom fixtures', () => {
  const key = 'avweather-flightplans';
  let root: Root;
  let container: HTMLDivElement;
  const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
    // Native focus/keyboard/layout and downloads belong to the browser spec.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root?.unmount()); container?.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear();
    for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });
  async function mount(raw = JSON.stringify([legacy])) {
    localStorage.setItem(key, raw);
    await act(async () => root.render(createElement(PlanPage)));
  }
  function button(name: string) {
    const found = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === name);
    expect(found, name).toBeDefined(); return found!;
  }
  async function click(name: string) { await act(async () => button(name).click()); }
  async function fill(label: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  async function choose(text = envelope([modern]), options: { size?: number; read?: () => Promise<string> } = {}) {
    const file = new File([text], 'fixture.json', { type: 'application/json' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode(await (options.read?.() ?? Promise.resolve(text))).buffer });
    if (options.size !== undefined) Object.defineProperty(file, 'size', { value: options.size });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  }
  async function preview(text = envelope([modern])) { await click('Import plans'); await choose(text); }

  it('does not write on preview/cancel and keeps editor fields; confirmation appends new records through Web Locks', async () => {
    const lock = vi.fn(async (_key: string, callback: () => boolean) => callback());
    vi.stubGlobal('navigator', { locks: { request: lock } });
    await mount(); const raw = localStorage.getItem(key);
    await fill('Departure', 'DRAFT'); await fill('Date', '2032-05-06'); await fill('Mag Variation', '12');
    await preview(); expect(localStorage.getItem(key)).toBe(raw);
    expect(container.textContent).toContain('2030-05-07'); expect(container.textContent).toContain('-10°');
    await click('Cancel'); expect(localStorage.getItem(key)).toBe(raw);
    await preview(); await click('Confirm import as new copies');
    expect(lock).toHaveBeenCalledWith(key, expect.any(Function));
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(saved).toHaveLength(2); expect(saved[0]).toEqual(legacy);
    expect(saved[1]).toMatchObject({ date: modern.date, magneticVariation: modern.magneticVariation });
    expect(saved[1].id).not.toBe(modern.id); expect(saved[1].waypoints[0].id).not.toBe('wp');
    for (const [label, value] of [['Departure', 'DRAFT'], ['Date', '2032-05-06'], ['Mag Variation', '12']]) {
      expect(container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)?.value).toBe(value);
    }
    expect(container.querySelector('dialog')).toBeNull();
  });

  it('keeps missing legacy date/variation absent in saved copies and unsets them when loaded', async () => {
    await mount('[]'); await fill('Date', '2030-01-02'); await fill('Mag Variation', '12');
    await preview(JSON.stringify([legacy])); expect(container.textContent).toContain('Not stored / unset');
    await click('Confirm import as new copies');
    const saved = JSON.parse(localStorage.getItem(key)!);
    expect(Object.hasOwn(saved[0], 'date')).toBe(false); expect(Object.hasOwn(saved[0], 'magneticVariation')).toBe(false);
    await click('Load plan');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Load Legacy fixture"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[aria-label="Date"]')?.value).toBe('');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Mag Variation"]')?.value).toBe('');
  });

  it('rejects a stale import then explicitly refreshes, re-reviews and merges without losing newer records', async () => {
    await mount(); await fill('Departure', 'DRAFT'); await preview();
    const changed = JSON.stringify([legacy, { ...legacy, id: 'other', name: 'Other tab' }]);
    localStorage.setItem(key, changed); await click('Confirm import as new copies');
    expect(localStorage.getItem(key)).toBe(changed); expect(container.textContent).toContain('changed in another tab');
    expect(container.querySelector('.av-plan-import-list')).not.toBeNull();
    await click('Refresh saved plans'); expect(container.textContent).toContain('2 existing saved plans stay unchanged');
    expect(localStorage.getItem(key)).toBe(changed);
    await click('Confirm import as new copies');
    expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(3);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Departure"]')?.value).toBe('DRAFT');
  });

  it.each(['QuotaExceededError', 'SecurityError'])('preserves preview, draft and original storage on %s writes', async errorName => {
    await mount(); await fill('Departure', 'DRAFT'); await preview(); const raw = localStorage.getItem(key);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Fixture denied', errorName); });
    await click('Confirm import as new copies');
    expect(localStorage.getItem(key)).toBe(raw); expect(container.textContent).toContain('Could not save');
    expect(container.querySelector('.av-plan-import-list')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label="Departure"]')?.value).toBe('DRAFT');
  });

  it('will not import over damaged existing storage', async () => {
    await mount('{broken'); await preview();
    expect(button('Confirm import as new copies').disabled).toBe(true);
    expect(container.textContent).toContain('cannot be read safely'); expect(localStorage.getItem(key)).toBe('{broken');
  });

  it('clears a previous valid preview on invalid or oversized files and checks size before reading', async () => {
    await mount(); await preview();
    await choose('{bad'); expect(button('Confirm import as new copies').disabled).toBe(true);
    expect(container.querySelector('.av-plan-import-list')).toBeNull();
    await choose(); const read = vi.fn();
    await choose('', { size: BACKUP_LIMITS.maxBytes + 1, read });
    expect(read).not.toHaveBeenCalled(); expect(container.textContent).toContain('2 MiB');
    expect(button('Confirm import as new copies').disabled).toBe(true);
    expect(localStorage.getItem(key)).toBe(JSON.stringify([legacy]));
  });

  it('ignores stale asynchronous file reads after replacement or cancellation', async () => {
    await mount(); await click('Import plans');
    let resolve!: (text: string) => void;
    await choose('', { read: () => new Promise<string>(r => { resolve = r; }) });
    await choose(envelope([modern]));
    await act(async () => resolve('{broken'));
    expect(container.textContent).not.toContain('not valid JSON'); expect(button('Confirm import as new copies').disabled).toBe(false);
    await choose('', { read: () => new Promise<string>(r => { resolve = r; }) });
    await click('Cancel'); await click('Import plans'); await act(async () => resolve(envelope([legacy])));
    expect(container.querySelector('.av-plan-import-list')).toBeNull();
  });

  it('empty files of records never enable a write', async () => {
    await mount(); await preview('[]'); expect(button('Confirm import as new copies').disabled).toBe(true);
    expect(container.textContent).toContain('This backup is empty'); expect(localStorage.getItem(key)).toBe(JSON.stringify([legacy]));
  });

  it('exports fresh stored data without refreshing the stale write snapshot and recovers damaged raw text', async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:fixture'; }, revokeObjectURL: vi.fn() });
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await mount(); const changed = JSON.stringify([legacy, modern]); localStorage.setItem(key, changed);
    await click('Export all saved plans');
    const text = (blob: Blob) => new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(parsePlanBackup(await text(blobs[0]))).toEqual([legacy, modern]);
    expect(localStorage.getItem(key)).toBe(changed);
    await preview(); await click('Confirm import as new copies'); expect(container.textContent).toContain('changed in another tab');
    await click('Cancel'); localStorage.setItem(key, '{damaged\n'); await click('Export all saved plans');
    expect(await text(blobs[1])).toBe('{damaged\n'); expect(container.textContent).toContain('Raw recovery download requested');
    expect(localStorage.getItem(key)).toBe('{damaged\n'); expect(download).toHaveBeenCalledTimes(2);
  });

  it('reports denied storage reads during export without claiming a successful backup or losing the draft', async () => {
    await mount(); await fill('Departure', 'DRAFT');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Fixture denied', 'SecurityError'); });
    await click('Export all saved plans'); expect(container.textContent).toContain('Backup could not be downloaded');
    await preview(); await click('Confirm import as new copies'); expect(container.textContent).toContain('Could not save');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Departure"]')?.value).toBe('DRAFT');
  });
});
