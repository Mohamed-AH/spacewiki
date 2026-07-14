// Stylised heliocentric scene for deep-space replays: the Sun, planet orbit
// rings, and labelled planets, laid out around Earth (which stays at the
// scene origin). Distances are compressed — the UI carries a "not to scale"
// disclaimer.

import * as THREE from 'three';
import { makeDiscTexture, makeTextSprite } from './scene.js';
import { PLANETS, SUN_DISTANCE, AU_COMPRESSION } from './data.js';

// Ecliptic basis. The plane contains the origin (Earth) and the Sun:
// sunPos = -SUN_DISTANCE * U, so Earth sits on its own orbit ring at angle 0.
const N = new THREE.Vector3(0.14, 1, 0.07).normalize();          // plane normal
const U = new THREE.Vector3().crossVectors(N, new THREE.Vector3(0.25, 0, -1)).normalize();
const V = new THREE.Vector3().crossVectors(N, U).normalize();
export const SUN_POS = U.clone().multiplyScalar(-SUN_DISTANCE);

export function ringRadius(au) {
    return SUN_DISTANCE * Math.pow(au, AU_COMPRESSION);
}

/** Position on a planet's orbit ring; angle in degrees from the Earth direction. */
export function planetPosition(au, angleDeg) {
    const a = angleDeg * (Math.PI / 180);
    return new THREE.Vector3()
        .copy(SUN_POS)
        .addScaledVector(U, Math.cos(a) * ringRadius(au))
        .addScaledVector(V, Math.sin(a) * ringRadius(au));
}

/**
 * Build the heliocentric backdrop into `group`. Waypoint angle overrides come
 * from the probe route so encounters line up with the flight path.
 * Returns { bodies } — a map of body key -> { mesh, glow, pos } for pulsing.
 */
export function buildSolarSystem(group, angleOverrides = {}) {
    const discTex = makeDiscTexture();
    const bodies = {};

    // --- Sun ------------------------------------------------------------------
    const sunCore = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0xffe9b0 }),
    );
    sunCore.position.copy(SUN_POS);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: discTex, color: 0xffb84d, transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sunGlow.scale.setScalar(16);
    sunCore.add(sunGlow);
    const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: discTex, color: 0xff8c2a, transparent: true, opacity: 0.35,
        depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sunHalo.scale.setScalar(34);
    sunCore.add(sunHalo);
    group.add(sunCore);
    bodies.sun = { mesh: sunCore, glow: sunGlow, pos: SUN_POS.clone() };

    const sunLabel = makeTextSprite('Sun', { color: '#e8c27a' });
    sunLabel.position.copy(SUN_POS).add(new THREE.Vector3(0, 4.4, 0));
    group.add(sunLabel);

    // --- Orbit rings + planets -------------------------------------------------
    const ringMat = new THREE.LineBasicMaterial({
        color: 0x2c3a58, transparent: true, opacity: 0.5,
    });

    // Earth's own ring, for context (Earth itself is the tracked globe at origin).
    group.add(makeRing(SUN_DISTANCE, ringMat));

    for (const [key, planet] of Object.entries(PLANETS)) {
        group.add(makeRing(ringRadius(planet.au), ringMat));

        const angle = angleOverrides[key] ?? planet.angle;
        const pos = planetPosition(planet.au, angle);

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(planet.size, 24, 24),
            new THREE.MeshBasicMaterial({ color: planet.color }),
        );
        mesh.position.copy(pos);
        group.add(mesh);

        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: discTex, color: planet.color, transparent: true, opacity: 0.3,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        glow.scale.setScalar(planet.size * 5);
        mesh.add(glow);

        if (planet.rings) {
            const disc = new THREE.Mesh(
                new THREE.RingGeometry(planet.size * 1.4, planet.size * 2.2, 48),
                new THREE.MeshBasicMaterial({
                    color: planet.color, side: THREE.DoubleSide,
                    transparent: true, opacity: 0.35,
                }),
            );
            disc.lookAt(N);
            disc.rotateX(0.45);
            mesh.add(disc);
        }

        const label = makeTextSprite(planet.label);
        label.position.copy(pos).add(new THREE.Vector3(0, planet.size + 1.1, 0));
        group.add(label);

        bodies[key] = { mesh, glow, pos, baseGlow: 0.3 };
    }

    return { bodies };
}

function makeRing(radius, material) {
    const pts = [];
    const segments = 160;
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3()
            .copy(SUN_POS)
            .addScaledVector(U, Math.cos(a) * radius)
            .addScaledVector(V, Math.sin(a) * radius));
    }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), material);
}
