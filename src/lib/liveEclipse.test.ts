import { describe, expect, it } from 'vitest'
import { findUpcomingEclipse } from './eclipse'
import { calculateLiveEclipse, countdownParts, eclipseCountdown, formatCountdown, nextLiveMilestone } from './liveEclipse'

const paris = { latitude: 48.8566, longitude: 2.3522 }
const result = findUpcomingEclipse(paris, new Date('2026-08-12T12:00:00Z'))!

describe('live eclipse calculation', () => {
  it('calculates real topocentric coverage at maximum in Paris', () => {
    const state = calculateLiveEclipse(result, paris, result.peak)
    expect(state.active).toBe(true)
    expect(state.coverage).toBeCloseTo(result.coverage, 2)
    expect(state.offsetPercent).toBeLessThan(0)
  })

  it('moves the Moon across the Sun between contacts', () => {
    const before = calculateLiveEclipse(result, paris, new Date(result.begins.getTime() - 1_000))
    const building = calculateLiveEclipse(result, paris, new Date('2026-08-12T17:45:00Z'))
    const receding = calculateLiveEclipse(result, paris, new Date('2026-08-12T18:45:00Z'))
    const after = calculateLiveEclipse(result, paris, new Date(result.ends.getTime() + 1_000))

    expect(before.offsetPercent).toBe(-108)
    expect(building.coverage).toBeCloseTo(0.3, 1)
    expect(building.offsetPercent).toBeLessThan(0)
    expect(receding.offsetPercent).toBeGreaterThan(0)
    expect(after.offsetPercent).toBe(108)
  })

  it('names the next contact and formats its countdown', () => {
    const now = new Date(result.begins.getTime() + 1_000)
    expect(nextLiveMilestone(result, now)?.label).toBe('Maximum')
    expect(formatCountdown(125_000)).toBe('2:05')
  })


  it('counts through start, maximum, end, and completion', () => {
    expect(eclipseCountdown(result, new Date(result.begins.getTime() - 1_000)).phase).toBe('begins')
    expect(eclipseCountdown(result, new Date(result.begins.getTime() + 1_000)).phase).toBe('maximum')
    expect(eclipseCountdown(result, new Date(result.peak.getTime() + 1_000)).phase).toBe('ends')
    expect(eclipseCountdown(result, result.ends).phase).toBe('complete')
  })

  it('returns stable, screen-ready countdown units', () => {
    expect(countdownParts(90_061_000)).toEqual({ days: '01', hours: '01', minutes: '01', seconds: '01' })
  })
})
