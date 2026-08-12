// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

type Cell = { latitude: number; longitude: number; coverage: number; size: number }
type Surface = { event: { peak: string }; cells: Cell[] }

async function loadSurface(): Promise<Surface> {
  return JSON.parse(await readFile(new URL('../../public/coverage/2026-08-12.json', import.meta.url), 'utf8'))
}

function closest(cells: Cell[], latitude: number, longitude: number): Cell {
  return cells
    .filter((cell) => cell.size < 1.5)
    .sort((left, right) => (
      Math.hypot(left.latitude - latitude, left.longitude - longitude)
      - Math.hypot(right.latitude - latitude, right.longitude - longitude)
    ))[0]
}

describe('precomputed worldwide coverage', () => {
  it('preserves the published 2026 coverage pattern at known locations', async () => {
    const surface = await loadSurface()

    expect(surface.event.peak).toMatch(/^2026-08-12T/)
    expect(closest(surface.cells, 48.8566, 2.3522).coverage).toBeCloseTo(.92, 1)
    expect(closest(surface.cells, 45.6, -.748).coverage).toBeGreaterThan(.94)
    expect(closest(surface.cells, 43.36, -5.85).coverage).toBe(1)
  })

  it('contains regional detail and varied local shades', async () => {
    const surface = await loadSurface()
    const westernFrance = surface.cells.filter((cell) => (
      cell.size < 1.5
      && cell.latitude >= 43
      && cell.latitude <= 51
      && cell.longitude >= -5
      && cell.longitude <= 4
    ))
    const distinctPercentages = new Set(westernFrance.map((cell) => Math.round(cell.coverage * 100)))

    expect(westernFrance.length).toBeGreaterThan(75)
    expect(distinctPercentages.size).toBeGreaterThan(8)
  })
})
