import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchPlaces } from '../lib/geocoding'
import ImmersivePreview from './ImmersivePreview'

vi.mock('../lib/geocoding', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/geocoding')>()
  return { ...original, searchPlaces: vi.fn() }
})

const searchPlacesMock = vi.mocked(searchPlaces)

describe('immersive local prototype', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T12:00:00Z'))
    window.history.replaceState({}, '', '/preview')
    searchPlacesMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('turns unavailable geolocation into an address-search recovery path', async () => {
    vi.stubGlobal('navigator', { geolocation: undefined })
    render(<ImmersivePreview />)

    fireEvent.click(screen.getByRole('button', { name: /use my location/i }))
    await act(async () => { await vi.advanceTimersByTimeAsync(16) })

    expect(screen.getByRole('alert')).toHaveTextContent('Location isn’t available on this device')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('debounces typeahead and exposes only a broad map area', async () => {
    searchPlacesMock.mockResolvedValue([{
      id: 'paris',
      name: 'Paris, France',
      description: 'Île-de-France',
      latitude: 48.8566,
      longitude: 2.3522,
    }])
    render(<ImmersivePreview />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Paris' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(419) })
    expect(searchPlacesMock).not.toHaveBeenCalled()

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    await act(async () => { await Promise.resolve() })
    const suggestion = screen.getByRole('button', { name: /Paris, France/i })
    expect(searchPlacesMock).toHaveBeenCalledTimes(1)
    fireEvent.click(suggestion)

    const map = screen.getByRole('img', { name: /deliberately imprecise map around Paris/i })
    expect(map).toHaveTextContent('No precise pin')
    expect(map).toHaveTextContent('Map unavailable · the location result still works')
    expect(window.location.pathname).toBe('/preview/area/48.9,2.4/paris-france')
    expect(map.closest('.immersive-preview')).toHaveClass('maximum-preview')
    const calendarLink = screen.getByRole('link', { name: 'Add to calendar' })
    expect(calendarLink).toHaveAttribute('href', expect.stringMatching(/^\/api\/calendar\?/))
    expect(calendarLink).toHaveAttribute('download', expect.stringMatching(/\.ics$/))
  })

  it('animates first contact when the local simulation crosses the start', () => {
    window.history.replaceState({}, '', '/preview/live')
    render(<ImmersivePreview />)

    fireEvent.click(screen.getByRole('button', { name: 'Before' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByRole('status')).toHaveTextContent('First contact')
    const result = screen.getByRole('main')
    expect(result.closest('.immersive-preview')).toHaveClass('eclipse-active')
    expect(getComputedStyle(result).display).toBe('block')
  })
})
