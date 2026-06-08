export const BRIEFING_STALE_AFTER_MS = 30 * 60 * 1000
export const BRIEFING_EXPIRED_AFTER_MS = 6 * 60 * 60 * 1000

export type CacheFreshness = 'fresh' | 'stale' | 'expired' | 'unknown'

export function getCacheAgeMs(cachedAt?: number | null): number | null {
  if (!cachedAt || Number.isNaN(cachedAt)) {
    return null
  }

  const age = Date.now() - cachedAt
  return age >= 0 ? age : 0
}

export function getCacheFreshness(cachedAt?: number | null): CacheFreshness {
  const age = getCacheAgeMs(cachedAt)
  if (age == null) {
    return 'unknown'
  }
  if (age >= BRIEFING_EXPIRED_AFTER_MS) {
    return 'expired'
  }
  if (age >= BRIEFING_STALE_AFTER_MS) {
    return 'stale'
  }
  return 'fresh'
}

export function formatCacheAge(cachedAt?: number | null): string {
  const age = getCacheAgeMs(cachedAt)
  if (age == null) {
    return 'Cache time unknown'
  }

  const minutes = Math.round(age / 60000)
  if (minutes < 1) {
    return 'Updated just now'
  }
  if (minutes < 60) {
    return `Updated ${minutes}m ago`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `Updated ${hours}h ago`
  }

  const days = Math.round(hours / 24)
  return `Updated ${days}d ago`
}
