import type { FlightData } from '@/components/FlightMarkers'

export function normalizeFlightIdentifier(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

export function looksLikeIcaoHex(value: string | null | undefined): boolean {
  return /^[A-F0-9]{6}$/.test(normalizeFlightIdentifier(value))
}

export function getFlightSearchCandidates(value: string | null | undefined): string[] {
  const normalized = normalizeFlightIdentifier(value)
  if (!normalized) {
    return []
  }

  const candidates = new Set<string>([normalized])

  if (normalized.includes('-')) {
    candidates.add(normalized.replace(/-/g, ''))
    return [...candidates]
  }

  if (!normalized.startsWith('N') && /^[A-Z][A-Z0-9]{4,5}$/.test(normalized)) {
    candidates.add(`${normalized[0]}-${normalized.slice(1)}`)
  }

  if (!normalized.startsWith('N') && /^[A-Z]{2}[A-Z0-9]{3,4}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 2)}-${normalized.slice(2)}`)
  }

  return [...candidates]
}

export function getFlightSearchHint(value: string | null | undefined): string {
  const normalized = normalizeFlightIdentifier(value)
  if (!normalized) {
    return 'Search by tail number, callsign, or 6-character ICAO hex. Case and spaces are normalized automatically.'
  }

  if (looksLikeIcaoHex(normalized)) {
    return `${normalized} looks like an ICAO hex code.`
  }

  if (/^N[1-9][A-HJ-NP-Z0-9]{0,5}$/.test(normalized)) {
    return `${normalized} looks like a US tail number.`
  }

  if (!normalized.includes('-') && /^[A-Z][A-Z0-9]{4,5}$/.test(normalized) && !normalized.startsWith('N')) {
    return `If this registration is painted with a hyphen, also try ${normalized[0]}-${normalized.slice(1)}.`
  }

  if (!normalized.includes('-') && /^[A-Z]{2}[A-Z0-9]{3,4}$/.test(normalized)) {
    return `If this registration uses a prefix hyphen, also try ${normalized.slice(0, 2)}-${normalized.slice(2)}.`
  }

  return 'Use the painted tail number, the live callsign, or the aircraft hex code.'
}

export function getFlightDisplayLabel(flight: FlightData | null): string | null {
  if (!flight) {
    return null
  }

  return normalizeFlightIdentifier(flight.registration)
    || normalizeFlightIdentifier(flight.callsign)
    || normalizeFlightIdentifier(flight.icao24)
    || null
}

export function isFlightTracked(flight: FlightData, trackedFlightId: string | null): boolean {
  const tracked = normalizeFlightIdentifier(trackedFlightId)
  if (!tracked) {
    return false
  }

  return normalizeFlightIdentifier(flight.icao24) === tracked
    || normalizeFlightIdentifier(flight.registration) === tracked
    || normalizeFlightIdentifier(flight.callsign) === tracked
}

export function findBestTrackedFlight(query: string, flights: FlightData[]): FlightData | null {
  const normalizedQuery = normalizeFlightIdentifier(query)
  if (!normalizedQuery) {
    return null
  }

  const queryCandidates = getFlightSearchCandidates(normalizedQuery)
  const matchesAnyCandidate = (value: string | null | undefined) => {
    const normalizedValue = normalizeFlightIdentifier(value)
    return queryCandidates.some((candidate) => normalizedValue === candidate)
  }
  const includesAnyCandidate = (value: string | null | undefined) => {
    const normalizedValue = normalizeFlightIdentifier(value)
    return queryCandidates.some((candidate) => normalizedValue.includes(candidate) || candidate.includes(normalizedValue))
  }

  const exactRegistration = flights.find((flight) => matchesAnyCandidate(flight.registration))
  if (exactRegistration) {
    return exactRegistration
  }

  const exactCallsign = flights.find((flight) => matchesAnyCandidate(flight.callsign))
  if (exactCallsign) {
    return exactCallsign
  }

  const exactIcao = flights.find((flight) => matchesAnyCandidate(flight.icao24))
  if (exactIcao) {
    return exactIcao
  }

  const partialRegistration = flights.find((flight) => includesAnyCandidate(flight.registration))
  if (partialRegistration) {
    return partialRegistration
  }

  const partialCallsign = flights.find((flight) => includesAnyCandidate(flight.callsign))
  if (partialCallsign) {
    return partialCallsign
  }

  const partialIcao = flights.find((flight) => includesAnyCandidate(flight.icao24))
  return partialIcao ?? null
}

export function getTrackedRefreshQuery(flight: FlightData | null): string | null {
  if (!flight) {
    return null
  }

  return normalizeFlightIdentifier(flight.icao24)
    || normalizeFlightIdentifier(flight.registration)
    || normalizeFlightIdentifier(flight.callsign)
    || null
}
