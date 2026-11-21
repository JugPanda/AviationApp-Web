import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { GET } from "@/app/api/flights/route";
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("premium preview boundaries", () => {
  it("keeps the marketing page server rendered and map at its own route", () => {
    expect(read("src/app/page.tsx")).not.toContain("'use client'");
    expect(read("src/app/page.tsx")).toContain('href="/map"');
    expect(read("src/app/map/page.tsx")).toContain("MapWrapper");
    expect(JSON.parse(read("public/manifest.json")).start_url).toBe("/map");
    expect(JSON.parse(read("public/manifest.json")).id).toBe("/");
  });
  it("states storage, operational and future-feature limitations", () => {
    const home = read("src/app/page.tsx");
    for (const phrase of [
      "They do not automatically sync",
      "illustrative templates",
      "not available features",
      "not current flight information",
      "not a full EFB",
    ])
      expect(home).toContain(phrase);
    expect(read("src/app/layout.tsx")).not.toContain("maximumScale");
  });
  it("preserves existing local storage keys", () => {
    expect(read("src/app/plan/page.tsx")).toContain("'avweather-flightplans'");
    expect(read("src/app/logbook/page.tsx")).toContain("'avweather-logbook'");
    expect(read("src/components/tools/WeightBalance.tsx")).toContain(
      "wb-${aircraftId}",
    );
  });
  it("does not contact traffic providers without explicit permission configuration", async () => {
    vi.stubEnv("ENABLE_LICENSED_TRAFFIC", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(
      new Request("http://localhost/api/flights?query=N12345"),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe("unavailable");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("has no new account, checkout, collection form or fabricated proof", () => {
    const home = read("src/app/page.tsx");
    expect(home).not.toMatch(
      /<form|Trusted by \d|FAA.certified|Join \d+ pilots/,
    );
    expect(home).toContain("No account required");
  });
});

describe("production worker regression", () => {
  function worker(fetcher: typeof fetch) {
    const listeners: Record<string, (event: unknown) => void> = {};
    const cache = { match: vi.fn(), put: vi.fn(), addAll: vi.fn() };
    const caches = {
      open: vi.fn().mockResolvedValue(cache),
      keys: vi
        .fn()
        .mockResolvedValue([
          "avweather-shell-v2",
          "avweather-api-v2",
          "another-app",
        ]),
      delete: vi.fn(),
    };
    const self = {
      location: { origin: "https://example.com" },
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        listeners[name] = handler;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    };
    vm.runInNewContext(read("public/sw.js"), {
      self,
      caches,
      fetch: fetcher,
      URL,
      Response,
    });
    return { listeners, caches, cache };
  }
  it("returns unavailable offline rather than replaying a stale weather response", async () => {
    const w = worker(vi.fn().mockRejectedValue(new Error("offline")));
    let pending!: Promise<Response>;
    w.listeners.fetch({
      request: new Request("https://example.com/api/metar"),
      respondWith: (p: Promise<Response>) => {
        pending = p;
      },
    });
    const response = await pending;
    expect(response.status).toBe(503);
    expect((await response.json()).offline).toBe(true);
    expect(w.cache.match).not.toHaveBeenCalled();
  });
  it("never stores RSC responses as HTML pages", () => {
    const w = worker(vi.fn());
    const respondWith = vi.fn();
    w.listeners.fetch({
      request: new Request("https://example.com/map?_rsc=token", {
        headers: { RSC: "1" },
      }),
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  });
  it("removes old AV Weather caches without deleting unrelated origin caches", async () => {
    const w = worker(vi.fn());
    let pending!: Promise<void>;
    w.listeners.activate({
      waitUntil: (p: Promise<void>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.caches.delete.mock.calls).toEqual([
      ["avweather-shell-v2"],
      ["avweather-api-v2"],
    ]);
  });
});
