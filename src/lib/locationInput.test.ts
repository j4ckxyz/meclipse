import { describe, expect, it } from 'vitest'
import { isSupportedMapUrl, parseLocationInput } from './locationInput'

describe('location input parsing', () => {
  it('extracts the pinned place rather than the viewport from a Google Maps link', () => {
    const place = parseLocationInput('https://www.google.com/maps/place/17260+Saint-Andr%C3%A9-de-Lidon,+France/@45.5809959,-0.8006431,9352m/data=!3m2!1e3!4b1!4m6!3m5!1sabc!8m2!3d45.600355!4d-0.7480599!16s%2Fm%2F03mcjrw')

    expect(place).toMatchObject({
      name: 'Saint-André-de-Lidon, France',
      latitude: 45.600355,
      longitude: -0.74806,
    })
  })

  it('supports Apple Maps, OpenStreetMap, geo links and plain coordinate pairs', () => {
    expect(parseLocationInput('https://maps.apple.com/?ll=45.6,-0.748&q=Home')).toMatchObject({ latitude: 45.6, longitude: -0.748 })
    expect(parseLocationInput('https://maps.apple.com/place?coordinate=45.6,-0.748&name=Home')).toMatchObject({ latitude: 45.6, longitude: -0.748 })
    expect(parseLocationInput('https://www.openstreetmap.org/#map=14/45.6/-0.748')).toMatchObject({ latitude: 45.6, longitude: -0.748 })
    expect(parseLocationInput('geo:45.6,-0.748')).toMatchObject({ latitude: 45.6, longitude: -0.748 })
    expect(parseLocationInput('45.6, -0.748')).toMatchObject({ latitude: 45.6, longitude: -0.748 })
    expect(parseLocationInput('https://www.google.fr/maps/@45.6,-0.748,12z')).toMatchObject({ latitude: 45.6, longitude: -0.748 })
  })

  it('does not interpret arbitrary URLs as locations', () => {
    expect(isSupportedMapUrl('https://example.com/?ll=45.6,-0.748')).toBe(false)
    expect(parseLocationInput('https://example.com/?ll=45.6,-0.748')).toBeNull()
  })
})
