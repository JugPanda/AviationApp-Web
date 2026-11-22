import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
const output = process.env.OUTPUT_DIRECTORY || "test-results";

for (const width of [360, 1440]) {
  test(`${width}px product story tabs work with pointer and keyboard`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Explore AV Weather" });
    await expect(tabs.getByRole("tab")).toHaveCount(3);
    const weather = tabs.getByRole("tab", { name: "Weather", exact: true });
    await weather.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      tabs.getByRole("tab", { name: "Planning", exact: true }),
    ).toBeFocused();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await expect(page.getByRole("tabpanel")).toContainText(
      "Illustrative inputs only",
    );
    await expect(
      page
        .getByRole("tabpanel")
        .getByRole("link", { name: "Open the route planner" }),
    ).toHaveAttribute("href", "/plan");
    await page.keyboard.press("End");
    await expect(
      tabs.getByRole("tab", { name: "Pilot tools", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("not current wind");
    await page.keyboard.press("ArrowRight");
    await expect(weather).toBeFocused();
    await tabs.getByRole("tab", { name: "Planning", exact: true }).click();
    const panel = page.getByRole("tabpanel");
    await panel
      .locator("img")
      .evaluate((img: HTMLImageElement) => img.decode());
    if (width === 360)
      expect(
        await panel
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.currentSrc),
      ).toContain("showcase-planning-mobile.webp");
    await expect(
      panel.getByRole("link", { name: /Enlarge capture: planning/ }),
    ).toHaveAttribute("target", "_blank");
    const scan = await new AxeBuilder({ page })
      .include(".product-showcase")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.locator(".product-showcase").screenshot({
      path: path.join(output, `${width}-planning-showcase.png`),
    });
    await tabs.getByRole("tab", { name: "Pilot tools", exact: true }).click();
    await page
      .getByRole("tabpanel")
      .locator("img")
      .evaluate((img: HTMLImageElement) => img.decode());
    await page
      .locator(".product-showcase")
      .screenshot({ path: path.join(output, `${width}-tools-showcase.png`) });
  });
}

test("no-JS product story exposes all captures and links without dead tabs", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".product-showcase-panel")).toHaveCount(3);
  for (const panel of await page.locator(".product-showcase-panel").all())
    await expect(panel).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open the route planner" }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveAttribute("controls", "");
  await expect(page.locator(".walkthrough-steps li")).toHaveCount(3);
  await context.close();
});

test("walkthrough is opt-in, playable, pausable and seekable with captions", async ({
  page,
  request,
}) => {
  const mediaRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("airport-walkthrough.mp4"))
      mediaRequests.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Watch the short tour" }).click();
  const video = page.locator("video");
  await expect(video).toBeInViewport();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await expect(video).not.toHaveAttribute("src");
  await expect(video.locator("source")).toHaveCount(0);
  expect(mediaRequests).toHaveLength(0);
  await page.getByRole("button", { name: "Load recording", exact: true }).click();
  await expect(video).toHaveAttribute("src", "/media/airport-walkthrough.mp4");
  await expect.poll(() => mediaRequests.length).toBeGreaterThan(0);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  const box = await video.boundingBox();
  expect(box).not.toBeNull();
  // Native control keyboard bindings differ in WebKit; use the visible play
  // control verified in both engines, not a programmatic video.play() shortcut.
  await video.click({ position: { x: 24, y: box!.height - 48 } });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0.3);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await video.click({ position: { x: 24, y: box!.height - 48 } });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 10;
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.seeking))
    .toBe(false);
  expect(
    await video.evaluate((v: HTMLVideoElement) => v.currentTime),
  ).toBeCloseTo(10, 0);
  expect(
    await video.evaluate((v: HTMLVideoElement) => v.duration),
  ).toBeGreaterThan(19);
  await page
    .locator(".walkthrough-player")
    .screenshot({ path: path.join(output, "walkthrough-playing.png") });
  await expect(page.locator('track[kind="captions"]')).toHaveAttribute(
    "src",
    "/media/airport-walkthrough.vtt",
  );
  const captions = await request.get("/media/airport-walkthrough.vtt");
  expect(captions.ok()).toBe(true);
  expect(await captions.text()).toContain("Not current flight information");
  await expect(page.locator("video")).not.toHaveAttribute("autoplay");
  await expect(page.locator("video")).not.toHaveAttribute("loop");
});

test("crosswind side labels match entered bearings and disappear for calm wind", async ({
  page,
}) => {
  await page.goto("/tools");
  await page.getByRole("button", { name: "Crosswind", exact: true }).click();
  const inputs = page.locator(".max-w-4xl input");
  await expect(
    page.getByText("knots from right", { exact: true }),
  ).toBeVisible();
  await inputs.nth(1).fill("240");
  await expect(
    page.getByText("knots from left", { exact: true }),
  ).toBeVisible();
  await inputs.nth(2).fill("0");
  await expect(page.getByText(/knots from (left|right)/)).toHaveCount(0);
});

test("feedback is an explicit public GitHub handoff and updates point to shipped commits", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const feedback = page.getByRole("link", { name: "Share feedback on GitHub" });
  await expect(feedback).toHaveAttribute(
    "href",
    "https://github.com/JugPanda/AviationApp-Web/issues/new",
  );
  await expect(
    page.getByText("A GitHub account is required.", { exact: false }),
  ).toBeVisible();
  const response = await request.get(
    "https://github.com/JugPanda/AviationApp-Web/issues/new",
    { maxRedirects: 0 },
  );
  expect([200, 302]).toContain(response.status());
  await expect(page.locator("#updates time")).toHaveCount(2);
  for (const link of await page.locator("#updates a").all()) {
    const url = await link.getAttribute("href");
    expect(url).toMatch(
      /^https:\/\/github.com\/JugPanda\/AviationApp-Web\/commit\/[a-f0-9]{40}$/,
    );
  }
});
