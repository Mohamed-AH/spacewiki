// Static mission data for the Global Space Explorer console.

export const EARTH_RADIUS = 5;                 // Three.js scene units
export const REAL_EARTH_RADIUS_KM = 6378.137;  // WGS-84 mean equatorial radius
export const KM_TO_SCENE = EARTH_RADIUS / REAL_EARTH_RADIUS_KM;

export const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

// ---------------------------------------------------------------------------
// Historical launch sites (true geodetic pad coordinates)
// ---------------------------------------------------------------------------
export const LAUNCH_SITES = {
    ussr: {
        lat: 45.965, lon: 63.305,
        name: 'Baikonur Cosmodrome, Site 1/5',
        rocket: 'R-7 Semyorka — Sputnik 1',
        year: 1957,
        blurb: 'The first orbital launch in history. A modified R-7 ICBM lofted the 83.6 kg Sputnik 1 into a 215 × 939 km orbit, opening the Space Age.',
    },
    usa: {
        lat: 28.486, lon: -80.562,
        name: 'Cape Canaveral LC-26A',
        rocket: 'Juno I — Explorer 1',
        year: 1958,
        blurb: 'America’s first satellite. Explorer 1 carried a cosmic-ray package that led to the discovery of the Van Allen radiation belts.',
    },
    china: {
        lat: 41.301, lon: 100.315,
        name: 'Jiuquan Satellite Launch Center',
        rocket: 'Long March 1 — Dong Fang Hong 1',
        year: 1970,
        blurb: 'China’s first satellite broadcast the anthem "The East Is Red" from orbit, making China the fifth nation to launch independently.',
    },
    india: {
        lat: 13.720, lon: 80.230,
        name: 'Satish Dhawan Space Centre (SHAR)',
        rocket: 'SLV-3 — Rohini RS-1',
        year: 1980,
        blurb: 'ISRO’s first fully indigenous orbital launch placed the Rohini technology satellite into low Earth orbit on the fourth SLV flight.',
    },
    spacex: {
        lat: 9.048, lon: 167.743,
        name: 'Omelek Island, Kwajalein Atoll',
        rocket: 'Falcon 1 — Flight 4',
        year: 2008,
        blurb: 'The first privately developed liquid-fuelled rocket to reach orbit, after three failures that nearly ended SpaceX.',
    },
    blueorigin: {
        lat: 31.422, lon: -104.758,
        name: 'Corn Ranch Launch Site One, Texas',
        rocket: 'New Shepard — First Flight',
        year: 2015,
        blurb: 'Suborbital vertical-takeoff, vertical-landing vehicle. The propulsion module later achieved the first powered landing of a booster from space.',
    },
};

// ---------------------------------------------------------------------------
// Deep-space probe archive (escape direction vectors are stylised, not ephemeris)
// ---------------------------------------------------------------------------
export const PROBES = {
    voyager: {
        name: 'Voyager 1 & 2',
        meta: 'Launched 1977 · NASA · Status: Interstellar space',
        blurb: 'Launched to execute a grand tour of the Jovian and Saturnian systems. Both spacecraft have crossed the heliopause and now operate in interstellar space, still returning data after four decades.',
        action: 'Simulate escape route',
        escapeDir: [1.8, 1.0, -2.8],
        color: 0x00e5ff,
    },
    pioneer: {
        name: 'Pioneer 10 & 11',
        meta: 'Launched 1972 / 1973 · NASA · Status: Outward drift',
        blurb: 'Pioneered asteroid-belt traversal and the first close encounters with Jupiter and Saturn. Both are now silent, drifting outward toward the stellar neighbourhood carrying the Pioneer plaques.',
        action: 'Simulate Pioneer exit',
        escapeDir: [-1.9, -0.2, 2.5],
        color: 0x7ee787,
    },
    cassini: {
        name: 'Cassini–Huygens',
        meta: 'Launched 1997 · NASA / ESA / ASI · Status: Mission complete',
        blurb: 'Orbited Saturn for 13 years, delivered the Huygens lander to Titan, and captured ring and atmospheric dynamics before a deliberate end-of-mission descent into Saturn in 2017.',
        action: 'Simulate orbital insertion',
        escapeDir: [1.0, 1.4, 0.4],
        color: 0xf0b429,
    },
    newhorizons: {
        name: 'New Horizons',
        meta: 'Launched 2006 · NASA · Status: Kuiper Belt',
        blurb: 'Executed the first flyby of Pluto in 2015 and of the Kuiper Belt object Arrokoth in 2019 — the most distant close encounter ever performed. It continues outward at over 13 km/s.',
        action: 'Simulate flyby route',
        escapeDir: [-0.8, 0.6, -3.0],
        color: 0xff5cf4,
    },
    juno: {
        name: 'Juno',
        meta: 'Launched 2011 · NASA · Status: Active polar orbit',
        blurb: 'Orbiting Jupiter on extreme 53-day polar ellipses, Juno measures deep atmospheric water content, gravity harmonics, and the dynamics of the strongest magnetosphere in the Solar System.',
        action: 'Simulate Jupiter transfer',
        escapeDir: [0.6, -2.1, -0.4],
        color: 0xfff06e,
    },
    parker: {
        name: 'Parker Solar Probe',
        meta: 'Launched 2018 · NASA · Status: Solar corona',
        blurb: 'Descending inside the Sun’s coronal boundary via repeated Venus gravity assists, Parker holds the record as the fastest human-made object — over 190 km/s at perihelion.',
        action: 'Simulate solar descent',
        escapeDir: [0.2, -0.4, 0.1],
        color: 0xff7a45,
    },
};

// ---------------------------------------------------------------------------
// Fallback element sets (cached sample; epochs age, used only when CelesTrak
// is unreachable so the console still demonstrates live propagation).
// ---------------------------------------------------------------------------
export const FALLBACK_TLES = `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00000000  00000+0  00000+0 0  9990
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49512428429599
HST
1 20580U 90037B   24001.50000000  .00000000  00000+0  00000+0 0  9993
2 20580  28.4690 288.8102 0002460 321.7771  38.2740 15.09299865630158
NOAA 19
1 33591U 09005A   24001.50000000  .00000000  00000+0  00000+0 0  9997
2 33591  99.1917  55.3650 0013600 220.0000 139.0000 14.12501077770002
TERRA
1 25994U 99068A   24001.50000000  .00000000  00000+0  00000+0 0  9995
2 25994  98.2000 100.0000 0001300  90.0000 270.0000 14.57110000280002
GPS BIIR-2 (PRN 13)
1 24876U 97035A   24001.50000000  .00000000  00000+0  00000+0 0  9994
2 24876  55.6000 150.0000 0060000  60.0000 300.0000  2.00561000190000
GOES 16
1 41866U 16071A   24001.50000000  .00000000  00000+0  00000+0 0  9998
2 41866   0.0400 270.0000 0000600 200.0000 250.0000  1.00271000260004
MOLNIYA 3-50
1 25847U 99036A   24001.50000000  .00000000  00000+0  00000+0 0  9992
2 25847  63.1000 200.0000 7200000 270.0000  15.0000  2.00600000180001
TIANGONG
1 48274U 21035A   24001.50000000  .00000000  00000+0  00000+0 0  9991
2 48274  41.4700 200.0000 0005000 100.0000 260.0000 15.61000000150008`;
