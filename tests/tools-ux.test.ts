import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ToolsPage from '@/app/tools/page';

vi.mock('@/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => children }));

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(ToolsPage)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function assertNamedControls() {
  for (const control of container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('.av-tools-calculator input, .av-tools-calculator select, .av-tools-calculator textarea')) {
    const name = control.getAttribute('aria-label') || Array.from(control.labels || []).map(label => label.textContent).join(' ');
    expect(name?.trim(), `Unnamed ${control.outerHTML}`).toBeTruthy();
  }
}

async function clickButton(text: string, selector = '.av-tools-calculator button') {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>(selector)).find(item => (selector.includes('sidebar') ? item.querySelector('span')?.textContent : item.textContent)?.trim() === text);
  expect(button, `Missing button ${text}`).toBeDefined();
  await act(async () => button!.click());
}

describe('pilot tools navigation and presentation', () => {
  it('defaults to weight and balance with all warnings visible and ten grouped tools', () => {
    expect(container.querySelector('#selected-tool-title')?.textContent).toBe('Weight & Balance');
    expect(container.querySelectorAll('.av-tools-sidebar button')).toHaveLength(10);
    expect(container.querySelectorAll('#pilot-tool option')).toHaveLength(10);
    expect(container.querySelectorAll('#pilot-tool optgroup')).toHaveLength(3);
    expect(container.querySelector('.av-tools-quickbar')).toBeNull();
    const warning = container.querySelector('aside[aria-label="Weight and balance data limitations"]');
    expect(warning?.textContent).toContain('Illustrative templates — unverified');
    expect(warning?.textContent).toContain('C182T is not T182T; C172S is not 172N');
    expect(warning?.textContent).toContain('not a determination that an aircraft is safe to fly');
    assertNamedControls();
  });

  it('switches all ten tools with desktop buttons, preserving labels and content wrapper', async () => {
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.av-tools-sidebar button'));
    for (const button of buttons) {
      await act(async () => button.click());
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(container.querySelector('#selected-tool-title')?.textContent).toBe(button.querySelector('span')?.textContent);
      expect(container.querySelector('.av-tools-calculator.max-w-4xl')?.childElementCount).toBeGreaterThan(0);
      assertNamedControls();
    }
  });

  it('switches all ten tools with the native mobile selector', async () => {
    const select = container.querySelector<HTMLSelectElement>('#pilot-tool')!;
    for (const option of select.options) {
      await act(async () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(container.querySelector('#selected-tool-title')?.textContent).toBe(option.textContent);
      expect(container.querySelector('.av-tools-calculator')?.getAttribute('data-tool')).toBe(option.value);
      assertNamedControls();
    }
  });

  it('keeps conditional mode inputs named and mode selections exposed', async () => {
    const modes: [string, string[]][] = [
      ['Time / Speed / Distance', ['Time', 'Speed', 'Distance']],
      ['Fuel Calculator', ['Endurance', 'Fuel required', 'For Distance']],
      ['Altitude & Airspeed', ['Pressure altitude', 'Density altitude', 'True altitude', 'True airspeed']],
      ['Timer & Hobbs', ['Stopwatch', 'Countdown', 'Hobbs']],
    ];
    for (const [tool, options] of modes) {
      await clickButton(tool, '.av-tools-sidebar button');
      for (const option of options) {
        await clickButton(option);
        assertNamedControls();
        const selected = Array.from(container.querySelectorAll('.av-tools-calculator button[aria-pressed="true"]'));
        expect(selected.some(button => button.textContent?.trim() === option)).toBe(true);
      }
    }
  });
});
