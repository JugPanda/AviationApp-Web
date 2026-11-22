import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Timer from '@/components/tools/Timer';

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(StrictMode, null, createElement(Timer))));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find(button => button.textContent === label);
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}
const display = () => container.querySelector('p.font-mono')?.textContent;
const advance = async (ms: number) => act(async () => vi.advanceTimersByTime(ms));

describe('stopwatch elapsed-time lifecycle', () => {
  it('retains elapsed time through pauses/resumes without counting paused time', async () => {
    await click('Start');
    await advance(1230);
    expect(display()).toBe('00:01.23');
    expect(vi.getTimerCount()).toBe(1);
    await click('Stop');
    expect(vi.getTimerCount()).toBe(0);
    await advance(5000);
    expect(display()).toBe('00:01.23');
    await click('Start');
    await advance(770);
    expect(display()).toBe('00:02.00');
    await click('Lap');
    expect(container.textContent).toContain('Lap 1');
    await click('Stop');
    await advance(2000);
    await click('Start');
    await advance(1000);
    expect(display()).toBe('00:03.00');
  });

  it('resets while running and restarts at zero with no retained interval or laps', async () => {
    await click('Start');
    await advance(500);
    await click('Lap');
    await click('Reset');
    expect(display()).toBe('00:00.00');
    expect(container.textContent).not.toContain('Lap 1');
    expect(vi.getTimerCount()).toBe(0);
    await advance(5000);
    await click('Start');
    await advance(100);
    expect(display()).toBe('00:00.10');
  });

  it('does not restart its interval on each tick or on mode switches, and cleans up on unmount', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    await click('Start');
    for (let i = 0; i < 5; i++) await advance(100);
    expect(interval).toHaveBeenCalledTimes(1);
    await click('Hobbs');
    await advance(500);
    await click('Stopwatch');
    expect(display()).toBe('00:01.00');
    expect(interval).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    interval.mockRestore();
  });
});
