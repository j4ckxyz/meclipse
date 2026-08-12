import type { Coordinates, EclipseResult } from './eclipse'
import { solarDiscGeometry } from './solarGeometry.ts'

export type LiveEclipseState = {
  active: boolean
  central: boolean
  coverage: number
  moonScale: number
  offsetPercent: number
  progress: number
  stage: 'before' | 'partial' | 'central' | 'after'
}

export type CountdownPhase = 'begins' | 'maximum' | 'ends' | 'complete'

export type EclipseCountdown = {
  phase: CountdownPhase
  label: string
  at: Date | null
  milliseconds: number
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculateLiveEclipse(
  result: EclipseResult,
  coordinates: Coordinates,
  now: Date,
): LiveEclipseState {
  const time = now.getTime()
  const begins = result.begins.getTime()
  const ends = result.ends.getTime()
  const peak = result.peak.getTime()
  const progress = clamp((time - begins) / (ends - begins))

  if (time < begins) {
    return { active: false, central: false, coverage: 0, moonScale: 1, offsetPercent: -108, progress: 0, stage: 'before' }
  }
  if (time > ends) {
    return { active: false, central: false, coverage: 0, moonScale: 1, offsetPercent: 108, progress: 1, stage: 'after' }
  }

  const geometry = solarDiscGeometry(coordinates, now)
  const direction = time <= peak ? -1 : 1
  const offsetPercent = direction * Math.min(108, 100 * geometry.separationRatio)
  const central = Boolean(
    result.totalBegins && result.totalEnds &&
    time >= result.totalBegins.getTime() && time <= result.totalEnds.getTime(),
  )

  return {
    active: true,
    central,
    coverage: geometry.coverage,
    moonScale: geometry.moonScale,
    offsetPercent,
    progress,
    stage: central ? 'central' : 'partial',
  }
}

export function nextLiveMilestone(result: EclipseResult, now: Date): { label: string; at: Date } | null {
  const time = now.getTime()
  if (time < result.begins.getTime()) return { label: 'Begins', at: result.begins }
  if (time < result.peak.getTime()) return { label: 'Maximum', at: result.peak }
  if (time < result.ends.getTime()) return { label: 'Ends', at: result.ends }
  return null
}

export function eclipseCountdown(result: EclipseResult, now: Date): EclipseCountdown {
  const milestone = nextLiveMilestone(result, now)
  if (!milestone) return { phase: 'complete', label: 'Eclipse complete', at: null, milliseconds: 0 }

  const phase = milestone.label === 'Begins' ? 'begins' : milestone.label === 'Maximum' ? 'maximum' : 'ends'
  return {
    phase,
    label: phase === 'begins' ? 'Eclipse begins in' : phase === 'maximum' ? 'Maximum eclipse in' : 'Eclipse ends in',
    at: milestone.at,
    milliseconds: milestone.at.getTime() - now.getTime(),
  }
}

export function countdownParts(milliseconds: number): { days: string; hours: string; minutes: string; seconds: string } {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  return {
    days: String(Math.floor(total / 86_400)).padStart(2, '0'),
    hours: String(Math.floor((total % 86_400) / 3_600)).padStart(2, '0'),
    minutes: String(Math.floor((total % 3_600) / 60)).padStart(2, '0'),
    seconds: String(total % 60).padStart(2, '0'),
  }
}

export function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours) return `${hours} hr ${String(minutes).padStart(2, '0')} min`
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
