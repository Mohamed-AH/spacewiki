// Scene construction: renderer, camera, textureless Earth, starfield, atmosphere.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_RADIUS, KM_TO_SCENE } from './data.js';

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Geodetic lat/lon (degrees) to scene-space position on a sphere of `radius`. */
export function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta),
    );
}

/**
 * ECEF kilometres -> scene units. The mapping is chosen so that it agrees with
 * latLonToVector3: ECEF +Z (north pole) becomes scene +Y, and a point at
 * lat 0 / lon 90°E (ECEF +Y) becomes scene +X.
 */
export function ecfToScene(ecf, target = new THREE.Vector3()) {
    return target.set(ecf.y * KM_TO_SCENE, ecf.z * KM_TO_SCENE, -ecf.x * KM_TO_SCENE);
}

/** Local geographic east unit vector at a scene-space surface position. */
export function eastAt(surfacePos) {
    const normal = surfacePos.clone().normalize();
    return new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
}

// ---------------------------------------------------------------------------
// Scene assembly
// ---------------------------------------------------------------------------

export function createScene(canvas) {
    const container = canvas.parentElement;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        55, container.clientWidth / container.clientHeight, 0.1, 4000);
    camera.position.set(6, 4.5, 13);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = EARTH_RADIUS * 1.15;
    controls.maxDistance = 220;
    controls.zoomSpeed = 0.7;

    // --- Earth core ---------------------------------------------------------
    const earth = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0x0a1120 }),
    );
    scene.add(earth);

    // Fresnel rim glow: a slightly larger back-facing shell whose opacity
    // rises toward grazing view angles — a cheap, textureless atmosphere.
    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 64, 64),
        new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { glowColor: { value: new THREE.Color(0x2d7fd4) } },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vView = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 glowColor;
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.5);
                    gl_FragColor = vec4(glowColor, rim * 0.9);
                }`,
        }),
    );
    scene.add(atmosphere);

    // --- Graticule ----------------------------------------------------------
    const graticule = new THREE.Group();
    const gratMat = new THREE.LineBasicMaterial({
        color: 0x16223a, transparent: true, opacity: 0.7,
    });
    for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let lon = 0; lon <= 360; lon += 4) {
            pts.push(latLonToVector3(lat, lon, EARTH_RADIUS + 0.005));
        }
        graticule.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    for (let lon = 0; lon < 180; lon += 30) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 4) {
            pts.push(latLonToVector3(lat, lon, EARTH_RADIUS + 0.005));
        }
        for (let lat = 90; lat >= -90; lat -= 4) {
            pts.push(latLonToVector3(lat, lon + 180, EARTH_RADIUS + 0.005));
        }
        graticule.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    scene.add(graticule);

    // --- Starfield -----------------------------------------------------------
    scene.add(buildStarfield());

    // --- Groups populated by feature modules ---------------------------------
    const landGroup = new THREE.Group();
    const satGroup = new THREE.Group();
    const simGroup = new THREE.Group();   // launches + probe trajectories
    scene.add(landGroup, satGroup, simGroup);

    // --- Resize ---------------------------------------------------------------
    const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    new ResizeObserver(onResize).observe(container);

    return { renderer, scene, camera, controls, landGroup, satGroup, simGroup };
}

function buildStarfield() {
    const count = 2400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        // Uniform points on a distant sphere shell.
        const u = Math.random() * 2 - 1;
        const t = Math.random() * Math.PI * 2;
        const r = 900 + Math.random() * 800;
        const s = Math.sqrt(1 - u * u);
        positions[i * 3] = r * s * Math.cos(t);
        positions[i * 3 + 1] = r * u;
        positions[i * 3 + 2] = r * s * Math.sin(t);

        // Blue-white spectral spread with a few warm outliers.
        const temp = Math.random();
        if (temp > 0.94) color.setHSL(0.07, 0.7, 0.72);        // orange giants
        else if (temp > 0.8) color.setHSL(0.6, 0.5, 0.85);     // blue-white
        else color.setHSL(0.62, 0.1, 0.55 + Math.random() * 0.35);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return new THREE.Points(geo, new THREE.PointsMaterial({
        size: 2.2,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
    }));
}

// ---------------------------------------------------------------------------
// Coastlines — Natural Earth 1:110m land polygons drawn as line loops.
// ---------------------------------------------------------------------------

export async function loadCoastlines(landGroup) {
    const res = await fetch('assets/ne_110m_land.geojson');
    if (!res.ok) throw new Error(`coastline fetch failed: HTTP ${res.status}`);
    const data = await res.json();

    const mat = new THREE.LineBasicMaterial({
        color: 0x2f6fbe, transparent: true, opacity: 0.9,
    });

    for (const feature of data.features) {
        const geom = feature.geometry;
        const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
        for (const polygon of polygons) {
            for (const ring of polygon) {
                const points = ring.map(([lon, lat]) =>
                    latLonToVector3(lat, lon, EARTH_RADIUS + 0.015));
                landGroup.add(new THREE.LineLoop(
                    new THREE.BufferGeometry().setFromPoints(points), mat));
            }
        }
    }
}

/** Shared soft round sprite texture for point clouds. */
export function makeDiscTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
