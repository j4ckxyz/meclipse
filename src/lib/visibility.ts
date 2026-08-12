export type VisibilityPoint = {
  latitude: number
  longitude: number
  cloudCover: number
  precipitationChance: number
  elevation: number
  score: number
}

export type VisibilityOutlook = {
  points: VisibilityPoint[]
  forecastAvailable: boolean
}

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const OPEN_METEO_ELEVATION = 'https://api.open-meteo.com/v1/elevation'

export function visibilityGrid(latitude: number, longitude: number) {
  const latitudeStep = 0.32
  const longitudeStep = Math.min(0.7, latitudeStep / Math.max(0.35, Math.cos(latitude * Math.PI / 180)))
  return [-2, -1, 0, 1, 2].flatMap((row) =>
    [-2, -1, 0, 1, 2].map((column) => ({
      latitude: latitude + row * latitudeStep,
      longitude: longitude + column * longitudeStep,
    })),
  )
}

export function visibilityScore(cloudCover: number, precipitationChance: number, elevation: number, maximumElevation: number) {
  const elevationBonus = maximumElevation > 0 ? Math.min(15, elevation / maximumElevation * 15) : 0
  return Math.round(Math.max(0, Math.min(100, 100 - cloudCover * 0.82 - precipitationChance * 0.18 + elevationBonus)))
}

function closestHourIndex(times: string[], target: Date) {
  if (!times.length) return -1
  return times.reduce((best, time, index) => (
    Math.abs(new Date(time).getTime() - target.getTime()) < Math.abs(new Date(times[best]).getTime() - target.getTime()) ? index : best
  ), 0)
}

export async function fetchVisibilityOutlook(latitude: number, longitude: number, target: Date, signal?: AbortSignal): Promise<VisibilityOutlook> {
  const grid = visibilityGrid(latitude, longitude)
  const latitudes = grid.map((point) => point.latitude.toFixed(4)).join(',')
  const longitudes = grid.map((point) => point.longitude.toFixed(4)).join(',')
  const daysAway = Math.ceil((target.getTime() - Date.now()) / 86_400_000)
  const forecastAvailable = daysAway >= 0 && daysAway <= 15
  const forecastDays = Math.max(1, Math.min(16, daysAway + 1))

  const elevationUrl = `${OPEN_METEO_ELEVATION}?latitude=${latitudes}&longitude=${longitudes}`
  const weatherUrl = `${OPEN_METEO}?latitude=${latitudes}&longitude=${longitudes}&hourly=cloud_cover,precipitation_probability&forecast_days=${forecastDays}&timezone=GMT`
  const [elevationResponse, weatherResponse] = await Promise.all([
    fetch(elevationUrl, { signal }),
    forecastAvailable ? fetch(weatherUrl, { signal }) : Promise.resolve(null),
  ])
  if (!elevationResponse.ok || (weatherResponse && !weatherResponse.ok)) throw new Error('Visibility data is unavailable right now.')

  const elevationData = await elevationResponse.json() as { elevation?: number[] }
  const elevations = elevationData.elevation ?? grid.map(() => 0)
  const weatherData = weatherResponse ? await weatherResponse.json() as Array<{
    hourly: { time: string[]; cloud_cover: number[]; precipitation_probability: number[] }
  }> : []
  const maximumElevation = Math.max(...elevations, 0)

  return {
    forecastAvailable,
    points: grid.map((point, index) => {
      const hourly = weatherData[index]?.hourly
      const hourIndex = hourly ? closestHourIndex(hourly.time, target) : -1
      const cloudCover = hourIndex >= 0 ? hourly.cloud_cover[hourIndex] ?? 50 : 50
      const precipitationChance = hourIndex >= 0 ? hourly.precipitation_probability[hourIndex] ?? 0 : 0
      const elevation = elevations[index] ?? 0
      return { ...point, cloudCover, precipitationChance, elevation, score: visibilityScore(cloudCover, precipitationChance, elevation, maximumElevation) }
    }),
  }
}
