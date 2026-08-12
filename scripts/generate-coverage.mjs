import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextGlobalSolarEclipse, SearchGlobalSolarEclipse } from 'astronomy-engine'
import { generateCoverageSurface } from '../src/lib/coverageSurface.ts'

const EVENT_COUNT = Number(process.env.COVERAGE_EVENT_COUNT ?? 8)
const forceGeneration = process.env.COVERAGE_FORCE === '1'
const outputDirectory = join(process.cwd(), 'public', 'coverage')
const generatedAt = new Date()
const events = []
let eclipse = SearchGlobalSolarEclipse(new Date(generatedAt.getTime() - 12 * 60 * 60 * 1_000))

await mkdir(outputDirectory, { recursive: true })

for (let index = 0; index < EVENT_COUNT; index += 1) {
  const peak = eclipse.peak.date
  const date = peak.toISOString().slice(0, 10)
  const filename = `${date}.json`
  const started = performance.now()
  let document
  try {
    if (forceGeneration) throw new Error('Forced regeneration')
    document = JSON.parse(await readFile(join(outputDirectory, filename), 'utf8'))
    if (document.version !== 5) throw new Error('Outdated surface')
    console.log(`Reused ${filename}: ${document.cells.length} cells`)
  } catch {
    const surface = generateCoverageSurface(peak, {
      latitude: eclipse.latitude,
      longitude: eclipse.longitude,
    })
    document = {
      version: 5,
      event: {
        peak: peak.toISOString(),
        kind: eclipse.kind,
        latitude: surface.centre.latitude,
        longitude: surface.centre.longitude,
      },
      cells: surface.cells.map((cell) => ({
        ...cell,
        coverage: Math.round(cell.coverage * 10_000) / 10_000,
      })),
    }
    await writeFile(join(outputDirectory, filename), JSON.stringify(document))
    console.log(`Generated ${filename}: ${surface.cells.length} cells in ${((performance.now() - started) / 1_000).toFixed(1)}s`)
  }
  events.push({ peak: peak.toISOString(), kind: eclipse.kind, url: `/coverage/${filename}` })
  eclipse = NextGlobalSolarEclipse(eclipse.peak)
}

await writeFile(join(outputDirectory, 'manifest.json'), JSON.stringify({
  version: 5,
  generatedAt: generatedAt.toISOString(),
  events,
}, null, 2))
console.log(`Generated coverage manifest for ${events.length} forthcoming eclipses.`)
