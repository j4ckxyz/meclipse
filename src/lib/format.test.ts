import { describe, expect, it } from 'vitest'
import { formatDate, formatShortTime, formatTime, formatTimeZone } from './format'

describe('local date and time formatting', () => {
  const instant = new Date('2026-08-12T17:30:00Z')

  it('uses the selected location time zone rather than the device time zone', () => {
    expect(formatShortTime(instant, 'Europe/Paris', 'en-GB')).toBe('19:30')
    expect(formatShortTime(instant, 'America/New_York', 'en-GB')).toBe('13:30')
  })

  it('respects the browser locale clock and date conventions', () => {
    expect(formatTime(instant, 'America/New_York', 'en-US')).toMatch(/^0?1:30 PM/)
    expect(formatTime(instant, 'America/New_York', 'en-GB')).toMatch(/^13:30/)
    expect(formatDate(instant, 'Europe/Paris', 'fr-FR')).toBe('mercredi 12 août 2026')
  })

  it('provides a localised, daylight-saving-aware time zone label', () => {
    expect(formatTimeZone(instant, 'America/New_York', 'en-US')).toBe('Eastern Daylight Time')
  })
})
