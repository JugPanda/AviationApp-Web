import { test, expect } from '@playwright/test';

// Transport fixtures must not be bypassed by an installed service worker.
test.use({ serviceWorkers: 'block' });

for (const width of [360, 1440]) {
  test(`${width}px simultaneous coverage failures remain readable without covering map controls`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const message = 'SIGMET/AIRMET coverage is incomplete: TEST FIXTURE provider failures. Only validated available polygons are shown. G-AIRMETs are forecast snapshots, not continuous validity. Alaska zones are not precise hazard boundaries. Cross-check an official briefing source.';
    await page.route('**/api/metar?**', route => route.fulfill({ json: [] }));
    await page.route('**/api/pirep**', route => route.fulfill({ status: 503, json: { items: [], status: 'unavailable', updatedAt: new Date().toISOString(), message: 'TEST FIXTURE pilot reports unavailable. Cross-check an official briefing source.' } }));
    await page.route('**/api/sigmet**', route => route.fulfill({ status: 503, json: { items: [], status: 'unavailable', updatedAt: new Date().toISOString(), message } }));
    await page.goto('/map'); await page.locator('.leaflet-container').waitFor();
    await page.getByRole('button', { name: /^Weather layers/ }).click();
    await page.getByRole('button', { name: /^Hazards/ }).click();
    await page.getByRole('button', { name: 'Close map layers' }).click();
    const stack = page.locator('[data-map-layer-notices]');
    await expect(stack.locator('summary')).toHaveCount(2);
    await expect(stack).toContainText('Pilot reports · Unavailable');
    await expect(stack).toContainText('Hazard coverage · Incomplete');
    const selector = page.getByRole('region', { name: 'Hazard product time', exact: true });
    const boxes = await Promise.all([selector.boundingBox(), stack.boundingBox(), page.locator('.leaflet-control-zoom').boundingBox()]);
    const [time, notices, zoom] = boxes;
    expect(time && notices && zoom).toBeTruthy();
    expect(time!.y + time!.height).toBeLessThanOrEqual(notices!.y);
    expect(notices!.x).toBeGreaterThanOrEqual(zoom!.x + zoom!.width);
    const details = stack.locator('summary').filter({ hasText: 'Hazard coverage' });
    await details.focus(); await page.keyboard.press('Enter');
    await expect(stack.getByText(message, { exact: true })).toBeVisible();
    expect(await stack.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await details.click();
    await page.screenshot({ path: info.outputPath(`map-notices-${width}.png`) });
  });
}
