import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const source = new URL('../public/og-image.svg', import.meta.url)
const destination = new URL('../public/og-image.png', import.meta.url)
const svg = await readFile(source)

await sharp(svg, { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9, palette: true })
  .toFile(fileURLToPath(destination))

console.log('Generated public/og-image.png (1200×630)')
