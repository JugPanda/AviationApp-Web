import { test, expect, type Page } from '@playwright/test';

// Synthetic browser-local fixtures, never operational flight data.
const key = 'avweather-flightplans';
const legacy = { id: 'legacy', name: 'Legacy fixture', departure: 'KLOU', destination: 'KLEX', waypoints: [{ id: 'wp', name: 'TEST', distance: 50, trueCourse: 90, altitude: 3000, windDirection: 90, windSpeed: 20 }], aircraftTas: 120, fuelBurnRate: 10, fuelOnboard: 40, reserveMinutes: 45, createdAt: 1 };
async function save(page: Page, name: string) {
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await page.getByLabel('Plan name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}
async function records(page: Page) { return page.evaluate(key => localStorage.getItem(key), key); }
async function ready(page: Page) {
  await page.goto('/plan');
  await expect(page.getByRole('heading', { name: 'Flight planning', exact: true })).toBeVisible();
  // Wait for interactive hydration, not just server-rendered input presence.
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
}
for (const width of [360, 1440]) {
  test.describe(`${width}px planner reliability`, () => {
    test.use({ viewport: { width, height: 1000 } });
    test('magnetic sign, date, unsolvable crosswind and nonpositive groundspeed', async ({ page }, info) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await ready(page);
      await page.getByLabel('Date', { exact: true }).fill('2030-05-07');
      await page.getByLabel('Leg 1: Distance in nautical miles', { exact: true }).fill('10');
      for (const [course, variation, expected] of [['90', '-10', '100°'], ['90', '10', '80°'], ['90', '0', '90°'], ['5', '10', '355°'], ['355', '-10', '5°']]) {
        await page.getByLabel('Leg 1: True course in degrees', { exact: true }).fill(course);
        await page.getByLabel('Mag Variation', { exact: true }).fill(variation);
        await page.getByRole('button', { name: 'Preview printable navigation log' }).click();
        await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText(expected);
        await expect(page.getByText('2030-05-07', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: /Back to Editor/ }).click();
      }
      await page.getByLabel('Leg 1: True course in degrees', { exact: true }).fill('0');
      // One valid leg must not turn an invalid multi-leg plan into plausible totals.
      await page.getByRole('button', { name: '+ Add waypoint', exact: true }).click();
      await page.getByLabel('Leg 2: Distance in nautical miles', { exact: true }).fill('20');
      for (const [direction, speed, reason] of [['120', '150', 'crosswind'], ['0', '120', 'groundspeed'], ['0', '150', 'groundspeed']]) {
        await page.getByLabel('Leg 1: Wind direction in degrees', { exact: true }).fill(direction);
        await page.getByLabel('Leg 1: Wind speed in knots', { exact: true }).fill(speed);
        await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('Plan totals withheld');
        await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText(reason);
        await expect(page.locator('.av-plan-review-metrics, .av-plan-leg-results')).toHaveCount(0);
        await page.getByRole('button', { name: 'Preview printable navigation log' }).click();
        await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('Plan totals withheld');
        await expect(page.getByRole('table')).not.toContainText('TOTALS');
        await page.getByRole('button', { name: /Back to Editor/ }).click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`planner-invalid-${width}.png`), fullPage: true });
      await page.getByLabel('Leg 1: Wind speed in knots', { exact: true }).fill('0');
      await expect(page.locator('.av-plan-review-metrics')).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('two open tabs reject stale save and deletion, preserve drafts and support explicit refresh', async ({ page, context }) => {
      await ready(page); const other = await context.newPage(); await ready(other);
      await other.getByLabel('Departure', { exact: true }).fill('DRAFT');
      await save(page, 'First tab'); await expect(page.getByRole('status')).toContainText('Saved');
      const first = await records(page);
      await save(other, 'Second tab');
      await expect(other.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('changed in another tab');
      expect(await records(other)).toBe(first);
      await expect(other.getByLabel('Plan name', { exact: true })).toHaveValue('Second tab');
      await other.getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      await other.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(other.getByRole('status')).toContainText('Saved');
      await expect(other.getByLabel('Departure', { exact: true })).toHaveValue('DRAFT');
      expect(JSON.parse((await records(other))!)).toHaveLength(2);
      await page.getByRole('button', { name: 'Load plan', exact: true }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Delete First tab', exact: true }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('changed in another tab');
      expect(JSON.parse((await records(page))!)).toHaveLength(2);
      await page.getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Delete First tab', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Delete First tab', exact: true })).toHaveCount(0);
      expect(JSON.parse((await records(page))!).map((p: { name: string }) => p.name)).toEqual(['Second tab']);
      await other.close();
    });

    test('simultaneous saves serialize, with one explicit conflict and no silent loss', async ({ page, context }) => {
      await ready(page); const other = await context.newPage(); await ready(other);
      for (const [tab, name] of [[page, 'Concurrent A'], [other, 'Concurrent B']] as const) {
        await tab.getByRole('button', { name: 'Save plan', exact: true }).click();
        await tab.getByLabel('Plan name', { exact: true }).fill(name);
      }
      await Promise.all([page.getByRole('button', { name: 'Save', exact: true }).click(), other.getByRole('button', { name: 'Save', exact: true }).click()]);
      await expect.poll(async () => (await page.locator('[role="alert"]:not(#__next-route-announcer__)').count()) + (await other.locator('[role="alert"]:not(#__next-route-announcer__)').count())).toBe(1);
      const loser = await page.locator('[role="alert"]:not(#__next-route-announcer__)').count() ? page : other;
      await expect(loser.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('changed in another tab');
      expect(JSON.parse((await records(page))!)).toHaveLength(1);
      await loser.getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      await loser.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(loser.getByRole('status')).toContainText('Saved');
      expect(JSON.parse((await records(page))!).map((p: { name: string }) => p.name).sort()).toEqual(['Concurrent A', 'Concurrent B']);
      await other.close();
    });

    test('legacy load explicitly unsets missing fields; extended copy round-trips without changing original', async ({ page }) => {
      await page.goto('/plan');
      await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify([legacy])), { key, legacy });
      await ready(page);
      await page.getByLabel('Date', { exact: true }).fill('2031-01-02'); await page.getByLabel('Mag Variation', { exact: true }).fill('12');
      await page.getByRole('button', { name: 'Load plan', exact: true }).click();
      await page.getByRole('button', { name: 'Load Legacy fixture', exact: true }).click();
      await expect(page.getByLabel('Date', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Mag Variation', { exact: true })).toHaveValue('');
      await expect(page.getByRole('status')).toContainText('not stored');
      expect(await records(page)).toBe(JSON.stringify([legacy]));
      await page.getByRole('button', { name: 'Preview printable navigation log' }).click();
      await expect(page.getByText('Date not set', { exact: true })).toBeVisible();
      await expect(page.locator('tbody tr').first().locator('td').nth(5)).toHaveText('Not set');
      await page.getByRole('button', { name: /Back to Editor/ }).click();
      await page.getByLabel('Date', { exact: true }).fill('2030-05-07'); await page.getByLabel('Mag Variation', { exact: true }).fill('-10');
      await save(page, 'Extended copy'); await expect(page.getByRole('status')).toContainText('Saved');
      const saved = JSON.parse((await records(page))!); expect(saved[0]).toEqual(legacy);
      expect(saved[1]).toMatchObject({ schemaVersion: 2, date: '2030-05-07', magneticVariation: -10 });
      await page.reload(); await page.getByRole('button', { name: 'Load plan', exact: true }).click();
      await page.getByRole('button', { name: 'Load Extended copy', exact: true }).click();
      await expect(page.getByLabel('Date', { exact: true })).toHaveValue('2030-05-07');
      await expect(page.getByLabel('Mag Variation', { exact: true })).toHaveValue('-10');
    });

    test('corrupt data and denied writes cannot overwrite saved records or discard draft', async ({ page }) => {
      await page.goto('/plan'); await page.evaluate(key => localStorage.setItem(key, '{broken'), key); await ready(page);
      await save(page, 'Keep draft'); await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('cannot be read safely');
      expect(await records(page)).toBe('{broken'); await expect(page.getByLabel('Plan name', { exact: true })).toHaveValue('Keep draft');
      await page.evaluate(({ key, legacy }) => localStorage.setItem(key, JSON.stringify([legacy])), { key, legacy });
      await page.getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      await page.evaluate(key => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Fixture denied', 'QuotaExceededError'); return original.call(this, name, value); };
      }, key);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('Could not save');
      expect(await records(page)).toBe(JSON.stringify([legacy]));
      await expect(page.getByLabel('Plan name', { exact: true })).toHaveValue('Keep draft');
    });

    test('standalone wind calculator rejects infeasible solutions', async ({ page }) => {
      await page.goto('/tools');
      const selector = page.locator('#pilot-tool');
      if (await selector.isVisible()) await selector.selectOption('wind');
      else await page.getByRole('button', { name: 'Wind Correction', exact: true }).click();
      await page.getByLabel('True Course (°)', { exact: true }).fill('0');
      await page.getByLabel('True Airspeed (kts)', { exact: true }).fill('120');
      await page.getByLabel('Wind From (°)', { exact: true }).fill('120');
      await page.getByLabel('Wind Speed (kts)', { exact: true }).fill('150');
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('crosswind');
      await expect(page.getByText('Ground Speed', { exact: true })).toHaveCount(0);
      await page.getByLabel('Wind From (°)', { exact: true }).fill('0');
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('groundspeed');
      await page.getByLabel('Wind Speed (kts)', { exact: true }).fill('20');
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
      await expect(page.getByText('100 kts', { exact: true })).toBeVisible();
    });
  });
}
