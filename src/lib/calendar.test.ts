import { EclipseKind } from 'astronomy-engine'
import { describe, expect, it } from 'vitest'
import { buildCalendar, calendarDataUrl, calendarFilename } from './calendar'
import type { EclipseResult } from './eclipse'

const result: EclipseResult = {
  kind: EclipseKind.Total,
  coverage: 1,
  begins: new Date('2026-08-12T17:32:00Z'),
  totalBegins: new Date('2026-08-12T18:28:10Z'),
  peak: new Date('2026-08-12T18:29:00Z'),
  totalEnds: new Date('2026-08-12T18:29:50Z'),
  ends: new Date('2026-08-12T19:22:00Z'),
  peakAltitude: 8,
  durationMinutes: 110,
  centralPhaseSeconds: 100,
  timeZone: 'Europe/Madrid',
}

describe('local calendar download', () => {
  it('contains UTC contact times, local context, safety advice and a reminder', () => {
    const calendar = buildCalendar(result, 'León, Spain', new Date('2026-08-01T10:15:30Z'))
    const unfolded = calendar.replaceAll('\r\n ', '')

    expect(unfolded).toContain('DTSTAMP:20260801T101530Z')
    expect(unfolded).toContain('DTSTART:20260812T173200Z')
    expect(unfolded).toContain('DTEND:20260812T192200Z')
    expect(unfolded).toContain('SUMMARY:Total solar eclipse near León\\, Spain')
    expect(unfolded).toContain('Maximum: 20:29 CEST (100% coverage)')
    expect(unfolded).toContain('TRIGGER:-PT30M')
    expect(unfolded).toContain('certified eclipse glasses')
    expect(calendar.endsWith('\r\n')).toBe(true)
  })

  it('creates an importable data URL and safe British-facing filename', () => {
    const url = calendarDataUrl(result, 'León, Spain')

    expect(url).toMatch(/^data:text\/calendar;charset=utf-8,/)
    expect(decodeURIComponent(url)).toContain('BEGIN:VCALENDAR')
    expect(calendarFilename('León, Spain', result)).toBe('meclipse-2026-08-12-leon-spain.ics')
  })
})
