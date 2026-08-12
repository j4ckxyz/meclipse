# Meclipse

[meclipse.j4ck.xyz](https://meclipse.j4ck.xyz)

Meclipse is a fast, privacy-conscious solar eclipse checker. It tells someone whether an eclipse is visible from their location, how much of the Sun will be covered, and the local contact times.

The interface is event-led: if there is no visible solar eclipse during the next fortnight, it says so plainly rather than presenting a dormant dashboard.

## Features

- browser geolocation with clear fallbacks when permission or hardware is unavailable;
- fuzzy place, address and worldwide postcode autocomplete;
- pasted Google Maps, Apple Maps, OpenStreetMap, Bing Maps and Waze links;
- durable `/at/latitude,longitude/place` result routes;
- partial, annular and total eclipse classification;
- local contact times and live eclipse progression;
- a private, locally generated calendar reminder for each result;
- an intentionally imprecise regional map with a relative eclipse-coverage layer;
- a draggable, zoomable globe with a detailed worldwide coverage surface;
- automatic light and dark colour schemes;
- privacy-safe Facebook, Bluesky and WhatsApp sharing;
- a refresh-safe approximate visitor count with bounded storage;
- a generated 1200 by 630 Open Graph image;
- responsive layouts and reduced-motion support.

## How it works

Astronomical calculations run in the browser with [Astronomy Engine](https://github.com/cosinekitty/astronomy). Meclipse calculates topocentric Sun and Moon positions, apparent disc overlap, contact times, local time zones and whether the eclipsed portion of the Sun is above the horizon.

Worldwide globe surfaces use the same production calculation. The next eight solar eclipses are precomputed into static JSON at build time, then served from Vercel’s CDN. Each cell is coloured by its own maximum visible coverage rather than by screen-space point density, so rotating the globe cannot move or exaggerate the eclipse path. Fine regional cells reveal local variation in high-coverage areas, while coarser cells keep the global download modest. Existing surfaces are reused on later builds.

Place search is served through a small Vercel Function. Repeated queries are cached at the browser and CDN layers. Direct coordinates and coordinate-bearing map links are resolved entirely in the browser.

The visitor total uses an Upstash Redis HyperLogLog. It stores an approximate set cardinality in roughly constant space rather than creating a record for every visitor. A random identifier is kept in `sessionStorage`, so refreshing a tab does not increase the count. Short-lived, HMAC-hashed IP buckets rate-limit artificial session creation; raw IP addresses are never stored.

## Running locally

Meclipse requires Node.js 24.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Vite includes local versions of the place-search and visitor-count endpoints, so the core experience works without external storage.

The main application now uses the immersive interface. These development-only routes remain available:

```text
/preview
/preview/live
/preview/globe
```

The first route mirrors production. The second starts shortly before first contact in Paris and provides simulation controls for testing the real-time experience. The third isolates the worldwide globe for visual and performance testing.

## Environment variables

All variables are optional during local development.

```text
GEOAPIFY_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
VISITOR_HASH_SECRET=
VISITOR_COUNT_OFFSET=0
VITE_SITE_URL=
```

`GEOAPIFY_API_KEY` enables full street-address autocomplete. Without it, Meclipse uses cached Open-Meteo, Postcodes.io and Photon results.

The Upstash variables enable the production visitor counter. `VISITOR_HASH_SECRET` should be a long random value; if omitted, the Redis token is used as the HMAC secret. `VISITOR_COUNT_OFFSET` can preserve an earlier total during a migration.

## Testing

```sh
npm run test
npm run test:accuracy
npm run generate:coverage
npm run lint
npx tsc --noEmit
npm run build
```

The accuracy command runs the production astronomy code against 52 published city-centre examples for the 12 August 2026 eclipse. Its 284 assertions cover eclipse type, coverage and local contact times using published data from NASA, the Association Française d’Astronomie and timeanddate.com.

The `Eclipse maintenance` GitHub Actions workflow runs weekly and on demand. It checks that the precomputed manifest still contains the next eight eclipses, repeats the published-data accuracy suite, and verifies the application. A failed run opens one maintenance issue rather than creating repeated alerts.

Ordinary observations are accepted within 1.5 percentage points of published coverage and two minutes of published contact times. Sunset-boundary observations are reported separately with wider limits because refraction, elevation and the local horizon materially affect what is visible. The script always prints raw mean and maximum errors.

## Production deployment

The project is configured for Vercel:

```sh
vercel link
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add VISITOR_HASH_SECRET production
vercel deploy --prod
vercel domains add meclipse.j4ck.xyz
```

`vercel.json` supplies SPA rewrites for result routes, immutable caching for hashed assets, security headers and a restrictive geolocation policy. Vercel provides HTTPS automatically; browser geolocation requires a secure origin in production.

For `meclipse.j4ck.xyz`, add the CNAME record requested by `vercel domains inspect meclipse.j4ck.xyz` at the domain’s DNS provider.

## Project structure

```text
api/                    Vercel Function entry points
public/                 Static icons, manifest and Open Graph artwork
scripts/                Open Graph, coverage-surface and accuracy generation
src/components/         Shared interface components
src/lib/                Astronomy, routing, formatting and location logic
src/preview/            Immersive experience, live animation and maps
src/server/             Testable server-side request handlers
```

## Privacy

Exact coordinates are rounded before entering a result URL or the deliberately vague map. Social sharing always points to the homepage and never includes the result route, coordinates or place name. The visitor counter stores only approximate session cardinality and temporary keyed hashes; it does not store accounts, raw IP addresses or location histories.

## Contributing, forks and licence

Issues, pull requests and forks are welcome. Meclipse is licensed under the [Apache License 2.0](LICENSE). Its [NOTICE](NOTICE) attribution includes the original project URL and must be retained in distributed forks and derivative works as required by the licence.
