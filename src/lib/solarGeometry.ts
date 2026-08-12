import {
  AngleBetween,
  Body,
  Equator,
  Horizon,
  KM_PER_AU,
  Observer,
} from 'astronomy-engine'
import type { Coordinates } from './eclipse.ts'

const DEG_TO_RAD = Math.PI / 180
const SUN_RADIUS_KM = 695_700
const MOON_RADIUS_KM = 1_737.4

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function circleOverlap(radiusA: number, radiusB: number, distance: number): number {
  if (distance >= radiusA + radiusB) return 0
  if (distance <= Math.abs(radiusA - radiusB)) {
    return Math.PI * Math.min(radiusA, radiusB) ** 2
  }

  const angleA = Math.acos(clamp(
    (distance ** 2 + radiusA ** 2 - radiusB ** 2) / (2 * distance * radiusA),
    -1,
    1,
  ))
  const angleB = Math.acos(clamp(
    (distance ** 2 + radiusB ** 2 - radiusA ** 2) / (2 * distance * radiusB),
    -1,
    1,
  ))
  const lens = 0.5 * Math.sqrt(Math.max(0,
    (-distance + radiusA + radiusB) *
    (distance + radiusA - radiusB) *
    (distance - radiusA + radiusB) *
    (distance + radiusA + radiusB),
  ))
  return radiusA ** 2 * angleA + radiusB ** 2 * angleB - lens
}

export type SolarDiscGeometry = {
  coverage: number
  moonScale: number
  separationRatio: number
  sunAltitude: number
  visibleEclipsedArea: number
}

function signedAzimuthDifference(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}

function visibleEclipsedArea(
  sunAltitude: number,
  sunRadiusDegrees: number,
  moonX: number,
  moonY: number,
  moonRadius: number,
): number {
  const slices = 96
  const lowerY = Math.max(-1, -sunAltitude / sunRadiusDegrees)
  if (lowerY >= 1) return 0
  const step = (1 - lowerY) / slices
  let area = 0

  for (let index = 0; index < slices; index += 1) {
    const y = lowerY + (index + 0.5) * step
    const sunHalfWidth = Math.sqrt(Math.max(0, 1 - y * y))
    const moonSlice = moonRadius * moonRadius - (y - moonY) ** 2
    if (moonSlice <= 0) continue
    const moonHalfWidth = Math.sqrt(moonSlice)
    const left = Math.max(-sunHalfWidth, moonX - moonHalfWidth)
    const right = Math.min(sunHalfWidth, moonX + moonHalfWidth)
    if (right > left) area += (right - left) * step
  }
  return area
}

export function solarDiscGeometry(coordinates: Coordinates, date: Date): SolarDiscGeometry {
  const observer = new Observer(coordinates.latitude, coordinates.longitude, 0)
  const sun = Equator(Body.Sun, date, observer, false, true)
  const moon = Equator(Body.Moon, date, observer, false, true)
  const separation = AngleBetween(sun.vec, moon.vec) * DEG_TO_RAD
  const sunRadius = Math.asin(SUN_RADIUS_KM / (sun.dist * KM_PER_AU))
  const moonRadius = Math.asin(MOON_RADIUS_KM / (moon.dist * KM_PER_AU))
  const overlap = circleOverlap(sunRadius, moonRadius, separation)
  const sunHorizontal = Horizon(date, observer, sun.ra, sun.dec, 'normal')
  const sunAirless = Horizon(date, observer, sun.ra, sun.dec)
  const moonAirless = Horizon(date, observer, moon.ra, moon.dec)
  const sunRadiusDegrees = sunRadius / DEG_TO_RAD
  const moonX = signedAzimuthDifference(moonAirless.azimuth, sunAirless.azimuth) *
    Math.cos(sunAirless.altitude * DEG_TO_RAD) / sunRadiusDegrees
  const moonY = (moonAirless.altitude - sunAirless.altitude) / sunRadiusDegrees
  const moonScale = moonRadius / sunRadius

  return {
    coverage: clamp(overlap / (Math.PI * sunRadius ** 2)),
    moonScale,
    separationRatio: separation / (sunRadius + moonRadius),
    sunAltitude: sunHorizontal.altitude,
    visibleEclipsedArea: visibleEclipsedArea(
      sunHorizontal.altitude,
      sunRadiusDegrees,
      moonX,
      moonY,
      moonScale,
    ),
  }
}
