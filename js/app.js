// Application shell: UI wiring, camera rig, render loop, telemetry readouts.

import * as THREE from 'three';
import { createScene } from './scene.js';
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

const catalogSelect = $('catalog-select');
const refreshBtn = $('refresh-btn');
const scaleToggle = $('scale-toggle');
const launchSelect = $('launch-select');
const launchInfo = $('launch-info');
const launchBtn = $('launch-btn');
const probeCards = $('probe-cards');

const satCard = $('sat-card');
const statusSource = $('status-source');
const statusNodes = $('status-nodes');
const statusRender = $('status-render');
const statusFps = $('status-fps');
const statusScale = $('status-scale');

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
const { renderer, scene, camera, controls, satGroup, simGroup, updateSun, updateClouds } =
    createScene(canvas);

const satLayer = new SatelliteLayer(satGroup);
const sims = new Simulations(simGroup);

// ---------------------------------------------------------------------------
// Idle spin: auto-rotate pauses while the user interacts, resumes after 10 s.
// ---------------------------------------------------------------------------
let resumeSpinTimer = null;
controls.addEventListener('start', () => {
    controls.autoRotate = false;
    clearTimeout(resumeSpinTimer);
});
controls.addEventListener('end', () => {
    clearTimeout(resumeSpinTimer);
    resumeSpinTimer = setTimeout(() => {
        if (rig.mode === 'free') controls.autoRotate = true;
    }, 10000);
});

// ---------------------------------------------------------------------------
// Camera rig: follows deep-space replays, frames the finale, returns home.
// ---------------------------------------------------------------------------
const rig = {
    mode: 'free',        // free | sim | return
    home: null,
    framed: false,
};

function rigEnterSim() {
    if (rig.mode === 'free') {
        rig.home = { pos: camera.position.clone(), target: controls.target.clone() };
    }
    rig.mode = 'sim';
    rig.framed = false;
    controls.enabled = false;
    controls.autoRotate = false;
}

function rigReturnHome() {
    if (rig.mode === 'free' || !rig.home) return;
    rig.mode = 'return';
    rig.framed = false;
    controls.enabled = false;
}

const _dir = new THREE.Vector3();
function rigUpdate() {
    if (rig.mode === 'sim') {
        const d = sims.cameraDirective();
        if (!d) return;
        if (d.mode === 'follow') {
            controls.target.lerp(d.target, 0.06);
            _dir.subVectors(camera.position, controls.target);
            if (_dir.lengthSq() < 1e-6) _dir.set(0, 0.4, 1);
            _dir.normalize();
            _dir.y += 0.0025 * d.dist;          // gentle cinematic elevation
            _dir.normalize().multiplyScalar(d.dist);
            camera.position.lerp(_dir.add(controls.target), 0.06);
        } else if (d.mode === 'frame' && !rig.framed) {
            const want = d.radius * 1.9;
            controls.target.lerp(d.center, 0.05);
            _dir.subVectors(camera.position, controls.target).normalize()
                .multiplyScalar(want).add(controls.target);
            camera.position.lerp(_dir, 0.05);
            if (camera.position.distanceTo(_dir) < want * 0.03) {
                rig.framed = true;              // hand the framed shot to the user
                controls.enabled = true;
            }
        }
    } else if (rig.mode === 'return') {
        controls.target.lerp(rig.home.target, 0.07);
        camera.position.lerp(rig.home.pos, 0.07);
        if (camera.position.distanceTo(rig.home.pos) < 0.15) {
            camera.position.copy(rig.home.pos);
            controls.target.copy(rig.home.target);
            rig.mode = 'free';
            rig.home = null;
            controls.enabled = true;
        }
    }
}

// ---------------------------------------------------------------------------
// Satellite catalog loading
// ---------------------------------------------------------------------------
async function refreshCatalog() {
    setLink('busy', 'POLLING');
    setHud('UPLINK', 'Polling CelesTrak GP registry…');
    refreshBtn.disabled = true;

    const group = catalogSelect.value;
    const label = `CELESTRAK GROUP:${group.toUpperCase()}`;
    const result = await satLayer.load(SatelliteLayer.queryUrl(group), label);

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

catalogSelect.addEventListener('change', refreshCatalog);
refreshBtn.addEventListener('click', refreshCatalog);

scaleToggle.addEventListener('change', () => {
    satLayer.exaggerated = scaleToggle.checked;
    satLayer.update(new Date());
    if (satLayer.selectedIndex >= 0) {
        satLayer.select(satLayer.selectedIndex, new Date());
    }
    statusScale.innerHTML = scaleToggle.checked
        ? 'SIZES &amp; DISTANCES NOT TO SCALE'
        : 'TRUE-SCALE ALTITUDES · SIZES NOT TO SCALE';
});

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
    rigReturnHome();               // launches are earth-scale; leave any probe framing
    satGroup.visible = true;
    const site = sims.runLaunch(launchSelect.value);
    if (site) {
        setHud('LIFTOFF DETECTED',
            `VEHICLE: ${site.rocket}<br>ORIGIN: ${site.name}<br>ASCENT: gravity-turn east`);
    }
});

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
    clearSelection();
    satGroup.visible = false;      // declutter the heliocentric replay
    rigEnterSim();
    const probe = sims.runProbe(key);
    if (probe) {
        setHud('TRAJECTORY PLOTTED',
            `UNIT: ${probe.name}<br>FRAME: heliocentric (stylised)<br>REPLAY: rolling`);
    }
});

sims.onEvent = (title, body) => setHud(title, body);

sims.onCleared = () => {
    satGroup.visible = true;
    rigReturnHome();
    setHud('SYSTEM ONLINE', 'LEO radar environment scan active…');
};

// ---------------------------------------------------------------------------
// Tabs + mobile panel — leaving a simulation tab retires its scene.
// ---------------------------------------------------------------------------
let activeTab = 'track';

document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        const next = tab.dataset.tab;
        if (next !== activeTab &&
            (activeTab === 'launch' || activeTab === 'probes') &&
            sims.hasContent()) {
            sims.fadeOutAndClear();
        }
        activeTab = next;
        document.querySelectorAll('.tab').forEach((t) => {
            t.classList.toggle('active', t === tab);
            t.setAttribute('aria-selected', String(t === tab));
        });
        document.querySelectorAll('.tab-page').forEach((page) => {
            page.classList.toggle('active', page.id === `tab-${next}`);
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
    if (!satGroup.visible) return;

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
        if (sims.hasContent()) {
            sims.fadeOutAndClear();   // onCleared handles HUD + camera return
        } else {
            rigReturnHome();
            setHud('SYSTEM ONLINE', 'LEO radar environment scan active…');
        }
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
let lastFrame = 0;
let frames = 0;
let lastFpsSample = performance.now();

function animate(timestamp) {
    requestAnimationFrame(animate);
    const dt = Math.min((timestamp - lastFrame) / 1000, 0.1) || 0.016;
    lastFrame = timestamp;

    if (timestamp - lastPropagate >= PROPAGATE_INTERVAL_MS) {
        lastPropagate = timestamp;
        satLayer.update(new Date());
    }

    sims.update(dt);
    updateClouds(dt);
    rigUpdate();

    if (timestamp - lastReadout >= READOUT_INTERVAL_MS) {
        lastReadout = timestamp;
        const now = new Date();
        updateSun(now);
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
window.__gse = { satLayer, sims, camera, controls, scene, rig };
