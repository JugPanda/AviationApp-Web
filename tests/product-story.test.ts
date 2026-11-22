import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read = (path: string) => fs.readFileSync(path, "utf8").replace(/\s+/g, " ");
describe("truthful product story", () => {
  it("states a specific browser use case rather than replacing the incumbent", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("Your preflight workspace.");
    expect(page).toContain("On the device you have.");
    expect(page).toContain("ForeFlight already does a lot well.");
    expect(page).toContain("Check airport weather");
  });
  it("labels all three real captures without implying validated route or wind data", () => {
    const page = read("src/app/page.tsx");
    for (const name of ["weather", "planning", "tools"])
      expect(
        fs.statSync(`public/images/showcase-${name}.webp`).size,
      ).toBeGreaterThan(1000);
    expect(page).toContain("not an actual route or aircraft record");
    expect(page).toContain("not current wind or aircraft limits");
    expect(page).toContain(
      "without assuming your data automatically moves between them",
    );
  });
  it("keeps video opt-in with captions and plain-text steps", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain('preload="none"');
    expect(page).not.toMatch(/autoPlay|autoplay|<video[^>]*loop/);
    expect(page).toContain('kind="captions"');
    expect(page).toContain('className="walkthrough-steps"');
    expect(
      fs.statSync("public/media/airport-walkthrough.mp4").size,
    ).toBeLessThan(5_000_000);
  });
  it("links genuine feedback and historical release evidence, without collecting private records", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("Reports are public");
    expect(page).not.toContain("<form");
    expect(page).toContain("4158630b7e0ca5dd792cef829908d230636b30cc");
    expect(page).toContain("3311c1c614e7abf8def28b3efa5667b7edd35614");
  });
});
