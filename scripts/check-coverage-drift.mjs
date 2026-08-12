import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const manifestPath = 'public/coverage/manifest.json'
const generated = JSON.parse(await readFile(manifestPath, 'utf8'))
const committed = JSON.parse(execFileSync('git', ['show', `HEAD:${manifestPath}`], { encoding: 'utf8' }))

delete generated.generatedAt
delete committed.generatedAt

if (JSON.stringify(generated) !== JSON.stringify(committed)) {
  console.error('The committed coverage manifest no longer contains the next eight eclipses.')
  console.error('Run npm run generate:coverage and commit the refreshed coverage files.')
  process.exitCode = 1
} else {
  console.log('The committed coverage manifest still contains the next eight eclipses.')
}
