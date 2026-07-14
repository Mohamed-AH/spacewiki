// Flight simulations: historical pad launches (gravity-turn ascent with
// particle exhaust) and stylised deep-space escape trajectories.

import * as THREE from 'three';
import { latLonToVector3, eastAt, makeDiscTexture } from './scene.js';
import { EARTH_RADIUS, LAUNCH_SITES, PROBES } from './data.js';

const TRAIL_LENGTH = 70;

export class Simulations {
    constructor(simGroup) {
        this.group = simGroup;
        this.activeLaunch = null;
        this.activeProbe = null;
        this.discTex = makeDiscTexture();

        // Assigned by the app shell:
        this.onLaunchComplete = null;   // (site) => void
        this.onProbeProgress = null;    // (probe, au) => void
        this.onProbeComplete = null;    // (probe) => void
    }

    clear() {
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            this.group.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map && child.material.map !== this.discTex) {
                    child.material.map.dispose();
                }
                child.material.dispose();
            }
        }
        this.activeLaunch = null;
        this.activeProbe = null;
    }

    // -----------------------------------------------------------------------
    // Historical launch: rise along the surface normal, pitch downrange east.
    // -----------------------------------------------------------------------
    runLaunch(siteKey) {
        this.clear();
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

        // Pad marker ring
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

        // Vehicle
        const rocket = new THREE.Mesh(
            new THREE.ConeGeometry(0.045, 0.2, 10),
            new THREE.MeshBasicMaterial({ color: 0xfff2cf }),
        );
        rocket.position.copy(pad);
        this.group.add(rocket);

        // Exhaust trail — ring buffer of points fading to black (additive).
        const trail = this.makeTrail(0xff5a1f, pad);
        this.group.add(trail.points);

        this.activeLaunch = {
            site, curve, rocket, trail, pulseRings,
            progress: 0,
            speed: 0.0042,
        };
        return site;
    }

    // -----------------------------------------------------------------------
    // Deep-space probe: Catmull-Rom escape spline revealed as the probe flies.
    // -----------------------------------------------------------------------
    runProbe(probeKey) {
        this.clear();
        const probe = PROBES[probeKey];
        if (!probe) return null;

        const dir = new THREE.Vector3().fromArray(probe.escapeDir);
        const controlPoints = [];
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            controlPoints.push(new THREE.Vector3()
                .copy(dir)
                .multiplyScalar(EARTH_RADIUS * 0.22 + t * 13)
                .add(new THREE.Vector3(
                    Math.sin(t * 5) * 1.5,
                    Math.cos(t * 3) * 0.8,
                    Math.sin(t * 2) * 0.4,
                )));
        }
        const curve = new THREE.CatmullRomCurve3(controlPoints);

        const pathPoints = curve.getPoints(240);
        const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
        pathGeo.setDrawRange(0, 0);
        const path = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({
            color: probe.color, transparent: true, opacity: 0.75,
        }));
        this.group.add(path);

        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 16, 16),
            new THREE.MeshBasicMaterial({ color: probe.color }),
        );
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.discTex, color: probe.color,
            transparent: true, opacity: 0.85,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        glow.scale.setScalar(0.55);
        body.add(glow);
        this.group.add(body);

        this.activeProbe = {
            probe, curve, body, path,
            pathSegments: 240,
            progress: 0,
            speed: 0.0028,
        };
        return probe;
    }

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

        // Re-shade the whole buffer: newest = bright, oldest = black (invisible
        // under additive blending).
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

    update(elapsed) {
        if (this.activeLaunch) this.updateLaunch(elapsed);
        if (this.activeProbe) this.updateProbe();
    }

    updateLaunch(elapsed) {
        const L = this.activeLaunch;
        L.progress += L.speed;

        for (const ring of L.pulseRings) {
            const s = 1 + 0.6 * ((elapsed * 0.9 + ring.phase) % 1);
            ring.mesh.scale.setScalar(s);
            ring.mesh.material.opacity = 0.9 * (1 - ((elapsed * 0.9 + ring.phase) % 1));
        }

        if (L.progress >= 1) {
            const site = L.site;
            // Leave the trail and pad visible; freeze the vehicle at cutoff.
            this.activeLaunch = null;
            if (this.onLaunchComplete) this.onLaunchComplete(site);
            return;
        }

        const pos = L.curve.getPointAt(L.progress);
        const tangent = L.curve.getTangentAt(L.progress);
        L.rocket.position.copy(pos);
        L.rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
        this.pushTrailPoint(L.trail, pos.clone().addScaledVector(tangent, -0.12));
    }

    updateProbe() {
        const P = this.activeProbe;
        P.progress += P.speed;

        if (P.progress >= 1) {
            const probe = P.probe;
            P.path.geometry.setDrawRange(0, P.pathSegments + 1);
            this.activeProbe = null;
            if (this.onProbeComplete) this.onProbeComplete(probe);
            return;
        }

        const pos = P.curve.getPointAt(P.progress);
        P.body.position.copy(pos);
        P.path.geometry.setDrawRange(0, Math.floor(P.progress * P.pathSegments) + 1);
        if (this.onProbeProgress) {
            this.onProbeProgress(P.probe, (pos.length() * 0.35).toFixed(2));
        }
    }
}
