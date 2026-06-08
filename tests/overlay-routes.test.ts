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

  it('returns live TFRs when the FAA geoserver responds with GeoJSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      json: vi.fn().mockResolvedValue({
        features: [
          {
            id: 'V_TFR_LOC.1',
            geometry: {
              type: 'Polygon',
              coordinates: [[[-83, 40], [-82.9, 40], [-82.9, 40.1], [-83, 40]]],
            },
            properties: {
              NOTAM_KEY: '6/4112-1-FDC-F',
              TITLE: 'COLUMBUS, OH, Monday, June 1, 2026 through Monday, July 20, 2026 Local',
              CNS_LOCATION_ID: 'ZID',
              STATE: 'OH',
              LEGAL: 'SECURITY',
              LAST_MODIFICATION_DATETIME: '202605291056',
            },
          },
        ],
      }),
    }))

    const response = await getTfrs(new NextRequest('http://localhost/api/tfr'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('live')
    expect(body.items).toHaveLength(1)
    expect(body.items[0].notamNumber).toBe('6/4112-1-FDC-F')
    expect(body.items[0].state).toBe('OH')
    expect(body.items[0].coordinates.type).toBe('polygon')
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
