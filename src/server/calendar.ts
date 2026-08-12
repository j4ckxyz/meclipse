const MAX_CALENDAR_BYTES = 16_384
const encoder = new TextEncoder()

const ERROR_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

function safeFilename(value: string | null): string {
  const filename = (value || 'meclipse-event.ics')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
  return filename.toLowerCase().endsWith('.ics') ? filename : `${filename || 'meclipse-event'}.ics`
}

function validCalendar(value: string): boolean {
  return encoder.encode(value).length <= MAX_CALENDAR_BYTES
    && value.startsWith('BEGIN:VCALENDAR\r\n')
    && value.endsWith('END:VCALENDAR\r\n')
    && !value.includes('\0')
}

export function calendarResponse(request: Request): Response {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: ERROR_HEADERS })
  }

  const params = new URL(request.url).searchParams
  const calendar = params.get('calendar') || ''
  if (!validCalendar(calendar)) {
    return Response.json({ error: 'Invalid calendar data' }, { status: 400, headers: ERROR_HEADERS })
  }

  const filename = safeFilename(params.get('filename'))
  return new Response(calendar, {
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Type': 'text/calendar; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
