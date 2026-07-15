// Application shell: UI wiring, camera rig, render loop, telemetry readouts.

import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { createScene } from './scene.js';
import { SatelliteLayer } from './satellites.js';
import { Simulations } from './simulations.js';
import { buildConstellations } from './constellations.js';
import { buildMoon } from './moon.js';
import { sunDirectionScene } from './scene.js';
import { LAUNCH_SITES, PROBES, MOON_LANDINGS } from './data.js';

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
const labelsToggle = $('labels-toggle');
const labelsNote = $('labels-note');
const constellationsToggle = $('constellations-toggle');
const launchSelect = $('launch-select');
const launchInfo = $('launch-info');
const launchBtn = $('launch-btn');
const launchTimeline = $('launch-timeline');
const probeCards = $('probe-cards');
const moonCards = $('moon-cards');

const satCard = $('sat-card');
const statusSource = $('status-source');
const statusNodes = $('status-nodes');
const statusRender = $('status-render');
const statusFps = $('status-fps');
const statusScale = $('status-scale');

const tracker = $('probe-tracker');
const trackerPlay = $('tracker-play');
const trackerName = $('tracker-name');
const trackerYear = $('tracker-year');
const trackerSlider = $('tracker-slider');
const trackerTicks = $('tracker-ticks');
const trackerAu = $('tracker-au');
const trackerLight = $('tracker-light');
const gaugeNeedle = $('gauge-needle');

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

const constellations = buildConstellations();
scene.add(constellations);

const moon = buildMoon();
scene.add(moon.group);

// ---------------------------------------------------------------------------
// Idle spin — evaluated every frame so it can never get stuck off.
// ---------------------------------------------------------------------------
const DEFAULT_MIN_DISTANCE = controls.minDistance;
const SPIN_RESUME_MS = 10000;
let interacting = false;
let lastInteractAt = -Infinity;

controls.addEventListener('start', () => { interacting = true; });
controls.addEventListener('end', () => {
    interacting = false;
    lastInteractAt = performance.now();
});

function updateSpin(now) {
    controls.autoRotate = rig.mode === 'free' &&
        !interacting &&
        (now - lastInteractAt) > SPIN_RESUME_MS;
}

// ---------------------------------------------------------------------------
// Camera rig: probe follow/framing, Moon fly-to, and the return flight home.
// ---------------------------------------------------------------------------
const rig = {
    mode: 'free',        // free | sim | moon | return
    home: null,
    framed: false,
    moonSite: null,      // landing-site key, or null for the Moon itself
    moonArrived: false,
};

function rigSaveHome() {
    if (rig.mode === 'free') {
        rig.home = { pos: camera.position.clone(), target: controls.target.clone() };
    }
}

function rigEnterSim() {
    rigSaveHome();
    rig.mode = 'sim';
    rig.framed = false;
    controls.enabled = false;
}

function rigFlyToMoon(siteKey) {
    rigSaveHome();
    rig.mode = 'moon';
    rig.moonSite = siteKey;
    rig.moonArrived = false;
    controls.enabled = false;
    // Allow close orbits around the Moon (the default floor is sized for Earth).
    controls.minDistance = 0.6;
    moon.setSitesVisible(true);
    moon.selectSite(siteKey);
}

function rigReturnHome() {
    if (rig.mode === 'moon') {
        moon.setSitesVisible(false);
        moon.selectSite(null);
        rig.moonSite = null;
        controls.minDistance = DEFAULT_MIN_DISTANCE;
    }
    if (rig.mode === 'free' || !rig.home) { rig.mode = 'free'; return; }
    rig.mode = 'return';
    rig.framed = false;
    controls.enabled = false;
}

const _dir = new THREE.Vector3();
const _want = new THREE.Vector3();
const _target = new THREE.Vector3();

function rigUpdate(dt) {
    // Frame-rate-independent smoothing: f ≈ 0.06/frame at 60 fps.
    const f = 1 - Math.exp(-4.0 * dt);
    const fr = 1 - Math.exp(-5.0 * dt);
    if (rig.mode === 'sim') {
        const d = sims.cameraDirective();
        if (!d) return;
        if (d.mode === 'follow') {
            rig.framed = false;
            controls.enabled = false;
            controls.target.lerp(d.target, f);
            _dir.subVectors(camera.position, controls.target);
            if (_dir.lengthSq() < 1e-6) _dir.set(0, 0.4, 1);
            _dir.normalize();
            _dir.y += 0.0025 * d.dist;          // gentle cinematic elevation
            _dir.normalize().multiplyScalar(d.dist);
            camera.position.lerp(_dir.add(controls.target), f);
        } else if (d.mode === 'frame' && !rig.framed) {
            const want = d.radius * 1.9;
            controls.target.lerp(d.center, f);
            _want.subVectors(camera.position, controls.target).normalize()
                .multiplyScalar(want).add(controls.target);
            camera.position.lerp(_want, f);
            if (camera.position.distanceTo(_want) < want * 0.03) {
                rig.framed = true;              // hand the framed shot to the user
                controls.enabled = true;
            }
        }
    } else if (rig.mode === 'moon') {
        if (rig.moonArrived) return;
        if (rig.moonSite) {
            moon.siteWorldPos(rig.moonSite, _target);
            _dir.subVectors(_target, moon.group.position).normalize();
            _want.copy(_target).addScaledVector(_dir, 2.1);
        } else {
            _target.copy(moon.group.position);
            _dir.copy(moon.group.position).normalize();
            _want.copy(moon.group.position)
                .addScaledVector(_dir, 4.2)
                .add(new THREE.Vector3(0, 1.6, 0));
        }
        controls.target.lerp(_target, fr);
        camera.position.lerp(_want, fr);
        if (camera.position.distanceTo(_want) < 0.08) {
            rig.moonArrived = true;
            controls.enabled = true;
        }
    } else if (rig.mode === 'return') {
        controls.target.lerp(rig.home.target, fr);
        camera.position.lerp(rig.home.pos, fr);
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

    // Small catalogs label everything; large ones label the first 60.
    labelsNote.textContent = satLayer.labelsCoverAll() ? '(all objects)' : '(first 60)';
}

catalogSelect.addEventListener('change', refreshCatalog);
refreshBtn.addEventListener('click', refreshCatalog);

scaleToggle.addEventListener('change', () => {
    satLayer.exaggerated = scaleToggle.checked;
    satLayer.refreshAll(new Date());
    if (satLayer.selectedIndex >= 0) {
        satLayer.select(satLayer.selectedIndex, new Date());
    }
    statusScale.innerHTML = scaleToggle.checked
        ? 'SIZES &amp; DISTANCES NOT TO SCALE'
        : 'TRUE-SCALE ALTITUDES · SIZES NOT TO SCALE';
});

labelsToggle.addEventListener('change', () => {
    satLayer.setLabelsEnabled(labelsToggle.checked);
});

constellationsToggle.addEventListener('change', () => {
    constellations.visible = constellationsToggle.checked;
});

document.querySelectorAll('.legend-toggle input').forEach((box) => {
    box.addEventListener('change', () => {
        satLayer.setClassVisible(box.dataset.class, box.checked);
        if (satLayer.selectedIndex < 0) satCard.classList.add('hidden');
    });
});

// ---------------------------------------------------------------------------
// Launch simulator UI + timeline
// ---------------------------------------------------------------------------
const launchesByYear = Object.entries(LAUNCH_SITES)
    .sort((a, b) => a[1].year - b[1].year);

for (const [key, site] of launchesByYear) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${site.year} — ${site.rocket}`;
    launchSelect.appendChild(opt);

    const item = document.createElement('div');
    item.className = 'tl-item';
    item.dataset.key = key;
    item.innerHTML = `<span class="tl-year">${site.year}</span>
        <span class="tl-name">${site.rocket}</span>`;
    item.addEventListener('click', () => {
        launchSelect.value = key;
        renderLaunchInfo();
    });
    launchTimeline.appendChild(item);
}

function renderLaunchInfo() {
    const site = LAUNCH_SITES[launchSelect.value];
    launchInfo.textContent =
        `PAD    ${site.name}\n` +
        `GEO    ${site.lat.toFixed(3)}°, ${site.lon.toFixed(3)}°\n` +
        `YEAR   ${site.year}\n\n${site.blurb}`;
    launchTimeline.querySelectorAll('.tl-item').forEach((el) => {
        el.classList.toggle('active', el.dataset.key === launchSelect.value);
    });
}
launchSelect.addEventListener('change', renderLaunchInfo);
launchSelect.value = launchesByYear[0][0];
renderLaunchInfo();

launchBtn.addEventListener('click', () => {
    rigReturnHome();               // launches are earth-scale; leave any probe framing
    exitDeepSpaceView();
    const site = sims.runLaunch(launchSelect.value);
    if (site) {
        setHud('LIFTOFF DETECTED',
            `VEHICLE: ${site.rocket}<br>ORIGIN: ${site.name}<br>ASCENT: gravity-turn east`);
    }
});

// ---------------------------------------------------------------------------
// Deep-space probe UI + tracker overlay
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

function enterDeepSpaceView() {
    satGroup.visible = false;      // declutter the heliocentric replay
    moon.group.visible = false;
}

function exitDeepSpaceView() {
    satGroup.visible = true;
    moon.group.visible = true;
}

// The tracker slider is linear in replay progress; encounter ticks are stored
// in eased space, so invert the easing to place them.
function easeInv(y) {
    let lo = 0, hi = 1;
    for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (Simulations.ease(mid) < y) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

function showTracker(status) {
    trackerName.textContent = status.name;
    trackerTicks.innerHTML = '';
    for (const tick of status.ticks) {
        const el = document.createElement('div');
        el.className = 'tracker-tick';
        el.style.setProperty('--x', `${(easeInv(tick.t) * 100).toFixed(1)}%`);
        el.title = tick.note;
        trackerTicks.appendChild(el);
    }
    tracker.classList.remove('hidden');
}

let scrubbing = false;

function updateTracker() {
    const status = sims.probeStatus();
    if (!status) { tracker.classList.add('hidden'); return; }
    trackerYear.textContent = String(Math.round(status.year));
    trackerAu.textContent = status.au >= 10
        ? `${status.au.toFixed(1)} AU` : `${status.au.toFixed(2)} AU`;
    trackerLight.textContent = status.lightMinutes >= 90
        ? `${(status.lightMinutes / 60).toFixed(1)} h`
        : `${status.lightMinutes.toFixed(1)} min`;
    trackerPlay.textContent = status.playing ? '❚❚' : '▶';
    if (!scrubbing) trackerSlider.value = String(Math.round(status.progress * 1000));

    // log10 gauge, 0.1 AU .. 150 AU
    const frac = (Math.log10(Math.max(status.au, 0.1)) + 1) / 3.176;
    gaugeNeedle.style.left = `${(Math.min(Math.max(frac, 0), 1) * 100).toFixed(1)}%`;
}

trackerSlider.addEventListener('pointerdown', () => { scrubbing = true; });
window.addEventListener('pointerup', () => { scrubbing = false; });
trackerSlider.addEventListener('input', () => {
    sims.setProbePlaying(false);
    sims.scrubProbe(Number(trackerSlider.value) / 1000);
    updateTracker();
});

trackerPlay.addEventListener('click', () => {
    sims.setProbePlaying(!sims.probePlaying);
    updateTracker();
});

probeCards.addEventListener('click', (e) => {
    const key = e.target.dataset?.probe;
    if (!key) return;
    clearSelection();
    enterDeepSpaceView();
    rigEnterSim();
    const probe = sims.runProbe(key);
    if (probe) {
        setHud('TRAJECTORY PLOTTED',
            `UNIT: ${probe.name}<br>FRAME: heliocentric (stylised)<br>REPLAY: rolling`);
        showTracker(sims.probeStatus());
        updateTracker();
    }
});

sims.onEvent = (title, body) => setHud(title, body);

sims.onCleared = () => {
    exitDeepSpaceView();
    tracker.classList.add('hidden');
    rigReturnHome();
    setHud('SYSTEM ONLINE', 'LEO radar environment scan active…');
};

// ---------------------------------------------------------------------------
// Moon UI
// ---------------------------------------------------------------------------
$('moon-visit-btn').addEventListener('click', () => {
    rigFlyToMoon(null);
    setHud('TRANSLUNAR CRUISE',
        'TARGET: the Moon<br>DISTANCE: 384,400 km (compressed on screen)<br>Esc to return');
});

for (const landing of MOON_LANDINGS) {
    const card = document.createElement('div');
    card.className = 'card moon-card';
    card.innerHTML = `
        <h3>${landing.mission} — ${landing.year}</h3>
        <div class="meta">${landing.site} · ${landing.lat.toFixed(2)}°, ${landing.lon.toFixed(2)}°</div>
        <div class="crew">${landing.crew}</div>
        <p>${landing.blurb}</p>
        <button class="ghost" data-landing="${landing.key}">Visit landing site</button>`;
    moonCards.appendChild(card);
}

moonCards.addEventListener('click', (e) => {
    const key = e.target.dataset?.landing;
    if (!key) return;
    const landing = MOON_LANDINGS.find((l) => l.key === key);
    rigFlyToMoon(key);
    setHud(`${landing.mission.toUpperCase()} — ${landing.year}`,
        `SITE: ${landing.site}<br>CREW: ${landing.crew}<br>Esc to return`);
});

// ---------------------------------------------------------------------------
// Tabs + mobile panel — leaving a scene-owning tab retires its scene.
// ---------------------------------------------------------------------------
let activeTab = 'track';

document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        const next = tab.dataset.tab;
        if (next !== activeTab) {
            if ((activeTab === 'launch' || activeTab === 'probes') && sims.hasContent()) {
                sims.fadeOutAndClear();
            }
            if (activeTab === 'moon' && rig.mode === 'moon') {
                rigReturnHome();
                setHud('SYSTEM ONLINE', 'LEO radar environment scan active…');
            }
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

const _sunDir = new THREE.Vector3();

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

    const nowDate = new Date();
    moon.update(nowDate, sunDirectionScene(nowDate, _sunDir), dt);

    updateSpin(timestamp);
    rigUpdate(dt);

    if (timestamp - lastReadout >= READOUT_INTERVAL_MS) {
        lastReadout = timestamp;
        updateSun(nowDate);
        constellations.rotation.y = satellite.gstime(nowDate);
        utcClock.textContent = `${nowDate.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
        if (satLayer.selectedIndex >= 0) updateSatCard();
        updateTracker();
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
window.__gse = { satLayer, sims, camera, controls, scene, rig, moon, constellations };
