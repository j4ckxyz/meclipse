import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ApproximateMap } from '../lib/approximateMap'
import type { EclipseResult } from '../lib/eclipse'
import { solarDiscGeometry } from '../lib/solarGeometry'

type RegionalMapProps = {
  map: ApproximateMap
  place: string
  result: EclipseResult
}

function regionalCoverage(area: ApproximateMap, peak: Date) {
  const samples: Array<{ longitude: number; latitude: number; coverage: number }> = []
  const latitudeStep = .18
  const longitudeStep = .24
  for (let row = -5; row <= 5; row += 1) {
    for (let column = -6; column <= 6; column += 1) {
      const latitude = area.latitude + row * latitudeStep
      const longitude = area.longitude + column * longitudeStep
      let coverage = 0
      for (const offsetMinutes of [-10, -5, 0, 5, 10]) {
        const geometry = solarDiscGeometry({ latitude, longitude }, new Date(peak.getTime() + offsetMinutes * 60_000))
        if (geometry.sunAltitude > 0) coverage = Math.max(coverage, geometry.coverage)
      }
      samples.push({ latitude, longitude, coverage })
    }
  }
  const minimum = Math.min(...samples.map(({ coverage }) => coverage))
  const maximum = Math.max(...samples.map(({ coverage }) => coverage))
  const range = Math.max(.0001, maximum - minimum)
  return {
    type: 'FeatureCollection' as const,
    features: samples.map(({ latitude, longitude, coverage }) => ({
      type: 'Feature' as const,
      properties: { coverage, localScore: (coverage - minimum) / range },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [longitude - longitudeStep / 2, latitude - latitudeStep / 2],
          [longitude + longitudeStep / 2, latitude - latitudeStep / 2],
          [longitude + longitudeStep / 2, latitude + latitudeStep / 2],
          [longitude - longitudeStep / 2, latitude + latitudeStep / 2],
          [longitude - longitudeStep / 2, latitude - latitudeStep / 2],
        ]],
      },
    })),
  }
}

type MapPalette = {
  background: string
  boundary: string
  label: string
  labelHalo: string
  land: string
  park: string
  road: string
  roadMajor: string
  water: string
}

const LIGHT_MAP: MapPalette = {
  background: '#dfe3de',
  land: '#d7ddd7',
  park: '#c8d3c8',
  water: '#aebfc4',
  road: '#c0c7c2',
  roadMajor: '#f0eee5',
  boundary: '#849397',
  label: '#26363c',
  labelHalo: '#e9ece6',
}

const DARK_MAP: MapPalette = {
  background: '#172329',
  land: '#1c2b30',
  park: '#22332f',
  water: '#233f49',
  road: '#334249',
  roadMajor: '#657177',
  boundary: '#58676c',
  label: '#d8e1de',
  labelHalo: '#172329',
}

function meclipseMapStyle(dark: boolean): StyleSpecification {
  const colour = dark ? DARK_MAP : LIGHT_MAP
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': colour.background } },
      { id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: { 'fill-color': colour.land, 'fill-opacity': .74 } },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': colour.park, 'fill-opacity': .8 } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': colour.water } },
      {
        id: 'boundaries',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['!=', ['get', 'maritime'], 1],
        paint: { 'line-color': colour.boundary, 'line-dasharray': [2, 2], 'line-opacity': .62, 'line-width': 1 },
      },
      {
        id: 'minor-roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
        paint: { 'line-color': colour.road, 'line-opacity': .62, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .25, 10, 1.4] },
      },
      {
        id: 'major-roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false],
        paint: { 'line-color': colour.roadMajor, 'line-opacity': .88, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, .7, 10, 2.3] },
      },
      {
        id: 'places',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
        layout: {
          'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 13],
          'text-max-width': 8,
        },
        paint: {
          'text-color': colour.label,
          'text-halo-color': colour.labelHalo,
          'text-halo-width': 1.2,
          'text-halo-blur': .25,
        },
      },
    ],
  }
}

function RegionalMap({ map: area, place, result }: RegionalMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<MapLibreMap | null>(null)
  const supportsWebGl = typeof window.WebGLRenderingContext !== 'undefined'
  const [nearViewport, setNearViewport] = useState(() => typeof window.IntersectionObserver === 'undefined')
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'failed'>(supportsWebGl ? 'waiting' : 'failed')

  useEffect(() => {
    if (nearViewport || !container.current || typeof window.IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setNearViewport(true)
      observer.disconnect()
    }, { rootMargin: '220px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [nearViewport])

  useEffect(() => {
    if (!nearViewport || !supportsWebGl || !container.current) return
    let disposed = false
    const colourScheme = window.matchMedia('(prefers-color-scheme: dark)')

    async function createMap() {
      setStatus('loading')
      try {
        const { default: maplibregl } = await import('maplibre-gl')
        if (disposed || !container.current) return
        const instance = new maplibregl.Map({
          container: container.current,
          style: meclipseMapStyle(colourScheme.matches),
          center: [area.longitude, area.latitude],
          zoom: 8.25,
          minZoom: 8.25,
          maxZoom: 8.25,
          interactive: false,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 0,
        })
        mapInstance.current = instance
        instance.getCanvas().setAttribute('aria-hidden', 'true')
        const loadTimeout = window.setTimeout(() => {
          if (!disposed && !instance.loaded()) setStatus('failed')
        }, 8_000)
        instance.on('style.load', () => {
          if (disposed) return
          instance.addSource('local-coverage', { type: 'geojson', data: regionalCoverage(area, result.peak) })
          instance.addLayer({
            id: 'local-coverage',
            type: 'fill',
            source: 'local-coverage',
            paint: {
              'fill-color': ['interpolate', ['linear'], ['get', 'localScore'], 0, '#557f93', .45, '#d6bd72', .72, '#d88450', 1, '#b74d38'],
              'fill-opacity': ['interpolate', ['linear'], ['get', 'localScore'], 0, .18, 1, .48],
              'fill-antialias': false,
            },
          }, 'boundaries')
          instance.once('idle', () => {
            window.clearTimeout(loadTimeout)
            if (!disposed) setStatus('ready')
          })
        })
      } catch {
        if (!disposed) setStatus('failed')
      }
    }

    function updateTheme(event: MediaQueryListEvent) {
      mapInstance.current?.setStyle(meclipseMapStyle(event.matches))
    }

    void createMap()
    colourScheme.addEventListener('change', updateTheme)
    return () => {
      disposed = true
      colourScheme.removeEventListener('change', updateTheme)
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [area, nearViewport, result.peak, supportsWebGl])

  return (
    <div className={`map-frame native-area-map map-${status}`}>
      <div className="map-visual" role="img" aria-label={`A broad, deliberately imprecise map around ${place}`}>
        <div ref={container} className="maplibre-field" aria-hidden="true" />
        <div className="map-fallback-field" aria-hidden="true" />
        <div className="map-ready-overlay" aria-hidden={status !== 'ready'}>
          <div className="map-tone" />
          <div className="map-coordinate-grid" />
          <div className="map-area-aperture"><span /></div>
          <span className="map-area-label">Your broad viewing area</span>
          <span className="map-privacy-label"><ShieldCheck size={13} /> No precise pin</span>
          <span className="map-coverage-key"><i /> Relative eclipse coverage <small>lower → higher</small></span>
        </div>
        {status === 'loading' && <span className="map-load-state">Drawing the region…</span>}
        {status === 'failed' && <span className="map-load-state">Map unavailable · the location result still works</span>}
      </div>
      <span className="map-attribution">
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>{' · '}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a>{' · '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
      </span>
    </div>
  )
}

export default RegionalMap
