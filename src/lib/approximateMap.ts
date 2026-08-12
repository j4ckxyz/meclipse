import type { Coordinates } from './eclipse'

export type ApproximateMap = Coordinates & {
  openUrl: string
}

export function approximateCoordinates(coordinates: Coordinates): Coordinates {
  return {
    latitude: Number((Math.round(coordinates.latitude * 10) / 10).toFixed(1)),
    longitude: Number((Math.round(coordinates.longitude * 10) / 10).toFixed(1)),
  }
}

export function approximateMap(coordinates: Coordinates): ApproximateMap {
  const approximate = approximateCoordinates(coordinates)
  return {
    ...approximate,
    openUrl: `https://www.openstreetmap.org/#map=8/${approximate.latitude}/${approximate.longitude}`,
  }
}
