import { visitorsResponse } from '../src/server/visitors.js'

const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env || {}

export default {
  fetch(request: Request) {
    return visitorsResponse(request, {
      upstashUrl: environment.UPSTASH_REDIS_REST_URL || environment.KV_REST_API_URL,
      upstashToken: environment.UPSTASH_REDIS_REST_TOKEN || environment.KV_REST_API_TOKEN,
      hashSecret: environment.VISITOR_HASH_SECRET,
      countOffset: Number(environment.VISITOR_COUNT_OFFSET || 0),
    })
  },
}
