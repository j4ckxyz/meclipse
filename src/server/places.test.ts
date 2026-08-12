// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { placesResponse } from './places'

describe('placesResponse', () => {
  it('normalises Open-Meteo results and sets long CDN caching', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      results: [{
        id: 2988507,
        name: 'Paris',
        latitude: 48.8534,
        longitude: 2.3488,
        admin1: 'Île-de-France',
        country: 'France',
      }],
    }))

    const response = await placesResponse(
      new Request('https://meclipse.test/api/places?q=Paris'),
      { fetcher },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain('max-age=2592000')
    expect(body.results[0]).toMatchObject({ name: 'Paris', description: 'Île-de-France, France' })
  })

  it('uses Geoapify for full addresses when configured', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      results: [{
        place_id: 'abc',
        formatted: '10 Downing Street, London, SW1A 2AA, United Kingdom',
        name: '10 Downing Street',
        city: 'London',
        postcode: 'SW1A 2AA',
        country: 'United Kingdom',
        lat: 51.5034,
        lon: -0.1276,
      }],
    }))

    const response = await placesResponse(
      new Request('https://meclipse.test/api/places?q=10%20Downing%20Street'),
      { fetcher, geoapifyKey: 'test-key' },
    )
    const body = await response.json()

    expect(String(fetcher.mock.calls[0][0])).toContain('geoapify.com')
    expect(body.results[0]).toMatchObject({ name: '10 Downing Street', latitude: 51.5034 })
  })

  it('routes UK postcode searches to the dedicated postcode dataset', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      result: [{
        postcode: 'BS1 5AH',
        latitude: 51.4506,
        longitude: -2.6006,
        admin_district: 'Bristol, City of',
        region: 'South West',
        country: 'England',
      }],
    }))

    const response = await placesResponse(
      new Request('https://meclipse.test/api/places?q=BS1%205AH'),
      { fetcher },
    )
    const body = await response.json()

    expect(String(fetcher.mock.calls[0][0])).toContain('postcodes.io')
    expect(body.results[0]).toMatchObject({ name: 'BS1 5AH', latitude: 51.4506 })
  })

  it('gives Channel Islands postcodes a usable regional coordinate', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      result: [{
        postcode: 'JE3 6LA',
        latitude: null,
        longitude: null,
        admin_district: 'Channel Islands',
        country: 'Channel Islands',
      }],
    }))

    const response = await placesResponse(
      new Request('https://meclipse.test/api/places?q=JE36LA'),
      { fetcher },
    )
    const body = await response.json()

    expect(body.results[0]).toMatchObject({
      name: 'JE3 6LA',
      description: 'Jersey, Channel Islands',
      latitude: 49.2144,
      longitude: -2.1313,
    })
  })

  it('falls back to typo-tolerant Photon when the global index has no match', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({
        features: [{
          properties: {
            osm_type: 'R',
            osm_id: 126521,
            name: 'Saint-André-de-Lidon',
            postcode: '17260',
            state: 'Nouvelle-Aquitaine',
            country: 'France',
          },
          geometry: { coordinates: [-0.7487851, 45.5990595] },
        }],
      }))

    const response = await placesResponse(
      new Request('https://meclipse.test/api/places?q=Saint%20andre%20de%20lidon'),
      { fetcher },
    )
    const body = await response.json()

    expect(String(fetcher.mock.calls[1][0])).toContain('photon.komoot.io')
    expect(body.results[0]).toMatchObject({
      name: 'Saint-André-de-Lidon',
      latitude: 45.5990595,
      longitude: -0.7487851,
    })
  })

  it('resolves coordinate-bearing map links without calling a provider', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const mapUrl = 'https://www.google.com/maps/place/Paris/@48.8,2.3/data=!8m2!3d48.8566!4d2.3522'
    const response = await placesResponse(
      new Request(`https://meclipse.test/api/places?q=${encodeURIComponent(mapUrl)}`),
      { fetcher },
    )
    const body = await response.json()

    expect(body.results[0]).toMatchObject({ latitude: 48.8566, longitude: 2.3522 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not cache errors or invalid requests', async () => {
    const invalid = await placesResponse(new Request('https://meclipse.test/api/places?q=x'))
    expect(invalid.status).toBe(400)
    expect(invalid.headers.get('Cache-Control')).toBe('no-store')

    const failed = await placesResponse(
      new Request('https://meclipse.test/api/places?q=Paris'),
      { fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })) },
    )
    expect(failed.status).toBe(502)
    expect(failed.headers.get('Cache-Control')).toBe('no-store')
  })
})
