import { describe, expect, it } from 'vitest'
import { geolocationFailure } from './geolocationMessage'

describe('geolocation fallback copy', () => {
  it('gives permission guidance without blaming the user', () => {
    expect(geolocationFailure(1)).toEqual({
      title: 'Location access is switched off',
      message: expect.stringContaining('browser settings'),
    })
  })

  it('points unsupported hardware towards search', () => {
    expect(geolocationFailure()).toEqual({
      title: 'Location isn’t available on this device',
      message: expect.stringContaining('Search'),
    })
  })
})
