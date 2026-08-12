import { eclipseName, type EclipseResult } from './eclipse'
import { formatTime } from './format'

const CALENDAR_HOST = 'meclipse.j4ck.xyz'
const CALENDAR_URL = `https://${CALENDAR_HOST}/`
const lineEncoder = new TextEncoder()

function escapeCalendarText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n')
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function foldLine(line: string): string {
  let folded = ''
  let bytes = 0
  for (const character of line) {
    const characterBytes = lineEncoder.encode(character).length
    if (bytes + characterBytes > 75) {
      folded += '\r\n '
      bytes = 1
    }
    folded += character
    bytes += characterBytes
  }
  return folded
}

function eventName(result: EclipseResult): string {
  return eclipseName(result.kind).replace(' eclipse', ' solar eclipse')
}

export function calendarFilename(place: string, result: EclipseResult): string {
  const date = result.peak.toISOString().slice(0, 10)
  const safePlace = place
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'your-location'
  return `meclipse-${date}-${safePlace}.ics`
}

export function buildCalendar(result: EclipseResult, place: string, createdAt = new Date()): string {
  const coverage = Math.round(result.coverage * 100)
  const contactLines = [
    `Begins: ${formatTime(result.begins, result.timeZone)}`,
    result.totalBegins ? `${result.kind === 'total' ? 'Totality' : 'Ring phase'} begins: ${formatTime(result.totalBegins, result.timeZone)}` : null,
    `Maximum: ${formatTime(result.peak, result.timeZone)} (${coverage}% coverage)`,
    result.totalEnds ? `${result.kind === 'total' ? 'Totality' : 'Ring phase'} ends: ${formatTime(result.totalEnds, result.timeZone)}` : null,
    `Ends: ${formatTime(result.ends, result.timeZone)}`,
    '',
    'Protect your eyes with certified eclipse glasses. Ordinary sunglasses are not safe.',
    'Calculated locally by Meclipse.',
  ].filter((line): line is string => line !== null)
  const identifierPlace = calendarFilename(place, result).replace(/^meclipse-|\.ics$/g, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meclipse//Solar eclipse reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${result.peak.getTime()}-${identifierPlace}@${CALENDAR_HOST}`,
    `DTSTAMP:${formatUtc(createdAt)}`,
    `DTSTART:${formatUtc(result.begins)}`,
    `DTEND:${formatUtc(result.ends)}`,
    `SUMMARY:${escapeCalendarText(`${eventName(result)} near ${place}`)}`,
    `LOCATION:${escapeCalendarText(place)}`,
    `DESCRIPTION:${escapeCalendarText(contactLines.join('\n'))}`,
    `URL:${CALENDAR_URL}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:The solar eclipse begins in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export function calendarDataUrl(result: EclipseResult, place: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildCalendar(result, place))}`
}
