import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import WalkthroughPlayer from "@/components/WalkthroughPlayer";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("walkthrough opt-in resource boundary", () => {
  it("server-renders a source-free poster and a usable download without JavaScript", () => {
    container.innerHTML = renderToStaticMarkup(createElement(WalkthroughPlayer));
    const video = container.querySelector("video")!;
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.querySelector("source")).toBeNull();
    expect(video.getAttribute("poster")).toBe("/images/walkthrough-poster.webp");
    expect(video.getAttribute("width")).toBe("1280");
    expect(video.getAttribute("height")).toBe("864");
    expect(video.controls).toBe(true);
    expect(container.querySelector("button")!.disabled).toBe(true);
    expect(container.querySelector("a[download]")!.getAttribute("href"))
      .toBe("/media/airport-walkthrough.mp4");
    expect(container.querySelector("noscript")!.textContent).toContain("read the steps below");
    container.innerHTML = "";
  });

  it("keeps hydration source-free and attaches media only on explicit activation", async () => {
    await act(async () => root.render(createElement(WalkthroughPlayer)));
    const video = container.querySelector("video")!;
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.querySelector("source")).toBeNull();
    expect(video.querySelector("track")).toBeNull();
    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(video.getAttribute("src")).toBe("/media/airport-walkthrough.mp4");
    expect(video.querySelector('track[kind="captions"]')!.getAttribute("src"))
      .toBe("/media/airport-walkthrough.vtt");
    expect(video.paused).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.loop).toBe(false);
    expect(document.activeElement).toBe(video);
    expect(container.querySelector("button")).toBeNull();
  });

  it("exposes a visible failure message and download outside the native player", async () => {
    await act(async () => root.render(createElement(WalkthroughPlayer)));
    await act(async () => container.querySelector("button")!.click());
    await act(async () => container.querySelector("video")!.dispatchEvent(new Event("error")));
    const status = container.querySelector('[role="status"]')!;
    expect(status.textContent).toContain("could not be loaded");
    expect(status.closest("video")).toBeNull();
    expect(container.querySelector("a[download]")!.closest("video")).toBeNull();
  });
});
