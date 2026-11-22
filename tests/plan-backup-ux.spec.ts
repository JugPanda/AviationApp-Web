import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

// Isolated browser-local fixtures only. Not flight data or aircraft validation.
const key = 'avweather-flightplans';
const legacy = {
  id: 'legacy', name: 'Legacy fixture', departure: 'KLOU', destination: 'KLEX',
  waypoints: [{ id: 'wp', name: 'TEST', distance: 50, trueCourse: 90, altitude: 3000, windDirection: 90, windSpeed: 20 }],
  aircraftTas: 120, fuelBurnRate: 10, fuelOnboard: 40, reserveMinutes: 45, createdAt: 1,
};
const modern = { ...legacy, id: 'modern', name: 'Dated fixture', schemaVersion: 2, date: '2030-05-07', magneticVariation: -10 };
const envelope = (plans: unknown) => JSON.stringify({ format: 'avweather-plan-backup', version: 1, plans });
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), key);
const modal = (page: Page) => page.getByRole('dialog', { name: 'Import saved plans', exact: true });
const confirm = (page: Page) => modal(page).getByRole('button', { name: 'Confirm import as new copies', exact: true });
async function ready(page: Page) {
  await page.goto('/plan');
  // Verify interactive hydration before relying on client storage state.
  await page.getByRole('button', { name: 'Import plans', exact: true }).click();
  await expect(modal(page)).toBeVisible();
  await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
}
async function seed(page: Page, stored = JSON.stringify([legacy])) {
  // Seed before the first document, once per tab. The former immediate second
  // navigation interrupted WebKit's initial SW registration and emitted an
  // access-control pageerror unrelated to the tested dialog. Keep real SWs on.
  await page.addInitScript(({ key, stored }) => {
    if (!sessionStorage.getItem('plan-backup-fixture-seeded')) {
      localStorage.setItem(key, stored);
      sessionStorage.setItem('plan-backup-fixture-seeded', 'true');
    }
  }, { key, stored });
  await ready(page);
}
async function choose(page: Page, content = envelope([modern]), name = 'fixture.json') {
  await modal(page).getByLabel('Plan backup file', { exact: true }).setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
}
async function preview(page: Page, content = envelope([modern])) {
  await page.getByRole('button', { name: 'Import plans', exact: true }).click();
  await choose(page, content);
  await expect(modal(page).getByRole('status')).toContainText('ready for review');
}
async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all saved plans', exact: true }).click();
  const result = await pending;
  expect(await result.failure()).toBeNull();
  return { filename: result.suggestedFilename(), text: await readFile((await result.path())!, 'utf8') };
}

// Deterministic crash/old-app fixtures: only the fingerprint is transactional.
async function setFence(page: Page, bytes: string | null) {
  return page.evaluate(async ({ key, bytes }) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(bytes)));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('avweather-write-fences', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('fingerprints');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('fingerprints', 'readwrite');
        tx.objectStore('fingerprints').put(hash, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
    return hash;
  }, { key, bytes });
}
async function getFence(page: Page) {
  return page.evaluate(key => new Promise<string | undefined>((resolve, reject) => {
    const open = indexedDB.open('avweather-write-fences', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('fingerprints', 'readonly');
      const request = tx.objectStore('fingerprints').get(key);
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), key);
}
const acknowledgeRecovery = (page: Page) => page.getByRole('checkbox', { name: /I have saved and reviewed/ });
const resetFence = (page: Page) => page.getByRole('button', { name: 'Reconcile write protection', exact: true });

for (const width of [360, 1440]) {
  test.describe(`${width}px plan backup integrity`, () => {
    test.use({ viewport: { width, height: 1000 } });

    test('exports all records, previews and cancels without writes, then imports new copies without replacing the draft', async ({ page }) => {
      const originals = [{ ...legacy, notes: { preserved: 'Historical extension' } }, modern];
      const original = JSON.stringify(originals);
      await seed(page, original);
      await page.getByLabel('Departure', { exact: true }).fill('DRAFT');
      await page.getByLabel('Date', { exact: true }).fill('2032-05-06');
      await page.getByLabel('Mag Variation', { exact: true }).fill('12');
      const backup = await download(page);
      expect(backup.filename).toBe('avweather-plans.json');
      expect(JSON.parse(backup.text)).toEqual({ format: 'avweather-plan-backup', version: 1, plans: originals });
      expect(await raw(page)).toBe(original);
      await preview(page, backup.text);
      await expect(modal(page)).toContainText('Date: Not stored / unset');
      await expect(modal(page)).toContainText('2030-05-07');
      await expect(modal(page)).toContainText('-10°');
      expect(await raw(page)).toBe(original);
      await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await raw(page)).toBe(original);
      await preview(page, backup.text);
      await confirm(page).focus(); await page.keyboard.press('Enter');
      await expect(modal(page)).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText('Imported 2');
      const saved = JSON.parse((await raw(page))!);
      expect(saved).toHaveLength(4); expect(saved.slice(0, 2)).toEqual(originals);
      expect(new Set(saved.map((p: { id: string }) => p.id)).size).toBe(4);
      expect(saved[2]).toEqual({ ...originals[0], id: expect.any(String), waypoints: [{ ...legacy.waypoints[0], id: expect.any(String) }] });
      expect(saved[2].waypoints[0].id).not.toBe('wp');
      expect(Object.hasOwn(saved[2], 'date')).toBe(false);
      expect(Object.hasOwn(saved[2], 'magneticVariation')).toBe(false);
      expect(saved[3]).toMatchObject({ schemaVersion: 2, date: modern.date, magneticVariation: -10 });
      for (const [label, value] of [['Departure', 'DRAFT'], ['Date', '2032-05-06'], ['Mag Variation', '12']]) {
        await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
      }
      await ready(page);
      await page.getByRole('button', { name: 'Load plan', exact: true }).click();
      await page.getByRole('button', { name: 'Load Dated fixture', exact: true }).last().click();
      await expect(page.getByLabel('Date', { exact: true })).toHaveValue(modern.date);
      await expect(page.getByLabel('Mag Variation', { exact: true })).toHaveValue('-10');
      await page.getByRole('button', { name: 'Load plan', exact: true }).click();
      await page.getByRole('button', { name: 'Load Legacy fixture', exact: true }).last().click();
      await expect(page.getByLabel('Date', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Mag Variation', { exact: true })).toHaveValue('');
      expect(JSON.parse((await raw(page))!)).toEqual(saved);
    });

    test('raw recovery downloads exact damaged text and import cannot overwrite damaged storage', async ({ page }) => {
      const damaged = '{broken\nwith recovery details';
      await seed(page, damaged);
      const backup = await download(page);
      expect(backup).toEqual({ filename: 'avweather-plans-recovery.txt', text: damaged });
      await expect(page.getByRole('status')).toContainText('Raw recovery');
      await preview(page);
      await expect(confirm(page)).toBeDisabled();
      await expect(modal(page).getByRole('alert')).toContainText('cannot be read safely');
      expect(await raw(page)).toBe(damaged);
    });

    test('malformed, unsafe and oversized files discard the previous preview, never original saved plans', async ({ page }) => {
      await seed(page); const original = await raw(page); await preview(page);
      for (const invalid of ['{bad', envelope([{ ...modern, date: '2030-02-30' }]), envelope([legacy, legacy]), '[{"__proto__":{"polluted":true}}]', ' '.repeat(2 * 1024 * 1024 + 1)]) {
        await choose(page, invalid);
        await expect(modal(page).getByRole('alert')).toBeVisible();
        await expect(confirm(page)).toBeDisabled();
        await expect(modal(page).locator('.av-plan-import-list')).toHaveCount(0);
        expect(await raw(page)).toBe(original);
      }
      const invalidUtf8 = Buffer.from(envelope([modern]));
      invalidUtf8[invalidUtf8.indexOf('Dated')] = 0xff;
      await modal(page).getByLabel('Plan backup file', { exact: true }).setInputFiles({ name: 'invalid-encoding.json', mimeType: 'application/json', buffer: invalidUtf8 });
      await expect(modal(page).getByRole('alert')).toContainText('not valid UTF-8');
      expect(await raw(page)).toBe(original);
      await choose(page, '[]');
      await expect(modal(page)).toContainText('This backup is empty'); await expect(confirm(page)).toBeDisabled();
      await choose(page); await expect(confirm(page)).toBeEnabled();
      expect(await raw(page)).toBe(original);
    });

    test('a newer save from another tab blocks stale import until explicit refresh and reconfirmation', async ({ page, context }) => {
      await seed(page); const other = await context.newPage(); await ready(other);
      await page.getByLabel('Departure', { exact: true }).fill('DRAFT'); await preview(page);
      await other.getByRole('button', { name: 'Save plan', exact: true }).click();
      await other.getByLabel('Plan name', { exact: true }).fill('Other tab copy');
      await other.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(other.getByRole('status')).toContainText('Saved');
      const newer = await raw(page);
      await confirm(page).click();
      await expect(modal(page).getByRole('alert')).toContainText('changed in another tab');
      expect(await raw(page)).toBe(newer);
      await expect(modal(page).locator('.av-plan-import-list')).toContainText(modern.name);
      await modal(page).getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      await expect(modal(page)).toContainText('2 existing saved plans stay unchanged');
      expect(await raw(page)).toBe(newer);
      await confirm(page).click(); await expect(modal(page)).toHaveCount(0);
      const saved = JSON.parse((await raw(page))!);
      expect(saved).toHaveLength(3); expect(saved.slice(0, 2)).toEqual(JSON.parse(newer!));
      await expect(page.getByLabel('Departure', { exact: true })).toHaveValue('DRAFT');
      await other.close();
    });

    test('simultaneous imports use the existing lock and snapshot protection without silent loss', async ({ page, context }, info) => {
      await seed(page); const other = await context.newPage(); await ready(other);
      await preview(page); await preview(other);
      await Promise.all([confirm(page).click(), confirm(other).click()]);
      try {
        await expect.poll(async () => await modal(page).count() + await modal(other).count()).toBe(1);
      } catch (error) {
        // Retain both tabs' real records/statuses: disappearing dialogs can mean
        // two successful writes with one lost copy, not a missed click.
        const tabs = await Promise.all([page, other].map(tab => tab.evaluate(key => ({
          raw: localStorage.getItem(key),
          webLocksAvailable: !!navigator.locks,
          dialogs: document.querySelectorAll('dialog').length,
          statuses: Array.from(document.querySelectorAll('[role="status"], [role="alert"]'), element => element.textContent),
        }), key)));
        await info.attach('simultaneous-import-storage', { body: JSON.stringify(tabs, null, 2), contentType: 'application/json' });
        throw error;
      }
      const loser = await modal(page).count() ? page : other;
      await expect(modal(loser).getByRole('alert')).toContainText('changed in another tab');
      expect(JSON.parse((await raw(page))!)).toHaveLength(2);
      await modal(loser).getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      await confirm(loser).click(); await expect(modal(loser)).toHaveCount(0);
      const saved = JSON.parse((await raw(page))!);
      expect(saved).toHaveLength(3); expect(saved[0]).toEqual(legacy);
      expect(new Set(saved.map((p: { id: string }) => p.id)).size).toBe(3);
      await other.close();
    });

    test('transactional fence rejects a stale localStorage cache even after the other tab releases its lock', async ({ page, context }) => {
      await seed(page); const original = await raw(page);
      const other = await context.newPage(); await ready(other);
      await preview(page); await preview(other);
      await confirm(page).click(); await expect(modal(page)).toHaveCount(0);
      const newer = await raw(page);
      await other.evaluate(({ key, original }) => {
        const get = Storage.prototype.getItem;
        Object.defineProperty(window, 'restoreTestGet', { value: () => { Storage.prototype.getItem = get; } });
        Storage.prototype.getItem = function (name) { return name === key ? original : get.call(this, name); };
      }, { key, original });
      await confirm(other).click();
      await expect(modal(other).getByRole('alert')).toContainText('changed in another tab');
      expect(await raw(page)).toBe(newer);
      await other.evaluate(() => (window as unknown as { restoreTestGet: () => void }).restoreTestGet());
      await modal(other).getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      await confirm(other).click(); await expect(modal(other)).toHaveCount(0);
      await expect.poll(async () => JSON.parse((await raw(page))!).length).toBe(3);
      await other.close();
    });

    test('stale export is an exact raw recovery file, never a complete backup claim', async ({ page, context }) => {
      await seed(page); const original = (await raw(page))!;
      const other = await context.newPage(); await ready(other);
      await preview(other); await confirm(other).click(); await expect(modal(other)).toHaveCount(0);
      const newer = await raw(other); const fence = await getFence(other);
      // Model WebKit returning an older process-local cache after a real write.
      await page.evaluate(({ key, original }) => {
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function (name) { return name === key ? original : get.call(this, name); };
      }, { key, original });
      await page.getByLabel('Departure', { exact: true }).fill('DRAFT');
      expect(await download(page)).toEqual({ filename: 'avweather-plans-recovery.txt', text: original });
      await expect(page.getByRole('status')).toContainText('Incomplete / unverified');
      await expect(page.getByRole('status')).not.toContainText('Backup download requested for');
      await expect(page.getByRole('region', { name: 'Recover write protection' })).toContainText('may be stale');
      await expect(resetFence(page)).toBeDisabled();
      expect(await raw(other)).toBe(newer); expect(await getFence(other)).toBe(fence);
      await expect(page.getByLabel('Departure', { exact: true })).toHaveValue('DRAFT');
      await other.close();
    });

    test('backup-first fence recovery changes only the fingerprint, refreshes records and permits safe save and import', async ({ page }, info) => {
      await seed(page);
      await page.getByLabel('Departure', { exact: true }).fill('DRAFT');
      await page.getByLabel('Date', { exact: true }).fill('2032-05-06');
      await page.getByLabel('Mag Variation', { exact: true }).fill('12');
      const originals = [legacy, { ...modern, notes: 'Preserve unknown fields' }];
      const changed = JSON.stringify(originals, null, 2) + '\n';
      // An old app wrote records without updating the existing fingerprint.
      const beforeFence = await setFence(page, JSON.stringify([legacy]));
      await page.evaluate(({ key, changed }) => localStorage.setItem(key, changed), { key, changed });
      await preview(page); await confirm(page).click();
      await expect(modal(page).getByRole('alert')).toContainText('changed in another tab');
      await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await download(page)).toEqual({ filename: 'avweather-plans-recovery.txt', text: changed });
      expect(await getFence(page)).toBe(beforeFence); expect(await raw(page)).toBe(changed);
      await expect(resetFence(page)).toBeDisabled();
      await acknowledgeRecovery(page).focus(); await page.keyboard.press('Space');
      await expect(resetFence(page)).toBeEnabled();
      const region = page.getByRole('region', { name: 'Recover write protection' });
      expect((await new AxeBuilder({ page }).include('#plan-recovery').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
      const sizes = await region.locator('input, button').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
      expect(sizes.every(size => size.width >= 44 && size.height >= 44)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await region.screenshot({ path: info.outputPath(`plan-recovery-${width}.png`) });
      // A reset must not call either localStorage mutator, even with equal bytes.
      await page.evaluate(key => {
        const set = Storage.prototype.setItem; const remove = Storage.prototype.removeItem;
        Object.defineProperty(window, 'restoreRecoveryStorage', { value: () => { Storage.prototype.setItem = set; Storage.prototype.removeItem = remove; } });
        Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('Reset wrote plan bytes'); return set.call(this, name, value); };
        Storage.prototype.removeItem = function (name) { if (name === key) throw new Error('Reset removed plan bytes'); return remove.call(this, name); };
      }, key);
      await resetFence(page).focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toContainText('Write protection reconciled');
      expect(await raw(page)).toBe(changed);
      const expectedHash = await page.evaluate(async changed => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(changed)))), byte => byte.toString(16).padStart(2, '0')).join(''), changed);
      expect(await getFence(page)).toBe(expectedHash);
      await page.evaluate(() => (window as unknown as { restoreRecoveryStorage: () => void }).restoreRecoveryStorage());
      for (const [label, value] of [['Departure', 'DRAFT'], ['Date', '2032-05-06'], ['Mag Variation', '12']]) {
        await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
      }
      await page.getByRole('button', { name: 'Save plan', exact: true }).click();
      await page.getByLabel('Plan name', { exact: true }).fill('Recovered draft');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Saved “Recovered draft”');
      let saved = JSON.parse((await raw(page))!);
      expect(saved).toHaveLength(3); expect(saved.slice(0, 2)).toEqual(originals);
      await preview(page); await confirm(page).click(); await expect(modal(page)).toHaveCount(0);
      saved = JSON.parse((await raw(page))!);
      expect(saved).toHaveLength(4); expect(saved.slice(0, 2)).toEqual(originals);
      await expect(page.getByLabel('Departure', { exact: true })).toHaveValue('DRAFT');
    });

    test('fence recovery refuses a newer transactional writer after export even with unchanged raw cache', async ({ page }) => {
      await seed(page); const original = await raw(page);
      await setFence(page, JSON.stringify([modern]));
      await download(page); await acknowledgeRecovery(page).check();
      // Model a cooperating writer committing its fence while this tab still
      // sees the exported cache: the raw equality check alone cannot catch it.
      const newerFence = await setFence(page, JSON.stringify([legacy, modern]));
      await resetFence(page).click();
      await expect(page.getByRole('status')).toContainText('Recovery refused');
      expect(await getFence(page)).toBe(newerFence); expect(await raw(page)).toBe(original);
      await expect(resetFence(page)).toHaveCount(0);
    });

    test('fence recovery refuses changed raw bytes after export without touching either store', async ({ page }) => {
      await seed(page); const fence = await setFence(page, JSON.stringify([modern]));
      await download(page); await acknowledgeRecovery(page).check();
      const changed = JSON.stringify([legacy, modern]);
      await page.evaluate(({ key, changed }) => localStorage.setItem(key, changed), { key, changed });
      await resetFence(page).click();
      await expect(page.getByRole('status')).toContainText('Recovery refused');
      expect(await getFence(page)).toBe(fence); expect(await raw(page)).toBe(changed);
    });

    test('denied coordination exports unverified bytes and cannot reconcile a previously exported fence', async ({ page }) => {
      await seed(page); const original = (await raw(page))!;
      const fence = await setFence(page, JSON.stringify([modern]));
      await download(page); await acknowledgeRecovery(page).check();
      await page.evaluate(() => {
        const open = IDBFactory.prototype.open;
        Object.defineProperty(window, 'restoreRecoveryIDB', { value: () => { IDBFactory.prototype.open = open; } });
        IDBFactory.prototype.open = () => { throw new DOMException('Synthetic IDB denial', 'SecurityError'); };
      });
      await resetFence(page).click();
      await expect(page.getByRole('status')).toContainText('Recovery could not be completed');
      expect(await raw(page)).toBe(original);
      expect(await download(page)).toEqual({ filename: 'avweather-plans-recovery.txt', text: original });
      await expect(page.getByRole('status')).toContainText('Incomplete / unverified');
      await expect(resetFence(page)).toHaveCount(0);
      await page.evaluate(() => (window as unknown as { restoreRecoveryIDB: () => void }).restoreRecoveryIDB());
      expect(await getFence(page)).toBe(fence);
    });

    test('an aborted fingerprint transaction restores the original bytes and allows a safe retry', async ({ page }) => {
      await seed(page); const original = await raw(page); await preview(page);
      await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        Object.defineProperty(window, 'restoreTestPut', { value: () => { IDBObjectStore.prototype.put = put; } });
        IDBObjectStore.prototype.put = function (value, key) {
          const request = put.call(this, value, key);
          const transaction = this.transaction;
          request.addEventListener('success', () => queueMicrotask(() => transaction.abort()));
          return request;
        };
      });
      await confirm(page).click();
      await expect(modal(page).getByRole('alert')).toContainText('Could not save');
      expect(await raw(page)).toBe(original);
      await page.evaluate(() => (window as unknown as { restoreTestPut: () => void }).restoreTestPut());
      // A failed save deliberately requires review of the current store before
      // retry. Do not bypass that safety gate or wait on its disabled button.
      await expect(confirm(page)).toBeDisabled();
      await modal(page).getByRole('button', { name: 'Refresh saved plans', exact: true }).click();
      expect(await raw(page)).toBe(original);
      await expect(confirm(page)).toBeEnabled();
      await confirm(page).click(); await expect(modal(page)).toHaveCount(0);
      expect(JSON.parse((await raw(page))!)).toHaveLength(2);
    });

    test('denied IndexedDB coordination cannot bypass the write fence', async ({ page }) => {
      await seed(page); const original = await raw(page); await preview(page);
      await page.evaluate(() => {
        IDBFactory.prototype.open = () => { throw new DOMException('Synthetic IDB denial', 'SecurityError'); };
      });
      await confirm(page).click();
      await expect(modal(page).getByRole('alert')).toContainText('Could not save');
      expect(await raw(page)).toBe(original);
      await expect(modal(page).locator('.av-plan-import-list')).toContainText(modern.name);
    });

    test('quota and denied storage preserve preview, existing records and editor values', async ({ page }) => {
      await seed(page); const original = await raw(page);
      await page.getByLabel('Departure', { exact: true }).fill('DRAFT'); await preview(page);
      await page.evaluate(key => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Synthetic quota fault', 'QuotaExceededError');
          return original.call(this, name, value);
        };
      }, key);
      await confirm(page).click();
      await expect(modal(page).getByRole('alert')).toContainText('Could not save');
      await expect(modal(page).locator('.av-plan-import-list')).toContainText(modern.name);
      expect(await raw(page)).toBe(original);
      await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.getByLabel('Departure', { exact: true })).toHaveValue('DRAFT');
      await page.evaluate(key => {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function (name) {
          if (name === key) throw new DOMException('Synthetic denied read', 'SecurityError');
          return original.call(this, name);
        };
      }, key);
      await page.getByRole('button', { name: 'Export all saved plans', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Backup could not be downloaded');
      await expect(page.getByLabel('Departure', { exact: true })).toHaveValue('DRAFT');
    });
  });
}

for (const width of [360, 768, 1440]) {
  test(`${width}px import dialog is keyboard accessible, contains focus, restores opener and does not overflow`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const opener = page.getByRole('button', { name: 'Import plans', exact: true });
    await opener.focus(); await page.keyboard.press('Enter');
    const input = modal(page).getByLabel('Plan backup file', { exact: true });
    await expect(input).toBeFocused(); await expect(confirm(page)).toBeDisabled();
    await page.keyboard.press('Shift+Tab');
    await expect(modal(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(input).toBeFocused();
    await choose(page, envelope([{ ...modern, name: 'Long fixture '.repeat(25) }, legacy]));
    await expect(confirm(page)).toBeEnabled();
    await input.focus(); await page.keyboard.press('Shift+Tab'); await expect(confirm(page)).toBeFocused();
    await page.keyboard.press('Tab'); await expect(input).toBeFocused();
    expect((await new AxeBuilder({ page }).include('.av-plan-dialog').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    expect(await modal(page).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const sizes = await modal(page).locator('input, button').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
    expect(sizes.every(size => size.width >= 44 && size.height >= 48)).toBe(true);
    await page.screenshot({ path: info.outputPath(`plan-import-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape'); await expect(modal(page)).toHaveCount(0); await expect(opener).toBeFocused();
    expect(await raw(page)).toBe(JSON.stringify([legacy])); expect(errors).toEqual([]);
  });
}
