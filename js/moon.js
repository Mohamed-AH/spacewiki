// The Moon: rendered at a compressed distance but at its true present
// direction in the sky (simplified lunar ephemeris, good to ~2°), tidally
// locked so the near side faces Earth, sunlit by the same solar direction
// as the terminator, with the six Apollo landing sites marked.

import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { ecfToScene, latLonToVector3, makeDiscTexture, makeTextSprite } from './scene.js';
import { MOON_DISTANCE, MOON_RADIUS, MOON_LANDINGS } from './data.js';

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const RAD = Math.PI / 180;

/** Approximate lunar direction in scene (Earth-fixed) coordinates. */
export function moonDirectionScene(date, target = new THREE.Vector3()) {
    const d = (date.getTime() - J2000_MS) / 86400000;

    const L = (218.316 + 13.176396 * d) * RAD;   // mean longitude
    const M = (134.963 + 13.064993 * d) * RAD;   // mean anomaly
    const F = (93.272 + 13.229350 * d) * RAD;    // argument of latitude

    const lambda = L + 6.289 * RAD * Math.sin(M);   // ecliptic longitude
    const beta = 5.128 * RAD * Math.sin(F);         // ecliptic latitude
    const eps = (23.439 - 0.0000004 * d) * RAD;     // obliquity

    // Ecliptic -> equatorial (≈ECI) -> ECEF -> scene
    const xe = Math.cos(beta) * Math.cos(lambda);
    const ye = Math.cos(beta) * Math.sin(lambda);
    const ze = Math.sin(beta);
    const eci = {
        x: xe,
        y: ye * Math.cos(eps) - ze * Math.sin(eps),
        z: ye * Math.sin(eps) + ze * Math.cos(eps),
    };
    const ecf = satellite.eciToEcf(eci, satellite.gstime(date));
    return ecfToScene(ecf, target).normalize();
}

export function buildMoon() {
    const group = new THREE.Group();
    const discTex = makeDiscTexture();

    const tex = new THREE.TextureLoader().load('assets/moon_1024.jpg');
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;

    const uniforms = {
        moonMap: { value: tex },
        sunDir: { value: new THREE.Vector3(1, 0, 0) },
    };

    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(MOON_RADIUS, 64, 64),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: /* glsl */`
                varying vec3 vPos;
                varying vec3 vNormalW;
                void main() {
                    vPos = position;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D moonMap;
                uniform vec3 sunDir;
                varying vec3 vPos;
                varying vec3 vNormalW;
                const float PI = 3.141592653589793;
                void main() {
                    vec3 n = normalize(vPos);
                    float lat = asin(clamp(n.y, -1.0, 1.0));
                    float lon = atan(n.x, -n.z);
                    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
                    vec3 tex = texture2D(moonMap, uv).rgb;
                    float sunAmt = smoothstep(-0.08, 0.18, dot(normalize(vNormalW), sunDir));
                    // 0.14 floor = earthshine, so the dark side stays readable
                    vec3 col = tex * (0.14 + 0.86 * sunAmt) + vec3(0.008, 0.011, 0.02);
                    gl_FragColor = vec4(col, 1.0);
                }`,
        }),
    );
    group.add(mesh);

    // --- Apollo landing sites (children of the mesh: they rotate with it) -----
    const sites = new Map();
    const sitesGroup = new THREE.Group();
    sitesGroup.visible = false;             // shown while the Moon has focus
    mesh.add(sitesGroup);

    for (const landing of MOON_LANDINGS) {
        const pos = latLonToVector3(landing.lat, landing.lon, MOON_RADIUS + 0.005);
        const normal = pos.clone().normalize();

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.035, 0.05, 24),
            new THREE.MeshBasicMaterial({
                color: 0xf0b429, side: THREE.DoubleSide,
                transparent: true, opacity: 0.9, depthWrite: false,
            }),
        );
        ring.position.copy(pos);
        ring.lookAt(pos.clone().add(normal));

        const dot = new THREE.Sprite(new THREE.SpriteMaterial({
            map: discTex, color: 0xffe9b0, transparent: true, opacity: 0.95,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        dot.scale.setScalar(0.09);
        dot.position.copy(pos);

        const label = makeTextSprite(landing.mission, { color: '#e8c27a', size: 24, height: 0.17 });
        label.position.copy(pos).addScaledVector(normal, 0.16);

        sitesGroup.add(ring, dot, label);
        sites.set(landing.key, { landing, ring, dot, label, localPos: pos });
    }

    // --- State ------------------------------------------------------------------
    let selectedKey = null;
    let pulseT = 0;

    const _dir = new THREE.Vector3();
    const _toEarth = new THREE.Vector3();
    const NEAR_SIDE = new THREE.Vector3(0, 0, -1);   // lunar lon 0 in local coords

    function update(date, sunDir, dt) {
        moonDirectionScene(date, _dir);
        group.position.copy(_dir).multiplyScalar(MOON_DISTANCE);

        // Tidal lock: keep the near side pointed at Earth (origin).
        _toEarth.copy(group.position).negate().normalize();
        mesh.quaternion.setFromUnitVectors(NEAR_SIDE, _toEarth);

        uniforms.sunDir.value.copy(sunDir);

        if (selectedKey) {
            pulseT += dt * 2.2;
            const s = sites.get(selectedKey);
            const pulse = 1 + 0.35 * (0.5 + 0.5 * Math.sin(pulseT));
            s.ring.scale.setScalar(pulse);
        }
    }

    function setSitesVisible(visible) {
        sitesGroup.visible = visible;
    }

    function selectSite(key) {
        if (selectedKey) {
            const prev = sites.get(selectedKey);
            prev.ring.scale.setScalar(1);
            prev.ring.material.color.setHex(0xf0b429);
        }
        selectedKey = key;
        pulseT = 0;
        if (key) sites.get(key).ring.material.color.setHex(0x7ee787);
    }

    /** World position of a site (for camera targeting). */
    function siteWorldPos(key, target = new THREE.Vector3()) {
        const s = sites.get(key);
        return s ? s.dot.getWorldPosition(target) : target.copy(group.position);
    }

    return { group, update, setSitesVisible, selectSite, siteWorldPos };
}
