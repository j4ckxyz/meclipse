import { visitorsResponse } from '../src/server/visitors'

export default {
  fetch(request: Request) {
    return visitorsResponse(request, {
      upstashUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
      hashSecret: process.env.VISITOR_HASH_SECRET,
      countOffset: Number(process.env.VISITOR_COUNT_OFFSET || 0),
    })
  },
}
