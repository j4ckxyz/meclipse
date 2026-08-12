import { placesResponse } from '../src/server/places'

export default {
  fetch(request: Request) {
    return placesResponse(request, { geoapifyKey: process.env.GEOAPIFY_API_KEY })
  },
}
