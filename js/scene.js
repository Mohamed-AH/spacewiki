// Scene construction: renderer, camera, day/night Earth, starfield, atmosphere.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as satellite from 'satellite.js';
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
// Solar geometry — approximate solar ephemeris (good to ~1°), rotated into the
// Earth-fixed frame so the day/night terminator sits where it really is.
// ---------------------------------------------------------------------------

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export function sunDirectionScene(date, target = new THREE.Vector3()) {
    const d = (date.getTime() - J2000_MS) / 86400000;
    const rad = Math.PI / 180;
    const L = (280.460 + 0.9856474 * d) * rad;      // mean longitude
    const g = (357.528 + 0.9856003 * d) * rad;      // mean anomaly
    const lambda = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    const eps = (23.439 - 0.0000004 * d) * rad;     // obliquity

    const eci = {
        x: Math.cos(lambda),
        y: Math.cos(eps) * Math.sin(lambda),
        z: Math.sin(eps) * Math.sin(lambda),
    };
    const ecf = satellite.eciToEcf(eci, satellite.gstime(date));
    return ecfToScene(ecf, target).normalize();
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
    controls.maxDistance = 600;
    controls.zoomSpeed = 0.7;
    controls.autoRotate = true;         // subtle idle spin; app pauses it on input
    controls.autoRotateSpeed = 0.35;

    // --- Textures ---------------------------------------------------------------
    const loader = new THREE.TextureLoader();
    const loadTex = (url) => {
        const tex = loader.load(url);
        // Longitude/latitude UVs are derived in the shader; skip mipmaps to
        // avoid the derivative seam at the antimeridian.
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.RepeatWrapping;
        return tex;
    };
    const dayMap = loadTex('assets/earth_atmos_2048.jpg');
    const nightMap = loadTex('assets/earth_lights_2048.png');
    const cloudMap = loadTex('assets/earth_clouds_1024.png');

    const sunDir = sunDirectionScene(new Date());

    // --- Earth: day/night blend with a live solar terminator ---------------------
    // UVs are computed from the surface normal using the SAME lat/lon convention
    // as latLonToVector3, so satellites, pads, and coastlines always align.
    const sphereVertexShader = /* glsl */`
        varying vec3 vPos;
        varying vec3 vNormalV;
        varying vec3 vViewV;
        void main() {
            vPos = position;
            vNormalV = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewV = -mv.xyz;
            gl_Position = projectionMatrix * mv;
        }`;

    const earthUniforms = {
        dayMap: { value: dayMap },
        nightMap: { value: nightMap },
        sunDir: { value: sunDir.clone() },
    };

    const earth = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS, 128, 128),
        new THREE.ShaderMaterial({
            uniforms: earthUniforms,
            vertexShader: sphereVertexShader,
            fragmentShader: /* glsl */`
                uniform sampler2D dayMap;
                uniform sampler2D nightMap;
                uniform vec3 sunDir;
                varying vec3 vPos;
                varying vec3 vNormalV;
                varying vec3 vViewV;
                const float PI = 3.141592653589793;
                void main() {
                    vec3 n = normalize(vPos);
                    float lat = asin(clamp(n.y, -1.0, 1.0));
                    float lon = atan(n.x, -n.z);
                    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

                    vec3 day = texture2D(dayMap, uv).rgb;
                    vec3 lights = texture2D(nightMap, uv).rgb;

                    float sunAmt = smoothstep(-0.12, 0.28, dot(n, sunDir));

                    // Moody, slightly desaturated day side
                    vec3 dayCol = day * vec3(0.62, 0.74, 0.95) * 0.9;
                    float lum = dot(dayCol, vec3(0.299, 0.587, 0.114));
                    dayCol = mix(vec3(lum), dayCol, 0.88);

                    // Deep-blue night side with warm city lights
                    vec3 nightCol = vec3(0.013, 0.024, 0.052)
                        + lights * vec3(1.0, 0.82, 0.55) * 1.4;

                    vec3 col = mix(nightCol, dayCol, sunAmt);

                    // Cool fresnel rim under the atmosphere shell
                    float rim = pow(1.0 - max(dot(normalize(vNormalV), normalize(vViewV)), 0.0), 3.4);
                    col += vec3(0.10, 0.20, 0.38) * rim;

                    gl_FragColor = vec4(col, 1.0);
                }`,
        }),
    );
    scene.add(earth);

    // --- Cloud layer: faint, sunlit, drifting slowly ------------------------------
    const cloudUniforms = {
        cloudMap: { value: cloudMap },
        sunDir: { value: sunDir.clone() },
    };
    const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 96, 96),
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: cloudUniforms,
            vertexShader: /* glsl */`
                varying vec3 vPos;
                varying vec2 vUv;
                void main() {
                    vPos = position;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D cloudMap;
                uniform vec3 sunDir;
                varying vec3 vPos;
                varying vec2 vUv;
                void main() {
                    vec4 tex = texture2D(cloudMap, vUv);
                    float sunAmt = smoothstep(-0.12, 0.3, dot(normalize(vPos), sunDir));
                    float a = tex.a * mix(0.05, 0.32, sunAmt);
                    gl_FragColor = vec4(vec3(0.75, 0.82, 0.95), a);
                }`,
        }),
    );
    scene.add(clouds);

    // --- Atmosphere: fresnel shell -------------------------------------------------
    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.022, 96, 96),
        new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { glowColor: { value: new THREE.Color(0x3d7fd6) } },
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
                    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.6);
                    gl_FragColor = vec4(glowColor, rim * 0.5);
                }`,
        }),
    );
    scene.add(atmosphere);

    // --- Graticule (barely-there texture) -----------------------------------------
    const graticule = new THREE.Group();
    const gratMat = new THREE.LineBasicMaterial({
        color: 0x1a2b4a, transparent: true, opacity: 0.22,
    });
    for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let lon = 0; lon <= 360; lon += 4) {
            pts.push(latLonToVector3(lat, lon, EARTH_RADIUS + 0.006));
        }
        graticule.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    for (let lon = 0; lon < 180; lon += 30) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 4) {
            pts.push(latLonToVector3(lat, lon, EARTH_RADIUS + 0.006));
        }
        for (let lat = 90; lat >= -90; lat -= 4) {
            pts.push(latLonToVector3(lat, lon + 180, EARTH_RADIUS + 0.006));
        }
        graticule.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    scene.add(graticule);

    // --- Starfield ------------------------------------------------------------------
    scene.add(buildStarfield());

    // --- Groups populated by feature modules -----------------------------------------
    const satGroup = new THREE.Group();
    const simGroup = new THREE.Group();   // launches + probe trajectories
    scene.add(satGroup, simGroup);

    // --- Per-frame / per-tick hooks ----------------------------------------------------
    const _sun = new THREE.Vector3();
    function updateSun(date) {
        sunDirectionScene(date, _sun);
        earthUniforms.sunDir.value.copy(_sun);
        cloudUniforms.sunDir.value.copy(_sun);
    }

    function updateClouds(dt) {
        clouds.rotation.y += dt * 0.004;
    }

    // --- Resize --------------------------------------------------------------------
    const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    };
    new ResizeObserver(onResize).observe(container);

    return { renderer, scene, camera, controls, satGroup, simGroup, updateSun, updateClouds };
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
        const r = 1400 + Math.random() * 900;
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
        size: 2.0,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
    }));
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

/** Canvas-generated text label rendered as a sprite (used for planets). */
export function makeTextSprite(text, { color = '#8fa8c9', size = 22, height = 2.4 } = {}) {
    const pad = 8;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${size * 2}px "SFMono-Regular", Consolas, Menlo, monospace`;
    canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
    canvas.height = size * 2 + pad * 2;
    ctx.font = `${size * 2}px "SFMono-Regular", Consolas, Menlo, monospace`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(height * aspect, height, 1);
    return sprite;
}
