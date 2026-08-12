import { calendarResponse } from '../src/server/calendar.js'

export default {
  fetch(request: Request) {
    return calendarResponse(request)
  },
}
