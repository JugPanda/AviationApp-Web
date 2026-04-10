export interface CrosswindCalculationInput {
  runwayHeading: number;
  windDirection: number;
  windSpeed: number;
  gustSpeed?: number | null;
}

export interface CrosswindCalculationResult {
  angleDiff: number;
  crosswind: number;
  headwind: number;
  tailwind: number;
  gustCrosswind: number;
  gustHeadwind: number;
  gustTailwind: number;
  isHeadwind: boolean;
  windFromLeft: boolean;
  maxCrosswind: number;
  effectiveGustSpeed: number | null;
  limits: {
    student: number;
    private: number;
    commercial: number;
    transport: number;
  };
  exceedsStudent: boolean;
  exceedsPrivate: boolean;
  exceedsCommercial: boolean;
}

export function calculateCrosswind({
  runwayHeading,
  windDirection,
  windSpeed,
  gustSpeed,
}: CrosswindCalculationInput): CrosswindCalculationResult {
  let angleDiff = windDirection - runwayHeading;

  while (angleDiff > 180) angleDiff -= 360;
  while (angleDiff < -180) angleDiff += 360;

  const angleRad = Math.abs(angleDiff) * (Math.PI / 180);
  const crosswind = Math.abs(windSpeed * Math.sin(angleRad));
  const headwindComponent = windSpeed * Math.cos(angleRad);
  const isHeadwind = Math.abs(angleDiff) <= 90;
  const headwind = isHeadwind ? headwindComponent : 0;
  const tailwind = isHeadwind ? 0 : Math.abs(headwindComponent);

  const effectiveGustSpeed = typeof gustSpeed === 'number' && gustSpeed > windSpeed ? gustSpeed : null;
  const gustCrosswind = effectiveGustSpeed ? Math.abs(effectiveGustSpeed * Math.sin(angleRad)) : 0;
  const gustHeadwindComponent = effectiveGustSpeed ? effectiveGustSpeed * Math.cos(angleRad) : 0;
  const gustHeadwind = effectiveGustSpeed && isHeadwind ? gustHeadwindComponent : 0;
  const gustTailwind = effectiveGustSpeed && !isHeadwind ? Math.abs(gustHeadwindComponent) : 0;

  const limits = {
    student: 7,
    private: 12,
    commercial: 15,
    transport: 20,
  };

  const roundedCrosswind = Math.round(crosswind * 10) / 10;
  const roundedHeadwind = Math.round(headwind * 10) / 10;
  const roundedTailwind = Math.round(tailwind * 10) / 10;
  const roundedGustCrosswind = Math.round(gustCrosswind * 10) / 10;
  const roundedGustHeadwind = Math.round(gustHeadwind * 10) / 10;
  const roundedGustTailwind = Math.round(gustTailwind * 10) / 10;
  const maxCrosswind = effectiveGustSpeed ? roundedGustCrosswind : roundedCrosswind;

  return {
    angleDiff,
    crosswind: roundedCrosswind,
    headwind: roundedHeadwind,
    tailwind: roundedTailwind,
    gustCrosswind: roundedGustCrosswind,
    gustHeadwind: roundedGustHeadwind,
    gustTailwind: roundedGustTailwind,
    isHeadwind,
    windFromLeft: angleDiff > 0,
    maxCrosswind,
    effectiveGustSpeed,
    limits,
    exceedsStudent: maxCrosswind > limits.student,
    exceedsPrivate: maxCrosswind > limits.private,
    exceedsCommercial: maxCrosswind > limits.commercial,
  };
}