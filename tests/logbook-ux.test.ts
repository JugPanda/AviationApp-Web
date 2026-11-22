import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import LogbookPage from '@/app/logbook/page';

// Component fixture only: no Next server or shared .next output is touched.
vi.mock('@/components/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  useBrowserReady: () => true,
}));
const key = 'avweather-logbook';
const fixture = {
  id: 'existing-flight', date: '2026-11-21', aircraft: 'N123QA', aircraftType: 'C172',
  from: 'KLOU', to: 'KLEX', route: 'KFFT', totalTime: 1.5, pic: 1.5, sic: 0,
  dual: 0, solo: 0, crossCountry: 1.5, dayTime: 1, nightTime: 0.5,
  actualInstrument: 0.2, simulatedInstrument: 0, dayLandings: 3, nightLandings: 1,
  approaches: 2, approachTypes: 'ILS', holds: 1, remarks: 'Preserved flight note',
  createdAt: 100, updatedAt: 200,
};
let root: Root;
let container: HTMLDivElement;
function button(name: string) {
  const element = [...container.querySelectorAll('button')].find(el => el.textContent === name);
  if (!element) throw new Error(`Missing button ${name}`);
  return element;
}
async function click(name: string) { await act(async () => button(name).click()); }
async function mount() { await act(async () => root.render(React.createElement(LogbookPage))); }
async function field(name: string, value: string) {
  const input = container.querySelector(`#av-logbook-${name}`) as HTMLInputElement | HTMLTextAreaElement;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit() {
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function importJSON(value: string) {
  const file = new File([value], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(value) });
  const input = container.querySelector('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
function saved() { return JSON.parse(localStorage.getItem(key) || '[]'); }

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('logbook local workflow component fixture', () => {
  it('does not write defaults on mount and retains all saved fields on edit', async () => {
    localStorage.setItem(key, JSON.stringify([fixture]));
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    expect(writes).not.toHaveBeenCalled();
    expect(container.textContent).toContain(fixture.remarks);
    await click('Edit flight');
    await field('remarks', 'Updated note');
    await submit();
    expect(saved()).toEqual([{ ...fixture, remarks: 'Updated note', updatedAt: expect.any(Number) }]);
    expect(container.querySelector('[role=status]')?.textContent).toBe('Flight updated in this browser.');
  });

  it('creates an entry using explicit visible labels and unchanged schema', async () => {
    await mount();
    await click('+ Add Flight');
    for (const [name, value] of Object.entries({ date: '2026-11-21', aircraft: 'N123QA', aircraftType: 'C172', from: 'KLOU', to: 'KLEX', totalTime: '1.5', pic: '1.5', remarks: 'Created in fixture' })) await field(name, value);
    for (const input of container.querySelectorAll('form input, form textarea')) {
      expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toBeTruthy();
    }
    await submit();
    const [entry] = saved();
    expect(Object.keys(entry).sort()).toEqual(Object.keys(fixture).sort());
    expect(entry).toMatchObject({ totalTime: 1.5, pic: 1.5, remarks: 'Created in fixture', dayLandings: 0 });
    expect(container.querySelector('[role=status]')?.textContent).toBe('Flight saved in this browser.');
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(container.textContent).toContain('Created in fixture');
    expect(saved()).toEqual([entry]);
  });

  it('keeps canceled edits out of storage and supports declining discard', async () => {
    localStorage.setItem(key, JSON.stringify([fixture]));
    await mount();
    await click('Edit flight');
    await field('remarks', 'Unsaved note');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click('Cancel');
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.textContent).toContain('Still editing');
    expect(saved()).toEqual([fixture]);
    await click('Cancel');
    expect(container.querySelector('form')).toBeNull();
    expect(saved()).toEqual([fixture]);
    expect(container.textContent).toContain('Entry canceled. No changes were saved.');
  });

  it('does not lose the draft or claim success on storage failure', async () => {
    localStorage.setItem(key, JSON.stringify([fixture]));
    await mount();
    await click('Edit flight');
    await field('remarks', 'Keep this draft');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await submit();
    expect(saved()).toEqual([fixture]);
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Could not save');
    expect((container.querySelector('#av-logbook-remarks') as HTMLTextAreaElement).value).toBe('Keep this draft');
    write.mockRestore();
    await submit();
    expect(saved()[0].remarks).toBe('Keep this draft');
  });

  it('keeps raw malformed data intact and blocks destructive writes', async () => {
    const raw = '{cannot parse this';
    localStorage.setItem(key, raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('It has not been changed.');
    expect(button('+ Add Flight').disabled).toBe(true);
    expect(button('Import JSON').disabled).toBe(true);
    expect(button('Download stored data').disabled).toBe(false);
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('handles unavailable storage without presenting an empty usable logbook', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    await mount();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Browser storage could not be read.');
    expect(button('+ Add Flight').disabled).toBe(true);
    expect(button('Download stored data').disabled).toBe(true);
    expect(container.textContent).not.toContain('No flights logged yet');
  });

  it('imports complete original JSON records, skips existing IDs and rejects malformed files atomically', async () => {
    localStorage.setItem(key, JSON.stringify([fixture]));
    await mount();
    const extra = { ...fixture, id: 'another-flight', remarks: 'Import fixture' };
    await importJSON(JSON.stringify([fixture, extra]));
    expect(saved()).toEqual([fixture, extra]);
    expect(container.querySelector('[role=status]')?.textContent).toContain('Imported 1 new flight; 1 existing ID skipped.');
    await importJSON(JSON.stringify([{ ...fixture, remarks: 'Cannot overwrite' }]));
    expect(saved()).toEqual([fixture, extra]);
    for (const raw of ['not-json', '{}', '[{"id":"incomplete"}]', JSON.stringify([extra, extra])]) {
      await importJSON(raw);
      expect(container.querySelector('[role=alert]')?.textContent).toContain('No records were changed.');
      expect(saved()).toEqual([fixture, extra]);
    }
  });

  it('confirms deletion and keeps the entry if storage fails', async () => {
    localStorage.setItem(key, JSON.stringify([fixture]));
    await mount();
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click('Delete');
    expect(saved()).toEqual([fixture]);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    await click('Delete');
    expect(saved()).toEqual([fixture]);
    expect(container.querySelector('article')).not.toBeNull();
    write.mockRestore();
    await click('Delete');
    expect(saved()).toEqual([]);
    expect(container.textContent).toContain('Flight deleted from this browser.');
  });

  it('protects changes made by another tab', async () => {
    localStorage.setItem(key, JSON.stringify([fixture]));
    await mount();
    await click('Edit flight');
    await field('remarks', 'Stale edit');
    const remote = { ...fixture, remarks: 'Another tab wrote this' };
    localStorage.setItem(key, JSON.stringify([remote]));
    await submit();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Nothing was overwritten');
    expect(saved()).toEqual([remote]);
  });

  it('retains logged totals and incomplete count indicators without legal clearance', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
    localStorage.setItem(key, JSON.stringify([{ ...fixture, approaches: 6 }]));
    await mount();
    await click('Totals');
    const total = [...container.querySelectorAll('dt')].find(el => el.textContent === 'Total time');
    expect(total?.nextElementSibling?.textContent).toBe('1.5 hours');
    await click('Recency');
    expect(container.textContent).toContain('Incomplete checks, not clearance to fly');
    expect(container.textContent).toContain('They do not establish legal currency or fitness to fly.');
    expect([...container.querySelectorAll('.av-logbook-count')].map(el => el.textContent)).toEqual(['Count met', 'Partial count', 'Count met']);
  });
});
