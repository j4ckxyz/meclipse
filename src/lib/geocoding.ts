export type { Place } from '../types/place'
import type { Place } from '../types/place'

type SearchResponse = { results: Place[] }
type CacheEntry = { expiresAt: number; results: Place[] }

const CACHE_PREFIX = 'meclipse:places:v2:'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const memoryCache = new Map<string, CacheEntry>()
const pendingSearches = new Map<string, Promise<Place[]>>()

export function normaliseQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

function cacheKey(query: string): string {
  return `${CACHE_PREFIX}${normaliseQuery(query).toLocaleLowerCase('en-GB')}`
}

function readCache(query: string): Place[] | null {
  const key = cacheKey(query)
  const memory = memoryCache.get(key)
  if (memory && memory.expiresAt > Date.now()) return memory.results

  try {
    const stored = localStorage.getItem(key)
    if (!stored) return null
    const entry = JSON.parse(stored) as CacheEntry
    if (entry.expiresAt <= Date.now()) {
      localStorage.removeItem(key)
      return null
    }
    memoryCache.set(key, entry)
    return entry.results
  } catch {
    return null
  }
}

function writeCache(query: string, results: Place[]): void {
  const key = cacheKey(query)
  const entry = { expiresAt: Date.now() + CACHE_TTL, results }
  memoryCache.set(key, entry)
  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Search remains usable when storage is unavailable.
  }
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const normalised = normaliseQuery(query)
  if (normalised.length < 2) return []

  const cached = readCache(normalised)
  if (cached) return cached

  const pending = pendingSearches.get(cacheKey(normalised))
  if (pending) return pending

  const request = (async () => {
    const url = new URL('/api/places', window.location.origin)
    url.searchParams.set('q', normalised)
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('Place search is unavailable just now. Try again shortly.')

    const data = (await response.json()) as SearchResponse
    writeCache(normalised, data.results)
    return data.results
  })()

  pendingSearches.set(cacheKey(normalised), request)
  try {
    return await request
  } finally {
    pendingSearches.delete(cacheKey(normalised))
  }
}
