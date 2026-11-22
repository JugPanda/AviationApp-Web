import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
const output = process.env.OUTPUT_DIRECTORY || "test-results";

for (const width of [360, 768, 1440]) {
  for (const route of [
    "/",
    "/map",
    "/plan",
    "/tools",
    "/logbook",
    "/about",
    "/privacy",
  ]) {
    test(`${width}px ${route} renders with working navigation and no overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (route === "/map")
        await expect(page.locator(".leaflet-container")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (["/map", "/plan", "/tools", "/logbook"].includes(route)) {
        await expect(
          page.locator('.av-primary-nav [aria-current="page"]'),
        ).toHaveAttribute("href", route);
        for (const link of await page.locator(".av-primary-nav a").all())
          await expect(link).toBeInViewport();
        const axe = await new AxeBuilder({ page })
          .include(".av-shell-header")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(axe.violations).toEqual([]);
      } else {
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(axe.violations).toEqual([]);
      }
      if (route === "/") {
        const image = page.locator(".phone-screen img");
        await expect(page.locator(".phone-mockup")).toBeVisible();
        await expect(
          page.getByRole("tab", { name: "Weather", exact: true }),
        ).toBeVisible();
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((i: HTMLImageElement) => i.decode());
        if (width === 360) {
          const dimensions = await image.evaluate((i: HTMLImageElement) => ({
            width: i.naturalWidth,
            height: i.naturalHeight,
            ratio: getComputedStyle(i).aspectRatio,
          }));
          // Responsive srcset reports density-corrected naturalWidth, not raw pixels.
          const sourceWidth = Number(
            new URL(
              await image.evaluate((i: HTMLImageElement) => i.currentSrc),
            ).searchParams.get("w"),
          );
          expect(sourceWidth).toBeGreaterThanOrEqual(306);
          expect(dimensions.ratio).toBe("390 / 844");
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: path.join(output, `${width}-landing.png`),
          fullPage: true,
        });
        await page.screenshot({ path: path.join(output, `${width}-hero.png`) });
      } else if (route === "/tools" || route === "/map") {
        await page.screenshot({
          path: path.join(output, `${width}-${route.slice(1)}.png`),
        });
      }
      expect(errors).toEqual([]);
    });
  }
}

test("phone preview retains high-resolution imagery on a 3x mobile display", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const image = page.locator(".phone-screen img");
    await image.evaluate((i: HTMLImageElement) => i.decode());
    const source = await image.evaluate((i: HTMLImageElement) => i.currentSrc);
    expect(
      Number(new URL(source).searchParams.get("w")),
    ).toBeGreaterThanOrEqual(1080);
    await page.screenshot({ path: path.join(output, "390-3x-hero.png") });
  } finally {
    await context.close();
  }
});

test("landing CTAs enter workspace and return; FAQ works by keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const summary = page
    .locator("summary")
    .filter({ hasText: "Will my plans appear on all my devices?" });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Not yet. Plans, aircraft profiles", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Check airport weather", exact: false })
    .first()
    .click();
  await expect(page).toHaveURL(/\/map$/);
  await page.getByRole("link", { name: "AV Weather Pilot workspace — back to home" }).click();
  await expect(page.locator("h1")).toContainText("Your preflight workspace.");
});

test("no-JS landing retains all content, disclosure and navigation", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Is this a replacement for ForeFlight?" })
    .click();
  await expect(
    page.getByText("Not today. This is a developing", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Preview notes", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await context.close();
});

test("local plans survive reload and remain local", async ({ page }) => {
  await page.goto("/plan");
  await page.getByLabel("Departure", { exact: true }).fill("KLOU");
  await page.getByLabel("Destination", { exact: true }).fill("KLEX");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await page.getByRole("textbox", { name: /plan name/i }).fill("QA local plan");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("avweather-flightplans")),
    )
    .toContain("QA local plan");
  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem("avweather-flightplans")),
  ).toContain("KLOU");
  await expect(
    page
      .getByText(/Saved plans stay in this browser. No device sync./i)
      .first(),
  ).toBeVisible();
});

test("real METAR search opens airport detail; traffic and radar remain gated", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const forbidden: string[] = [];
  page.on("request", (r) => {
    if (/opensky-network|api\.adsb\.lol|rainviewer/.test(r.url()))
      forbidden.push(r.url());
  });
  await page.goto("/map");
  const search = page.getByRole("textbox", {
    name: "Search airport by ICAO code",
  });
  await expect(search).toBeEnabled();
  await search.fill("KLOU");
  await search.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Airport briefing for KLOU" }),
  ).toBeVisible({ timeout: 25000 });
  await page.getByRole("button", { name: /close airport/i }).click();
  await page.getByRole("button", { name: /^Weather layers/ }).click();
  await page.getByRole("button", { name: "Flights", exact: true }).click();
  await expect(page.getByText(/Traffic remains unavailable until provider permissions/)).toBeVisible();
  await page.getByRole("button", { name: "Radar", exact: true }).click();
  await page.getByRole("button", { name: "Close map layers" }).click();
  await expect(page.getByText(/licensing pending/i)).toBeVisible();
  expect(forbidden).toEqual([]);
  const traffic = await request.get("/api/flights?query=N12345");
  expect(traffic.status()).toBe(503);
});

test("weight-and-balance clearly identifies unverified templates", async ({
  page,
}) => {
  await page.goto("/tools");
  await expect(
    page.getByText(/illustrative.*unverified/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/C172S is not 172N/i)).toBeVisible();
});

test("service worker updates safely and never serves stale operational data offline", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page
    .getByRole("link", { name: "Open workspace", exact: false })
    .first()
    .click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    const r = await fetch("/api/metar?ids=KLOU");
    return { status: r.status, body: await r.json() };
  });
  expect(result.status).toBe(503);
  expect(result.body.offline).toBe(true);
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await context.close();
});

test("installed v2 worker upgrades to v3 without losing local records", async ({
  browser,
  baseURL,
}) => {
  // Isolated loopback origin: real predecessor worker, test-only cache records.
  // All application responses come from the candidate server; no live user data.
  const previousWorker = execFileSync(
    "git",
    ["show", "540eaf2862dfac00e2508db1d7ccfe6221627d8c:public/sw.js"],
    { encoding: "utf8" },
  );
  let usePrevious = true;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === "/sw.js" && usePrevious) {
        res.writeHead(200, {
          "Content-Type": "application/javascript",
          "Cache-Control": "no-store",
        });
        res.end(previousWorker);
        return;
      }
      const upstream = await fetch(new URL(req.url || "/", baseURL!), {
        headers: { Accept: req.headers.accept || "*/*" },
      });
      res.writeHead(upstream.status, {
        "Content-Type":
          upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.writeHead(502);
      res.end("Test proxy could not reach candidate");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .toContain("avweather-shell-v2");
    await page.evaluate(async () => {
      localStorage.setItem(
        "avweather-flightplans",
        JSON.stringify([
          { id: "upgrade-test", name: "Upgrade preservation test" },
        ]),
      );
      await (
        await caches.open("avweather-api-v2")
      ).put(
        "/api/metar?ids=KLOU",
        new Response(JSON.stringify({ fixture: "stale-test-only" })),
      );
      await caches.open("unrelated-origin-cache");
    });
    usePrevious = false;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .toEqual(
        expect.arrayContaining([
          "avweather-shell-v3",
          "unrelated-origin-cache",
        ]),
      );
    // The new shell cache is created during install; cleanup completes on activation.
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toContain("avweather-shell-v2");
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toContain("avweather-api-v2");
    expect(
      await page.evaluate(() => localStorage.getItem("avweather-flightplans")),
    ).toContain("Upgrade preservation test");
    await page.reload();
    await expect(page.locator("h1")).toContainText("Your preflight workspace.");
    await page.goto(`${origin}/map`);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await context.setOffline(true);
    const status = await page.evaluate(
      async () => (await fetch("/api/metar?ids=KLOU")).status,
    );
    expect(status).toBe(503);
  } finally {
    await context.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("metadata, social image, sitemap and installed-app entry are coherent", async ({
  request,
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AV Weather.*Your preflight workspace/);
  expect(
    new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!)
      .href,
  ).toBe("https://aviationweather.vercel.app/");
  const manifest = await (await request.get("/manifest.json")).json();
  expect(manifest.start_url).toBe("/map");
  expect(manifest.id).toBe("/");
  const social = await request.get("/opengraph-image");
  expect(social.status()).toBe(200);
  expect(social.headers()["content-type"]).toContain("image/png");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const route of ["map", "about", "privacy"])
    expect(sitemap).toContain(`https://aviationweather.vercel.app/${route}`);
});

test("reduced-motion mobile content is visible and scroll stays native", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  await page.locator("#questions").scrollIntoViewIfNeeded();
  await expect(page.locator("#questions h2")).toBeInViewport();
});
