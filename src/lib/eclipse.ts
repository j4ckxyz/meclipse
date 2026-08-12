import {
  Body,
  EclipseKind,
  NextLocalSolarEclipse,
  Observer,
  SearchRiseSet,
  SearchLocalSolarEclipse,
  type EclipseEvent,
  type LocalSolarEclipseInfo,
} from 'astronomy-engine'
import tzLookup from 'tz-lookup'
import { solarDiscGeometry } from './solarGeometry.ts'

export type Coordinates = { latitude: number; longitude: number }

export type EclipseResult = {
  kind: EclipseKind
  coverage: number
  peak: Date
  begins: Date
  ends: Date
  totalBegins?: Date
  totalEnds?: Date
  peakAltitude: number
  durationMinutes: number
  centralPhaseSeconds?: number
  timeZone: string
}

export const UPCOMING_WINDOW_DAYS = 14
const TWELVE_HOURS = 12 * 60 * 60 * 1000

function eventDate(event: EclipseEvent): Date {
  return event.time.date
}

function maximumVisibleTime(coordinates: Coordinates, begins: Date, geometricPeak: Date, ends: Date): Date {
  const geometric = solarDiscGeometry(coordinates, geometricPeak)
  if (geometricPeak >= begins && geometricPeak <= ends && geometric.sunAltitude >= 1.5) return geometricPeak

  const start = begins.getTime()
  const finish = ends.getTime()
  const coarseStep = Math.max(30_000, Math.ceil((finish - start) / 180))
  let bestTime = start
  let bestScore = -1

  for (let time = start; time <= finish; time += coarseStep) {
    const score = solarDiscGeometry(coordinates, new Date(time)).visibleEclipsedArea
    if (score > bestScore) {
      bestScore = score
      bestTime = time
    }
  }

  let lower = Math.max(start, bestTime - coarseStep)
  let upper = Math.min(finish, bestTime + coarseStep)
  const ratio = (Math.sqrt(5) - 1) / 2
  for (let index = 0; index < 24; index += 1) {
    const left = upper - ratio * (upper - lower)
    const right = lower + ratio * (upper - lower)
    const leftScore = solarDiscGeometry(coordinates, new Date(left)).visibleEclipsedArea
    const rightScore = solarDiscGeometry(coordinates, new Date(right)).visibleEclipsedArea
    if (leftScore > rightScore) upper = right
    else lower = left
  }
  return new Date((lower + upper) / 2)
}

function toResult(eclipse: LocalSolarEclipseInfo, coordinates: Coordinates): EclipseResult | null {
  const observer = new Observer(coordinates.latitude, coordinates.longitude, 0)
  const geometricBegins = eventDate(eclipse.partial_begin)
  const geometricEnds = eventDate(eclipse.partial_end)
  const sunrise = SearchRiseSet(Body.Sun, observer, 1, geometricBegins, 1)?.date
  const sunset = SearchRiseSet(Body.Sun, observer, -1, geometricBegins, 1)?.date
  const begins = sunrise && sunrise < geometricEnds ? sunrise : geometricBegins
  const ends = sunset && sunset > begins && sunset < geometricEnds ? sunset : geometricEnds
  if (ends <= begins) return null

  const geometricPeak = eventDate(eclipse.peak)
  const peak = maximumVisibleTime(coordinates, begins, geometricPeak, ends)
  const geometricTotalBegins = eclipse.total_begin ? eventDate(eclipse.total_begin) : undefined
  const geometricTotalEnds = eclipse.total_end ? eventDate(eclipse.total_end) : undefined
  const centralVisible = Boolean(
    geometricTotalBegins && geometricTotalEnds &&
    geometricTotalBegins < ends && geometricTotalEnds > begins,
  )
  const totalBegins = centralVisible && geometricTotalBegins
    ? new Date(Math.max(begins.getTime(), geometricTotalBegins.getTime()))
    : undefined
  const totalEnds = centralVisible && geometricTotalEnds
    ? new Date(Math.min(ends.getTime(), geometricTotalEnds.getTime()))
    : undefined
  const geometry = solarDiscGeometry(coordinates, peak)
  const kind = centralVisible ? eclipse.kind : EclipseKind.Partial

  return {
    kind,
    coverage: geometry.coverage,
    peak,
    begins,
    ends,
    totalBegins,
    totalEnds,
    peakAltitude: geometry.sunAltitude,
    durationMinutes: Math.max(0, Math.round((ends.getTime() - begins.getTime()) / 60_000)),
    centralPhaseSeconds:
      totalBegins && totalEnds
        ? Math.max(0, Math.round((totalEnds.getTime() - totalBegins.getTime()) / 1_000))
        : undefined,
    timeZone: tzLookup(coordinates.latitude, coordinates.longitude),
  }
}

export function findUpcomingEclipse(
  coordinates: Coordinates,
  now = new Date(),
  windowDays = UPCOMING_WINDOW_DAYS,
): EclipseResult | null {
  const observer = new Observer(coordinates.latitude, coordinates.longitude, 0)
  let eclipse = SearchLocalSolarEclipse(new Date(now.getTime() - TWELVE_HOURS), observer)

  if (eclipse.partial_end.time.date.getTime() < now.getTime()) {
    eclipse = NextLocalSolarEclipse(eclipse.peak.time, observer)
  }

  const result = toResult(eclipse, coordinates)
  if (!result) return null
  const windowEnd = now.getTime() + windowDays * 24 * 60 * 60 * 1000
  return result.begins.getTime() <= windowEnd ? result : null
}

export function eclipseName(kind: EclipseKind): string {
  if (kind === EclipseKind.Total) return 'Total eclipse'
  if (kind === EclipseKind.Annular) return 'Annular eclipse'
  return 'Partial eclipse'
}

export function eclipseDescription(kind: EclipseKind, coverage: number): string {
  if (kind === EclipseKind.Total) return 'Daylight will briefly give way to totality.'
  if (kind === EclipseKind.Annular) return 'The Moon will leave a bright ring of sunlight.'
  if (coverage >= 0.8) return 'Most of the Sun will be covered.'
  if (coverage >= 0.4) return 'A clear bite will be taken from the Sun.'
  return 'A subtle partial eclipse will be visible.'
}

export function eclipseStatus(result: EclipseResult, now = new Date()): string {
  const time = now.getTime()
  if (time >= result.begins.getTime() && time <= result.ends.getTime()) return 'Happening now'
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: result.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return localDate.format(result.peak) === localDate.format(now) ? 'Today' : 'Coming up'
}
