export type OverlayResponseStatus = 'live' | 'unavailable'

export interface OverlayResponse<T> {
  items: T[]
  status: OverlayResponseStatus
  updatedAt: string
  message?: string
}

export function buildLiveOverlayResponse<T>(items: T[]): OverlayResponse<T> {
  return {
    items,
    status: 'live',
    updatedAt: new Date().toISOString(),
  }
}

export function buildUnavailableOverlayResponse<T>(message: string): OverlayResponse<T> {
  return {
    items: [],
    status: 'unavailable',
    message,
    updatedAt: new Date().toISOString(),
  }
}

export function isOverlayResponse<T>(value: unknown): value is OverlayResponse<T> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<OverlayResponse<T>>
  return Array.isArray(candidate.items) && typeof candidate.status === 'string' && typeof candidate.updatedAt === 'string'
}
