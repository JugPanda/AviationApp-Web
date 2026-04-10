import { describe, expect, it } from 'vitest'

import { calculateCrosswind } from '@/lib/crosswind'

describe('calculateCrosswind', () => {
  it('ignores gust values that are not greater than the steady wind', () => {
    const result = calculateCrosswind({
      runwayHeading: 270,
      windDirection: 300,
      windSpeed: 15,
      gustSpeed: 10,
    })

    expect(result.effectiveGustSpeed).toBeNull()
    expect(result.crosswind).toBe(7.5)
    expect(result.maxCrosswind).toBe(7.5)
    expect(result.exceedsStudent).toBe(true)
  })

  it('uses the gust value when it is higher than the steady wind', () => {
    const result = calculateCrosswind({
      runwayHeading: 270,
      windDirection: 300,
      windSpeed: 15,
      gustSpeed: 25,
    })

    expect(result.effectiveGustSpeed).toBe(25)
    expect(result.gustCrosswind).toBe(12.5)
    expect(result.maxCrosswind).toBe(12.5)
    expect(result.exceedsPrivate).toBe(true)
  })
})