import { describe, expect, it } from 'vitest'
import { approximateCoordinates, approximateMap } from './approximateMap'

describe('privacy-preserving maps', () => {
  it('rounds exact coordinates to a broad grid before creating a URL', () => {
    const exact = { latitude: 48.856612, longitude: 2.352221 }
    const rounded = approximateCoordinates(exact)
    const map = approximateMap(exact)

    expect(rounded).toEqual({ latitude: 48.9, longitude: 2.4 })
    expect(map.latitude).toBe(48.9)
    expect(map.longitude).toBe(2.4)
    expect(map.openUrl).not.toContain('48.856612')
    expect(map.openUrl).not.toContain('2.352221')
    expect(map.openUrl).toContain('/48.9/2.4')
  })

  it('uses a fixed regional zoom and contains no location marker', () => {
    const map = approximateMap({ latitude: 51.451616, longitude: -2.603943 })

    expect(map).toMatchObject({ latitude: 51.5, longitude: -2.6 })
    expect(map.openUrl).toContain('#map=8/')
    expect(map.openUrl).not.toContain('marker')
  })
})
