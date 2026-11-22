import { expect, test, type Page } from '@playwright/test';

// Run against the parent's newly built server. No build/server is started by this suite.
const profile = { id: 'wb-kept', name: 'Archer original', aircraftType: 'PA28-181', fuelGallons: 12, stationWeights: [175, 80, 25], createdAt: 1, updatedAt: 1 };
const aircraft = { name: 'N-SNAPSHOT', emptyWeight: 1500, emptyArm: 40, maxGross: 2550, fuelArm: 40, fuelCapacity: 53, fuelWeight: 6, stations: [{ name: 'Pilot', arm: 40, maxWeight: 400 }], envelope: { points: [{ weight: 1500, cgMin: 35, cgMax: 47 }, { weight: 2550, cgMin: 41, cgMax: 47 }, { weight: 2000, cgMin: 42, cgMax: 47 }] } };
async function open(page: Page, records: Record<string, string> = {}) {
  await page.addInitScript(values => {
    if (!sessionStorage.getItem('wb-regression-seeded')) {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      sessionStorage.setItem('wb-regression-seeded', 'true');
    }
  }, records);
  await page.goto('/tools');
  await expect(page.getByLabel('Aircraft Type', { exact: true })).toBeVisible();
}
async function assertContained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const clipped = await page.locator('.av-tools-calculator input:visible, .av-tools-calculator select:visible, .av-tools-calculator button:visible').evaluateAll(elements => elements.filter(element => {
    const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1;
  }).map(element => element.outerHTML));
  expect(clipped).toEqual([]);
}
for (const width of [1440, 390]) {
  test.describe(`W&B reliability at ${width}px`, () => {
    let errors: string[];
    test.beforeEach(async ({ page }) => {
      errors = [];
      await page.setViewportSize({ width, height: 900 });
      page.on('pageerror', error => errors.push(error.message));
    });
    test.afterEach(async ({ page }) => { await assertContained(page); expect(errors).toEqual([]); });

    test('unloaded Manage Edit preserves original payload and survives reload', async ({ page }) => {
      await open(page, { 'avweather-profiles': JSON.stringify([profile]) });
      await page.getByRole('button', { name: 'Manage profiles', exact: true }).click();
      await page.getByTitle('Edit', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit Profile', exact: true });
      await expect(dialog).toContainText('Rename only');
      await expect(dialog).toContainText('12 gallons');
      await dialog.getByLabel('Profile Name', { exact: true }).fill('Renamed Archer');
      await dialog.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-profiles')!));
      expect(stored[0]).toEqual({ ...profile, name: 'Renamed Archer', updatedAt: expect.any(Number) });
      await page.reload();
      await page.getByLabel('Saved aircraft profiles').selectOption(profile.id);
      await expect(page.getByLabel('Aircraft Type', { exact: true })).toHaveValue('PA28-181');
      await expect(page.getByLabel('Pilot & Front Pax (lbs)', { exact: true })).toHaveValue('175');
      await expect(page.getByRole('complementary', { name: 'Weight and balance data limitations' })).toContainText('C182T is not T182T; C172S is not 172N');
    });

    test('explicit station violation suppresses valid status; negative and blank are invalid', async ({ page }) => {
      await open(page);
      await page.getByLabel('Pilot & Front Pax (lbs)', { exact: true }).fill('180');
      await page.getByLabel('Baggage Area 1 (lbs)', { exact: true }).fill('121');
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('Baggage Area 1: 121 lbs exceeds maximum 120 lbs');
      await expect(page.getByText('Within selected weight/CG limits only — unverified', { exact: true })).toHaveCount(0);
      await page.getByLabel('Baggage Area 1 (lbs)', { exact: true }).fill('120');
      await expect(page.getByText('Within selected weight/CG limits only — unverified', { exact: true })).toBeVisible();
      for (const value of ['-1', '']) {
        await page.getByLabel('Pilot & Front Pax (lbs)', { exact: true }).fill(value);
        await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('finite, nonnegative weight is required');
        await expect(page.getByText('Within selected weight/CG limits only — unverified', { exact: true })).toHaveCount(0);
      }
    });

    test('profile snapshot wins name collision and unsorted intermediate envelope is used', async ({ page }) => {
      const saved = { ...profile, aircraftType: 'custom-N-SNAPSHOT', customAircraft: aircraft, fuelGallons: 50, stationWeights: [200] };
      await open(page, { 'avweather-profiles': JSON.stringify([saved]), 'avweather-custom-aircraft': JSON.stringify([{ ...aircraft, emptyWeight: 1800 }]) });
      await page.getByLabel('Saved aircraft profiles').selectOption(profile.id);
      await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Empty Weight', exact: true }) })).toContainText('1500');
      await expect(page.getByText('Limits: 42.0 in to 47.0 in', { exact: true })).toBeVisible();
      await expect(page.getByText('Outside selected weight/CG limits', { exact: true })).toBeVisible();
      await expect(page.locator('.av-tools-envelope-chart circle')).toHaveAttribute('fill', '#ef4444');
      await expect(page.locator('.av-tools-envelope-chart')).toContainText('2550');
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Save Profile', exact: true });
      await dialog.getByLabel('Profile Name', { exact: true }).fill('Snapshot copy');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-profiles')!)[1].customAircraft.emptyWeight)).toBe(1500);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-custom-aircraft')!)[0].emptyWeight)).toBe(1800);
    });

    test('duplicate envelope point is rejected and custom draft remains editable', async ({ page }) => {
      await open(page); await page.getByRole('button', { name: 'Add custom aircraft', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Add Custom Aircraft', exact: true });
      await dialog.getByLabel('Aircraft Name', { exact: true }).fill('Envelope draft');
      await dialog.getByLabel('Envelope point 2 weight (lbs)', { exact: true }).fill('1500');
      await dialog.getByRole('button', { name: 'Save Aircraft', exact: true }).click();
      await expect(dialog.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('unique');
      expect(await page.evaluate(() => localStorage.getItem('avweather-custom-aircraft'))).toBeNull();
      await dialog.getByLabel('Envelope point 2 weight (lbs)', { exact: true }).fill('2550');
      await dialog.getByRole('button', { name: '+ Add Point', exact: true }).click();
      await dialog.getByLabel('Envelope point 3 forward limit (inches)', { exact: true }).fill('42');
      await dialog.getByRole('button', { name: 'Save Aircraft', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-custom-aircraft')!)[0].envelope.points.map((p: { weight: number }) => p.weight))).toEqual([1500, 2000, 2550]);
    });

    test('another tab cannot overwrite a stale profile edit', async ({ page, context }) => {
      await open(page, { 'avweather-profiles': JSON.stringify([profile]) });
      await page.getByRole('button', { name: 'Manage profiles', exact: true }).click(); await page.getByTitle('Edit', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit Profile', exact: true });
      await dialog.getByLabel('Profile Name', { exact: true }).fill('Stale draft');
      const other = await context.newPage(); await other.goto('/tools');
      await other.getByRole('button', { name: 'Manage profiles', exact: true }).click(); await other.getByTitle('Edit', { exact: true }).click();
      await other.getByLabel('Profile Name', { exact: true }).fill('Newer name');
      await other.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(other.getByRole('dialog', { name: 'Edit Profile', exact: true })).not.toBeVisible();
      await dialog.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(dialog.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('changed');
      await expect(dialog.getByLabel('Profile Name', { exact: true })).toHaveValue('Stale draft');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-profiles')!)[0].name)).toBe('Newer name');
      await other.close();
    });

    test('corrupt records are recoverable, never replaced with a new profile', async ({ page }) => {
      const raw = '[{"id":"damaged"';
      await open(page, { 'avweather-profiles': raw });
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('damaged');
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Save Profile', exact: true });
      await dialog.getByLabel('Profile Name', { exact: true }).fill('New draft');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('not been overwritten');
      expect(await page.evaluate(() => localStorage.getItem('avweather-profiles'))).toBe(raw);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Manage profiles', exact: true }).click();
      await page.getByRole('button', { name: 'Import/Export', exact: true }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export All Profiles', exact: true }).click();
      const stream = await (await download).createReadStream();
      const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString()).toBe(raw);
    });

    test('quota failure does not crash mount or discard unsaved profile draft', async ({ page }) => {
      await page.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage) throw new DOMException('Injected quota failure', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      });
      await open(page);
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('not saved');
      await page.getByLabel('Pilot & Front Pax (lbs)', { exact: true }).fill('180');
      await page.getByRole('button', { name: 'Save profile', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Save Profile', exact: true });
      await dialog.getByLabel('Profile Name', { exact: true }).fill('Keep my draft');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText('not saved');
      await expect(dialog.getByLabel('Profile Name', { exact: true })).toHaveValue('Keep my draft');
      expect(await page.evaluate(() => localStorage.getItem('avweather-profiles'))).toBeNull();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByLabel('Pilot & Front Pax (lbs)', { exact: true })).toHaveValue('180');
    });
  });
}
