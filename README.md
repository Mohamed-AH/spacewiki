# Global Space Explorer — Mission Console

A professional, fully client-side 3D mission console for space enthusiasts, built with
[Three.js](https://threejs.org) and [satellite.js](https://github.com/shashwatak/satellite-js).
No build step, no backend, no textures — the entire planet is drawn from vector data.

![Stack](https://img.shields.io/badge/three.js-r160-049EF4) ![Stack](https://img.shields.io/badge/satellite.js-v5-4cc9f0) ![Stack](https://img.shields.io/badge/build-none-7ee787)

## Features

- **Live satellite tracking** — element sets are pulled from CelesTrak's GP API
  (by sovereign registry or technical group), propagated in the browser with the
  **SGP4** model, and rotated from Earth-Centered Inertial into Earth-Centered
  Earth-Fixed coordinates via Greenwich Mean Sidereal Time — so up to 1,500
  satellites sit above their *true* ground positions in real time.
- **Orbit-class colouring** — LEO / MEO / GEO / HEO are classified from each
  element set's period and eccentricity.
- **Click-to-inspect telemetry** — raycast picking on the GPU point cloud opens a
  live readout: NORAD ID, altitude, velocity, orbital period, inclination, plus
  the satellite's instantaneous orbital track drawn around the globe.
- **Historical launch simulator** — six first flights (Sputnik 1 to New Shepard)
  lift off from their true geodetic pad coordinates and fly a quadratic-Bézier
  gravity turn toward geographic east, with a fading particle exhaust trail.
- **Deep-space flight logs** — Voyager, Pioneer, Cassini, New Horizons, Juno and
  Parker Solar Probe escape routes rendered as animated Catmull-Rom splines.
- **Textureless cartography** — coastlines are generated on the fly from the
  Natural Earth 1:110m land dataset and drawn as GPU line loops (< 150 kB for
  the whole planet), plus a graticule and fresnel-shader atmosphere glow.
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
| Drag | Orbit the camera |
| Scroll / pinch | Zoom |
| Right-drag | Pan |
| Click a satellite | Inspect live telemetry + orbital track |
| `Esc` | Clear selection and simulations |

## Architecture

```
index.html          App shell, import map (no bundler)
css/styles.css      Mission-console theme, responsive layout
js/app.js           UI wiring + render loop
js/scene.js         Renderer, textureless Earth, starfield, atmosphere shader
js/satellites.js    TLE ingestion, SGP4 propagation, picking, telemetry
js/simulations.js   Launch ascents + deep-space trajectories
js/data.js          Launch sites, probe archive, fallback element sets
vendor/             three.js r160, OrbitControls, satellite.js v5 (vendored)
assets/             Natural Earth 1:110m land GeoJSON
```

### Coordinate pipeline

1. `satellite.twoline2satrec()` parses each TLE into an SGP4 record.
2. `satellite.propagate()` returns ECI position/velocity (km) at the live UTC clock.
3. `satellite.gstime()` + `satellite.eciToEcf()` rotate ECI into ECEF.
4. ECEF kilometres map into scene units by `s = R_scene / 6378.137 km`, with axes
   remapped so ECEF +Z (north pole) becomes scene +Y.

## Data sources & credits

- [CelesTrak](https://celestrak.org) — live GP element sets (CORS-enabled public API)
- [Natural Earth](https://www.naturalearthdata.com) — public-domain vector cartography
- [Three.js](https://threejs.org) (MIT) and [satellite.js](https://github.com/shashwatak/satellite-js) (MIT), vendored under `vendor/`
