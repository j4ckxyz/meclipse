import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type CoverageCell = { longitude: number; latitude: number; coverage: number; size: number }
type GlobeData = {
  event: { peak: string; kind: string; latitude: number; longitude: number }
  cells: CoverageCell[]
}

type CoverageManifest = {
  events: Array<{ peak: string; kind: string; url: string }>
}

const DAY = 24 * 60 * 60 * 1_000

const LIGHT_GLOBE = {
  space: '#dce3e1',
  water: '#c4d2d2',
  land: '#e7e9e2',
  boundary: '#9aa7a7',
}

const DARK_GLOBE = {
  space: '#10191e',
  water: '#182b33',
  land: '#26363a',
  boundary: '#657477',
}

function globeStyle(dark: boolean): StyleSpecification {
  const colour = dark ? DARK_GLOBE : LIGHT_GLOBE
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, .62, 3, .18],
    },
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      },
    },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      { id: 'space', type: 'background', paint: { 'background-color': colour.land } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': colour.water } },
      { id: 'land', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: { 'fill-color': colour.land, 'fill-opacity': .96 } },
      {
        id: 'boundaries',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['!=', ['get', 'maritime'], 1],
        paint: { 'line-color': colour.boundary, 'line-opacity': .44, 'line-width': .65 },
      },
    ],
  }
}

function coverageGeoJson(cells: CoverageCell[]) {
  return {
    type: 'FeatureCollection' as const,
    features: cells.map((cell) => {
      const half = cell.size / 2
      const west = Math.max(-179.999, cell.longitude - half)
      const east = Math.min(179.999, cell.longitude + half)
      const south = Math.max(-89.9, cell.latitude - half)
      const north = Math.min(89.9, cell.latitude + half)
      return {
      type: 'Feature' as const,
      properties: { coverage: cell.coverage, longitude: cell.longitude, latitude: cell.latitude, size: cell.size },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
      },
    }}),
  }
}

function CoverageGlobe() {
  const container = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<MapLibreMap | null>(null)
  const startsImmediately = typeof window.IntersectionObserver === 'undefined'
  const [nearViewport, setNearViewport] = useState(startsImmediately)
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'empty' | 'failed'>(
    startsImmediately ? 'loading' : 'waiting',
  )
  const [data, setData] = useState<GlobeData | null>(null)
  const [selectedCoverage, setSelectedCoverage] = useState<number | null>(null)

  useEffect(() => {
    if (window.location.hash === '#coverage-globe') container.current?.closest('section')?.scrollIntoView()
  }, [])

  useEffect(() => {
    if (nearViewport || !container.current || typeof window.IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setNearViewport(true)
      setStatus('loading')
      observer.disconnect()
    }, { rootMargin: '360px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [nearViewport])

  useEffect(() => {
    if (!nearViewport) return
    const controller = new AbortController()

    async function loadCoverage() {
      try {
        const manifestResponse = await fetch('/coverage/manifest.json', {
          cache: 'force-cache',
          signal: controller.signal,
        })
        if (!manifestResponse.ok) throw new Error('Coverage manifest unavailable')
        const manifest = await manifestResponse.json() as CoverageManifest
        const now = Date.now()
        const event = manifest.events.find(({ peak }) => {
          const time = new Date(peak).getTime()
          return time >= now - DAY && time <= now + 14 * DAY
        })
        if (!event) {
          setStatus('empty')
          return
        }
        const surfaceResponse = await fetch(event.url, { cache: 'force-cache', signal: controller.signal })
        if (!surfaceResponse.ok) throw new Error('Coverage surface unavailable')
        setData(await surfaceResponse.json() as GlobeData)
      } catch {
        if (!controller.signal.aborted) setStatus('failed')
      }
    }

    void loadCoverage()
    return () => controller.abort()
  }, [nearViewport])

  useEffect(() => {
    if (!data || !container.current || typeof window.WebGLRenderingContext === 'undefined') return
    const globeData = data
    const mapContainer = container.current
    let disposed = false
    const colourScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const preventNativePinch = (event: Event) => event.preventDefault()

    async function createGlobe() {
      try {
        const { default: maplibregl } = await import('maplibre-gl')
        if (disposed) return
        const instance = new maplibregl.Map({
          container: mapContainer,
          style: globeStyle(colourScheme.matches),
          center: [globeData.event.longitude, globeData.event.latitude],
          zoom: .55,
          minZoom: 0,
          maxZoom: 5.5,
          pitchWithRotate: false,
          dragRotate: false,
          scrollZoom: true,
          cooperativeGestures: true,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 0,
        })
        mapInstance.current = instance
        instance.getCanvas().setAttribute('aria-hidden', 'true')
        instance.touchZoomRotate.disableRotation()
        mapContainer.addEventListener('gesturestart', preventNativePinch, { passive: false })
        mapContainer.addEventListener('gesturechange', preventNativePinch, { passive: false })
        instance.on('style.load', () => {
          if (disposed) return
          instance.addSource('coverage', { type: 'geojson', data: coverageGeoJson(globeData.cells) })
          instance.addLayer({
            id: 'coverage-surface',
            type: 'fill',
            source: 'coverage',
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['get', 'coverage'],
                .005, '#4d7182',
                .2, '#6f9bac',
                .45, '#d2b865',
                .7, '#dc874e',
                .9, '#c95437',
                .985, '#f0d59a',
                1, '#f1eee0',
              ],
              'fill-opacity': [
                'case',
                ['>', ['get', 'size'], 1.5],
                ['interpolate', ['linear'], ['get', 'coverage'], .005, .045, .2, .065, .7, .09, 1, .11],
                ['interpolate', ['linear'], ['get', 'coverage'], .005, .08, .2, .14, .7, .24, 1, .31],
              ],
              'fill-antialias': false,
            },
          })
          instance.moveLayer('boundaries')
          instance.addLayer({
            id: 'country-labels',
            type: 'symbol',
            source: 'openmaptiles',
            'source-layer': 'place',
            filter: ['==', ['get', 'class'], 'country'],
            minzoom: 1.5,
            layout: {
              'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
              'text-font': ['Noto Sans Regular'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 1.5, 9, 5, 13],
              'text-transform': 'uppercase',
              'text-letter-spacing': .08,
            },
            paint: {
              'text-color': colourScheme.matches ? '#e1e8e5' : '#26363c',
              'text-halo-color': colourScheme.matches ? '#172329' : '#eef0ea',
              'text-halo-width': 1.3,
              'text-halo-blur': .4,
            },
          })
          instance.addLayer({
            id: 'coverage-hit',
            type: 'fill',
            source: 'coverage',
            paint: { 'fill-opacity': .001 },
          })
          instance.on('mousemove', 'coverage-hit', (event) => {
            const value = Number(event.features?.[0]?.properties?.coverage)
            if (Number.isFinite(value)) setSelectedCoverage(Math.round(value * 100))
            instance.getCanvas().style.cursor = 'crosshair'
          })
          instance.on('mouseleave', 'coverage-hit', () => {
            setSelectedCoverage(null)
            instance.getCanvas().style.cursor = 'grab'
          })
          instance.on('click', 'coverage-hit', (event) => {
            const value = Number(event.features?.[0]?.properties?.coverage)
            if (Number.isFinite(value)) setSelectedCoverage(Math.round(value * 100))
            const longitude = Number(event.features?.[0]?.properties?.longitude)
            const latitude = Number(event.features?.[0]?.properties?.latitude)
            if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
              instance.easeTo({ center: [longitude, latitude], zoom: Math.min(4.2, Math.max(2.2, instance.getZoom() + 1.2)), duration: 650 })
            }
          })
          setStatus('ready')
        })
      } catch {
        if (!disposed) setStatus('failed')
      }
    }

    function updateTheme(event: MediaQueryListEvent) {
      mapInstance.current?.setStyle(globeStyle(event.matches))
      setData((current) => current ? { ...current } : current)
    }

    void createGlobe()
    colourScheme.addEventListener('change', updateTheme)
    return () => {
      disposed = true
      colourScheme.removeEventListener('change', updateTheme)
      mapContainer.removeEventListener('gesturestart', preventNativePinch)
      mapContainer.removeEventListener('gesturechange', preventNativePinch)
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [data])

  function resetView() {
    if (!data) return
    mapInstance.current?.easeTo({ center: [data.event.longitude, data.event.latitude], zoom: .55, duration: 650 })
    setSelectedCoverage(null)
  }

  const eventDate = data
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(data.event.peak))
    : null

  return (
    <section id="coverage-globe" className="coverage-globe-section" aria-labelledby="coverage-globe-title">
      <div className="globe-copy">
        <p className="preview-kicker">Across the world</p>
        <h2 id="coverage-globe-title">Follow the shadow</h2>
        <p>Drag the globe to explore where the next eclipse reaches furthest. The colour shows the greatest visible coverage at each place.</p>
        {eventDate && <p className="globe-date">Solar eclipse · {eventDate}</p>}
        <div className="coverage-legend" aria-label="Eclipse coverage colour scale">
          <span>Less</span><i aria-hidden="true" /><span>Total</span>
        </div>
        <p className="coverage-selection" aria-live="polite">
          {selectedCoverage === null ? 'Hover to read a local estimate. Tap a coloured area to inspect that country.' : <><strong>{selectedCoverage}%</strong> maximum coverage around this point</>}
        </p>
      </div>
      <div className={`globe-frame globe-${status}`}>
        <div ref={container} className="globe-map" aria-hidden="true" />
        <div className="globe-fallback" aria-hidden="true"><span /></div>
        {status === 'loading' && <p className="globe-state"><span /> Loading the eclipse path…</p>}
        {status === 'empty' && <p className="globe-state">No worldwide solar eclipse is due in the next fortnight.</p>}
        {status === 'failed' && <p className="globe-state">The interactive globe is unavailable. Location checking still works.</p>}
        {status === 'ready' && (
          <button className="globe-reset" onClick={resetView}><RotateCcw size={14} /> Centre the shadow</button>
        )}
        <span className="globe-drag-note">Drag to turn · pinch to zoom</span>
        <span className="globe-attribution"><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></span>
      </div>
    </section>
  )
}

export default CoverageGlobe
