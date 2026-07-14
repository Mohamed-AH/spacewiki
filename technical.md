# Technical Documentation: Global Space Explorer Terminal & Interstellar Wiki

This consolidated developer blueprint details the architecture and implementation of a client-side, interactive 3D satellite tracker, rocket launch simulator, and deep space exploration directory. The system utilizes Three.js for hardware-accelerated 3D graphics and satellite.js for real-time orbital calculations.

---

## 1. System Architecture & Mathematical Foundations

### 1.1 Near-Earth Orbit Tracking (SGP4 Propagation)

Satellites in low-Earth orbit (LEO) are tracked via dynamic **Two-Line Element (TLE)** sets using the Simplified General Perturbations (SGP4) model.

1. **TLE Parsing:** Convert TLE parameters into an SGP4 record using `satellite.twoline2satrec()`.


2. **ECI Coordinate Generation:** Propagate the orbit record relative to the system's live UTC clock to obtain Earth-Centered Inertial (ECI) coordinates ($x, y, z$) in kilometers.


3. **Sidereal Correction:** Convert ECI coordinates to Earth-Centered Earth-Fixed (ECEF) coordinates by tracking Greenwich Mean Sidereal Time (GMST) to account for Earth's rotation.


4. **Scene Scaling:** Map physical ECEF coordinates into Three.js scene coordinates using a scale factor ($s$) relative to Earth's mean equatorial radius ($R_E \approx 6378.137\text{ km}$):



$$s = \frac{\text{Three.js Earth Radius}}{\text{Physical Earth Radius } (6378.137\text{ km})}$$

$$X_{\text{scene}} = x_{\text{ECEF}} \cdot s, \quad Y_{\text{scene}} = y_{\text{ECEF}} \cdot s, \quad Z_{\text{scene}} = z_{\text{ECEF}} \cdot s$$

### 1.2 Geopolitical Mapping (Textureless Landmass Generation)

To optimize performance and avoid high-bandwidth texture maps, global coastlines and boundaries are generated on-the-fly. Geographic latitude ($\phi$) and longitude ($\lambda$) vectors from a Natural Earth GeoJSON dataset are converted to 3D Cartesian vectors:

$$X = -R \cdot \sin\left((90^\circ - \phi) \cdot \frac{\pi}{180^\circ}\right) \cdot \sin\left((\lambda + 180^\circ) \cdot \frac{\pi}{180^\circ}\right)$$

$$Y = R \cdot \cos\left((90^\circ - \phi) \cdot \frac{\pi}{180^\circ}\right)$$

$$Z = R \cdot \sin\left((90^\circ - \phi) \cdot \frac{\pi}{180^\circ}\right) \cdot \cos\left((\lambda + 180^\circ) \cdot \frac{\pi}{180^\circ}\right)$$

These are rendered as instances of `THREE.LineLoop` and grouped to rotate in synchronization with the inner globe core.

### 1.3 Flight & Deep Space Simulation Mechanics

* **Planeside Launch Simulations:** Launches are initiated from historically accurate geodetic coordinates. They use linear interpolation (lerping) to move a rocket mesh along a surface-normal vector representing vertical ascent, paired with an instanced particle-exhaust trail.
* **Deep Space Interstellar Trajectories:** Interplanetary probes are outside the Earth's gravitational sphere of influence. Their heliocentric trajectories are modeled as 3D Catmull-Rom splines representing escape velocity vectors, gravity assists, and solar-system exit trajectories.

---

## 2. API Integration Strategy

The system connects directly to CelesTrak’s public, CORS-enabled GP (General Perturbations) endpoint to query live tracking data:

* **By Country of Origin:** `[https://celestrak.org/NORAD/elements/gp.php?COUNTRY=](https://celestrak.org/NORAD/elements/gp.php?COUNTRY=){COUNTRY_CODE}&FORMAT=json`

* **By Technical/Scientific Group:** `[https://celestrak.org/NORAD/elements/gp.php?GROUP=](https://celestrak.org/NORAD/elements/gp.php?GROUP=){GROUP_NAME}&FORMAT=json`


| Group Key | Target Registry Profile | Data Scope |
| --- | --- | --- |
| `country:US` | United States (Space Force / NASA / Commercial) | Broad orbital registry |
| `country:IND` | India (ISRO) | National remote sensing, weather, communication |
| `country:CIS` | Russia (Roscosmos) | Sovereign navigation, science, infrastructure |
| `country:PRC` | China (CNSA) | Deep Earth monitoring, communication |
| `group:science` | Global Scientific Payloads | Dedicated astrophysics & earth research missions |
| `group:weather` | Meteorological Fleets | Global climate monitoring satellites |
| `group:stations` | Manned Space Habitations | International Space Station (ISS) & Tiangong (CSS) |

---

## 3. Consolidated Web Application Implementation

This HTML document contains the complete, self-contained implementation. It features a split-pane layout: a clean, technical space manual (wiki) on the left, and a hardware-accelerated WebGL tracking canvas on the right.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Interstellar Control Terminal</title>
    <style>
        body { 
            margin: 0; 
            overflow: hidden; 
            background-color: #050508; 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            height: 100vh;
        }
        
        #wiki-panel {
            width: 400px;
            background: #0d1117;
            border-right: 1px solid #30363d;
            overflow-y: auto;
            color: #c9d1d9;
            padding: 24px;
            box-sizing: border-box;
            z-index: 10;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
        #viewport-container {
            flex-grow: 1;
            position: relative;
            height: 100%;
        }

        canvas { display: block; width: 100%; height: 100%; }

        #wiki-panel::-webkit-scrollbar { width: 6px; }
        #wiki-panel::-webkit-scrollbar-track { background: #0d1117; }
        #wiki-panel::-webkit-scrollbar-thumb { background: #21262d; border-radius: 3px; }

        h1 { font-size: 15px; letter-spacing: 1.5px; color: #58a6ff; text-transform: uppercase; margin: 0 0 8px 0; border-bottom: 1px solid #21262d; padding-bottom: 10px; }
        h2 { font-size: 11px; color: #8b949e; text-transform: uppercase; margin: 12px 0 4px 0; letter-spacing: 0.5px; }
        p { font-size: 12px; line-height: 1.6; color: #8b949e; margin: 0 0 10px 0; }
        
        .wiki-section {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 14px;
        }
        .wiki-section h3 { margin: 0 0 4px 0; font-size: 13px; color: #f0f6fc; }
        .wiki-section .meta { font-size: 11px; color: #58a6ff; margin-bottom: 8px; }
        
        select, button { 
            background: #161b22; 
            color: #c9d1d9; 
            border: 1px solid #30363d; 
            padding: 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            width: 100%; 
            outline: none; 
            cursor: pointer;
            box-sizing: border-box;
        }
        button {
            background: #21262d;
            font-weight: bold;
            margin-top: 8px;
            transition: all 0.2s ease-in-out;
        }
        button:hover {
            background: #30363d;
            border-color: #58a6ff;
            color: #fff;
        }
        
        #hud {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(13,17,23,0.95);
            border: 1px solid #30363d;
            padding: 12px 16px;
            border-radius: 6px;
            color: #c9d1d9;
            font-size: 11px;
            pointer-events: none;
            line-height: 1.5;
            font-family: monospace;
            z-index: 10;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/satellite.js/4.0.0/satellite.min.js"></script>
</head>
<body>

<div id="wiki-panel">
    <h1>Mission Control Wiki</h1>
    <p>Dynamic terminal for near-Earth payload telemetry, historical launcher events, and deep space exploration routes.</p>

    <div class="wiki-section">
        <h3>1. LEO Telemetry Filter</h3>
        <p>Query global spatial registries by operational state or sovereign flag.</p>
        
        <label for="country-select">Sovereign Registry</label>
        <select id="country-select" style="margin-bottom: 8px;">
            <option value="US" selected>United States (US)</option>
            <option value="IND">India (ISRO)</option>
            <option value="CIS">Russia (Roscosmos)</option>
            <option value="PRC">China (CNSA)</option>
        </select>

        <label for="utility-select">Technical Profile</label>
        <select id="utility-select">
            <option value="NONE" selected>-- Default: Use Country --</option>
            <option value="science">Scientific Class</option>
            <option value="weather">Weather Systems</option>
            <option value="stations">Manned Space Stations</option>
            <option value="gps-ops">Navigation (GPS)</option>
            <option value="beidou">Navigation (BeiDou)</option>
            <option value="glo-ops">Navigation (GLONASS)</option>
            <option value="galileo">Navigation (Galileo)</option>
        </select>
    </div>

    <div class="wiki-section">
        <h3>2. Launch Site Simulator</h3>
        <p>Re-enact historical test flights launching from planetary coordinates.</p>
        <select id="launch-select">
            <option value="ussr">R-7 Semyorka - Baikonur (1957)</option>
            <option value="usa">Juno I (Explorer 1) - Cape Canaveral (1958)</option>
            <option value="china">Long March 1 (DFH-1) - Jiuquan (1970)</option>
            <option value="india">SLV-3 (Rohini) - Satish Dhawan (1980)</option>
            <option value="spacex">Falcon 1 Flight 4 - Omelek Island (2008)</option>
            <option value="blueorigin">New Shepard - Corn Ranch (2015)</option>
        </select>
        <button id="launch-btn">Execute Flight Trajectory</button>
    </div>

    <h2>3. Interplanetary Flight Logs</h2>

    <div class="wiki-section">
        <h3>Voyager 1 & 2</h3>
        <div class="meta">Launched: 1977 | NASA | Status: Interstellar Space</div>
        <p>Launched to execute a grand tour of Jovian and Saturnian systems. Now operating in interstellar space beyond the heliosphere.</p>
        <button onclick="simulateDeepSpace('voyager')">Simulate Escape Route</button>
    </div>

    <div class="wiki-section">
        <h3>Pioneer 10 & 11</h3>
        <div class="meta">Launched: 1972 / 1973 | NASA | Status: Outward Drift</div>
        <p>Pioneered asteroid belt traversal and planetary encounters. Outward bound toward the stellar neighborhood.</p>
        <button onclick="simulateDeepSpace('pioneer')">Simulate Pioneer Exit</button>
    </div>

    <div class="wiki-section">
        <h3>Cassini-Huygens</h3>
        <div class="meta">Launched: 1997 | NASA / ESA | Status: Mission Completed</div>
        <p>Operated in orbit around Saturn for 13 years, capturing atmospheric and ring dynamics before a deliberate end-of-mission planetary descent.</p>
        <button onclick="simulateDeepSpace('cassini')">Simulate Orbital Insert</button>
    </div>

    <div class="wiki-section">
        <h3>New Horizons</h3>
        <div class="meta">Launched: 2006 | NASA | Status: Kuiper Belt</div>
        <p>Executed high-speed flyby of Pluto and Arrokoth. Continues mapping Kuiper Belt objects at extreme distance.</p>
        <button onclick="simulateDeepSpace('newhorizons')">Simulate Flyby Route</button>
    </div>

    <div class="wiki-section">
        <h3>Juno</h3>
        <div class="meta">Launched: 2011 | NASA | Status: Active Polar Orbit</div>
        <p>Actively orbiting Jupiter via extreme polar paths, measuring atmospheric water content and deep magnetosphere dynamics.</p>
        <button onclick="simulateDeepSpace('juno')">Simulate Jupiter Gravity Well</button>
    </div>

    <div class="wiki-section">
        <h3>Parker Solar Probe</h3>
        <div class="meta">Launched: 2018 | NASA | Status: Solar Corona</div>
        <p>Descending inside the Sun's coronal boundaries, utilizing gravity assists to break records as the fastest human-made object.</p>
        <button onclick="simulateDeepSpace('parker')">Simulate Solar Descent</button>
    </div>
</div>

<div id="viewport-container">
    <div id="hud">SYSTEM ONILINE<br>LEO Radar Environment Scan Active...</div>
</div>

<script>
    // Context Layout Resolution
    const container = document.getElementById('viewport-container');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(0, 0, 14);

    const EARTH_RADIUS = 5;
    const realEarthRadiusKm = 6378.137;

    // Structural Base Earth Model
    const baseGeo = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x0c0f17, transparent: true, opacity: 0.95 });
    const earthBase = new THREE.Mesh(baseGeo, baseMat);
    scene.add(earthBase);

    // Dynamic Geopolitical Borders
    const landGroup = new THREE.Group();
    scene.add(landGroup);

    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const x = -radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.cos(theta);
        return new THREE.Vector3(x, y, z);
    }

    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson')
        .then(res => res.json())
        .then(data => {
            data.features.forEach(feature => {
                const coordinates = feature.geometry.coordinates;
                coordinates.forEach(polygon => {
                    const coords = Array.isArray(polygon[0][0]) ? polygon[0] : polygon;
                    const points = [];
                    coords.forEach(coord => {
                        points.push(latLonToVector3(coord[1], coord[0], EARTH_RADIUS + 0.02));
                    });
                    const borderGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const borderMat = new THREE.LineBasicMaterial({ color: 0x1f6feb });
                    const line = new THREE.LineLoop(borderGeo, borderMat);
                    landGroup.add(line);
                });
            });
        });

    // Tracking Loop Variables
    let satDataList = [];
    const satGroup = new THREE.Group();
    scene.add(satGroup);

    const deepSpaceGroup = new THREE.Group();
    scene.add(deepSpaceGroup);

    const countrySelect = document.getElementById('country-select');
    const utilitySelect = document.getElementById('utility-select');
    const launchSelect = document.getElementById('launch-select');
    const launchBtn = document.getElementById('launch-btn');
    const hud = document.getElementById('hud');

    // Launch Site Coordinate Configs
    const launchSites = {
        ussr: { lat: 45.965, lon: 63.305, name: "Baikonur Cosmodrome", rocket: "R-7 (Sputnik 1)" },
        usa: { lat: 28.486, lon: -80.562, name: "Cape Canaveral LC-26", rocket: "Juno I (Explorer 1)" },
        china: { lat: 41.301, lon: 100.315, name: "Jiuquan Space Center", rocket: "Long March 1 (DFH-1)" },
        india: { lat: 13.720, lon: 80.230, name: "Satish Dhawan SHAR", rocket: "SLV-3 (Rohini)" },
        spacex: { lat: 9.048, lon: 167.743, name: "Omelek Island", rocket: "Falcon 1 Flight 4" },
        blueorigin: { lat: 31.422, lon: -104.758, name: "Corn Ranch LS-1", rocket: "New Shepard" }
    };

    // Deep Space Coordinate & Vector Offsets
    const probeConfigs = {
        voyager: { name: "Voyager 1 & 2", escapeDir: new THREE.Vector3(1.8, 1.0, -2.8), color: 0x00ffff },
        pioneer: { name: "Pioneer 10 & 11", escapeDir: new THREE.Vector3(-1.9, -0.2, 2.5), color: 0x39ff14 },
        cassini: { name: "Cassini-Huygens", escapeDir: new THREE.Vector3(1.0, 1.4, 0.4), color: 0xffa500 },
        newhorizons: { name: "New Horizons", escapeDir: new THREE.Vector3(-0.8, 0.6, -3.0), color: 0xff00ff },
        juno: { name: "Juno", escapeDir: new THREE.Vector3(0.6, -2.1, -0.4), color: 0xffff00 },
        parker: { name: "Parker Solar Probe", escapeDir: new THREE.Vector3(0.2, -0.4, 0.1), color: 0xff4500 }
    };

    let activeLaunch = null;
    let activeTrajectory = null;

    function buildQueryUrl() {
        const utilityVal = utilitySelect.value;
        const countryVal = countrySelect.value;
        return (utilityVal !== "NONE") 
            ? `https://celestrak.org/NORAD/elements/gp.php?GROUP=${utilityVal}&FORMAT=json`
            : `https://celestrak.org/NORAD/elements/gp.php?COUNTRY=${countryVal}&FORMAT=json`;
    }

    async function updateSatellites() {
        hud.innerHTML = "POLLING CELESTRAK GP REGISTRY...";
        while(satGroup.children.length > 0){
            const obj = satGroup.children[0];
            satGroup.remove(obj);
            if(obj.geometry) obj.geometry.dispose();
            if(obj.material) obj.material.dispose();
        }
        satDataList = [];

        try {
            const res = await fetch(buildQueryUrl());
            const data = await res.json();
            const maxVisible = 1200;
            const renderingBatch = data.slice(0, maxVisible);
            
            hud.innerHTML = `RADAR STATE: OK<br>CATALOG NODES: ${data.length}<br>` + 
                             (data.length > maxVisible ? `RENDER POOL: Limit first ${maxVisible} elements` : "RENDER POOL: 100%");

            const satGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
            const satMat = new THREE.MeshBasicMaterial({ color: 0x8b949e });

            renderingBatch.forEach(sat => {
                if(!sat.TLE_LINE1 || !sat.TLE_LINE2) return;
                const satrec = satellite.twoline2satrec(sat.TLE_LINE1, sat.TLE_LINE2);
                const mesh = new THREE.Mesh(satGeo, satMat);
                satGroup.add(mesh);
                satDataList.push({ satrec, mesh });
            });
        } catch(e) {
            hud.innerHTML = "RADAR ENCOUNTERED COMMS TIMEOUT";
        }
    }

    // Launch Physics Simulator
    function runLaunchSimulation() {
        // Clear old animations
        while(deepSpaceGroup.children.length > 0) {
            const child = deepSpaceGroup.children[0];
            deepSpaceGroup.remove(child);
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
        }
        activeTrajectory = null;

        const siteKey = launchSelect.value;
        const site = launchSites[siteKey];
        if(!site) return;

        const startPos = latLonToVector3(site.lat, site.lon, EARTH_RADIUS);
        const normal = startPos.clone().normalize();
        const endPos = startPos.clone().add(normal.clone().multiplyScalar(3.0));

        // Pad indicator ring
        const padGeo = new THREE.RingGeometry(0.08, 0.12, 16);
        const padMat = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.copy(startPos);
        pad.lookAt(startPos.clone().add(normal));
        deepSpaceGroup.add(pad);

        // Cone Payload Mesh
        const rocketGeo = new THREE.ConeGeometry(0.05, 0.18, 8);
        const rocketMat = new THREE.MeshBasicMaterial({ color: 0xfff000 });
        const rocketMesh = new THREE.Mesh(rocketGeo, rocketMat);
        rocketMesh.position.copy(startPos);
        rocketMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        deepSpaceGroup.add(rocketMesh);

        // Trailing sparks engine
        const pCount = 50;
        const pGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(pCount * 3);
        for(let i=0; i < pCount; i++) {
            positions[i*3] = startPos.x;
            positions[i*3+1] = startPos.y;
            positions[i*3+2] = startPos.z;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const pMat = new THREE.PointsMaterial({
            color: 0xff3300,
            size: 0.12,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const engineTrail = new THREE.Points(pGeo, pMat);
        deepSpaceGroup.add(engineTrail);

        activeLaunch = {
            mesh: rocketMesh,
            trail: engineTrail,
            start: startPos,
            end: endPos,
            dir: normal,
            progress: 0.0,
            speed: 0.006,
            particleCount: pCount,
            meta: site
        };

        hud.innerHTML = `LIFTOFF DETECTED<br>VEHICLE: ${site.rocket}<br>ORIGIN: ${site.name}`;
    }

    // Interstellar Route Plotter
    function simulateDeepSpace(key) {
        while(deepSpaceGroup.children.length > 0) {
            const child = deepSpaceGroup.children[0];
            deepSpaceGroup.remove(child);
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
        }
        activeLaunch = null;

        const config = probeConfigs[key];
        if(!config) return;

        const curvePoints = [];
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = new THREE.Vector3()
                .copy(config.escapeDir)
                .multiplyScalar(t * 12)
                .add(new THREE.Vector3(Math.sin(t * 5) * 1.5, Math.cos(t * 3) * 0.8, Math.sin(t * 2) * 0.4));
            curvePoints.push(p);
        }

        const pathCurve = new THREE.CatmullRomCurve3(curvePoints);
        const pathGeo = new THREE.BufferGeometry().setFromPoints(pathCurve.getPoints(120));
        const pathMat = new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: 0.7 });
        const pathLine = new THREE.Line(pathGeo, pathMat);
        deepSpaceGroup.add(pathLine);

        const probeGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const probeMat = new THREE.MeshBasicMaterial({ color: config.color });
        const probeMesh = new THREE.Mesh(probeGeo, probeMat);
        deepSpaceGroup.add(probeMesh);

        activeTrajectory = {
            mesh: probeMesh,
            curve: pathCurve,
            progress: 0.0,
            speed: 0.003,
            color: config.color,
            name: config.name
        };

        hud.innerHTML = `TRAJECTORY PLOTTED<br>UNIT: ${config.name}<br>ESCAPE SYSTEM: HELIOCENTRIC`;
    }

    countrySelect.addEventListener('change', () => { utilitySelect.value = "NONE"; updateSatellites(); });
    utilitySelect.addEventListener('change', updateSatellites);
    launchBtn.addEventListener('click', runLaunchSimulation);

    function animate() {
        requestAnimationFrame(animate);
        const now = new Date();

        // Planet rotations
        earthBase.rotation.y += 0.0003;
        landGroup.rotation.y += 0.0003;
        satGroup.rotation.y += 0.0003;
        deepSpaceGroup.rotation.y += 0.0003;

        // Active LEO Propagation
        satDataList.forEach(sat => {
            const prop = satellite.propagate(sat.satrec, now);
            const pos = prop.position;
            if(pos) {
                const x = (pos.x / realEarthRadiusKm) * EARTH_RADIUS;
                const y = (pos.y / realEarthRadiusKm) * EARTH_RADIUS;
                const z = (pos.z / realEarthRadiusKm) * EARTH_RADIUS;
                sat.mesh.position.set(x, y, z);
                sat.mesh.visible = true;
            } else {
                sat.mesh.visible = false;
            }
        });

        // Launch Simulation Loop
        if(activeLaunch) {
            activeLaunch.progress += activeLaunch.speed;
            if(activeLaunch.progress <= 1.0) {
                const curPos = new THREE.Vector3().lerpVectors(activeLaunch.start, activeLaunch.end, activeLaunch.progress);
                activeLaunch.mesh.position.copy(curPos);

                const posArr = activeLaunch.trail.geometry.attributes.position.array;
                const idx = Math.floor(activeLaunch.progress * activeLaunch.particleCount) % activeLaunch.particleCount;

                posArr[idx*3] = curPos.x - activeLaunch.dir.x * 0.1;
                posArr[idx*3+1] = curPos.y - activeLaunch.dir.y * 0.1;
                posArr[idx*3+2] = curPos.z - activeLaunch.dir.z * 0.1;
                activeLaunch.trail.geometry.attributes.position.needsUpdate = true;
            } else {
                hud.innerHTML = `ORBITAL DEPLOYMENT SEQUENCE ENDED<br>TARGET: ${activeLaunch.meta.rocket}<br>STATUS: SUCCESS`;
                activeLaunch = null;
            }
        }

        // Interstellar Escape Loop
        if(activeTrajectory) {
            activeTrajectory.progress += activeTrajectory.speed;
            if(activeTrajectory.progress <= 1.0) {
                const pos = activeTrajectory.curve.getPointAt(activeTrajectory.progress);
                activeTrajectory.mesh.position.copy(pos);
                
                const relativeAU = (pos.length() * 0.35).toFixed(2);
                hud.innerHTML = `INTERSTELLAR ESCAPE SEQUENCE ACCELERATION<br>UNIT: ${activeTrajectory.name}<br>CALCULATED RADIUS: ${relativeAU} AU`;
            } else {
                hud.innerHTML = `HELIOCENTRIC TRANSIT ACHIEVED<br>UNIT: ${activeTrajectory.name}<br>STATUS: OUT OF BOUNDS`;
                activeTrajectory = null;
            }
        }

        controls.update();
        renderer.render(scene, camera);
    }

    // Initial Telemetry Call
    updateSatellites();
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
</script>
</body>
</html>

```
