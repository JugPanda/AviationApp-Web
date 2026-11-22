import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Isolated browser data only: these illustrative test figures are not flight
// information or aircraft performance. No provider calls or external writes.
const planName = 'Isolated browser data — planner regression';
const storageKey = 'avweather-flightplans';

async function enterExampleLeg(page: Page) {
  await page.getByLabel('Departure', { exact: true }).fill('KLOU');
  await page.getByLabel('Destination', { exact: true }).fill('KLEX');
  await page.getByLabel('True airspeed (TAS, kt)', { exact: true }).fill('120');
  await page.getByLabel('Fuel Burn (gal/hr)', { exact: true }).fill('10');
  await page.getByLabel('Fuel Onboard (gal)', { exact: true }).fill('40');
  await page.getByLabel('Reserve (min)', { exact: true }).fill('45');
  await page.getByLabel('Leg 1: Waypoint name', { exact: true }).fill('TEST POINT');
  await page.getByLabel('Leg 1: Distance in nautical miles', { exact: true }).fill('50');
  await page.getByLabel('Leg 1: True course in degrees', { exact: true }).fill('90');
  await page.getByLabel('Leg 1: Wind direction in degrees', { exact: true }).fill('90');
  await page.getByLabel('Leg 1: Wind speed in knots', { exact: true }).fill('20');
}

function metric(container: Locator, label: string) {
  return container.locator('dl > div').filter({ has: container.page().locator('dt', { hasText: label }) }).locator('dd');
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('manual-input boundaries and helpful empty results remain visible', async ({ page }) => {
  await page.goto('/plan');
  for (const name of ['Route', 'Aircraft assumptions', 'Waypoints & legs', 'Review your plan']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Your totals will appear here')).toBeVisible();
  await expect(page.getByText(/does not generate or validate a geographical route/)).toBeVisible();
  await expect(page.getByText(/Starting values are placeholders, not aircraft-specific data/)).toBeVisible();
  await expect(page.getByText(/winds are not fetched automatically/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview printable navigation log' })).toBeDisabled();
  await expect(page.locator('.av-plan-leg-results')).toHaveCount(0);
  await expect(page.locator('.av-plan-leg')).not.toContainText('--');
  expect((await new AxeBuilder({ page }).include('.av-plan').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('leg editing recalculates actual wind, time, fuel and review outputs', async ({ page }) => {
  await page.goto('/plan');
  await enterExampleLeg(page);
  const leg = page.locator('.av-plan-leg-results');
  const review = page.getByRole('region', { name: 'Review your plan', exact: true });
  // Direct headwind: 120 kt TAS minus 20 kt = 100 kt; 50 nm = 30 min.
  await expect(metric(leg, 'True heading')).toHaveText('90°');
  await expect(metric(leg, 'Groundspeed')).toHaveText('100 kt');
  await expect(metric(leg, 'Leg time')).toHaveText('0:30');
  await expect(metric(leg, 'Leg fuel')).toHaveText('5 gal');
  await expect(metric(review, 'Total distance')).toHaveText('50 nm');
  await expect(metric(review, 'Fuel required')).toHaveText('12.5 gal');
  await expect(metric(review, 'Fuel after trip & reserve')).toHaveText('+27.5 gal');

  await page.getByLabel('Leg 1: Distance in nautical miles', { exact: true }).fill('100');
  await expect(metric(leg, 'Leg time')).toHaveText('1:00');
  await expect(metric(leg, 'Leg fuel')).toHaveText('10 gal');
  await expect(metric(review, 'Total time')).toHaveText('1:00');
  await expect(metric(review, 'Fuel required')).toHaveText('17.5 gal');
  await page.getByLabel('Fuel Onboard (gal)', { exact: true }).fill('12');
  await expect(metric(review, 'FUEL SHORTAGE')).toHaveText('-5.5 gal');

  await page.getByRole('button', { name: '+ Add waypoint', exact: true }).click();
  await expect(review.getByText('1 of 2 legs included')).toBeVisible();
  await expect(review.getByText(/excluded from these totals/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove leg 2', exact: true }).click();
  await expect(review.getByText('1 of 1 leg included')).toBeVisible();
});

test('named plans persist after reload, load all existing fields, and delete locally', async ({ page }) => {
  await page.goto('/plan');
  await enterExampleLeg(page);
  await page.getByLabel('Leg 1: Altitude in feet', { exact: true }).fill('4500');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await page.getByRole('textbox', { name: 'Plan name', exact: true }).fill(planName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`Saved “${planName}”`);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), storageKey);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: planName, departure: 'KLOU', destination: 'KLEX', aircraftTas: 120, fuelBurnRate: 10, fuelOnboard: 40, reserveMinutes: 45 });
  expect(saved[0].waypoints[0]).toMatchObject({ name: 'TEST POINT', distance: 50, trueCourse: 90, altitude: 4500, windDirection: 90, windSpeed: 20 });
  expect(Object.keys(saved[0]).sort()).toEqual(['id', 'name', 'departure', 'destination', 'waypoints', 'aircraftTas', 'fuelBurnRate', 'fuelOnboard', 'reserveMinutes', 'createdAt'].sort());

  await page.reload();
  await page.getByRole('button', { name: 'Load plan', exact: true }).click();
  await page.getByRole('button', { name: `Load ${planName}`, exact: true }).click();
  for (const [label, value] of [['Departure', 'KLOU'], ['Destination', 'KLEX'], ['Leg 1: Waypoint name', 'TEST POINT'], ['Leg 1: Altitude in feet', '4500'], ['Leg 1: Distance in nautical miles', '50'], ['Leg 1: Wind speed in knots', '20']]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  await expect(metric(page.locator('.av-plan-review'), 'Fuel required')).toHaveText('12.5 gal');
  await expect(page.getByRole('status')).toContainText('not stored with plans');
  await page.getByRole('button', { name: 'Load plan', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete ${planName}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No saved plans', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe('[]');
});

test('native dialogs contain keyboard focus, close on Escape, and restore the opener', async ({ page }) => {
  await page.goto('/plan');
  const opener = page.getByRole('button', { name: 'Save plan', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Save flight plan', exact: true });
  const name = dialog.getByRole('textbox', { name: 'Plan name', exact: true });
  await expect(name).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await name.fill(planName);
  expect((await new AxeBuilder({ page }).include('.av-plan-dialog').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(name).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Plan name', exact: true }).press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  const load = page.getByRole('button', { name: 'Load plan', exact: true });
  await load.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Load flight plan', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(load).toBeFocused();
});

for (const width of [360, 768, 1440]) {
  test(`${width}px planner has spacious controls and no overflow in editor, dialog or print preview`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/plan');
    await page.evaluate(() => document.fonts.ready);
    await expectNoPageOverflow(page);
    const controls = await page.locator('.av-plan input, .av-plan button').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
    expect(controls.every(size => size.width >= 44 && size.height >= 48)).toBe(true);
    await enterExampleLeg(page);
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`planner-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Save flight plan', exact: true });
    await expect(dialog).toBeInViewport();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Preview printable navigation log' }).click();
    await expect(page.getByRole('heading', { name: 'Navigation Log', exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toContainText('TEST POINT');
    await expect(page.getByRole('table')).toContainText('0:30');
    await expectNoPageOverflow(page);
    await page.getByRole('button', { name: /Back to Editor/ }).click();
    await expect(page.getByLabel('Leg 1: Distance in nautical miles', { exact: true })).toHaveValue('50');
    expect(errors).toEqual([]);
  });
}
