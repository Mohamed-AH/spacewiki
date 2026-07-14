// Application shell: UI wiring, render loop, and telemetry readouts.

import { createScene, loadCoastlines } from './scene.js';
import { SatelliteLayer } from './satellites.js';
import { Simulations } from './simulations.js';
import { LAUNCH_SITES, PROBES } from './data.js';

// ---------------------------------------------------------------------------
// DOM handles
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const canvas = $('scene-canvas');
const hudTitle = document.querySelector('.hud-title');
const hudBody = $('hud-body');
const linkStatus = $('link-status');
const linkLabel = $('link-label');
const utcClock = $('utc-clock');

const countrySelect = $('country-select');
const utilitySelect = $('utility-select');
const refreshBtn = $('refresh-btn');
const launchSelect = $('launch-select');
const launchInfo = $('launch-info');
const launchBtn = $('launch-btn');
const probeCards = $('probe-cards');

const satCard = $('sat-card');
const statusSource = $('status-source');
const statusNodes = $('status-nodes');
const statusRender = $('status-render');
const statusFps = $('status-fps');

function setHud(title, body) {
    hudTitle.textContent = title;
    hudBody.innerHTML = body;
}

function setLink(state, label) {
    linkStatus.dataset.state = state;
    linkLabel.textContent = label;
}

// ---------------------------------------------------------------------------
// Scene + feature layers
// ---------------------------------------------------------------------------
const { renderer, scene, camera, controls, landGroup, satGroup, simGroup } =
    createScene(canvas);

const satLayer = new SatelliteLayer(satGroup);
const sims = new Simulations(simGroup);

loadCoastlines(landGroup).catch(() => {
    setHud('CARTOGRAPHY FAULT', 'Coastline dataset unavailable — globe wireframe only.');
});

// ---------------------------------------------------------------------------
// Satellite catalog loading
// ---------------------------------------------------------------------------
async function refreshCatalog() {
    setLink('busy', 'POLLING');
    setHud('UPLINK', 'Polling CelesTrak GP registry…');
    refreshBtn.disabled = true;

    const group = utilitySelect.value;
    const country = countrySelect.value;
    const label = group !== 'NONE'
        ? `CELESTRAK GROUP:${group.toUpperCase()}`
        : `CELESTRAK COUNTRY:${country}`;

    const result = await satLayer.load(SatelliteLayer.queryUrl(country, group), label);

    if (result.fallback) {
        setLink('error', 'OFFLINE');
        setHud('COMMS TIMEOUT',
            'CelesTrak unreachable — cached sample element sets loaded.<br>' +
            `TRACKING NODES: ${result.rendered}`);
    } else {
        setLink('live', 'LINK LIVE');
        setHud('RADAR STATE: OK',
            `CATALOG NODES: ${result.total}<br>` +
            (result.total > result.rendered
                ? `RENDER POOL: first ${result.rendered} elements`
                : 'RENDER POOL: 100%'));
    }
    statusSource.innerHTML = `SOURCE: <b>${satLayer.sourceLabel}</b>`;
    statusNodes.innerHTML = `CATALOG: <b>${result.total}</b>`;
    statusRender.innerHTML = `RENDERED: <b>${result.rendered}</b>`;
    refreshBtn.disabled = false;
}

countrySelect.addEventListener('change', () => {
    utilitySelect.value = 'NONE';
    refreshCatalog();
});
utilitySelect.addEventListener('change', refreshCatalog);
refreshBtn.addEventListener('click', refreshCatalog);

// ---------------------------------------------------------------------------
// Launch simulator UI
// ---------------------------------------------------------------------------
for (const [key, site] of Object.entries(LAUNCH_SITES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${site.rocket} — ${site.year}`;
    launchSelect.appendChild(opt);
}

function renderLaunchInfo() {
    const site = LAUNCH_SITES[launchSelect.value];
    launchInfo.textContent =
        `PAD    ${site.name}\n` +
        `GEO    ${site.lat.toFixed(3)}°, ${site.lon.toFixed(3)}°\n` +
        `YEAR   ${site.year}\n\n${site.blurb}`;
}
launchSelect.addEventListener('change', renderLaunchInfo);
renderLaunchInfo();

launchBtn.addEventListener('click', () => {
    const site = sims.runLaunch(launchSelect.value);
    if (site) {
        setHud('LIFTOFF DETECTED',
            `VEHICLE: ${site.rocket}<br>ORIGIN: ${site.name}<br>ASCENT: gravity-turn east`);
    }
});

sims.onLaunchComplete = (site) => {
    setHud('MAIN ENGINE CUTOFF',
        `VEHICLE: ${site.rocket}<br>STATUS: nominal insertion<br>SEQUENCE: complete`);
};

// ---------------------------------------------------------------------------
// Deep-space probe UI
// ---------------------------------------------------------------------------
for (const [key, probe] of Object.entries(PROBES)) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <h3>${probe.name}</h3>
        <div class="meta">${probe.meta}</div>
        <p>${probe.blurb}</p>
        <button class="ghost" data-probe="${key}">${probe.action}</button>`;
    probeCards.appendChild(card);
}

probeCards.addEventListener('click', (e) => {
    const key = e.target.dataset?.probe;
    if (!key) return;
    const probe = sims.runProbe(key);
    if (probe) {
        setHud('TRAJECTORY PLOTTED',
            `UNIT: ${probe.name}<br>FRAME: heliocentric escape<br>SPLINE: Catmull-Rom`);
    }
});

sims.onProbeProgress = (probe, au) => {
    setHud('ESCAPE SEQUENCE', `UNIT: ${probe.name}<br>RADIAL DISTANCE: ${au} AU`);
};
sims.onProbeComplete = (probe) => {
    setHud('HELIOCENTRIC TRANSIT ACHIEVED',
        `UNIT: ${probe.name}<br>STATUS: beyond render bounds`);
};

// ---------------------------------------------------------------------------
// Tabs + mobile panel
// ---------------------------------------------------------------------------
document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => {
            t.classList.toggle('active', t === tab);
            t.setAttribute('aria-selected', String(t === tab));
        });
        document.querySelectorAll('.tab-page').forEach((page) => {
            page.classList.toggle('active', page.id === `tab-${tab.dataset.tab}`);
        });
    });
});

$('menu-toggle').addEventListener('click', () => {
    document.body.classList.toggle('panel-open');
});
canvas.addEventListener('pointerdown', () => {
    document.body.classList.remove('panel-open');
});

// ---------------------------------------------------------------------------
// Picking & selection
// ---------------------------------------------------------------------------
let pointerDown = null;

canvas.addEventListener('pointerdown', (e) => {
    pointerDown = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 5) return; // was a drag, not a click

    const index = satLayer.pick(e, camera, canvas);
    if (index >= 0) {
        satLayer.select(index, new Date());
        satCard.classList.remove('hidden');
        updateSatCard();
    }
});

function clearSelection() {
    satLayer.deselect();
    satCard.classList.add('hidden');
}

$('sat-card-close').addEventListener('click', clearSelection);

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        clearSelection();
        sims.clear();
        setHud('SYSTEM ONLINE', 'LEO radar environment scan active…');
    }
});

function updateSatCard() {
    const t = satLayer.selectedTelemetry(new Date());
    if (!t) return;
    $('sat-name').textContent = t.name;
    $('sat-norad').textContent = t.norad;
    $('sat-class').textContent = t.class;
    $('sat-alt').textContent = `${t.altitudeKm.toFixed(1)} km`;
    $('sat-vel').textContent = `${t.speedKms.toFixed(2)} km/s`;
    $('sat-period').textContent = `${t.periodMin.toFixed(1)} min`;
    $('sat-incl').textContent = `${t.inclinationDeg.toFixed(2)}°`;
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const PROPAGATE_INTERVAL_MS = 200;
const READOUT_INTERVAL_MS = 250;
let lastPropagate = 0;
let lastReadout = 0;
let frames = 0;
let lastFpsSample = performance.now();
const startTime = performance.now();

function animate(timestamp) {
    requestAnimationFrame(animate);

    if (timestamp - lastPropagate >= PROPAGATE_INTERVAL_MS) {
        lastPropagate = timestamp;
        satLayer.update(new Date());
    }

    sims.update((timestamp - startTime) / 1000);

    if (timestamp - lastReadout >= READOUT_INTERVAL_MS) {
        lastReadout = timestamp;
        const now = new Date();
        utcClock.textContent = `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
        if (satLayer.selectedIndex >= 0) updateSatCard();
    }

    frames++;
    if (timestamp - lastFpsSample >= 1000) {
        statusFps.innerHTML = `FPS: <b>${frames}</b>`;
        frames = 0;
        lastFpsSample = timestamp;
    }

    controls.update();
    renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
refreshCatalog();
requestAnimationFrame(animate);

// Console access for tinkering / debugging.
window.__gse = { satLayer, sims, camera, controls, scene };
