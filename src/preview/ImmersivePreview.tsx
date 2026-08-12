import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  LocateFixed,
  MapPinOff,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import ShareMenu from '../components/ShareMenu'
import VisitorCount from '../components/VisitorCount'
import GitHubStarLink from '../components/GitHubStarLink'
import CalendarLink from '../components/CalendarLink'
import { approximateMap } from '../lib/approximateMap'
import { approximateCoordinates } from '../lib/approximateMap'
import {
  eclipseDescription,
  eclipseName,
  findUpcomingEclipse,
  type Coordinates,
  type EclipseResult,
} from '../lib/eclipse'
import { formatDate, formatShortTime, formatTime } from '../lib/format'
import { geolocationFailure, type GeolocationFailure } from '../lib/geolocationMessage'
import { searchPlaces, type Place } from '../lib/geocoding'
import { parseLocationInput } from '../lib/locationInput'
import { locationPath, parseLocationPath } from '../lib/routes'
import {
  calculateLiveEclipse,
  countdownParts,
  eclipseCountdown,
} from '../lib/liveEclipse'
import RegionalMap from './RegionalMap'
import CoverageGlobe from './CoverageGlobe'
import './preview.css'

type Selection = {
  coordinates: Coordinates
  place: string
  result: EclipseResult
}

const PARIS = { latitude: 48.8566, longitude: 2.3522 }
const PARIS_RESULT = findUpcomingEclipse(PARIS, new Date('2026-08-12T12:00:00Z'))!
const DEMO_START = new Date(PARIS_RESULT.begins.getTime() - 5_000)

function demoSelection(): Selection {
  return {
    coordinates: PARIS,
    place: 'Paris, France',
    result: PARIS_RESULT,
  }
}

function selectionFromRoute(): Selection | null {
  const pathname = window.location.pathname.replace(/^\/preview\/area/, '/at')
  const route = parseLocationPath(pathname)
  if (!route) return null
  const result = findUpcomingEclipse(route, new Date())
  return result ? { coordinates: route, place: route.label, result } : null
}

function areaPath(coordinates: Coordinates, place: string, isPrototype: boolean): string {
  const path = locationPath(approximateCoordinates(coordinates), place)
  return isPrototype ? path.replace(/^\/at/, '/preview/area') : path
}

function ImmersivePreview() {
  const isPrototype = window.location.pathname.startsWith('/preview')
  const startsInDemo = window.location.pathname === '/preview/live'
  const [selection, setSelection] = useState<Selection | null>(startsInDemo ? demoSelection : selectionFromRoute)
  const [noEclipsePlace, setNoEclipsePlace] = useState('')
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [locationError, setLocationError] = useState<GeolocationFailure | null>(null)
  const [now, setNow] = useState(startsInDemo ? DEMO_START : new Date())
  const [simulating, setSimulating] = useState(startsInDemo)
  const [playing, setPlaying] = useState(startsInDemo)
  const [commencement, setCommencement] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)

  const live = useMemo(
    () => selection ? calculateLiveEclipse(selection.result, selection.coordinates, now) : null,
    [now, selection],
  )
  const maximumPreview = useMemo(
    () => selection ? calculateLiveEclipse(selection.result, selection.coordinates, selection.result.peak) : null,
    [selection],
  )
  const wasActive = useRef(live?.active ?? false)

  useEffect(() => {
    if (simulating && !playing) return
    const interval = simulating || live?.active ? 1_000 : 30_000
    const timer = window.setInterval(() => {
      setNow((current) => simulating ? new Date(current.getTime() + 1_000) : new Date())
    }, interval)
    return () => window.clearInterval(timer)
  }, [live?.active, playing, simulating])

  useEffect(() => {
    if (live?.active && !wasActive.current) {
      setCommencement(true)
      const timer = window.setTimeout(() => setCommencement(false), 5_000)
      wasActive.current = true
      return () => window.clearTimeout(timer)
    }
    wasActive.current = live?.active ?? false
  }, [live?.active])

  useEffect(() => {
    const trimmed = query.trim()
    if (selection || noEclipsePlace || trimmed.length < 3) return
    const direct = parseLocationInput(trimmed)
    if (direct) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        const matches = await searchPlaces(trimmed)
        if (!controller.signal.aborted) setPlaces(matches)
      } catch (caught) {
        if (!controller.signal.aborted) {
          setSearchError(caught instanceof Error ? caught.message : 'Place search is unavailable just now.')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 420)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [noEclipsePlace, query, selection])

  function selectPlace(coordinates: Coordinates, place: string, reference = new Date()) {
    const result = findUpcomingEclipse(coordinates, reference)
    window.history.pushState({}, '', areaPath(coordinates, place, isPrototype))
    setPlaces([])
    setLocationError(null)
    setSearchError('')
    if (!result) {
      setSelection(null)
      setNoEclipsePlace(place)
      return
    }
    setNoEclipsePlace('')
    setSelection({ coordinates, place, result })
    setNow(new Date())
    setSimulating(false)
    setPlaying(true)
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(geolocationFailure())
      searchInput.current?.focus()
      return
    }
    setLocating(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        selectPlace({ latitude: coords.latitude, longitude: coords.longitude }, 'Your general area')
      },
      (error) => {
        setLocating(false)
        setLocationError(geolocationFailure(error.code))
        searchInput.current?.focus()
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    )
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    const direct = parseLocationInput(query)
    if (direct) {
      selectPlace(direct, direct.name)
      return
    }
    setSearching(true)
    setSearchError('')
    try {
      const matches = await searchPlaces(query)
      if (matches[0]) selectPlace(matches[0], matches[0].name)
      else setSearchError('No matching place found. Try a nearby town or postcode.')
    } catch (caught) {
      setSearchError(caught instanceof Error ? caught.message : 'Place search is unavailable just now.')
    } finally {
      setSearching(false)
    }
  }

  function reset() {
    window.history.pushState({}, '', isPrototype ? '/preview' : '/')
    setSelection(null)
    setNoEclipsePlace('')
    setQuery('')
    setPlaces([])
    setLocationError(null)
    setSearchError('')
    setNow(new Date())
    setSimulating(false)
  }

  const shownEclipse = live?.active ? live : maximumPreview
  const depth = live?.active ? Math.min(0.74, live.coverage * 0.74) : 0
  const previewStyle = {
    '--eclipse-depth': depth,
    '--moon-x': `${shownEclipse?.offsetPercent ?? -108}%`,
    '--moon-scale': shownEclipse?.moonScale ?? 1,
  } as CSSProperties
  const directQueryPlace = !selection && !noEclipsePlace ? parseLocationInput(query) : null
  const visiblePlaces = directQueryPlace ? [directQueryPlace] : places

  return (
    <div className={`immersive-preview ${live?.active ? 'eclipse-active' : ''} ${selection && live?.stage === 'before' ? 'maximum-preview' : ''} ${commencement ? 'eclipse-commencing' : ''}`} style={previewStyle}>
      <div className="eclipse-veil" aria-hidden="true" />
      {commencement && <p className="commencement-message" role="status"><Sparkles size={17} /> First contact. The eclipse has begun here.</p>}

      <header className="preview-header">
        <button className="preview-wordmark" onClick={reset} aria-label="Meclipse home">
          <span className="brand-orbit" aria-hidden="true"><span /></span> meclipse
        </button>
        {isPrototype && <span className="prototype-label">Local prototype</span>}
        {isPrototype && <a href="/" className="leave-preview"><ArrowLeft size={15} /> Production view</a>}
      </header>

      {!selection && !noEclipsePlace && (
        <>
          <main className="preview-finder">
            <section className="preview-finder-copy">
              <p className="preview-kicker">Look up. Know what’s happening.</p>
              <h1>Meet the shadow<br /><em>where you are.</em></h1>
              <p>Live local coverage, contact times and a deliberately vague map of your viewing area.</p>
              {isPrototype && <a className="demo-link" href="/preview/live"><Play size={16} fill="currentColor" /> Watch the Paris demo</a>}
            </section>

            <section className="preview-search" aria-label="Choose a location">
            <button className="preview-location-button" onClick={useMyLocation} disabled={locating}>
              <LocateFixed size={20} aria-hidden="true" />
              <span><strong>{locating ? 'Finding your area…' : 'Use my location'}</strong><small>Fastest when this device supports it</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>

            {locationError && (
              <div className="location-fallback" role="alert">
                <MapPinOff size={22} aria-hidden="true" />
                <div><strong>{locationError.title}</strong><p>{locationError.message}</p></div>
              </div>
            )}

            <div className="preview-divider"><span>Or start typing</span></div>
            <form onSubmit={submitSearch} className="preview-search-form">
              <label htmlFor="preview-place">Place, postcode or map link</label>
              <div className="preview-input-row">
                <Search size={18} aria-hidden="true" />
                <input
                  ref={searchInput}
                  id="preview-place"
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPlaces([])
                    setSearchError('')
                  }}
                  placeholder="Town, postcode, coordinates or map link"
                  autoComplete="off"
                  aria-controls="preview-place-results"
                  aria-expanded={visiblePlaces.length > 0}
                />
                <span className={`search-pulse ${searching ? 'is-searching' : ''}`} aria-hidden="true" />
              </div>
              <p className="typeahead-note" aria-live="polite">
                {searching ? 'Searching…' : query.trim().length > 0 && query.trim().length < 3 ? 'Keep typing…' : 'Suggestions appear after three characters'}
              </p>
            </form>
            {searchError && <p className="preview-search-error" role="alert">{searchError}</p>}
            {visiblePlaces.length > 0 && (
              <div className="preview-place-results" id="preview-place-results" aria-label="Place suggestions">
                {visiblePlaces.map((place) => (
                  <button key={place.id} onClick={() => selectPlace(place, place.name)}>
                    <span><strong>{place.name}</strong><small>{place.description}</small></span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
            )}
            <p className="preview-privacy"><ShieldCheck size={14} /> Exact coordinates stay in this tab.</p>
            </section>
          </main>
          <CoverageGlobe />
        </>
      )}

      {selection && live && (
        <LiveResult
          selection={selection}
          live={live}
          now={now}
          simulating={simulating}
          playing={playing}
          setPlaying={setPlaying}
          setNow={setNow}
          setSimulating={setSimulating}
          reset={reset}
        />
      )}

      {!selection && noEclipsePlace && (
        <main className="preview-empty">
          <span className="empty-orbit" aria-hidden="true" />
          <p className="preview-kicker">{noEclipsePlace}</p>
          <h1>No eclipse is coming up here.</h1>
          <p>There isn’t a visible solar eclipse in the next fortnight.</p>
          <div className="preview-empty-actions">
            <button onClick={reset}><ArrowLeft size={17} /> Check another place</button>
            <ShareMenu label="Share result" />
          </div>
        </main>
      )}
      <footer className="preview-footer"><VisitorCount /><GitHubStarLink /></footer>
    </div>
  )
}

type LiveResultProps = {
  selection: Selection
  live: ReturnType<typeof calculateLiveEclipse>
  now: Date
  simulating: boolean
  playing: boolean
  setPlaying: (playing: boolean) => void
  setNow: (date: Date) => void
  setSimulating: (simulating: boolean) => void
  reset: () => void
}

function LiveResult({ selection, live, now, simulating, playing, setPlaying, setNow, setSimulating, reset }: LiveResultProps) {
  const { result, coordinates, place } = selection
  const map = useMemo(() => approximateMap(coordinates), [coordinates])
  const countdown = eclipseCountdown(result, now)
  const countdownUnits = countdownParts(countdown.milliseconds)
  const percentage = Math.round(1000 * (live.active ? live.coverage : result.coverage)) / 10
  const rangeStart = result.begins.getTime() - 10 * 60_000
  const rangeEnd = result.ends.getTime() + 10 * 60_000
  const clock = formatTime(now, result.timeZone)
  const status = live.stage === 'before'
    ? 'Waiting for first contact'
    : live.stage === 'after'
      ? 'The eclipse has passed'
      : live.central
        ? result.kind === 'total' ? 'Totality' : 'The ring phase'
        : now < result.peak ? 'The shadow is building' : 'The shadow is receding'

  function chooseTime(date: Date) {
    setSimulating(true)
    setPlaying(false)
    setNow(date)
  }

  return (
    <main className="immersive-result">
      <div className="live-topbar">
        <button onClick={reset}><ArrowLeft size={17} /> Change place</button>
        <p><span className={live.active ? 'live-beacon' : ''} />{status}</p>
        <div className="live-topbar-actions">
          <time dateTime={now.toISOString()}>{clock}</time>
          <ShareMenu className="live-share-bar" label="Share result" coverage={percentage} />
        </div>
      </div>

      <section className="live-hero" aria-labelledby="live-heading">
        <div className="live-copy">
          <p className="preview-kicker">{place}</p>
          <h1 id="live-heading">
            {live.active ? 'Right now,' : live.stage === 'after' ? 'From here,' : 'From here,'}<br />
            <em>{live.active ? `${percentage}% is covered.` : live.stage === 'after' ? 'the light has returned.' : `you’ll see a ${eclipseName(result.kind).toLowerCase()}.`}</em>
          </h1>
          <p className="live-description">
            {live.active
              ? 'The Moon’s position and the page light are updating from your local sky once a second.'
              : live.stage === 'after'
                ? 'The eclipse has finished at this location. These contact times remain here for reference.'
                : eclipseDescription(result.kind, result.coverage)}
          </p>
          {countdown.at && (
            <div className={`next-contact next-contact-${countdown.phase}`} key={countdown.phase} aria-live="polite" aria-atomic="true">
              <span><i /> Live · {countdown.label}</span>
              <div className="immersive-countdown" aria-label={`${Number(countdownUnits.days)} days, ${Number(countdownUnits.hours)} hours, ${Number(countdownUnits.minutes)} minutes, ${Number(countdownUnits.seconds)} seconds`}>
                {Object.entries(countdownUnits).map(([unit, value]) => <b key={unit}>{value}<small>{unit}</small></b>)}
              </div>
              <p>Target: {countdown.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })} in this device’s local time</p>
            </div>
          )}
        </div>

        <div className={`live-instrument countdown-visual-${countdown.phase}`} aria-label={live.active ? `${percentage}% of the Sun is currently covered` : `${Math.round(result.coverage * 100)}% will be covered at maximum`}>
          <div className="instrument-rings" aria-hidden="true" />
          <div className={`live-eclipse-disc ${result.kind}`} aria-hidden="true">
            <span className="live-sun" />
            <span className="live-moon" />
          </div>
          <p className="instrument-caption">
            <span>{live.active ? 'Live coverage' : 'Coverage at maximum'}</span>
            <strong>{percentage}%</strong>
          </p>
        </div>
      </section>

      <section className="ground-section">
        <div className="area-map">
          <div className="section-heading">
            <div><p className="preview-kicker">Viewing area</p><h2>Somewhere around here</h2></div>
            <span><ShieldCheck size={15} /> Intentionally vague</span>
          </div>
          <RegionalMap map={map} place={place} result={result} />
          <div className="map-explanation">
            <p>The colour compares astronomical coverage across the broad region; weather is not included. Your precise location is never sent to the map.</p>
            <a href={map.openUrl} target="_blank" rel="noreferrer">Open broad area in OpenStreetMap <ExternalLink size={13} /></a>
          </div>
        </div>

        <div className="local-contacts">
          <p className="preview-kicker">Local contacts</p>
          <h2>{formatDate(result.peak, result.timeZone)}</h2>
          <dl>
            <div><dt>Begins</dt><dd>{formatShortTime(result.begins, result.timeZone)}</dd></div>
            <div><dt>Maximum</dt><dd>{formatShortTime(result.peak, result.timeZone)}</dd></div>
            <div><dt>Ends</dt><dd>{formatShortTime(result.ends, result.timeZone)}</dd></div>
          </dl>
          <CalendarLink result={result} place={place} />
          <div className="immersive-safety"><ShieldCheck size={19} /><p><strong>Keep certified eclipse glasses on.</strong> Ordinary sunglasses are not safe at any point during a partial eclipse.</p></div>
        </div>
      </section>

      {simulating && (
        <aside className="time-machine" aria-label="Prototype time controls">
          <div className="time-machine-heading"><Sparkles size={15} /><span>Prototype time machine</span></div>
          <button className="play-control" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause simulation' : 'Play simulation'}>
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <input
            type="range"
            min={rangeStart}
            max={rangeEnd}
            step="1000"
            value={Math.min(rangeEnd, Math.max(rangeStart, now.getTime()))}
            onChange={(event) => chooseTime(new Date(Number(event.target.value)))}
            aria-label="Simulated eclipse time"
          />
          <div className="time-presets">
            <button aria-pressed={now.getTime() === result.begins.getTime() - 5_000} onClick={() => chooseTime(new Date(result.begins.getTime() - 5_000))}>Before</button>
            <button aria-pressed={now.getTime() === result.begins.getTime() + 1_000} onClick={() => chooseTime(new Date(result.begins.getTime() + 1_000))}>Start</button>
            <button aria-pressed={now.getTime() === result.peak.getTime()} onClick={() => chooseTime(result.peak)}>Maximum</button>
            <button aria-pressed={now.getTime() === result.ends.getTime() + 1_000} onClick={() => chooseTime(new Date(result.ends.getTime() + 1_000))}>After</button>
          </div>
          <button className="real-time-control" onClick={() => { setSimulating(false); setNow(new Date()); setPlaying(true) }}>Use real time</button>
        </aside>
      )}
    </main>
  )
}

export default ImmersivePreview
