import { describe, expect, it } from 'vitest'
import type { FlightData } from '@/components/FlightMarkers'
import {
  findBestTrackedFlight,
  getTrackedRefreshQuery,
  isFlightTracked,
  normalizeFlightIdentifier,
} from '@/lib/flight-tracking'

const flights: FlightData[] = [
  {
    icao24: 'abc123',
    callsign: 'UAL1236 ',
    originCountry: 'United States',
    longitude: -84.5,
    latitude: 38.0,
    altitude: 10000,
    velocity: 200,
    heading: 180,
    verticalRate: 0,
    onGround: false,
    lastUpdate: 123,
  },
  {
    icao24: 'def456',
    callsign: 'AAL555',
    originCountry: 'United States',
    longitude: -85.0,
    latitude: 39.0,
    altitude: 12000,
    velocity: 210,
    heading: 190,
    verticalRate: 100,
    onGround: false,
    lastUpdate: 124,
  },
]

describe('flight tracking helpers', () => {
  it('normalizes callsigns for reliable matching', () => {
    expect(normalizeFlightIdentifier(' ual1236 ')).toBe('UAL1236')
    expect(normalizeFlightIdentifier('')).toBe('')
    expect(normalizeFlightIdentifier(null)).toBe('')
  })

  it('finds a best tracked flight from partial search results', () => {
    const best = findBestTrackedFlight('UAL123', flights)
    expect(best?.icao24).toBe('abc123')
  })

  it('matches tracked flights by icao24 or normalized callsign', () => {
    expect(isFlightTracked(flights[0], 'abc123')).toBe(true)
    expect(isFlightTracked(flights[0], 'ual1236')).toBe(true)
    expect(isFlightTracked(flights[1], 'UAL1236')).toBe(false)
  })

  it('keeps polling scoped to the tracked callsign when available', () => {
    expect(getTrackedRefreshQuery(flights[0])).toBe('UAL1236')
    expect(getTrackedRefreshQuery(null)).toBeNull()
  })
})
