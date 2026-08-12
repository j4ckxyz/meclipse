import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, LocateFixed, Search, ShieldCheck } from 'lucide-react'
import ShareMenu from './components/ShareMenu'
import VisitorCount from './components/VisitorCount'
import GitHubStarLink from './components/GitHubStarLink'
import CalendarLink from './components/CalendarLink'
import VisibilityMap from './components/VisibilityMap'
import {
  eclipseDescription,
  eclipseName,
  eclipseStatus,
  findUpcomingEclipse,
  type Coordinates,
  type EclipseResult,
} from './lib/eclipse'
import {
  formatCentralDuration,
  formatDate,
  formatDuration,
  formatShortTime,
  formatTime,
  formatTimeZone,
} from './lib/format'
import { searchPlaces, type Place } from './lib/geocoding'
import { parseLocationInput } from './lib/locationInput'
import { locationPath, parseLocationPath } from './lib/routes'

type View =
  | { name: 'start' }
  | { name: 'result'; result: EclipseResult; place: string; coordinates: Coordinates }
  | { name: 'empty'; place: string }

function viewFor(coordinates: Coordinates, place: string): View {
  const result = findUpcomingEclipse(coordinates, new Date())
  return result ? { name: 'result', result, place, coordinates } : { name: 'empty', place }
}

function initialView(): View {
  const route = parseLocationPath(window.location.pathname)
  return route ? viewFor(route, route.label) : { name: 'start' }
}

function App() {
  const [view, setView] = useState<View>(initialView)
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleNavigation = () => {
      const route = parseLocationPath(window.location.pathname)
      setView(route ? viewFor(route, route.label) : { name: 'start' })
      setPlaces([])
      setError('')
    }
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (view.name !== 'start' || trimmed.length < 3) return
    const direct = parseLocationInput(trimmed)
    if (direct) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setBusy(true)
      setError('')
      try {
        const matches = await searchPlaces(trimmed)
        if (!controller.signal.aborted) setPlaces(matches)
      } catch (caught) {
        if (controller.signal.aborted) return
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Place search failed. Try again shortly.')
      } finally {
        if (!controller.signal.aborted) setBusy(false)
      }
    }, 280)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, view.name])

  const directQueryPlace = view.name === 'start' ? parseLocationInput(query) : null
  const visiblePlaces = directQueryPlace ? [directQueryPlace] : places

  useEffect(() => {
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    const origin = import.meta.env.VITE_SITE_URL || (
      import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL}`
        : window.location.origin
    )
    if (canonical) canonical.href = `${origin}${window.location.pathname}`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = view.name === 'result'
      ? `${Math.round(view.result.coverage * 100)}% solar eclipse coverage in ${view.place}, with local contact times.`
      : view.name === 'empty'
        ? `There is no solar eclipse visible in ${view.place} during the next fortnight.`
        : 'Check whether the solar eclipse is visible where you are — and how much of the Sun will disappear.'
    document.title = view.name === 'result'
      ? `${eclipseName(view.result.kind)} visible from ${view.place} — Meclipse`
      : view.name === 'empty'
        ? `No eclipse coming up in ${view.place} — Meclipse`
        : 'Meclipse — is the eclipse visible where you are?'
  }, [view])

  function showFor(coordinates: Coordinates, place: string, replace = false) {
    const path = locationPath(coordinates, place)
    window.history[replace ? 'replaceState' : 'pushState']({ place }, '', path)
    setView(viewFor(coordinates, place))
    setPlaces([])
    setError('')
    requestAnimationFrame(() => resultsRef.current?.focus())
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('This browser cannot find your location. Enter a place instead.')
      return
    }

    setBusy(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBusy(false)
        showFor({ latitude: coords.latitude, longitude: coords.longitude }, 'Your location')
      },
      (locationError) => {
        setBusy(false)
        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError('Location access was not allowed. Enter a place instead.')
        } else {
          setError('Your location could not be found. Enter a place instead.')
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  async function submitAddress(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    const direct = parseLocationInput(query)
    if (direct) {
      showFor(direct, direct.name)
      return
    }
    setBusy(true)
    setError('')
    setPlaces([])
    try {
      const matches = await searchPlaces(query)
      if (matches[0]) {
        showFor(matches[0], matches[0].name)
      } else {
        setError('No matching place found. Try a town or postcode.')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Address search failed. Try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    window.history.pushState({}, '', '/')
    setView({ name: 'start' })
    setQuery('')
    setPlaces([])
    setError('')
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="wordmark" onClick={reset} aria-label="Meclipse home">
          <span className="brand-orbit" aria-hidden="true"><span /></span>
          meclipse
        </button>
        <p className="header-note">A clear answer for your patch of Earth</p>
      </header>

      <main>
        {view.name === 'start' && (
          <section className="finder" aria-labelledby="page-title">
            <div className="finder-copy">
              <p className="eyebrow">Solar eclipse checker</p>
              <h1 id="page-title">Will the Sun<br /><em>disappear</em> here?</h1>
              <p className="intro">
                Find out whether the next solar eclipse will reach you — and how much of it you’ll see.
              </p>
            </div>

            <div className="finder-panel">
              <button className="primary-action" onClick={useMyLocation} disabled={busy}>
                <LocateFixed aria-hidden="true" size={19} strokeWidth={1.8} />
                {busy ? 'Finding you…' : 'Use my location'}
                <ArrowRight className="action-arrow" aria-hidden="true" size={19} />
              </button>
              <p className="privacy-note"><ShieldCheck size={14} aria-hidden="true" /> No account, saved location or tracking</p>

              <div className="or"><span>or search for a place</span></div>
              <form className="address-form" onSubmit={submitAddress}>
                <label htmlFor="address">Place, postcode or map link</label>
                <div className="input-row">
                  <input
                    id="address"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPlaces([])
                    }}
                    placeholder="Town, postcode, coordinates or map link"
                    autoComplete="off"
                    type="search"
                    aria-controls="place-results"
                    aria-expanded={visiblePlaces.length > 0}
                  />
                  <button type="submit" aria-label="Search" disabled={busy || !query.trim()}>
                    <Search size={19} aria-hidden="true" />
                  </button>
                </div>
              </form>

              {error && <p className="error" role="alert">{error}</p>}
              <div className="search-status" aria-live="polite">
                {busy && query.trim().length >= 3 ? 'Searching…' : ''}
              </div>
              {visiblePlaces.length > 0 && (
                <div className="place-results" id="place-results" aria-label="Place matches">
                  {visiblePlaces.map((place) => (
                    <button key={place.id} onClick={() => showFor(place, place.name)}>
                      <span><strong>{place.name}</strong>{place.description && <small>{place.description}</small>}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view.name === 'result' && (
          <ResultView
            result={view.result}
            place={view.place}
            coordinates={view.coordinates}
            now={now}
            reset={reset}
            resultsRef={resultsRef}
          />
        )}

        {view.name === 'empty' && (
          <section className="empty-view" ref={resultsRef} tabIndex={-1}>
            <div className="quiet-sun" aria-hidden="true"><span /></div>
            <p className="eyebrow">{view.place}</p>
            <h1>No eclipse is coming up here.</h1>
            <p>There isn’t a visible solar eclipse in the next fortnight.</p>
            <div className="empty-actions">
              <button className="text-action" onClick={reset}><ArrowLeft size={17} /> Check another place</button>
              <ShareMenu label="Share result" />
            </div>
          </section>
        )}
      </main>

      <footer>
        <div className="footer-primary"><VisitorCount /><p>Calculated on your device using astronomical data.</p><GitHubStarLink /></div>
        <p>Search by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, <a href="https://postcodes.io/" target="_blank" rel="noreferrer">Postcodes.io</a>, <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> and <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>.</p>
      </footer>
    </div>
  )
}

type ResultProps = {
  result: EclipseResult
  place: string
  coordinates: Coordinates
  now: Date
  reset: () => void
  resultsRef: React.RefObject<HTMLDivElement | null>
}

function ResultView({ result, place, coordinates, now, reset, resultsRef }: ResultProps) {
  const coverage = Math.round(result.coverage * 100)
  const phase = eclipseStatus(result, now)
  const shadowOffset = `${Math.max(0, (1 - result.coverage) * 82)}%`
  const locationLabel = place.length > 68 ? `${place.slice(0, 65)}…` : place

  return (
    <section className="result-view" ref={resultsRef} tabIndex={-1} aria-labelledby="result-title">
      <div className="result-actions">
        <button className="back-action" onClick={reset}><ArrowLeft size={17} /> Change location</button>
        <ShareMenu coverage={coverage} />
      </div>
      <div className="result-grid">
        <div className="eclipse-stage" aria-label={`${coverage}% of the Sun covered`}>
          <p className="stage-label"><span className="live-dot" />{phase}</p>
          <div className={`eclipse-disc ${result.kind}`} aria-hidden="true">
            <span className="sun-disc" />
            <span className="moon-disc" style={{ left: shadowOffset }} />
          </div>
          <div className="coverage-readout"><strong>{coverage}%</strong><span>of the Sun<br />covered</span></div>
        </div>

        <div className="result-copy">
          <p className="eyebrow location-label">{locationLabel}</p>
          <h1 id="result-title">Yes — you’ll see a<br /><em>{eclipseName(result.kind).toLowerCase()}</em>.</h1>
          <p className="result-intro">{eclipseDescription(result.kind, result.coverage)}</p>

          <dl className="facts">
            <div className="fact-wide">
              <dt>Date</dt><dd>{formatDate(result.peak, result.timeZone)}</dd>
            </div>
            <div><dt>Begins</dt><dd>{formatShortTime(result.begins, result.timeZone)}</dd></div>
            <div className="peak-fact"><dt>Maximum</dt><dd>{formatTime(result.peak, result.timeZone)}</dd></div>
            <div><dt>Ends</dt><dd>{formatShortTime(result.ends, result.timeZone)}</dd></div>
            <div><dt>Duration</dt><dd>{formatDuration(result.durationMinutes)}</dd></div>
            {result.centralPhaseSeconds !== undefined && (
              <div><dt>{result.kind === 'total' ? 'Totality' : 'Ring phase'}</dt><dd>{formatCentralDuration(result.centralPhaseSeconds)}</dd></div>
            )}
          </dl>
          <p className="time-zone-note">Times shown in {formatTimeZone(result.peak, result.timeZone)}</p>

          <CalendarLink result={result} place={place} />

          <aside className="safety-note">
            <ShieldCheck size={20} aria-hidden="true" />
            <p><strong>Protect your eyes.</strong> Use certified eclipse glasses. Ordinary sunglasses are not safe.</p>
          </aside>
        </div>
      </div>
      <VisibilityMap coordinates={coordinates} peak={result.peak} />
    </section>
  )
}

export default App
