import { cleanup, render, screen } from '@testing-library/react'
import { EclipseKind } from 'astronomy-engine'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EclipseResult } from '../lib/eclipse'
import CalendarLink from './CalendarLink'

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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CalendarLink', () => {
  it('downloads an object URL that mobile Safari can treat as a calendar file', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar-event')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const { unmount } = render(<CalendarLink result={result} place="León, Spain" />)
    const link = screen.getByRole('link', { name: 'Add to calendar' })

    expect(link).toHaveAttribute('href', 'blob:calendar-event')
    expect(link).toHaveAttribute('download', 'meclipse-2026-08-12-leon-spain.ics')
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))

    const calendarBlob = createObjectURL.mock.calls[0][0] as Blob
    expect(calendarBlob.type).toBe('text/calendar;charset=utf-8')

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:calendar-event')
  })
})
