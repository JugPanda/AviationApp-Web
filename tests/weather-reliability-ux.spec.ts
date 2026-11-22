import { test, expect } from '@playwright/test';

// Explicit transport/storage fixtures exercise failures without depending on a
// real airport outage. These reports are never represented as provider evidence.
for (const width of [360, 1440]) {
  test(`${width}px expired forecast survives failed refresh; metadata never renews it; empty retry is distinct`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const old = Date.now() - 48 * 3600000;
    await page.addInitScript(({ old }) => localStorage.setItem('avweather-briefing-KAAA', JSON.stringify({
      taf: { icaoId: 'KAAA', rawTaf: 'TEST FIXTURE OLD FORECAST', issueTime: old, validFrom: old / 1000, validTo: (old + 3600000) / 1000, forecasts: [] }, tafRetrievedAt: old,
    })), { old });
    await page.route('**/api/metar?**', route => route.fulfill({ json: [{ icaoId: 'KAAA', lat: 38, lon: -85, obsTime: Math.floor(Date.now() / 1000), name: 'Test fixture airport' }] }));
    await page.route('**/api/airport/KAAA', route => route.fulfill({ json: { airport: { ident: 'KAAA', name: 'Test fixture airport' }, runways: [], frequencies: [] } }));
    let calls = 0; let succeed = false;
    await page.route('**/api/taf?ids=KAAA', route => { calls++; return route.fulfill({ status: succeed ? 200 : 503, json: succeed ? [] : { error: 'Explicit test provider outage' } }); });
    await page.goto('/map'); await page.locator('.leaflet-container').waitFor();
    await page.getByLabel('Search airport by ICAO code').fill('KAAA'); await page.getByLabel('Search airport by ICAO code').press('Enter');
    const panel = page.getByRole('dialog', { name: 'Airport briefing for KAAA' }); await panel.waitFor();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('avweather-briefing-KAAA')!).detailsRetrievedAt)).toBeGreaterThan(old);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-briefing-KAAA')!).tafRetrievedAt)).toBe(old);
    await panel.getByRole('button', { name: 'Forecast', exact: true }).click();
    await expect(panel).toContainText('TAF refresh unavailable'); await expect(panel).toContainText('Expired TAF'); await expect(panel).toContainText('TEST FIXTURE OLD FORECAST');
    expect(calls).toBe(1); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('avweather-briefing-KAAA')!).tafRetrievedAt)).toBe(old);
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await panel.screenshot({ path: info.outputPath(`expired-forecast-${width}.png`) });
    succeed = true; await panel.getByRole('button', { name: 'Retry TAF', exact: true }).click();
    await expect(panel).toContainText('No TAF issued'); await expect(panel).not.toContainText('TEST FIXTURE OLD FORECAST'); expect(calls).toBe(2); expect(errors).toEqual([]);
    await context.close();
  });

  test(`${width}px valid SIGMET subset renders with incomplete coverage notice`, async ({ browser, baseURL }, info) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 900 }, serviceWorkers: 'block' }); const page = await context.newPage();
    await page.route('**/api/metar?**', route => route.fulfill({ json: [{ icaoId: 'KAAA', lat: 38.5, lon: -85, fltCat: 'VFR', name: 'Test fixture airport' }] }));
    await page.route('**/api/airport/KAAA', route => route.fulfill({ json: { airport: { ident: 'KAAA', name: 'Test fixture airport' }, runways: [], frequencies: [] } }));
    await page.route('**/api/pirep**', route => route.fulfill({ json: { items: [], status: 'live', updatedAt: new Date().toISOString() } }));
    await page.route('**/api/sigmet**', route => route.fulfill({ status: 503, json: { items: [{ id: 'test-sigmet', type: 'SIGMET', subType: 'CONVECTIVE', hazard: 'TEST FIXTURE', rawText: 'TEST FIXTURE ONLY', validFrom: new Date(Date.now() - 60000).toISOString(), validTo: new Date(Date.now() + 3600000).toISOString(), coords: [{ lat: 38, lng: -86 }, { lat: 39, lng: -85 }, { lat: 38, lng: -84 }], isActive: true }], status: 'unavailable', message: 'SIGMET coverage is incomplete. Test provider failure; valid available polygons only.', updatedAt: new Date().toISOString() } }));
    await page.goto('/map'); await page.locator('.leaflet-container').waitFor();
    await page.getByLabel('Search airport by ICAO code').fill('KAAA'); await page.getByLabel('Search airport by ICAO code').press('Enter');
    await page.getByRole('dialog', { name: 'Airport briefing for KAAA' }).waitFor(); await page.getByRole('button', { name: 'Close airport briefing' }).click();
    // Allow the existing map fly-to to settle before verifying/capturing paint.
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: /^Weather layers/ }).click(); await page.getByRole('button', { name: /^Hazards/ }).click(); await page.getByRole('button', { name: 'Close map layers' }).click();
    await expect(page.getByText('SIGMET coverage is incomplete. Test provider failure; valid available polygons only.')).toBeVisible();
    // Production Leaflet uses preferCanvas: verify actual painted red hazard
    // pixels, not nonexistent SVG paths. Tiles are in a separate layer.
    await expect.poll(() => page.locator('.leaflet-overlay-pane canvas').evaluateAll(canvases => canvases.reduce((count, node) => {
      const canvas = node as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 160 && pixels[i + 1] < 110 && pixels[i + 2] < 130 && pixels[i + 3] > 5) count++;
      return count;
    }, 0))).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`partial-hazards-${width}.png`) }); await context.close();
  });
}
