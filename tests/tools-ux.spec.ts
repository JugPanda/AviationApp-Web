import { expect, test, type Page } from '@playwright/test';

// The parent runner must include tools-ux.spec.ts in testMatch. No server is started here.
const tools = [
  ['weight-balance', 'Weight & Balance'],
  ['density-altitude', 'Density Altitude'],
  ['altitude', 'Altitude & Airspeed'],
  ['crosswind', 'Crosswind'],
  ['time-speed-distance', 'Time / Speed / Distance'],
  ['fuel', 'Fuel Calculator'],
  ['wind', 'Wind Correction'],
  ['sun', 'Sunrise / Sunset'],
  ['holding', 'Holding Pattern'],
  ['timer', 'Timer & Hobbs'],
] as const;

async function chooseTool(page: Page, width: number, id: string) {
  const tool = tools.find(item => item[0] === id)!;
  if (width <= 800) await page.getByLabel('Choose a tool').selectOption(id);
  else await page.getByRole('navigation', { name: 'Pilot tools', exact: true }).getByRole('button', { name: tool[1], exact: true }).click();
  await expect(page.locator('#selected-tool-title')).toHaveText(tool[1]);
  await expect(page.locator('.av-tools-calculator')).toHaveAttribute('data-tool', id);
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  // Deliberately scrollable W&B table is contained; form controls must not clip.
  const clippedControls = await page.locator('.av-tools-page input:visible, .av-tools-page select:visible, .av-tools-page button:visible').evaluateAll(elements => elements.filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.left < -1 || rect.right > innerWidth + 1;
  }).map(element => element.outerHTML));
  expect(clippedControls).toEqual([]);
}

async function assertNamedControls(page: Page) {
  for (const control of await page.locator('.av-tools-calculator input:visible, .av-tools-calculator select:visible, .av-tools-calculator textarea:visible').all()) {
    await expect(control).toHaveAccessibleName(/\S/);
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
}

for (const width of [1440, 390, 360]) {
  test.describe(`pilot tools at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/tools');
      await expect(page.locator('#selected-tool-title')).toHaveText('Weight & Balance');
    });

    test('all ten tools are discoverable, labeled, and contained', async ({ page }) => {
      if (width <= 800) {
        await expect(page.getByLabel('Choose a tool').locator('option')).toHaveCount(10);
        await expect(page.locator('.av-tools-sidebar')).toBeHidden();
      } else {
        await expect(page.getByRole('navigation', { name: 'Pilot tools', exact: true }).getByRole('button')).toHaveCount(10);
      }
      for (const [id] of tools) {
        await chooseTool(page, width, id);
        await assertNamedControls(page);
        await assertNoOverflow(page);
      }
      await expect(page.locator('.av-tools-quickbar')).toHaveCount(0);
    });

    test('crosswind left, right, calm, and gust behavior is unchanged', async ({ page }) => {
      await chooseTool(page, width, 'crosswind');
      const calculator = page.locator('.max-w-4xl');
      await calculator.getByLabel('Runway Heading (°)', { exact: true }).fill('270');
      await calculator.getByLabel('Wind Speed (knots)', { exact: true }).fill('15');
      await calculator.getByLabel('Wind Direction (°)', { exact: true }).fill('240');
      await expect(calculator.getByText('knots from left', { exact: true })).toBeVisible();
      await calculator.getByLabel('Wind Direction (°)', { exact: true }).fill('300');
      await expect(calculator.getByText('knots from right', { exact: true })).toBeVisible();
      await calculator.getByLabel('Wind Speed (knots)', { exact: true }).fill('0');
      await expect(calculator.getByText(/knots from (left|right)/)).toHaveCount(0);
      await calculator.getByLabel('Gust Speed (knots, optional)', { exact: true }).fill('20');
      await expect(calculator.getByText('G10kt', { exact: true })).toBeVisible();
      await assertNoOverflow(page);
    });

    test('W&B warnings remain visible and saved profiles survive reload', async ({ page }) => {
      const warning = page.getByRole('complementary', { name: 'Weight and balance data limitations' });
      await expect(warning).toContainText('Illustrative templates — unverified');
      await expect(warning).toContainText('C182T is not T182T; C172S is not 172N');
      await expect(warning).toContainText('not a determination that an aircraft is safe to fly');
      await page.getByLabel('Pilot & Front Pax (lbs)', { exact: true }).fill('175');
      const save = page.getByRole('button', { name: 'Save profile', exact: true });
      await save.click();
      const dialog = page.getByRole('dialog', { name: 'Save Profile', exact: true });
      await expect(dialog).toBeVisible();
      await page.getByLabel('Profile Name', { exact: true }).fill(`UX profile ${width}`);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-profiles') || '[]'));
      expect(stored).toHaveLength(1);
      expect(stored[0].stationWeights[0]).toBe(175);
      await page.reload();
      await page.getByLabel('Saved aircraft profiles').selectOption({ label: `UX profile ${width}` });
      await expect(page.getByLabel('Pilot & Front Pax (lbs)', { exact: true })).toHaveValue('175');
      await expect(warning).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-profiles') || '[]'))).toEqual(stored);
      await assertNoOverflow(page);
    });

    test('native profile dialogs support Escape, focus containment, and custom inputs', async ({ page }) => {
      const save = page.getByRole('button', { name: 'Save profile', exact: true });
      await save.click();
      const dialog = page.getByRole('dialog', { name: 'Save Profile', exact: true });
      await page.getByLabel('Profile Name', { exact: true }).focus();
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(save).toBeFocused();
      await page.getByRole('button', { name: 'Add custom aircraft', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Add Custom Aircraft', exact: true })).toBeVisible();
      await assertNamedControls(page);
      await assertNoOverflow(page);
      await page.keyboard.press('Escape');
    });

    test('secondary calculator modes remain labeled and fit the viewport', async ({ page }) => {
      const modes: [string, string[]][] = [
        ['time-speed-distance', ['Time', 'Speed', 'Distance']],
        ['fuel', ['Endurance', 'Fuel required', 'For Distance']],
        ['altitude', ['Pressure altitude', 'Density altitude', 'True altitude', 'True airspeed']],
        ['timer', ['Stopwatch', 'Countdown', 'Hobbs']],
      ];
      for (const [tool, options] of modes) {
        await chooseTool(page, width, tool);
        for (const option of options) {
          const button = page.locator('.av-tools-calculator').getByRole('button', { name: option, exact: true });
          await button.click();
          await expect(button).toHaveAttribute('aria-pressed', 'true');
          await assertNamedControls(page);
          await assertNoOverflow(page);
        }
      }
    });
  });
}
