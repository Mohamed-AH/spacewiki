// Live satellite layer: TLE ingestion, SGP4 propagation, orbit-class colouring,
// raycast picking, and a per-satellite telemetry readout.

import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { makeDiscTexture, ecfToScene } from './scene.js';
import { CELESTRAK_BASE, FALLBACK_TLES } from './data.js';

const MAX_RENDERED = 1500;

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
            size: 0.11,
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

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.09;
    }

    /** Build the CelesTrak GP query for the current filter selection. */
    static queryUrl(country, group) {
        return group !== 'NONE'
            ? `${CELESTRAK_BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=tle`
            : `${CELESTRAK_BASE}?COUNTRY=${encodeURIComponent(country)}&FORMAT=tle`;
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
        this.update(new Date());

        return {
            total: this.catalogTotal,
            rendered: this.records.length,
            fallback: this.usingFallback,
        };
    }

    /** Propagate every satellite to `now` (ECI -> ECEF via GMST -> scene). */
    update(now) {
        const gmst = satellite.gstime(now);
        const v = new THREE.Vector3();

        for (let i = 0; i < this.records.length; i++) {
            const rec = this.records[i];
            let ok = false;
            try {
                const pv = satellite.propagate(rec.satrec, now);
                if (pv && pv.position && typeof pv.position !== 'boolean') {
                    const ecf = satellite.eciToEcf(pv.position, gmst);
                    ecfToScene(ecf, v);
                    this.positions[i * 3] = v.x;
                    this.positions[i * 3 + 1] = v.y;
                    this.positions[i * 3 + 2] = v.z;
                    rec.pv = pv;
                    ok = true;
                }
            } catch { /* decayed / propagation error */ }

            if (!ok) {
                // Park failed nodes at origin, inside the globe (invisible).
                this.positions[i * 3] = 0;
                this.positions[i * 3 + 1] = 0;
                this.positions[i * 3 + 2] = 0;
                rec.pv = null;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeBoundingSphere();

        if (this.selectedIndex >= 0) {
            const i = this.selectedIndex;
            this.marker.position.set(
                this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
        }
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

        const hits = this.raycaster.intersectObject(this.points, false);
        for (const hit of hits) {
            const i = hit.index;
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
                    pts.push(ecfToScene(ecf, v).clone());
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
