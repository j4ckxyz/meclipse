import { placesResponse } from '../src/server/places.js'

const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env || {}

export default {
  fetch(request: Request) {
    return placesResponse(request, { geoapifyKey: environment.GEOAPIFY_API_KEY })
  },
}
