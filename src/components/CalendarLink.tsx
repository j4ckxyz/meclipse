import { CalendarPlus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { buildCalendar, calendarDataUrl, calendarFilename } from '../lib/calendar'
import type { EclipseResult } from '../lib/eclipse'

type CalendarLinkProps = {
  result: EclipseResult
  place: string
  className?: string
}

function CalendarLink({ result, place, className = '' }: CalendarLinkProps) {
  const calendar = useMemo(() => ({
    contents: buildCalendar(result, place),
    fallbackHref: calendarDataUrl(result, place),
    filename: calendarFilename(place, result),
  }), [place, result])
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    // WebKit does not reliably honour `download` for data URLs. A calendar Blob
    // gives iOS Safari a real file to hand to Calendar while retaining a data
    // URL fallback for older browsers without object URL support.
    if (typeof URL.createObjectURL !== 'function') return

    const objectUrl = URL.createObjectURL(new Blob([calendar.contents], {
      type: 'text/calendar;charset=utf-8',
    }))
    linkRef.current?.setAttribute('href', objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [calendar])

  return (
    <a
      className={`calendar-link ${className}`.trim()}
      ref={linkRef}
      href={calendar.fallbackHref}
      download={calendar.filename}
    >
      <CalendarPlus size={16} aria-hidden="true" />
      Add to calendar
    </a>
  )
}

export default CalendarLink
