import type { FlightData } from '@/components/FlightMarkers'

export function normalizeFlightIdentifier(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

export function isFlightTracked(flight: FlightData, trackedFlightId: string | null): boolean {
  const tracked = normalizeFlightIdentifier(trackedFlightId)
  if (!tracked) {
    return false
  }

  return normalizeFlightIdentifier(flight.icao24) === tracked
    || normalizeFlightIdentifier(flight.callsign) === tracked
}

export function findBestTrackedFlight(query: string, flights: FlightData[]): FlightData | null {
  const normalizedQuery = normalizeFlightIdentifier(query)
  if (!normalizedQuery) {
    return null
  }

  const exactCallsign = flights.find((flight) => normalizeFlightIdentifier(flight.callsign) === normalizedQuery)
  if (exactCallsign) {
    return exactCallsign
  }

  const exactIcao = flights.find((flight) => normalizeFlightIdentifier(flight.icao24) === normalizedQuery)
  if (exactIcao) {
    return exactIcao
  }

  const partialCallsign = flights.find((flight) => normalizeFlightIdentifier(flight.callsign).includes(normalizedQuery))
  if (partialCallsign) {
    return partialCallsign
  }

  const partialIcao = flights.find((flight) => normalizeFlightIdentifier(flight.icao24).includes(normalizedQuery))
  return partialIcao ?? null
}

export function getTrackedRefreshQuery(flight: FlightData | null): string | null {
  if (!flight) {
    return null
  }

  const callsign = normalizeFlightIdentifier(flight.callsign)
  return callsign || normalizeFlightIdentifier(flight.icao24) || null
}
