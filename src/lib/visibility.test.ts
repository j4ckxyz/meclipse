import { describe, expect, it } from 'vitest'
import { visibilityGrid, visibilityScore } from './visibility'

describe('local visibility outlook', () => {
  it('creates an evenly distributed 25-point area around a location', () => {
    const points = visibilityGrid(48.8566, 2.3522)

    expect(points).toHaveLength(25)
    expect(points[12]).toEqual({ latitude: 48.8566, longitude: 2.3522 })
    expect(new Set(points.map((point) => point.latitude))).toHaveLength(5)
    expect(new Set(points.map((point) => point.longitude))).toHaveLength(5)
  })

  it('strongly favours clear skies while giving higher ground a modest bonus', () => {
    const clearHill = visibilityScore(10, 5, 800, 800)
    const cloudyMountain = visibilityScore(90, 20, 800, 800)
    const clearLowland = visibilityScore(10, 5, 0, 800)

    expect(clearHill).toBeGreaterThan(cloudyMountain)
    expect(clearHill).toBeGreaterThan(clearLowland)
    expect(visibilityScore(100, 100, 0, 0)).toBe(0)
  })
})
