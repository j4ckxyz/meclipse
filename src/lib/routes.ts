import type { Coordinates } from './eclipse'

export type LocationRoute = Coordinates & { label: string; path: string }

const LOCATION_PATH = /^\/at\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\/([^/?#]+))?\/?$/

export function slugifyPlace(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'location'
}

export function locationPath(coordinates: Coordinates, label: string): string {
  const latitude = Number(coordinates.latitude.toFixed(4))
  const longitude = Number(coordinates.longitude.toFixed(4))
  return `/at/${latitude},${longitude}/${slugifyPlace(label)}`
}

export function parseLocationPath(pathname: string): LocationRoute | null {
  const match = pathname.match(LOCATION_PATH)
  if (!match) return null

  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null

  const path = locationPath({ latitude, longitude }, match[3] || 'location')
  const label = match[3]
    ? decodeURIComponent(match[3]).replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Shared location'

  return { latitude, longitude, label, path }
}
