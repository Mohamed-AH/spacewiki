# Global Space Explorer — Mission Console

A professional, fully client-side 3D mission console for space enthusiasts, built with
[Three.js](https://threejs.org) and [satellite.js](https://github.com/shashwatak/satellite-js).
No build step and no backend — everything runs in the browser.

![Stack](https://img.shields.io/badge/three.js-r160-049EF4) ![Stack](https://img.shields.io/badge/satellite.js-v5-4cc9f0) ![Stack](https://img.shields.io/badge/build-none-7ee787)

## Features

- **Cinematic Earth** — NASA Blue Marble imagery blended with night-side city
  lights in a custom shader. The day/night terminator is computed from a real
  solar ephemeris, so the sunlit hemisphere on screen is the one lit right now.
  A faint sunlit cloud layer drifts overhead, and the globe idles with a subtle
  auto-rotation that pauses while you interact.
- **Live satellite tracking** — element sets are pulled from CelesTrak's GP API
  (curated catalogs: brightest objects, stations, navigation fleets, science,
  weather, mega-constellations), propagated in the browser with the **SGP4**
  model, and rotated from Earth-Centered Inertial into Earth-Centered
  Earth-Fixed coordinates via Greenwich Mean Sidereal Time — up to 12,000
  satellites above their *true* ground positions in real time.
- **Orbit-class colouring** — LEO / MEO / GEO / HEO classified from each element
  set's period and eccentricity. Low-orbit altitudes are visually exaggerated
  (with an on-screen disclaimer and a true-scale toggle) so satellites are easy
  to spot; numeric telemetry is never scaled.
- **Click-to-inspect telemetry** — raycast picking (occluded satellites behind
  the planet are ignored) opens a live readout: NORAD ID, altitude, velocity,
  orbital period, inclination, plus the satellite's instantaneous orbital track.
- **Historical launch simulator** — fourteen missions, Sputnik 1 to Starship,
  lift off from their true pad coordinates, fly a gravity-turn ascent with
  staging callouts (MAX-Q, separation, fairing jettison), and end by deploying
  a payload onto a visible orbit ring.
- **Deep-space replays** — ten missions, from Voyager and Pioneer to Rosetta,
  Dawn and Parker, fly through a stylised solar system: the Sun, planet orbit rings, and
  labelled planets positioned along each mission's real encounter sequence.
  The camera follows the probe, calls out each gravity assist, then pulls back
  to frame the full route. `Esc` (or leaving the tab) fades the scene and flies
  the camera home.
- **Name labels & filters** — togglable satellite name labels (all objects on
  small catalogs, first 60 on large ones) and per-orbit-class show/hide filters.
  Full mega-constellations render too: up to 12,000 objects propagated in
  round-robin chunks to keep the frame rate high.
- **Mission timeline & distance tracker** — deep-space replays come with a
  scrubbable timeline (with encounter tick marks and a live mission year),
  play/pause, and a distance readout in AU and light-time against a
  logarithmic gauge running from the Sun to the heliopause. Ten missions, from
  Pioneer to Parker.
- **Launch timeline** — fourteen launches, Sputnik (1957) to Starship (2024),
  on a clickable chronological timeline.
- **Constellations** — thirteen classical figures (Orion, the Dippers,
  Crux, Scorpius…) drawn from real star coordinates and rotated by sidereal
  time, so they sit where they truly are in the sky. Togglable.
- **The Moon** — rendered at its true present sky direction from a simplified
  lunar ephemeris, tidally locked, sunlit with earthshine fill, with all six
  Apollo landing sites marked. Fly to the Moon or straight to Tranquility Base.
- **Offline resilience** — if CelesTrak is unreachable, an embedded sample
  element set keeps the console fully functional.

## Running

Everything is static; any web server works. From the repo root:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>. (A server is required — ES modules and
`fetch` don't run from `file://`.)

The site also deploys as-is to GitHub Pages or any static host.

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the camera (idle auto-spin resumes after 10 s) |
| Scroll / pinch | Zoom |
| Right-drag | Pan |
| Click a satellite | Inspect live telemetry + orbital track |
| `Esc` | Clear selection and simulations, return the camera home |

## Architecture

```
index.html          App shell, import map (no bundler)
css/styles.css      Mission-console theme, responsive layout
js/app.js           UI wiring, camera rig, render loop
js/scene.js         Renderer, day/night Earth shader, clouds, starfield
js/satellites.js    TLE ingestion, SGP4 propagation, picking, telemetry
js/simulations.js   Launch ascents + deep-space replays
js/solar.js         Stylised heliocentric backdrop (Sun, rings, planets)
js/constellations.js Classical constellation figures (RA/Dec star data)
js/moon.js          Lunar ephemeris, Apollo sites, sunlit moon shader
js/data.js          Launch sites, probe routes, planets, Apollo landings
vendor/             three.js r160, OrbitControls, satellite.js v5 (vendored)
assets/             Earth day / night-lights / cloud textures
```

### Coordinate pipeline

1. `satellite.twoline2satrec()` parses each TLE into an SGP4 record.
2. `satellite.propagate()` returns ECI position/velocity (km) at the live UTC clock.
3. `satellite.gstime()` + `satellite.eciToEcf()` rotate ECI into ECEF.
4. ECEF kilometres map into scene units by `s = R_scene / 6378.137 km`, with axes
   remapped so ECEF +Z (north pole) becomes scene +Y. The same solar-ephemeris +
   GMST rotation drives the terminator shader.

### Scale disclaimer

Like most aerospace visualisations, marker sizes, low-orbit altitudes, and
planetary distances are exaggerated or compressed for legibility — the status
bar says so on screen, and a Track-tab toggle restores true-scale altitudes.
All numeric readouts are unscaled.

## Data sources & credits

- [CelesTrak](https://celestrak.org) — live GP element sets (CORS-enabled public API)
- NASA Blue Marble / city-lights / cloud / lunar imagery, via the
  [three.js](https://threejs.org) example assets (MIT)
- [Three.js](https://threejs.org) (MIT) and [satellite.js](https://github.com/shashwatak/satellite-js) (MIT), vendored under `vendor/`

## License

[MIT](LICENSE) — free to use, copy, modify, and share. The vendored libraries
(Three.js, satellite.js) are also MIT-licensed.

## Suggest content

Spotted a mission we should chronicle or a catalog worth tracking? Email
[mojed+spacewiki@intigriti.me](mailto:mojed+spacewiki@intigriti.me).
