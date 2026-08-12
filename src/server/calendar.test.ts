// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { calendarResponse } from './calendar'

const calendar = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:test@meclipse.j4ck.xyz',
  'DTSTART:20260812T173200Z',
  'DTEND:20260812T192200Z',
  'SUMMARY:Solar eclipse',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

function request(calendarData = calendar, filename = 'meclipse-2026-08-12-paris.ics'): Request {
  const params = new URLSearchParams({ calendar: calendarData, filename })
  return new Request(`https://meclipse.test/api/calendar?${params}`)
}

describe('calendarResponse', () => {
  it('returns an iOS-importable calendar response without caching personal event data', async () => {
    const response = calendarResponse(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="meclipse-2026-08-12-paris.ics"')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(await response.text()).toBe(calendar)
  })

  it('rejects malformed calendar data and sanitises suggested filenames', () => {
    expect(calendarResponse(request('not a calendar')).status).toBe(400)
    expect(calendarResponse(new Request('https://meclipse.test/api/calendar', { method: 'POST' })).status).toBe(405)

    const response = calendarResponse(request(calendar, '../../unsafe name'))
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="..-..-unsafe-name.ics"')
  })
})
