import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET as getPireps } from '@/app/api/pirep/route'
import { GET as getSigmets } from '@/app/api/sigmet/route'
import { GET as getTfrs } from '@/app/api/tfr/route'

describe('overlay route degraded-state responses', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a 503 envelope for TFRs when the upstream feed fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockResolvedValue({}),
    }))

    const response = await getTfrs(new NextRequest('http://localhost/api/tfr'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('unavailable')
    expect(body.items).toEqual([])
    expect(body.message).toContain('official FAA briefing source')
    expect(JSON.stringify(body)).not.toContain('TFR-DEMO')
  })

  it('returns a 503 envelope for PIREPs when the upstream feed is non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({}),
    }))

    const response = await getPireps(new NextRequest('http://localhost/api/pirep?hours=3'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('unavailable')
    expect(body.items).toEqual([])
    expect(body.message).toContain('official briefing source')
    expect(JSON.stringify(body)).not.toContain('pirep-demo')
  })

  it('returns a 503 envelope for SIGMETs when every upstream request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const response = await getSigmets(new NextRequest('http://localhost/api/sigmet?type=all'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('unavailable')
    expect(body.items).toEqual([])
    expect(body.message).toContain('official briefing source')
    expect(JSON.stringify(body)).not.toContain('airmet-')
  })
})
