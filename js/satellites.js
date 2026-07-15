// Live satellite layer: TLE ingestion, SGP4 propagation, orbit-class colouring,
// raycast picking, and a per-satellite telemetry readout.

import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { makeDiscTexture, makeTextSprite, ecfToScene } from './scene.js';
import { CELESTRAK_BASE, FALLBACK_TLES, EARTH_RADIUS } from './data.js';

const MAX_RENDERED = 12000;      // full mega-constellations
const PROPAGATE_CHUNK = 3000;    // SGP4 records refreshed per tick (round-robin)
const LABEL_LIMIT = 60;

// Display-only altitude exaggeration so low orbits don't hug the surface.
// The boost decays with altitude: LEO lifts visibly, GEO is untouched.
const EXAG_STRENGTH = 3.4;
const EXAG_FALLOFF = 1.2; // scene units (~1530 km)

function exaggerateRadial(v, enabled) {
    if (!enabled) return v;
    const r = v.length();
    const alt = r - EARTH_RADIUS;
    if (alt <= 0) return v;
    const boosted = EARTH_RADIUS +
        alt * (1 + EXAG_STRENGTH * Math.exp(-alt / EXAG_FALLOFF));
    return v.multiplyScalar(boosted / r);
}

const ORBIT_CLASSES = {
    LEO: { color: new THREE.Color(0x4cc9f0), label: 'LEO' },
    MEO: { color: new THREE.Color(0x7ee787), label: 'MEO' },
    GEO: { color: new THREE.Color(0xf0b429), label: 'GEO' },
    HEO: { color: new THREE.Color(0xd2a8ff), label: 'HEO' },
};

function classify(satrec) {
    const periodMin = (2 * Math.PI) / satrec.no; // satrec.no is rad/min
    if (satrec.ecco > 0.25) return 'HEO';
    if (periodMin < 128) return 'LEO';
    if (periodMin > 1350 && periodMin < 1520) return 'GEO';
    return 'MEO';
}

/** Parse a CelesTrak TLE text blob into {name, satrec} records. */
function parseTleText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0);
    const records = [];
    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith('1 ') && lines[i + 1].startsWith('2 ')) {
            const name = i > 0 && !lines[i - 1].startsWith('1 ') && !lines[i - 1].startsWith('2 ')
                ? lines[i - 1].replace(/^0 /, '').trim()
                : `NORAD ${lines[i].slice(2, 7).trim()}`;
            try {
                const satrec = satellite.twoline2satrec(lines[i], lines[i + 1]);
                if (satrec.error === 0) records.push({ name, satrec });
            } catch { /* malformed element set — skip */ }
            i++;
        }
    }
    return records;
}

export class SatelliteLayer {
    constructor(satGroup) {
        this.group = satGroup;
        this.records = [];          // { name, satrec, class, eci, geo }
        this.catalogTotal = 0;
        this.sourceLabel = '—';
        this.usingFallback = false;
        this.selectedIndex = -1;
        this.exaggerated = true;   // display-only altitude scaling (see toggle)
        this.classVisible = { LEO: true, MEO: true, GEO: true, HEO: true };
        this.labelsEnabled = true;   // on by default; Display-card toggle turns them off
        this.labelItems = [];      // { index, sprite }
        this.cursor = 0;           // round-robin propagation cursor

        // Shared point cloud
        this.positions = new Float32Array(MAX_RENDERED * 3);
        this.colors = new Float32Array(MAX_RENDERED * 3);
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position',
            new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('color',
            new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setDrawRange(0, 0);

        this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({
            size: 0.15,
            map: makeDiscTexture(),
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        this.points.frustumCulled = false;
        this.group.add(this.points);

        // Selection marker + orbit track
        this.marker = new THREE.Sprite(new THREE.SpriteMaterial({
            map: makeDiscTexture(),
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        this.marker.scale.setScalar(0.35);
        this.marker.visible = false;
        this.group.add(this.marker);

        this.orbitLine = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
        );
        this.orbitLine.visible = false;
        this.group.add(this.orbitLine);

        this.labelGroup = new THREE.Group();
        this.group.add(this.labelGroup);

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.09;
    }

    /** Build the CelesTrak GP query. Only GROUP queries are supported by the
     *  GP API (CATNR/INTDES/GROUP/NAME/SPECIAL — there is no COUNTRY filter). */
    static queryUrl(group) {
        return `${CELESTRAK_BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
    }

    /**
     * Load a catalog. Falls back to the embedded sample set when the network
     * request fails, so the console keeps working offline.
     * Returns { total, rendered, fallback }.
     */
    async load(url, sourceLabel) {
        let text;
        this.usingFallback = false;
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            text = await res.text();
            if (!text.includes('\n2 ')) throw new Error('no element sets in response');
            this.sourceLabel = sourceLabel;
        } catch (err) {
            text = FALLBACK_TLES;
            this.usingFallback = true;
            this.sourceLabel = 'CACHED SAMPLE (offline)';
        }

        const parsed = parseTleText(text);
        this.catalogTotal = parsed.length;
        this.deselect();

        this.records = parsed.slice(0, MAX_RENDERED).map((r) => ({
            ...r,
            class: classify(r.satrec),
            valid: true,
        }));

        // Static per-class colours
        for (let i = 0; i < this.records.length; i++) {
            const c = ORBIT_CLASSES[this.records[i].class].color;
            this.colors[i * 3] = c.r;
            this.colors[i * 3 + 1] = c.g;
            this.colors[i * 3 + 2] = c.b;
        }
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.setDrawRange(0, this.records.length);

        // Small catalogs get larger markers so they stand apart from the stars.
        this.points.material.size = this.records.length <= 120 ? 0.24 : 0.15;

        this.cursor = 0;
        this.refreshAll(new Date());
        this.rebuildLabels();

        return {
            total: this.catalogTotal,
            rendered: this.records.length,
            fallback: this.usingFallback,
        };
    }

    /** Propagate one record and write its scene position into the buffer. */
    propagateOne(i, now, gmst, v) {
        const rec = this.records[i];
        let ok = false;
        if (this.classVisible[rec.class]) {
            try {
                const pv = satellite.propagate(rec.satrec, now);
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const ecf = satellite.eciToEcf(pv.position, gmst);
                    exaggerateRadial(ecfToScene(ecf, v), this.exaggerated);
                    this.positions[i * 3] = v.x;
                    this.positions[i * 3 + 1] = v.y;
                    this.positions[i * 3 + 2] = v.z;
                    rec.pv = pv;
                    ok = true;
                }
            } catch { /* decayed / propagation error */ }
        }
        if (!ok) {
            // Park hidden/failed nodes at origin, inside the globe (invisible).
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = 0;
            this.positions[i * 3 + 2] = 0;
            rec.pv = null;
        }
    }

    /**
     * Per-tick propagation. Large catalogs are refreshed round-robin in chunks
     * (a full 12k-object pass every few ticks keeps the frame rate high); the
     * selected and labelled satellites are refreshed every tick.
     */
    update(now) {
        const n = this.records.length;
        if (n === 0) return;
        const gmst = satellite.gstime(now);
        const v = new THREE.Vector3();

        const chunk = Math.min(n, PROPAGATE_CHUNK);
        for (let k = 0; k < chunk; k++) {
            this.propagateOne((this.cursor + k) % n, now, gmst, v);
        }
        this.cursor = (this.cursor + chunk) % n;

        for (const item of this.labelItems) this.propagateOne(item.index, now, gmst, v);
        if (this.selectedIndex >= 0) this.propagateOne(this.selectedIndex, now, gmst, v);

        this.afterPositionsChanged();
    }

    /** Full immediate pass over every record (used on load and filter changes). */
    refreshAll(now) {
        const gmst = satellite.gstime(now);
        const v = new THREE.Vector3();
        for (let i = 0; i < this.records.length; i++) this.propagateOne(i, now, gmst, v);
        this.afterPositionsChanged();
    }

    afterPositionsChanged() {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeBoundingSphere();

        if (this.selectedIndex >= 0) {
            const i = this.selectedIndex;
            this.marker.position.set(
                this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
        }
        for (const item of this.labelItems) {
            const i = item.index;
            item.sprite.position.set(
                this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
            item.sprite.visible = this.records[i].pv !== null;
        }
    }

    // -----------------------------------------------------------------------
    // Labels & class filtering
    // -----------------------------------------------------------------------

    setLabelsEnabled(enabled) {
        this.labelsEnabled = enabled;
        this.rebuildLabels();
    }

    setClassVisible(cls, visible) {
        this.classVisible[cls] = visible;
        this.refreshAll(new Date());
        this.rebuildLabels();
        if (this.selectedIndex >= 0 && !visible &&
            this.records[this.selectedIndex].class === cls) {
            this.deselect();
        }
    }

    rebuildLabels() {
        for (const item of this.labelItems) {
            item.sprite.material.map.dispose();
            item.sprite.material.dispose();
        }
        this.labelGroup.clear();
        this.labelItems = [];
        if (!this.labelsEnabled) return;

        for (let i = 0; i < this.records.length && this.labelItems.length < LABEL_LIMIT; i++) {
            const rec = this.records[i];
            if (!this.classVisible[rec.class]) continue;
            const sprite = makeTextSprite(rec.name, {
                color: '#a9c8ea', size: 20, height: 0.32,
            });
            sprite.center.set(0.5, -0.55);   // float the label above the marker
            sprite.material.opacity = 0.75;
            this.labelGroup.add(sprite);
            this.labelItems.push({ index: i, sprite });
        }
        this.afterPositionsChanged();
    }

    /** True when the catalog is small enough that every object gets a label. */
    labelsCoverAll() {
        return this.records.length <= LABEL_LIMIT;
    }

    /** Raycast pick from a pointer event; returns record index or -1. */
    pick(event, camera, canvas) {
        if (this.records.length === 0) return -1;
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(ndc, camera);
        // Scale threshold with camera distance so picking stays comfortable.
        this.raycaster.params.Points.threshold =
            0.012 * camera.position.length();

        // Don't select satellites hidden behind the planet.
        const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), EARTH_RADIUS);
        const sphereHit = new THREE.Vector3();
        const earthDist = this.raycaster.ray.intersectSphere(sphere, sphereHit)
            ? this.raycaster.ray.origin.distanceTo(sphereHit)
            : Infinity;

        const hits = this.raycaster.intersectObject(this.points, false);
        for (const hit of hits) {
            const i = hit.index;
            if (hit.distance > earthDist) continue;
            if (i < this.records.length && this.records[i].pv) return i;
        }
        return -1;
    }

    select(index, now) {
        this.selectedIndex = index;
        const rec = this.records[index];
        const cls = ORBIT_CLASSES[rec.class];
        this.marker.material.color.copy(cls.color);
        this.marker.visible = true;
        this.orbitLine.material.color.copy(cls.color);
        this.buildOrbitTrack(rec, now);
        this.orbitLine.visible = true;
    }

    deselect() {
        this.selectedIndex = -1;
        this.marker.visible = false;
        this.orbitLine.visible = false;
    }

    /** Instantaneous orbital track: one full period sampled in ECI, rendered
     *  in the current Earth-fixed frame. */
    buildOrbitTrack(rec, now) {
        const periodMin = (2 * Math.PI) / rec.satrec.no;
        const gmst = satellite.gstime(now);
        const steps = 160;
        const pts = [];
        const v = new THREE.Vector3();
        for (let s = 0; s <= steps; s++) {
            const t = new Date(now.getTime() + (s / steps) * periodMin * 60000);
            try {
                const pv = satellite.propagate(rec.satrec, t);
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const ecf = satellite.eciToEcf(pv.position, gmst);
                    pts.push(exaggerateRadial(ecfToScene(ecf, v), this.exaggerated).clone());
                }
            } catch { /* skip bad sample */ }
        }
        this.orbitLine.geometry.dispose();
        this.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }

    /** Live telemetry for the selected satellite, or null. */
    selectedTelemetry(now) {
        if (this.selectedIndex < 0) return null;
        const rec = this.records[this.selectedIndex];
        if (!rec.pv) return null;

        const gmst = satellite.gstime(now);
        const geo = satellite.eciToGeodetic(rec.pv.position, gmst);
        const vel = rec.pv.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        const periodMin = (2 * Math.PI) / rec.satrec.no;

        return {
            name: rec.name,
            norad: rec.satrec.satnum,
            class: ORBIT_CLASSES[rec.class].label,
            altitudeKm: geo.height,
            speedKms: speed,
            periodMin,
            inclinationDeg: rec.satrec.inclo * (180 / Math.PI),
        };
    }
}
