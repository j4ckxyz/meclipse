import { describe, expect, it } from 'vitest'
import { locationPath, parseLocationPath, slugifyPlace } from './routes'

describe('location routes', () => {
  it('creates short, stable coordinate URLs', () => {
    expect(locationPath(
      { latitude: 48.8566123, longitude: 2.3522219 },
      'Paris, Île-de-France',
    )).toBe('/at/48.8566,2.3522/paris-ile-de-france')
  })

  it('resolves a shared URL without a network request', () => {
    expect(parseLocationPath('/at/43.36,-5.85/oviedo')).toMatchObject({
      latitude: 43.36,
      longitude: -5.85,
      label: 'Oviedo',
    })
  })

  it('rejects invalid coordinates', () => {
    expect(parseLocationPath('/at/91,2/invalid')).toBeNull()
    expect(parseLocationPath('/somewhere/paris')).toBeNull()
  })

  it('makes an ASCII-safe slug', () => {
    expect(slugifyPlace('São Tomé & Príncipe')).toBe('sao-tome-principe')
  })
})
