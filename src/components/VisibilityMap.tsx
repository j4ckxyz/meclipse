import { useEffect, useMemo, useRef, useState } from 'react'
import { CloudSun, Mountain, Navigation } from 'lucide-react'
import type { Coordinates } from '../lib/eclipse'
import { fetchVisibilityOutlook, type VisibilityOutlook, type VisibilityPoint } from '../lib/visibility'
import 'maplibre-gl/dist/maplibre-gl.css'

function recommendation(points: VisibilityPoint[], origin: Coordinates) {
  return [...points].sort((a, b) => {
    const distanceA = Math.hypot(a.latitude - origin.latitude, a.longitude - origin.longitude)
    const distanceB = Math.hypot(b.latitude - origin.latitude, b.longitude - origin.longitude)
    return b.score - a.score || distanceA - distanceB
  })[0]
}

export default function VisibilityMap({ coordinates, peak }: { coordinates: Coordinates; peak: Date }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const [outlook, setOutlook] = useState<VisibilityOutlook | null>(null)
  const [error, setError] = useState('')
  const best = useMemo(() => outlook ? recommendation(outlook.points, coordinates) : null, [outlook, coordinates])

  useEffect(() => {
    const controller = new AbortController()
    fetchVisibilityOutlook(coordinates.latitude, coordinates.longitude, peak, controller.signal)
      .then(setOutlook)
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Visibility data is unavailable right now.')
      })
    return () => controller.abort()
  }, [coordinates.latitude, coordinates.longitude, peak])

  useEffect(() => {
    if (!outlook || !mapContainer.current) return
    let removed = false
    let map: import('maplibre-gl').Map | undefined
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (removed || !mapContainer.current) return
      map = new maplibregl.Map({
        container: mapContainer.current,
        center: [coordinates.longitude, coordinates.latitude],
        zoom: 7.4,
        attributionControl: false,
        style: {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.75, 'raster-opacity': 0.72 } }],
        },
      })
      map.on('load', () => {
        map?.addSource('visibility', { type: 'geojson', data: {
          type: 'FeatureCollection',
          features: outlook.points.map((point) => ({ type: 'Feature', properties: point, geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] } })),
        } })
        map?.addLayer({ id: 'visibility-heat', type: 'circle', source: 'visibility', paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 27, 9, 46],
          'circle-color': ['interpolate', ['linear'], ['get', 'score'], 0, '#9c4f3e', 45, '#d59b53', 70, '#a7bd79', 100, '#397f72'],
          'circle-opacity': 0.72,
          'circle-blur': 0.32,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,.72)',
        } })
        new maplibregl.Marker({ color: '#172026' }).setLngLat([coordinates.longitude, coordinates.latitude]).addTo(map!)
        if (best) new maplibregl.Marker({ color: '#397f72', scale: 0.82 }).setLngLat([best.longitude, best.latitude]).addTo(map!)
      })
    })
    return () => { removed = true; map?.remove() }
  }, [outlook, coordinates, best])

  return (
    <section className="visibility-section" aria-labelledby="visibility-title">
      <div className="visibility-heading">
        <div>
          <p className="eyebrow">Local viewing outlook</p>
          <h2 id="visibility-title">Find a clearer patch of sky.</h2>
          <p>Cloud forecast and elevation are combined to highlight nearby places with better viewing potential.</p>
        </div>
        <div className="visibility-legend" aria-label="Map legend"><span><i className="poor" /> Lower</span><span><i className="good" /> Better visibility</span></div>
      </div>
      <div className="visibility-card">
        <div className="visibility-map" ref={mapContainer} role="img" aria-label="Map of predicted eclipse visibility near your location">
          {!outlook && !error && <p className="map-status">Reading the sky and terrain…</p>}
          {error && <p className="map-status error" role="alert">{error}</p>}
        </div>
        <div className="visibility-summary">
          {best && <>
            <p className="visibility-score"><strong>{best.score}</strong><span>/ 100<br />viewing outlook</span></p>
            <h3>{outlook?.forecastAvailable ? 'Your best nearby outlook' : 'Higher-ground guide'}</h3>
            <dl>
              <div><CloudSun size={17} /><dt>Cloud cover</dt><dd>{best.cloudCover}%</dd></div>
              <div><Mountain size={17} /><dt>Elevation</dt><dd>{Math.round(best.elevation)} m</dd></div>
              <div><Navigation size={17} /><dt>Coordinates</dt><dd>{best.latitude.toFixed(2)}, {best.longitude.toFixed(2)}</dd></div>
            </dl>
            <a href={`https://www.openstreetmap.org/directions?from=${coordinates.latitude},${coordinates.longitude}&to=${best.latitude},${best.longitude}`} target="_blank" rel="noreferrer">Plan a route</a>
          </>}
          {!outlook?.forecastAvailable && outlook && <p className="forecast-note">Cloud forecasts only become reliable closer to the eclipse. For now, the map favours higher terrain; check again within 16 days.</p>}
          {outlook?.forecastAvailable && <p className="forecast-note">Forecasts can change quickly, and local ridges may block a low Sun. Recheck before travelling and choose a safe, publicly accessible viewpoint.</p>}
        </div>
      </div>
    </section>
  )
}
