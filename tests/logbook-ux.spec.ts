import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Every Playwright test gets its own browser context. Seed only once so reloads
// exercise real localStorage persistence, not a fixture being re-inserted.
const key = 'avweather-logbook';
const flight = {
  id: 'logbook-ux-fixture', date: '2026-11-21', aircraft: 'N123QA', aircraftType: 'C172',
  from: 'KLOU', to: 'KLEX', route: 'KFFT', totalTime: 1.5, pic: 1.5, sic: 0,
  dual: 0, solo: 0, crossCountry: 1.5, dayTime: 1, nightTime: 0.5,
  actualInstrument: 0.2, simulatedInstrument: 0, dayLandings: 3, nightLandings: 1,
  approaches: 2, approachTypes: 'ILS', holds: 1, remarks: 'Isolated test record, not flight data.',
  createdAt: 100, updatedAt: 200,
};
async function openLogbook(page: Page, records: unknown = []) {
  await page.addInitScript(({ key, records }) => {
    if (!sessionStorage.getItem('logbook-ux-seeded')) {
      localStorage.setItem(key, JSON.stringify(records));
      sessionStorage.setItem('logbook-ux-seeded', 'true');
    }
  }, { key, records });
  await page.goto('/logbook');
  await expect(page.getByRole('heading', { name: 'Flight logbook', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export backup' })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.locator('.av-logbook').evaluate(root => [...root.querySelectorAll('input:not([type=file]), select, textarea, button, summary')]
    .filter(el => el.getClientRects().length)
    .every(el => { const box = el.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth + 1 && box.height >= 48; }))).toBe(true);
}
async function fillRequired(page: Page) {
  await page.getByLabel('Date *', { exact: true }).fill('2026-11-21');
  await page.getByLabel('Aircraft registration *', { exact: true }).fill('N123QA');
  await page.getByLabel('Aircraft type *', { exact: true }).fill('C172');
  await page.getByLabel('From — departure *', { exact: true }).fill('KLOU');
  await page.getByLabel('To — destination *', { exact: true }).fill('KLEX');
  await page.getByLabel('Total time (hours) *', { exact: true }).fill('1.5');
}
async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), key);
}

for (const width of [360, 768, 1440]) {
  test(`${width}px logbook create, edit, cancel, export, delete, import and persist`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openLogbook(page);
    await expect(page.getByText('No flights logged yet', { exact: true })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${width}-logbook-empty.png`), fullPage: true });
    await page.getByRole('button', { name: '+ Add Flight', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Log New Flight' })).toBeFocused();
    await fillRequired(page);
    await page.getByLabel('Pilot in command (PIC) (hours)', { exact: true }).fill('1.5');
    await page.getByLabel('Day landings (count)', { exact: true }).fill('3');
    await page.locator('summary').filter({ hasText: 'More time categories' }).click();
    await page.getByLabel('Cross-country (hours)', { exact: true }).fill('1.5');
    await page.locator('summary').filter({ hasText: '03 / Route & instrument details' }).click();
    await page.getByLabel('Approaches (count)', { exact: true }).fill('2');
    await page.getByLabel('Remarks (optional)', { exact: true }).fill('Browser round-trip fixture');
    await noOverflow(page);
    const accessibility = await new AxeBuilder({ page }).include('.av-logbook').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${width}-logbook-form.png`), fullPage: true });
    await page.getByRole('button', { name: 'Log Flight', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Flight saved in this browser.');
    await expect(page.getByRole('article')).toHaveCount(1);
    const original = (await stored(page))[0];
    expect(original).toMatchObject({ totalTime: 1.5, crossCountry: 1.5, approaches: 2, dayLandings: 3 });
    await page.reload();
    await expect(page.getByRole('article')).toContainText('Browser round-trip fixture');
    expect(await stored(page)).toEqual([original]);
    await noOverflow(page);

    await page.getByRole('button', { name: 'Edit flight', exact: true }).click();
    await expect(page.getByLabel('Cross-country (hours)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Approaches (count)', { exact: true })).toBeVisible();
    await page.getByLabel('Remarks (optional)', { exact: true }).fill('Discard this draft');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Still editing.');
    await expect(page.getByLabel('Remarks (optional)', { exact: true })).toHaveValue('Discard this draft');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Entry canceled.');
    expect(await stored(page)).toEqual([original]);

    await page.getByRole('button', { name: 'Edit flight', exact: true }).click();
    await page.getByLabel('Remarks (optional)', { exact: true }).fill('Updated fixture note');
    await page.getByRole('button', { name: 'Update Flight', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Flight updated');
    const updated = (await stored(page))[0];
    expect(updated).toMatchObject({ ...original, remarks: 'Updated fixture note', updatedAt: expect.any(Number) });
    expect(updated.createdAt).toBe(original.createdAt);
    await page.getByRole('button', { name: 'Totals', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your logged totals' })).toBeVisible();
    await expect(page.locator('.av-logbook-totals').first()).toContainText('1.5');
    await noOverflow(page);
    await page.getByRole('button', { name: 'Recency', exact: true }).click();
    await expect(page.getByText('Incomplete checks, not clearance to fly', { exact: true })).toBeVisible();
    await expect(page.getByText(/do not establish legal currency/)).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${width}-logbook-recency.png`), fullPage: true });
    await page.getByRole('button', { name: 'Entries', exact: true }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^logbook-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const backup = Buffer.concat(chunks);
    expect(JSON.parse(backup.toString())).toEqual([updated]);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Deletion canceled');
    expect(await stored(page)).toEqual([updated]);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(0);
    expect(await stored(page)).toEqual([]);
    await page.reload();
    await expect(page.getByText('No flights logged yet', { exact: true })).toBeVisible();
    const input = page.getByLabel('Import logbook JSON file', { exact: true });
    await input.setInputFiles({ name: 'logbook-backup.json', mimeType: 'application/json', buffer: backup });
    await expect(page.getByRole('status')).toContainText('Imported 1 new flight; 0 existing IDs skipped.');
    expect(await stored(page)).toEqual([updated]);
    await input.setInputFiles({ name: 'logbook-backup.json', mimeType: 'application/json', buffer: backup });
    await expect(page.getByRole('status')).toContainText('Imported 0 new flights; 1 existing ID skipped.');
    await page.reload();
    await expect(page.getByRole('article')).toContainText('Updated fixture note');
    expect(await stored(page)).toEqual([updated]);
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${width}-logbook-entries.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('failed writes keep the draft and original records, then retry succeeds', async ({ page }) => {
  await openLogbook(page, [flight]);
  await page.getByRole('button', { name: 'Edit flight', exact: true }).click();
  await page.getByLabel('Remarks (optional)').fill('Must survive a failed save');
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Object.assign(window, { restoreLogbookWrites: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, name, value); };
  }, key);
  await page.getByRole('button', { name: 'Update Flight', exact: true }).click();
  await expect(page.locator('.av-logbook').getByRole('alert')).toContainText('Could not save to this browser');
  await expect(page.getByLabel('Remarks (optional)')).toHaveValue('Must survive a failed save');
  expect(await stored(page)).toEqual([flight]);
  await page.evaluate(() => (window as unknown as { restoreLogbookWrites: () => void }).restoreLogbookWrites());
  await page.getByRole('button', { name: 'Update Flight', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Flight updated');
  expect((await stored(page))[0].remarks).toBe('Must survive a failed save');
});

test('invalid import never mutates saved records; same IDs never replace records', async ({ page }) => {
  await openLogbook(page, [flight]);
  for (const content of ['not JSON', '{}', '[{"id":"missing-fields"}]', JSON.stringify([flight, flight])]) {
    await page.getByLabel('Import logbook JSON file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(content) });
    await expect(page.locator('.av-logbook').getByRole('alert')).toContainText('No records were changed.');
    expect(await stored(page)).toEqual([flight]);
  }
  await page.getByLabel('Import logbook JSON file').setInputFiles({ name: 'same-id.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ ...flight, remarks: 'Must not overwrite' }])) });
  await expect(page.getByRole('status')).toContainText('1 existing ID skipped');
  expect(await stored(page)).toEqual([flight]);
});

test('unreadable saved JSON stays intact and can be downloaded for recovery', async ({ page }) => {
  const raw = '{broken-but-not-discarded';
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await page.goto('/logbook');
  await expect(page.locator('.av-logbook').getByRole('alert')).toContainText('It has not been changed');
  await expect(page.getByRole('button', { name: '+ Add Flight' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import JSON' })).toBeDisabled();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download stored data' }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(raw);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
});

test('stale tabs cannot overwrite another tab’s saved entries', async ({ page }) => {
  await openLogbook(page, [flight]);
  await page.getByRole('button', { name: 'Edit flight', exact: true }).click();
  await page.getByLabel('Remarks (optional)').fill('Stale edit');
  const other = { ...flight, remarks: 'Saved elsewhere' };
  await page.evaluate(({ key, other }) => localStorage.setItem(key, JSON.stringify([other])), { key, other });
  await page.getByRole('button', { name: 'Update Flight', exact: true }).click();
  await expect(page.locator('.av-logbook').getByRole('alert')).toContainText('Nothing was overwritten');
  expect(await stored(page)).toEqual([other]);
  await expect(page.getByLabel('Remarks (optional)')).toHaveValue('Stale edit');
});
