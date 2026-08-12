import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { calendarResponse } from './src/server/calendar.ts'
import { placesResponse } from './src/server/places.ts'
import { visitorsResponse, type VisitorStore } from './src/server/visitors.ts'

const localVisitorSessions = new Set<string>()
const localVisitorStore: VisitorStore = {
  async record(sessionId) {
    localVisitorSessions.add(sessionId)
    return { count: localVisitorSessions.size, rateLimited: false }
  },
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', '')
  const explicitSiteUrl = process.env.VITE_SITE_URL || environment.VITE_SITE_URL
  const productionUrl = process.env.VITE_VERCEL_PROJECT_PRODUCTION_URL || environment.VITE_VERCEL_PROJECT_PRODUCTION_URL
  const siteUrl = explicitSiteUrl || (
    productionUrl
      ? `https://${productionUrl}`
      : 'http://localhost:5173'
  )

  return {
    plugins: [
      react(),
      {
        name: 'meclipse-production-url',
        transformIndexHtml(html) {
          return html.replaceAll('__SITE_URL__', siteUrl.replace(/\/$/, ''))
        },
      },
      {
        name: 'meclipse-local-calendar-api',
        configureServer(server) {
          server.middlewares.use('/api/calendar', async (request, response) => {
            const apiResponse = calendarResponse(new Request(
              `http://localhost/api/calendar${request.url || ''}`,
              { method: request.method },
            ))
            response.statusCode = apiResponse.status
            apiResponse.headers.forEach((value, key) => response.setHeader(key, value))
            response.end(await apiResponse.text())
          })
        },
      },
      {
        name: 'meclipse-local-places-api',
        configureServer(server) {
          server.middlewares.use('/api/places', async (request, response) => {
            const apiResponse = await placesResponse(new Request(
              `http://localhost/api/places${request.url || ''}`,
              { method: request.method },
            ), { geoapifyKey: environment.GEOAPIFY_API_KEY })
            response.statusCode = apiResponse.status
            apiResponse.headers.forEach((value, key) => response.setHeader(key, value))
            response.end(await apiResponse.text())
          })
        },
      },
      {
        name: 'meclipse-local-visitors-api',
        configureServer(server) {
          server.middlewares.use('/api/visitors', async (request, response) => {
            const chunks: Buffer[] = []
            for await (const chunk of request) chunks.push(Buffer.from(chunk))
            const apiResponse = await visitorsResponse(new Request(
              'http://localhost/api/visitors',
              {
                method: request.method,
                headers: { 'Content-Type': request.headers['content-type'] || 'application/json' },
                body: chunks.length ? Buffer.concat(chunks) : undefined,
              },
            ), { store: localVisitorStore })
            response.statusCode = apiResponse.status
            apiResponse.headers.forEach((value, key) => response.setHeader(key, value))
            response.end(await apiResponse.text())
          })
        },
      },
    ],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})
