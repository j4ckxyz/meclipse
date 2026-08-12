import { describe, expect, it } from 'vitest'
import { EclipseKind } from 'astronomy-engine'
import { eclipseStatus, findUpcomingEclipse } from './eclipse'

describe('eclipse availability', () => {
  it('confirms the 12 August 2026 eclipse in Paris during 19:00–20:00 local time', () => {
    const now = new Date('2026-08-12T17:30:00Z') // 19:30 CEST
    const result = findUpcomingEclipse({ latitude: 48.8566, longitude: 2.3522 }, now)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe(EclipseKind.Partial)
    expect(result?.coverage).toBeCloseTo(0.92, 1)
    expect(result?.timeZone).toBe('Europe/Paris')
    expect(eclipseStatus(result!, now)).toBe('Happening now')
  })

  it('reports no nearby event outside the two-week window', () => {
    expect(findUpcomingEclipse(
      { latitude: 48.8566, longitude: 2.3522 },
      new Date('2026-09-15T12:00:00Z'),
    )).toBeNull()
  })

  it('finds totality in northern Spain', () => {
    const result = findUpcomingEclipse(
      { latitude: 43.36, longitude: -5.85 },
      new Date('2026-08-01T12:00:00Z'),
    )
    expect(result?.kind).toBe(EclipseKind.Total)
    expect(result?.coverage).toBe(1)
  })

  it('clips a sunset eclipse to its visible portion and does not report below-horizon totality', () => {
    const result = findUpcomingEclipse(
      { latitude: 36.8065, longitude: 10.1815 },
      new Date('2026-08-01T00:00:00Z'),
    )

    expect(result?.kind).toBe(EclipseKind.Partial)
    expect(result?.coverage).toBeCloseTo(0.47, 2)
    expect(result?.peakAltitude).toBeGreaterThan(0)
    expect(result?.peak.getTime()).toBeLessThan(result!.ends.getTime())
    expect(result?.ends.toISOString()).toBe('2026-08-12T18:14:15.114Z')
  })
})
