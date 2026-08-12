import { CalendarPlus } from 'lucide-react'
import { useMemo } from 'react'
import { calendarDataUrl, calendarFilename } from '../lib/calendar'
import type { EclipseResult } from '../lib/eclipse'

type CalendarLinkProps = {
  result: EclipseResult
  place: string
  className?: string
}

function CalendarLink({ result, place, className = '' }: CalendarLinkProps) {
  const calendar = useMemo(() => ({
    href: calendarDataUrl(result, place),
    filename: calendarFilename(place, result),
  }), [place, result])

  return (
    <a
      className={`calendar-link ${className}`.trim()}
      href={calendar.href}
      download={calendar.filename}
    >
      <CalendarPlus size={16} aria-hidden="true" />
      Add to calendar
    </a>
  )
}

export default CalendarLink
