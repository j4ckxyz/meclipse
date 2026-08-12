import type { Place } from '../types/place.js'
import { isSupportedMapUrl, locationTextFromMapUrl, parseLocationInput } from '../lib/locationInput.js'

type Fetcher = typeof fetch

type OpenMeteoResult = {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
  admin2?: string
  postcodes?: string[]
}

type GeoapifyResult = {
  place_id: string
  formatted: string
  lat: number
  lon: number
  name?: string
  city?: string
  postcode?: string
  state?: string
  country?: string
}

type PostcodesIoResult = {
  postcode: string
  latitude: number | null
  longitude: number | null
  admin_district?: string
  region?: string
  country?: string
}

type PhotonFeature = {
  properties: {
    osm_type?: string
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    county?: string
    state?: string
    country?: string
    postcode?: string
  }
  geometry?: { coordinates?: [number, number] }
}

const SUCCESS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
  'CDN-Cache-Control': 'public, max-age=2592000, stale-while-revalidate=2592000, stale-if-error=604800',
  'Vercel-CDN-Cache-Control': 'public, max-age=2592000, stale-while-revalidate=2592000, stale-if-error=604800',
  'X-Content-Type-Options': 'nosniff',
}

const ERROR_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d?[A-Z]{0,2}$/i

const CROWN_DEPENDENCY_CENTRES: Record<string, { name: string; latitude: number; longitude: number }> = {
  JE: { name: 'Jersey', latitude: 49.2144, longitude: -2.1313 },
  GY: { name: 'Guernsey', latitude: 49.4554, longitude: -2.5369 },
  IM: { name: 'Isle of Man', latitude: 54.2361, longitude: -4.5481 },
}

function compact(parts: Array<string | undefined>, exclude?: string): string {
  const seen = new Set<string>()
  return parts.filter((part): part is string => {
    if (!part || part === exclude || seen.has(part)) return false
    seen.add(part)
    return true
  }).join(', ')
}

async function searchOpenMeteo(query: string, fetcher: Fetcher): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('count', '6')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  const response = await fetcher(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Open-Meteo search failed')
  const data = (await response.json()) as { results?: OpenMeteoResult[] }

  return (data.results || []).map((place) => ({
    id: `om-${place.id}`,
    name: place.name,
    description: compact([place.admin2, place.admin1, place.country], place.name),
    latitude: place.latitude,
    longitude: place.longitude,
  }))
}

async function searchUkPostcodes(query: string, fetcher: Fetcher): Promise<Place[]> {
  const url = new URL('https://api.postcodes.io/postcodes')
  url.searchParams.set('query', query.toUpperCase())
  url.searchParams.set('limit', '6')
  const response = await fetcher(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('UK postcode search failed')
  const data = (await response.json()) as { result?: PostcodesIoResult[] }

  return (data.result || []).flatMap((place) => {
    const prefix = place.postcode.slice(0, 2).toUpperCase()
    const fallback = CROWN_DEPENDENCY_CENTRES[prefix]
    const latitude = place.latitude ?? fallback?.latitude
    const longitude = place.longitude ?? fallback?.longitude
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    return [{
      id: `pc-${place.postcode.replace(/\s/g, '')}`,
      name: place.postcode,
      description: compact([fallback?.name, place.admin_district, place.region, place.country]),
      latitude: latitude!,
      longitude: longitude!,
    }]
  })
}

async function searchPhoton(query: string, fetcher: Fetcher): Promise<Place[]> {
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/geo+json, application/json',
      'User-Agent': 'Meclipse/1.0 (https://meclipse.vercel.app)',
    },
  })
  if (!response.ok) throw new Error('Photon search failed')
  const data = (await response.json()) as { features?: PhotonFeature[] }

  return (data.features || []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates) return []
    const [longitude, latitude] = coordinates
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    const properties = feature.properties
    const name = properties.name || compact([properties.housenumber, properties.street]) || properties.postcode
    if (!name) return []
    return [{
      id: `ph-${properties.osm_type || 'place'}-${properties.osm_id || `${latitude}-${longitude}`}`,
      name,
      description: compact([
        properties.postcode,
        properties.district,
        properties.city,
        properties.county,
        properties.state,
        properties.country,
      ], name),
      latitude,
      longitude,
    }]
  })
}

async function searchFreeProviders(query: string, fetcher: Fetcher): Promise<Place[]> {
  if (UK_POSTCODE.test(query)) {
    try {
      const postcodes = await searchUkPostcodes(query, fetcher)
      if (postcodes.length) return postcodes
    } catch {
      // Fall through to the global providers.
    }
  }

  try {
    const openMeteo = await searchOpenMeteo(query, fetcher)
    if (openMeteo.length) return openMeteo
  } catch {
    // Photon keeps search usable if Open-Meteo has no match or is unavailable.
  }
  return searchPhoton(query, fetcher)
}

async function resolveMapRedirect(value: string, fetcher: Fetcher): Promise<string> {
  let current = value
  for (let redirect = 0; redirect < 5; redirect += 1) {
    if (!isSupportedMapUrl(current)) return value
    const response = await fetcher(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Meclipse/1.0 (map link resolver)' },
    })
    const location = response.headers.get('location')
    response.body?.cancel().catch(() => undefined)
    if (!location) return response.url || current
    current = new URL(location, current).toString()
  }
  return current
}

async function searchGeoapify(query: string, apiKey: string, fetcher: Fetcher): Promise<Place[]> {
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
  url.searchParams.set('text', query)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('format', 'json')
  url.searchParams.set('apiKey', apiKey)
  const response = await fetcher(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Geoapify search failed')
  const data = (await response.json()) as { results?: GeoapifyResult[] }

  return (data.results || []).map((place) => {
    const name = place.name || place.city || place.formatted.split(',')[0]
    return {
      id: `ga-${place.place_id}`,
      name,
      description: compact([place.city, place.postcode, place.state, place.country], name),
      latitude: place.lat,
      longitude: place.lon,
    }
  })
}

export async function placesResponse(
  request: Request,
  options: { fetcher?: Fetcher; geoapifyKey?: string } = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: ERROR_HEADERS })
  }

  const query = new URL(request.url).searchParams.get('q')?.trim().replace(/\s+/g, ' ')
  if (!query || query.length < 2 || query.length > 2048) {
    return Response.json({ error: 'Enter between 2 and 2,048 characters.' }, { status: 400, headers: ERROR_HEADERS })
  }

  try {
    const fetcher = options.fetcher || fetch
    let resolvedQuery = query
    let direct = parseLocationInput(resolvedQuery)
    if (!direct && isSupportedMapUrl(resolvedQuery)) {
      resolvedQuery = await resolveMapRedirect(resolvedQuery, fetcher)
      direct = parseLocationInput(resolvedQuery)
    }
    if (direct) return Response.json({ results: [direct] }, { headers: SUCCESS_HEADERS })

    const mapText = locationTextFromMapUrl(resolvedQuery)
    const searchQuery = mapText || resolvedQuery
    let results: Place[] = []
    if (options.geoapifyKey) {
      try {
        results = await searchGeoapify(searchQuery, options.geoapifyKey, fetcher)
      } catch {
        // The no-key providers are a production fallback, not a hard failure.
      }
    }
    if (!results.length) results = await searchFreeProviders(searchQuery, fetcher)
    return Response.json({ results }, { headers: SUCCESS_HEADERS })
  } catch {
    return Response.json(
      { error: 'Place search is temporarily unavailable.' },
      { status: 502, headers: ERROR_HEADERS },
    )
  }
}
