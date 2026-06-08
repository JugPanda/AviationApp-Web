import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  BRIEFING_EXPIRED_AFTER_MS,
  BRIEFING_STALE_AFTER_MS,
  formatCacheAge,
  getCacheAgeMs,
  getCacheFreshness,
} from '@/lib/cache-freshness'

afterEach(() => {
  vi.useRealTimers()
})

describe('cache freshness helpers', () => {
  it('treats missing timestamps as unknown', () => {
    expect(getCacheAgeMs(null)).toBeNull()
    expect(getCacheFreshness(null)).toBe('unknown')
    expect(formatCacheAge(null)).toBe('Cache time unknown')
  })

  it('classifies fresh, stale, and expired cache windows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'))

    const freshAt = Date.now() - 5 * 60 * 1000
    const staleAt = Date.now() - BRIEFING_STALE_AFTER_MS - 1000
    const expiredAt = Date.now() - BRIEFING_EXPIRED_AFTER_MS - 1000

    expect(getCacheFreshness(freshAt)).toBe('fresh')
    expect(getCacheFreshness(staleAt)).toBe('stale')
    expect(getCacheFreshness(expiredAt)).toBe('expired')
  })

  it('formats readable relative ages', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'))

    expect(formatCacheAge(Date.now() - 10 * 1000)).toBe('Updated just now')
    expect(formatCacheAge(Date.now() - 12 * 60 * 1000)).toBe('Updated 12m ago')
    expect(formatCacheAge(Date.now() - 2 * 60 * 60 * 1000)).toBe('Updated 2h ago')
    expect(formatCacheAge(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('Updated 2d ago')
  })
})
