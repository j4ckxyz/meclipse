import { solarDiscGeometry } from './solarGeometry.ts'

export type CoverageCell = {
  longitude: number
  latitude: number
  coverage: number
  size: number
}

export type CoverageSurface = {
  centre: { longitude: number; latitude: number }
  cells: CoverageCell[]
}

const HOUR = 60 * 60 * 1_000

function maximumCoverage(longitude: number, latitude: number, peak: Date): number {
  const start = peak.getTime() - 4 * HOUR
  const end = peak.getTime() + 4 * HOUR
  let bestTime = start
  let maximum = 0

  for (let time = start; time <= end; time += 15 * 60_000) {
    const geometry = solarDiscGeometry({ latitude, longitude }, new Date(time))
    if (geometry.sunAltitude > 0 && geometry.coverage > maximum) {
      maximum = geometry.coverage
      bestTime = time
    }
  }

  for (let time = bestTime - 15 * 60_000; time <= bestTime + 15 * 60_000; time += 60_000) {
    const geometry = solarDiscGeometry({ latitude, longitude }, new Date(time))
    if (geometry.sunAltitude > 0) maximum = Math.max(maximum, geometry.coverage)
  }
  return maximum
}

function pointKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(2)},${latitude.toFixed(2)}`
}

function addNeighbourhood(target: Map<string, [number, number]>, longitude: number, latitude: number, radius: number, step: number) {
  for (let candidateLatitude = latitude - radius; candidateLatitude <= latitude + radius; candidateLatitude += step) {
    if (candidateLatitude < -89 || candidateLatitude > 89) continue
    for (let candidateLongitude = longitude - radius; candidateLongitude <= longitude + radius; candidateLongitude += step) {
      const wrappedLongitude = ((candidateLongitude + 540) % 360) - 180
      target.set(pointKey(wrappedLongitude, candidateLatitude), [wrappedLongitude, candidateLatitude])
    }
  }
}

export function generateCoverageSurface(
  peak: Date,
  suggestedCentre: { longitude?: number; latitude?: number } = {},
): CoverageSurface {
  const fineCandidates = new Map<string, [number, number]>()
  for (let latitude = -88; latitude <= 88; latitude += 4) {
    for (let longitude = -180; longitude < 180; longitude += 4) {
      if (maximumCoverage(longitude, latitude, peak) >= .002) {
        addNeighbourhood(fineCandidates, longitude, latitude, 4, 2)
      }
    }
  }

  const fineCells: CoverageCell[] = []
  const hotspotCandidates = new Map<string, [number, number]>()
  let best = {
    longitude: suggestedCentre.longitude ?? -12,
    latitude: suggestedCentre.latitude ?? 48,
    coverage: 0,
  }

  for (const [longitude, latitude] of fineCandidates.values()) {
    const coverage = maximumCoverage(longitude, latitude, peak)
    if (coverage < .005) continue
    fineCells.push({ longitude, latitude, coverage, size: 2.08 })
    if (coverage > best.coverage) best = { longitude, latitude, coverage }
    if (coverage >= .55) addNeighbourhood(hotspotCandidates, longitude, latitude, 2, 1)
  }

  const hotspotCells: CoverageCell[] = []
  for (const [longitude, latitude] of hotspotCandidates.values()) {
    const coverage = maximumCoverage(longitude, latitude, peak)
    if (coverage < .5) continue
    hotspotCells.push({ longitude, latitude, coverage, size: 1.06 })
    if (coverage > best.coverage) best = { longitude, latitude, coverage }
  }

  return {
    centre: { longitude: best.longitude, latitude: best.latitude },
    cells: [...fineCells, ...hotspotCells],
  }
}
