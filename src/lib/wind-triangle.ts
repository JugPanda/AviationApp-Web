export type WindTriangle =
  | { ok: false; error: string }
  | { ok: true; trueHeading: number; windCorrectionAngle: number; groundSpeed: number; crosswindComponent: number; headwindComponent: number; isHeadwind: boolean };

export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/** True course and wind FROM direction in degrees; all speeds in knots.
 * Returns the forward-air-vector solution only, with positive track progress.
 * Do not clamp an impossible triangle into an apparently usable solution.
 */
export function solveWindTriangle(trueCourse: number, tas: number, windDirection: number, windSpeed: number): WindTriangle {
  if (![trueCourse, tas, windDirection, windSpeed].every(Number.isFinite) || tas <= 0 || windSpeed < 0 || trueCourse < 0 || trueCourse > 360 || windDirection < 0 || windDirection > 360) {
    return { ok: false, error: 'Enter a positive true airspeed, nonnegative wind speed and directions from 0° to 360°.' };
  }
  const angle = (windDirection - trueCourse) * Math.PI / 180;
  const crosswind = windSpeed * Math.sin(angle);
  const headwind = windSpeed * Math.cos(angle);
  if (Math.abs(crosswind) > tas) {
    return { ok: false, error: 'No wind solution: crosswind exceeds true airspeed. Check the course, wind and TAS.' };
  }
  const wca = Math.asin(crosswind / tas) * 180 / Math.PI;
  // sqrt avoids a spurious positive cos(π/2) at the exact crosswind limit.
  const forwardAirspeed = Math.sqrt(Math.max(0, tas * tas - crosswind * crosswind));
  const groundSpeed = forwardAirspeed - headwind;
  if (!Number.isFinite(groundSpeed) || groundSpeed <= 1e-9) {
    return { ok: false, error: 'No wind solution: groundspeed is zero or negative. Check the course, wind and TAS.' };
  }
  return {
    ok: true,
    trueHeading: normalizeHeading(trueCourse + wca),
    windCorrectionAngle: wca,
    groundSpeed,
    crosswindComponent: Math.abs(crosswind),
    headwindComponent: headwind,
    isHeadwind: headwind > 0,
  };
}
