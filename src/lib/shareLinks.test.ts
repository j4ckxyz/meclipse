import { describe, expect, it } from 'vitest'
import { shareTargets } from './shareLinks'

describe('social share targets', () => {
  it('uses the supplied public homepage and copy for every network', () => {
    const homepage = 'https://meclipse.example/'
    const copy = 'I can see 96% of the eclipse where I am! Check out yours here:'
    const targets = shareTargets(homepage, copy)

    expect(new URL(targets.facebook).searchParams.get('u')).toBe(homepage)
    expect(new URL(targets.facebook).searchParams.get('quote')).toBe(`${copy} ${homepage}`)
    expect(new URL(targets.bluesky).searchParams.get('text')).toBe(`${copy} ${homepage}`)
    expect(new URL(targets.whatsapp).searchParams.get('text')).toBe(`${copy} ${homepage}`)
  })
})
