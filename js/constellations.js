// Classical constellations on the celestial sphere. Star positions are
// equatorial coordinates (RA hours, Dec degrees) of the bright figure stars;
// the group is rotated by GMST each tick so the figures sit where they really
// are in the sky above the rendered Earth.

import * as THREE from 'three';
import { makeDiscTexture, makeTextSprite } from './scene.js';

const SPHERE_RADIUS = 1250;

// [name, stars as [raHours, decDeg], line segments as star-index pairs]
const CONSTELLATIONS = [
    ['Orion',
        [[5.92, 7.41], [5.42, 6.35], [5.53, -0.30], [5.60, -1.20], [5.68, -1.94], [5.80, -9.67], [5.24, -8.20]],
        [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2], [0, 4]]],
    ['Ursa Major',
        [[11.06, 61.75], [11.03, 56.38], [11.90, 53.69], [12.26, 57.03], [12.90, 55.96], [13.42, 54.93], [13.79, 49.31]],
        [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]],
    ['Ursa Minor',
        [[2.53, 89.26], [17.54, 86.59], [16.77, 82.04], [15.73, 77.79], [14.85, 74.16], [15.35, 71.83], [16.29, 75.76]],
        [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
    ['Cassiopeia',
        [[0.15, 59.15], [0.68, 56.54], [0.95, 60.72], [1.43, 60.24], [1.91, 63.67]],
        [[0, 1], [1, 2], [2, 3], [3, 4]]],
    ['Scorpius',
        [[16.00, -22.62], [16.09, -19.81], [16.49, -26.43], [16.84, -34.29], [16.91, -42.36], [17.62, -43.00], [17.56, -37.10]],
        [[1, 0], [0, 2], [2, 3], [3, 4], [4, 5], [5, 6]]],
    ['Crux',
        [[12.44, -63.10], [12.52, -57.11], [12.79, -59.69], [12.25, -58.75]],
        [[0, 1], [2, 3]]],
    ['Cygnus',
        [[20.69, 45.28], [20.37, 40.26], [19.51, 27.96], [19.75, 45.13], [20.77, 33.97]],
        [[0, 1], [1, 2], [3, 1], [1, 4]]],
    ['Leo',
        [[10.14, 11.97], [10.33, 19.84], [10.28, 23.42], [9.88, 26.01], [11.24, 20.52], [11.82, 14.57], [11.35, 6.03]],
        [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 0]]],
    ['Taurus',
        [[4.60, 16.51], [4.33, 15.63], [4.48, 19.18], [5.44, 28.61], [5.63, 21.14]],
        [[0, 1], [1, 2], [2, 3], [0, 4]]],
    ['Gemini',
        [[7.58, 31.89], [7.76, 28.03], [7.34, 21.98], [6.63, 16.40], [6.38, 22.51]],
        [[0, 1], [1, 2], [2, 3], [0, 4], [4, 3]]],
    ['Canis Major',
        [[6.75, -16.72], [6.38, -17.96], [6.98, -28.97], [7.14, -26.39], [7.40, -29.30]],
        [[0, 1], [0, 3], [3, 2], [3, 4]]],
    ['Lyra',
        [[18.62, 38.78], [18.75, 37.60], [18.83, 33.36], [18.98, 32.69], [18.91, 36.90]],
        [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]]],
    ['Aquila',
        [[19.85, 8.87], [19.77, 10.61], [19.92, 6.41], [19.09, 13.86], [20.19, -0.82]],
        [[1, 0], [0, 2], [0, 3], [0, 4]]],
    ['Pegasus',
        [[23.08, 15.21], [0.22, 15.18], [0.14, 29.09], [23.06, 28.08]],
        [[0, 1], [1, 2], [2, 3], [3, 0]]],
];

function radecToScene(raHours, decDeg, radius) {
    const ra = raHours * (Math.PI / 12);
    const dec = decDeg * (Math.PI / 180);
    // Equatorial (≈ECI) direction, mapped with the same ECI->scene convention
    // used everywhere else: scene = (eci.y, eci.z, -eci.x).
    const x = Math.cos(dec) * Math.cos(ra);
    const y = Math.cos(dec) * Math.sin(ra);
    const z = Math.sin(dec);
    return new THREE.Vector3(y * radius, z * radius, -x * radius);
}

/**
 * Build the constellation layer. Rotate the returned group by GMST each tick
 * (group.rotation.y = gmst) to keep the figures aligned with the real sky.
 */
export function buildConstellations() {
    const group = new THREE.Group();
    const discTex = makeDiscTexture();

    const lineMat = new THREE.LineBasicMaterial({
        color: 0x5b74a8, transparent: true, opacity: 0.32, depthWrite: false,
    });

    const starPositions = [];
    for (const [name, stars, lines] of CONSTELLATIONS) {
        const pts = stars.map(([ra, dec]) => radecToScene(ra, dec, SPHERE_RADIUS));
        starPositions.push(...pts);

        const segPts = [];
        for (const [a, b] of lines) segPts.push(pts[a], pts[b]);
        group.add(new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(segPts), lineMat));

        // Label at the centroid, pushed onto the sphere.
        const centroid = new THREE.Vector3();
        for (const p of pts) centroid.add(p);
        centroid.normalize().multiplyScalar(SPHERE_RADIUS * 0.98);
        const label = makeTextSprite(name, { color: '#6d87b8', size: 26, height: 34 });
        label.material.opacity = 0.55;
        label.position.copy(centroid);
        group.add(label);
    }

    // Figure stars: slightly larger and warmer than the background field.
    const starGeo = new THREE.BufferGeometry().setFromPoints(starPositions);
    group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
        size: 4.5,
        sizeAttenuation: false,
        map: discTex,
        color: 0xcfe0ff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
    })));

    group.visible = true;
    return group;
}
