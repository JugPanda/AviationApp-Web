import { describe, expect, it } from 'vitest'
import type { FlightData } from '@/components/FlightMarkers'
import {
  findBestTrackedFlight,
  getFlightDisplayLabel,
  getFlightSearchCandidates,
  getFlightSearchHint,
  getTrackedRefreshQuery,
  isFlightTracked,
  looksLikeIcaoHex,
  normalizeFlightIdentifier,
} from '@/lib/flight-tracking'

const flights: FlightData[] = [
  {
    icao24: 'abc123',
    callsign: 'UAL1236 ',
    registration: 'N123AB',
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
    registration: 'G-KELS',
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

  it('matches tail numbers before falling back to callsigns', () => {
    const best = findBestTrackedFlight('gkels', flights)
    expect(best?.icao24).toBe('def456')
  })

  it('matches tracked flights by icao24, tail number, or normalized callsign', () => {
    expect(isFlightTracked(flights[0], 'abc123')).toBe(true)
    expect(isFlightTracked(flights[0], 'n123ab')).toBe(true)
    expect(isFlightTracked(flights[0], 'ual1236')).toBe(true)
    expect(isFlightTracked(flights[1], 'UAL1236')).toBe(false)
  })

  it('keeps polling scoped to the tracked hex when available', () => {
    expect(getTrackedRefreshQuery(flights[0])).toBe('ABC123')
    expect(getTrackedRefreshQuery(null)).toBeNull()
  })

  it('builds flexible search candidates and hints for registrations', () => {
    expect(getFlightSearchCandidates('gkels')).toContain('G-KELS')
    expect(getFlightSearchCandidates('cgabc')).toEqual(['CGABC', 'C-GABC', 'CG-ABC'])
    expect(getFlightSearchHint('gkels')).toContain('G-KELS')
  })

  it('detects hex searches and prefers registration as the display label', () => {
    expect(looksLikeIcaoHex('a76546')).toBe(true)
    expect(getFlightDisplayLabel(flights[0])).toBe('N123AB')
  })
})
