// Flight simulations: historical pad launches (gravity-turn ascent, staging
// callouts, payload deployment) and deep-space replays flown through a
// stylised solar system with automatic camera choreography.

import * as THREE from 'three';
import { latLonToVector3, eastAt, makeDiscTexture } from './scene.js';
import { EARTH_RADIUS, LAUNCH_SITES, PROBES, PLANETS } from './data.js';
import { buildSolarSystem, planetPosition, SUN_POS } from './solar.js';

const TRAIL_LENGTH = 90;
const LAUNCH_DURATION_S = 5.5;
const PROBE_DURATION_S = 24;

const LAUNCH_EVENTS = [
    { t: 0.30, note: 'MAX-Q — maximum dynamic pressure' },
    { t: 0.62, note: 'Stage separation' },
    { t: 0.85, note: 'Payload fairing jettison' },
];

export class Simulations {
    constructor(simGroup) {
        this.group = simGroup;
        this.discTex = makeDiscTexture();
        this.time = 0;

        this.activeLaunch = null;
        this.payload = null;         // post-launch orbiting payload
        this.activeProbe = null;
        this.frame = null;           // end-of-probe camera framing
        this.pulses = [];            // planet glow flashes
        this.fading = [];            // objects being faded out
        this.clearing = false;

        // Assigned by the app shell:
        this.onEvent = null;         // (title, htmlBody) => void
        this.onCleared = null;       // () => void — after a graceful clear
    }

    hasContent() {
        return this.group.children.length > 0;
    }

    // -----------------------------------------------------------------------
    // Clearing
    // -----------------------------------------------------------------------

    clearImmediate() {
        for (const f of this.fading) this.disposeObject(f.obj);
        this.fading = [];
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            this.group.remove(child);
            this.disposeObject(child);
        }
        this.activeLaunch = null;
        this.payload = null;
        this.activeProbe = null;
        this.frame = null;
        this.pulses = [];
        this.clearing = false;
    }

    /** Fade everything out over ~0.8 s, then fire onCleared. */
    fadeOutAndClear() {
        if (!this.hasContent() && this.fading.length === 0) return;
        this.activeLaunch = null;
        this.payload = null;
        this.activeProbe = null;
        this.frame = null;
        this.pulses = [];
        // Snapshot first — startFade re-adds each object so it keeps rendering
        // while it fades, which would otherwise make this loop endless.
        const children = [...this.group.children];
        this.group.clear();
        for (const child of children) this.startFade(child);
        this.clearing = true;
    }

    startFade(obj) {
        const mats = [];
        obj.traverse((node) => {
            if (node.material) {
                node.material.transparent = true;
                mats.push({ mat: node.material, base: node.material.opacity ?? 1 });
            }
        });
        this.group.add(obj); // keep rendering while it fades
        this.fading.push({ obj, mats, life: 1 });
    }

    disposeObject(obj) {
        obj.traverse((node) => {
            if (node.geometry) node.geometry.dispose();
            if (node.material) {
                if (node.material.map && node.material.map !== this.discTex) {
                    node.material.map.dispose();
                }
                node.material.dispose();
            }
        });
    }

    // -----------------------------------------------------------------------
    // Historical launch
    // -----------------------------------------------------------------------

    runLaunch(siteKey) {
        this.clearImmediate();
        const site = LAUNCH_SITES[siteKey];
        if (!site) return null;

        const pad = latLonToVector3(site.lat, site.lon, EARTH_RADIUS);
        const normal = pad.clone().normalize();
        const east = eastAt(pad);

        // Quadratic Bézier gravity turn: vertical climb, then downrange east.
        const curve = new THREE.QuadraticBezierCurve3(
            pad.clone(),
            pad.clone().addScaledVector(normal, 1.9),
            pad.clone().addScaledVector(normal, 2.7).addScaledVector(east, 2.9),
        );

        const pulseRings = [];
        for (let k = 0; k < 2; k++) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.09, 0.13, 32),
                new THREE.MeshBasicMaterial({
                    color: 0xf0b429, side: THREE.DoubleSide,
                    transparent: true, opacity: 0.9,
                }),
            );
            ring.position.copy(pad);
            ring.lookAt(pad.clone().add(normal));
            this.group.add(ring);
            pulseRings.push({ mesh: ring, phase: k * 0.5 });
        }

        const rocket = new THREE.Mesh(
            new THREE.ConeGeometry(0.05, 0.22, 10),
            new THREE.MeshBasicMaterial({ color: 0xfff2cf }),
        );
        rocket.position.copy(pad);
        this.group.add(rocket);

        const trail = this.makeTrail(0xff5a1f, pad);
        this.group.add(trail.points);

        this.activeLaunch = {
            site, curve, rocket, trail, pulseRings,
            progress: 0,
            events: LAUNCH_EVENTS.map((e) => ({ ...e })),
        };
        return site;
    }

    finishLaunch() {
        const L = this.activeLaunch;
        this.activeLaunch = null;

        const pos = L.curve.getPointAt(1);
        const tangent = L.curve.getTangentAt(1);

        // Fade the ascent hardware…
        this.group.remove(L.rocket, L.trail.points);
        this.startFade(L.rocket);
        this.startFade(L.trail.points);
        for (const ring of L.pulseRings) {
            this.group.remove(ring.mesh);
            this.startFade(ring.mesh);
        }
        this.clearing = false; // these fades are cosmetic, not a scene clear

        // …and deploy the payload into a circular orbit through the cutoff point.
        const r = pos.length();
        const u = pos.clone().normalize();
        const orbitNormal = new THREE.Vector3().crossVectors(pos, tangent).normalize();
        const w = new THREE.Vector3().crossVectors(orbitNormal, u).normalize();

        const orbitPts = [];
        for (let i = 0; i <= 128; i++) {
            const a = (i / 128) * Math.PI * 2;
            orbitPts.push(new THREE.Vector3()
                .addScaledVector(u, Math.cos(a) * r)
                .addScaledVector(w, Math.sin(a) * r));
        }
        const orbitLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(orbitPts),
            new THREE.LineDashedMaterial({
                color: 0xf0b429, transparent: true, opacity: 0.55,
                dashSize: 0.25, gapSize: 0.18,
            }),
        );
        orbitLine.computeLineDistances();
        this.group.add(orbitLine);

        const body = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.09),
            new THREE.MeshBasicMaterial({ color: 0x9fe3ff }),
        );
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.discTex, color: 0x4cc9f0, transparent: true, opacity: 0.8,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        glow.scale.setScalar(0.45);
        body.add(glow);
        body.position.copy(pos);
        this.group.add(body);

        this.payload = { body, u, w, r, theta: 0 };

        if (this.onEvent) {
            this.onEvent('PAYLOAD DEPLOYED',
                `VEHICLE: ${L.site.rocket}<br>ORBIT: achieved — circular track<br>SEQUENCE: complete`);
        }
    }

    // -----------------------------------------------------------------------
    // Deep-space replay
    // -----------------------------------------------------------------------

    runProbe(probeKey) {
        this.clearImmediate();
        const probe = PROBES[probeKey];
        if (!probe) return null;
        const route = probe.route;

        // Solar-system backdrop, with encounter planets moved onto the route.
        const overrides = {};
        for (const wp of route.waypoints) {
            if (PLANETS[wp.body]) overrides[wp.body] = wp.angle;
        }
        const { bodies } = buildSolarSystem(this.group, overrides);

        // Flight path: Earth -> encounters -> ending.
        const anchors = [new THREE.Vector3(0, 0, 0)];
        for (const wp of route.waypoints) {
            anchors.push(bodies[wp.body].pos.clone());
        }

        let endPos;
        if (route.end.type === 'orbit') {
            const target = bodies[route.end.body];
            endPos = route.end.body === 'sun'
                ? SUN_POS.clone().addScaledVector(
                    new THREE.Vector3().subVectors(anchors.at(-1), SUN_POS).normalize(), 4.4)
                : target.pos.clone();
        } else {
            const last = anchors.at(-1);
            const outward = new THREE.Vector3().subVectors(last, SUN_POS).normalize();
            endPos = last.clone().addScaledVector(outward, 55);
        }
        anchors.push(endPos);

        const curve = new THREE.CatmullRomCurve3(anchors, false, 'catmullrom', 0.6);
        const samples = 400;
        const pathPoints = curve.getPoints(samples);

        const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
        pathGeo.setDrawRange(0, 0);
        const path = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({
            color: probe.color, transparent: true, opacity: 0.8,
        }));
        this.group.add(path);

        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 16, 16),
            new THREE.MeshBasicMaterial({ color: probe.color }),
        );
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.discTex, color: probe.color, transparent: true, opacity: 0.85,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        glow.scale.setScalar(1.1);
        body.add(glow);
        this.group.add(body);

        // Event triggers: locate each waypoint's parameter along the curve.
        const events = route.waypoints.map((wp) => {
            const pos = bodies[wp.body].pos;
            let best = 0, bestDist = Infinity;
            for (let i = 0; i <= samples; i++) {
                const d = pathPoints[i].distanceToSquared(pos);
                if (d < bestDist) { bestDist = d; best = i; }
            }
            return { t: best / samples, note: wp.note, body: wp.body };
        });

        this.activeProbe = {
            probe, route, curve, body, path, bodies, events,
            samples,
            progress: 0,
        };
        return probe;
    }

    finishProbe() {
        const P = this.activeProbe;
        this.activeProbe = null;
        P.path.geometry.setDrawRange(0, P.samples + 1);

        if (P.route.end.type === 'orbit') {
            const target = P.bodies[P.route.end.body];
            if (target) this.pulses.push({ glow: target.glow, t: 1.6 });
        }

        // Frame the whole route (Sun + path) for the closing shot.
        const keyPoints = [new THREE.Vector3(0, 0, 0), SUN_POS.clone(),
            ...P.curve.points];
        const center = new THREE.Vector3();
        for (const p of keyPoints) center.add(p);
        center.divideScalar(keyPoints.length);
        let radius = 0;
        for (const p of keyPoints) radius = Math.max(radius, center.distanceTo(p));
        this.frame = { center, radius: radius + 10 };

        if (this.onEvent) {
            this.onEvent(
                P.route.end.type === 'orbit' ? 'ORBIT INSERTION COMPLETE' : 'SYSTEM ESCAPE COMPLETE',
                `UNIT: ${P.probe.name}<br>${P.route.end.note}<br>Drag to explore · Esc to return`);
        }
    }

    // -----------------------------------------------------------------------
    // Camera choreography (consumed by the app's camera rig)
    // -----------------------------------------------------------------------

    cameraDirective() {
        if (this.activeProbe) {
            const pos = this.activeProbe.body.position;
            const dist = Math.min(14 + pos.length() * 0.42, 170);
            return { mode: 'follow', target: pos, dist };
        }
        if (this.frame) {
            return { mode: 'frame', center: this.frame.center, radius: this.frame.radius };
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Per-frame update
    // -----------------------------------------------------------------------

    makeTrail(colorHex, origin) {
        const positions = new Float32Array(TRAIL_LENGTH * 3);
        const colors = new Float32Array(TRAIL_LENGTH * 3);
        for (let i = 0; i < TRAIL_LENGTH; i++) {
            positions[i * 3] = origin.x;
            positions[i * 3 + 1] = origin.y;
            positions[i * 3 + 2] = origin.z;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position',
            new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const points = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.11,
            map: this.discTex,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        points.frustumCulled = false;
        return { points, head: 0, color: new THREE.Color(colorHex) };
    }

    pushTrailPoint(trail, pos) {
        const geo = trail.points.geometry;
        const p = geo.attributes.position.array;
        const c = geo.attributes.color.array;
        const i = trail.head % TRAIL_LENGTH;
        p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
        trail.head++;

        // Newest = bright, oldest = black (invisible under additive blending).
        for (let k = 0; k < TRAIL_LENGTH; k++) {
            const idx = (trail.head - 1 - k + TRAIL_LENGTH * 2) % TRAIL_LENGTH;
            const fade = Math.max(0, 1 - k / TRAIL_LENGTH);
            c[idx * 3] = trail.color.r * fade;
            c[idx * 3 + 1] = trail.color.g * fade;
            c[idx * 3 + 2] = trail.color.b * fade;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
    }

    update(dt) {
        this.time += dt;
        if (this.activeLaunch) this.updateLaunch(dt);
        if (this.payload) this.updatePayload(dt);
        if (this.activeProbe) this.updateProbe(dt);
        this.updatePulses(dt);
        this.updateFades(dt);
    }

    updateLaunch(dt) {
        const L = this.activeLaunch;
        L.progress += dt / LAUNCH_DURATION_S;

        for (const ring of L.pulseRings) {
            const cycle = (this.time * 0.9 + ring.phase) % 1;
            ring.mesh.scale.setScalar(1 + 0.6 * cycle);
            ring.mesh.material.opacity = 0.9 * (1 - cycle);
        }

        while (L.events.length && L.progress >= L.events[0].t) {
            const e = L.events.shift();
            if (this.onEvent) {
                this.onEvent('ASCENT', `VEHICLE: ${L.site.rocket}<br>${e.note}`);
            }
        }

        if (L.progress >= 1) {
            this.finishLaunch();
            return;
        }

        const pos = L.curve.getPointAt(L.progress);
        const tangent = L.curve.getTangentAt(L.progress);
        L.rocket.position.copy(pos);
        L.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
        this.pushTrailPoint(L.trail, pos.clone().addScaledVector(tangent, -0.13));
    }

    updatePayload(dt) {
        const P = this.payload;
        P.theta += dt * 0.5;
        P.body.position.set(0, 0, 0)
            .addScaledVector(P.u, Math.cos(P.theta) * P.r)
            .addScaledVector(P.w, Math.sin(P.theta) * P.r);
    }

    updateProbe(dt) {
        const P = this.activeProbe;
        P.progress += dt / PROBE_DURATION_S;
        const p = Math.min(P.progress, 1);
        const eased = p * p * (3 - 2 * p);   // slow launch, fast cruise, gentle arrival

        while (P.events.length && eased >= P.events[0].t) {
            const e = P.events.shift();
            const b = P.bodies[e.body];
            if (b) this.pulses.push({ glow: b.glow, t: 1.2 });
            if (this.onEvent) {
                this.onEvent('ENCOUNTER', `UNIT: ${P.probe.name}<br>${e.note}`);
            }
        }

        if (P.progress >= 1) {
            this.finishProbe();
            return;
        }

        const pos = P.curve.getPointAt(eased);
        P.body.position.copy(pos);
        P.path.geometry.setDrawRange(0, Math.floor(eased * P.samples) + 1);
    }

    updatePulses(dt) {
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const pulse = this.pulses[i];
            pulse.t -= dt;
            const base = 0.3;
            if (pulse.t <= 0) {
                pulse.glow.material.opacity = base;
                this.pulses.splice(i, 1);
            } else {
                pulse.glow.material.opacity = base + Math.min(pulse.t, 1) * 0.7;
            }
        }
    }

    updateFades(dt) {
        if (this.fading.length === 0) {
            if (this.clearing) {
                this.clearing = false;
                if (this.onCleared) this.onCleared();
            }
            return;
        }
        for (let i = this.fading.length - 1; i >= 0; i--) {
            const f = this.fading[i];
            f.life -= dt * 1.6;
            if (f.life <= 0) {
                this.group.remove(f.obj);
                this.disposeObject(f.obj);
                this.fading.splice(i, 1);
            } else {
                for (const { mat, base } of f.mats) mat.opacity = base * f.life;
            }
        }
    }
}
