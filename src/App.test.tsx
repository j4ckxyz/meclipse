import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('shareable result flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-12T17:30:00Z'))
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('opens a coordinate URL directly without searching', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    window.history.replaceState({}, '', '/at/48.8566,2.3522/paris')

    render(<App />)

    expect(screen.getByRole('heading', { name: /partial eclipse/i })).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('offers visible, privacy-safe social links that share the homepage', () => {
    window.history.replaceState({}, '', '/at/48.8566,2.3522/paris')
    const deepLink = window.location.href
    render(<App />)

    const facebook = screen.getByRole('link', { name: 'Share on Facebook' })
    const bluesky = screen.getByRole('link', { name: 'Share on Bluesky' })
    const whatsapp = screen.getByRole('link', { name: 'Share on WhatsApp' })
    const homepage = new URL('/', deepLink).href
    const expectedCopy = `I can see 92% of the eclipse where I am! Check out yours here: ${homepage}`

    expect(new URL(facebook.getAttribute('href')!).searchParams.get('u')).toBe(homepage)
    expect(new URL(facebook.getAttribute('href')!).searchParams.get('quote')).toBe(expectedCopy)
    expect(new URL(bluesky.getAttribute('href')!).searchParams.get('text')).toBe(expectedCopy)
    expect(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')).toBe(expectedCopy)
    expect(facebook.getAttribute('href')).not.toContain(encodeURIComponent('/at/'))
    expect(facebook).toHaveAttribute('target', '_blank')
  })

  it('suggests places while typing and creates a durable result URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      results: [{
        id: 'om-2988507',
        name: 'Paris',
        description: 'Île-de-France, France',
        latitude: 48.8566,
        longitude: 2.3522,
      }],
    })))
    render(<App />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Paris' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    const suggestion = await screen.findByRole('button', { name: /Paris/i })
    fireEvent.click(suggestion)

    expect(window.location.pathname).toBe('/at/48.8566,2.3522/paris')
    expect(screen.getByRole('heading', { name: /partial eclipse/i })).toBeInTheDocument()
  })

  it('restores the finder when browser history returns home', async () => {
    window.history.replaceState({}, '', '/at/48.8566,2.3522/paris')
    render(<App />)

    window.history.pushState({}, '', '/')
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))

    await waitFor(() => expect(screen.getByRole('heading', { name: /Will the Sun/i })).toBeInTheDocument())
  })

  it('opens a pasted Google Maps location without a geocoding request', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    render(<App />)
    const mapUrl = 'https://www.google.com/maps/place/17260+Saint-Andr%C3%A9-de-Lidon,+France/@45.58,-0.80/data=!8m2!3d45.600355!4d-0.7480599'

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: mapUrl } })
    const suggestion = screen.getByRole('button', { name: /Saint-André-de-Lidon/i })
    fireEvent.click(suggestion)

    expect(window.location.pathname).toContain('/at/45.6004,-0.7481/')
    expect(screen.getByRole('heading', { name: /partial eclipse/i })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('opens a Channel Islands postcode result with regional coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      results: [{
        id: 'pc-JE36LA',
        name: 'JE3 6LA',
        description: 'Jersey, Channel Islands',
        latitude: 49.2144,
        longitude: -2.1313,
      }],
    })))
    render(<App />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'JE36LA' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    fireEvent.click(await screen.findByRole('button', { name: /JE3 6LA/i }))

    expect(window.location.pathname).toBe('/at/49.2144,-2.1313/je3-6la')
    expect(screen.getByRole('heading', { name: /partial eclipse/i })).toBeInTheDocument()
  })
})
