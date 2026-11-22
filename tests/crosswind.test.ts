import { describe, expect, it } from "vitest";

import { calculateCrosswind } from "@/lib/crosswind";

describe("calculateCrosswind", () => {
  it.each([
    { runwayHeading: 270, windDirection: 300, windFromLeft: false },
    { runwayHeading: 0, windDirection: 90, windFromLeft: false },
    { runwayHeading: 90, windDirection: 0, windFromLeft: true },
    { runwayHeading: 350, windDirection: 10, windFromLeft: false },
    { runwayHeading: 10, windDirection: 350, windFromLeft: true },
  ])(
    "reports the correct wind side for runway $runwayHeading and wind from $windDirection",
    ({ runwayHeading, windDirection, windFromLeft }) => {
      // Bearings increase clockwise: a positive relative bearing is to the right.
      const result = calculateCrosswind({
        runwayHeading,
        windDirection,
        windSpeed: 15,
      });
      expect(result.windFromLeft).toBe(windFromLeft);
    },
  );
  it("ignores gust values that are not greater than the steady wind", () => {
    const result = calculateCrosswind({
      runwayHeading: 270,
      windDirection: 300,
      windSpeed: 15,
      gustSpeed: 10,
    });

    expect(result.effectiveGustSpeed).toBeNull();
    expect(result.crosswind).toBe(7.5);
    expect(result.maxCrosswind).toBe(7.5);
    expect(result.exceedsStudent).toBe(true);
  });

  it("uses the gust value when it is higher than the steady wind", () => {
    const result = calculateCrosswind({
      runwayHeading: 270,
      windDirection: 300,
      windSpeed: 15,
      gustSpeed: 25,
    });

    expect(result.effectiveGustSpeed).toBe(25);
    expect(result.gustCrosswind).toBe(12.5);
    expect(result.maxCrosswind).toBe(12.5);
    expect(result.exceedsPrivate).toBe(true);
  });
});
