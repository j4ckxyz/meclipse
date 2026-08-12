import type { Place } from '../types/place.ts'

type Coordinates = { latitude: number; longitude: number }

const MAP_HOSTS = [
  'google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
  'maps.apple.com',
  'openstreetmap.org',
  'www.openstreetmap.org',
  'bing.com',
  'www.bing.com',
  'waze.com',
  'www.waze.com',
]

function validCoordinates(latitude: number, longitude: number): Coordinates | null {
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null
  return { latitude, longitude }
}

function coordinatePair(value: string, separator: RegExp = /\s*,\s*/): Coordinates | null {
  const [latitudeText, longitudeText, ...rest] = value.trim().split(separator)
  if (!latitudeText || !longitudeText || rest.length) return null
  return validCoordinates(Number(latitudeText), Number(longitudeText))
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value.replace(/\+/g, ' ')
  }
}

function cleanLabel(value: string): string {
  return safeDecode(value).replace(/\s+/g, ' ').replace(/^\d{4,6}\s+/, '').trim().slice(0, 90)
}

function hostMatches(hostname: string, allowed: string): boolean {
  return hostname === allowed || hostname.endsWith(`.${allowed}`)
}

function isGoogleHost(hostname: string): boolean {
  return hostMatches(hostname, 'google.com') || /(^|\.)google\.[a-z.]{2,}$/i.test(hostname)
}

export function isSupportedMapUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      (isGoogleHost(hostname) || MAP_HOSTS.some((host) => hostMatches(hostname, host)))
  } catch {
    return false
  }
}

export function locationTextFromMapUrl(value: string): string | null {
  if (!isSupportedMapUrl(value)) return null
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase()
  if (isGoogleHost(hostname) || hostMatches(hostname, 'goo.gl')) {
    const placePart = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1]
    const query = url.searchParams.get('query')
    return cleanLabel(placePart || query || '') || null
  }
  if (hostMatches(hostname, 'maps.apple.com')) {
    return cleanLabel(url.searchParams.get('q') || url.searchParams.get('address') || '') || null
  }
  return null
}

function placeFromCoordinates(coordinates: Coordinates, label: string, source: string): Place {
  const latitude = Number(coordinates.latitude.toFixed(6))
  const longitude = Number(coordinates.longitude.toFixed(6))
  return {
    id: `coordinates-${latitude},${longitude}`,
    name: label,
    description: `${source} · ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    latitude,
    longitude,
  }
}

export function parseLocationInput(value: string): Place | null {
  const input = value.trim()
  if (!input) return null

  const geoMatch = input.match(/^geo:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i)
  if (geoMatch) {
    const coordinates = validCoordinates(Number(geoMatch[1]), Number(geoMatch[2]))
    return coordinates ? placeFromCoordinates(coordinates, 'Pasted coordinates', 'Geo link') : null
  }

  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(input)) {
    const coordinates = coordinatePair(input)
    return coordinates ? placeFromCoordinates(coordinates, 'Pasted coordinates', 'Latitude and longitude') : null
  }

  if (!isSupportedMapUrl(input)) return null
  const url = new URL(input)
  const hostname = url.hostname.toLowerCase()
  let coordinates: Coordinates | null = null
  let label = 'Pasted map location'
  let source = 'Map link'

  if (isGoogleHost(hostname) || hostMatches(hostname, 'goo.gl')) {
    source = 'Google Maps'
    const placePart = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1]
    if (placePart) label = cleanLabel(placePart) || label
    const pin = `${url.pathname}${url.search}${url.hash}`.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i)
    const viewport = `${url.pathname}${url.search}${url.hash}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    const query = url.searchParams.get('query')
    coordinates = pin
      ? validCoordinates(Number(pin[1]), Number(pin[2]))
      : query && coordinatePair(query)
        ? coordinatePair(query)
        : viewport
          ? validCoordinates(Number(viewport[1]), Number(viewport[2]))
          : null
  } else if (hostMatches(hostname, 'maps.apple.com')) {
    source = 'Apple Maps'
    label = cleanLabel(url.searchParams.get('name') || url.searchParams.get('q') || url.searchParams.get('address') || '') || label
    for (const parameter of ['coordinate', 'll', 'sll', 'near']) {
      coordinates = coordinatePair(url.searchParams.get(parameter) || '')
      if (coordinates) break
    }
  } else if (hostMatches(hostname, 'openstreetmap.org')) {
    source = 'OpenStreetMap'
    const latitude = url.searchParams.get('mlat')
    const longitude = url.searchParams.get('mlon')
    coordinates = latitude && longitude
      ? validCoordinates(Number(latitude), Number(longitude))
      : null
    const mapFragment = url.hash.match(/#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/)
    if (!coordinates && mapFragment) coordinates = validCoordinates(Number(mapFragment[1]), Number(mapFragment[2]))
  } else if (hostMatches(hostname, 'bing.com')) {
    source = 'Bing Maps'
    coordinates = coordinatePair(url.searchParams.get('cp') || '', /\s*~\s*/)
  } else if (hostMatches(hostname, 'waze.com')) {
    source = 'Waze'
    coordinates = coordinatePair(url.searchParams.get('ll') || '')
  }

  return coordinates ? placeFromCoordinates(coordinates, label, source) : null
}
