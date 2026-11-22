import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [360, 768, 1440]) {
  test(`${width}px weather controls are discoverable, spacious and keyboard operable`, async ({page}, info) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/map');
    await expect(page.getByRole('heading',{name:'Weather map',exact:true})).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const sizes=await page.locator('.av-weather-controls button').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
    expect(sizes.every(s=>s.width>=44 && s.height>=48)).toBe(true);
    const layers=page.getByRole('button',{name:/^Weather layers/});await layers.click();
    const dialog=page.getByRole('dialog',{name:'Map layers',exact:true});
    await expect(dialog).toBeVisible();await expect(page.getByRole('button',{name:'Close map layers'})).toBeFocused();
    await page.getByRole('button',{name:'Airspace',exact:true}).click();await expect(page.getByRole('button',{name:'Airspace',exact:true})).toHaveAttribute('aria-pressed','true');
    for(let n=0;n<8;n++){await page.keyboard.press('Tab');expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true);}
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(layers).toBeFocused();
    await page.getByRole('button',{name:/^Filters/}).click();
    await page.getByRole('button',{name:/Choose individual states/}).click();
    await expect(page.getByRole('checkbox',{name:/Kentucky/})).toBeVisible();
    await page.getByRole('checkbox',{name:/Kentucky/}).check();
    await expect(page.getByRole('button',{name:/1 states selected/})).toBeVisible();
    await page.getByRole('button',{name:/^Unknown/}).click();
    await expect(page.getByRole('button',{name:/^Unknown/})).toHaveAttribute('aria-pressed','false');
    expect((await new AxeBuilder({page}).include('.av-map-panel').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await page.screenshot({path:info.outputPath(`weather-${width}.png`)});
  });
  test(`${width}px real airport report keeps UTC observation and readable sections visible`,async({page}, info)=>{
    await page.setViewportSize({width,height:900});await page.goto('/map');
    const search=page.getByRole('textbox',{name:'Search airport by ICAO code'});await search.fill('KLOU');await search.press('Enter');
    const panel=page.getByRole('dialog',{name:'Airport briefing for KLOU'});await expect(panel).toBeVisible({timeout:30000});
    await expect(search).toHaveValue('KLOU');await expect(panel.locator('.av-observation-time')).toContainText('UTC');
    for(const name of ['Conditions','Forecast','NOTAMs','Airport','Runways','Frequencies']) await expect(panel.getByRole('button',{name,exact:true})).toBeVisible();
    expect(await panel.evaluate(p=>p.scrollWidth<=p.clientWidth+1)).toBe(true);
    if(width===360){const oldHeight=(await panel.boundingBox())!.height;await page.getByRole('button',{name:'Expand panel',exact:true}).click();expect((await panel.boundingBox())!.height).toBeGreaterThan(oldHeight);}
    await panel.screenshot({path:info.outputPath(`airport-${width}.png`)});
    await page.getByRole('button',{name:'Close airport briefing',exact:true}).focus();await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(search).toBeFocused();
  });
}

test('airport search failure retains the entered identifier and explains failure',async({browser, baseURL})=>{
  const context = await browser.newContext({serviceWorkers:'block', baseURL});
  const page = await context.newPage();
  // Explicit failure transport fixture, not a live provider result.
  await page.route('**/api/metar?ids=ZZZZ',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Fixture provider unavailable'})}));
  await page.goto('/map');const search=page.getByRole('textbox',{name:'Search airport by ICAO code'});await search.fill('ZZZZ');await search.press('Enter');
  await expect(page.locator('.av-map-content').getByRole('alert')).toContainText('Failed to fetch weather data (503)');await expect(search).toHaveValue('ZZZZ');
  await context.close();
});
