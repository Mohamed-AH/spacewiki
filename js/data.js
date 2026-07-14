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
    vostok: {
        lat: 45.920, lon: 63.342,
        name: 'Baikonur Cosmodrome, Gagarin’s Start',
        rocket: 'Vostok-K — Vostok 1 (Gagarin)',
        year: 1961,
        blurb: 'Yuri Gagarin becomes the first human in space, completing one orbit of Earth in 108 minutes aboard Vostok 1.',
    },
    apollo11: {
        lat: 28.608, lon: -80.604,
        name: 'Kennedy Space Center LC-39A',
        rocket: 'Saturn V — Apollo 11',
        year: 1969,
        blurb: 'The most powerful rocket ever flown at the time carries Armstrong, Aldrin and Collins toward the first crewed lunar landing.',
    },
    sts1: {
        lat: 28.608, lon: -80.604,
        name: 'Kennedy Space Center LC-39A',
        rocket: 'Space Shuttle Columbia — STS-1',
        year: 1981,
        blurb: 'The first flight of a reusable orbital spacecraft. Columbia orbits Earth 37 times before landing on a runway like an aircraft.',
    },
    ariane: {
        lat: 5.232, lon: -52.775,
        name: 'Guiana Space Centre ELA-1, Kourou',
        rocket: 'Ariane 1 — L01',
        year: 1979,
        blurb: 'Europe’s independent access to space begins. The Ariane family goes on to dominate the commercial launch market for decades.',
    },
    falconheavy: {
        lat: 28.608, lon: -80.604,
        name: 'Kennedy Space Center LC-39A',
        rocket: 'Falcon Heavy — Demo Flight',
        year: 2018,
        blurb: 'The most powerful operational rocket of its era lofts a Tesla Roadster toward Mars while both side boosters land back in unison.',
    },
    artemis1: {
        lat: 28.627, lon: -80.621,
        name: 'Kennedy Space Center LC-39B',
        rocket: 'SLS — Artemis I',
        year: 2022,
        blurb: 'NASA’s return to the Moon begins: the Space Launch System sends an uncrewed Orion capsule around the Moon and back.',
    },
    chandrayaan3: {
        lat: 13.720, lon: 80.230,
        name: 'Satish Dhawan Space Centre (SHAR)',
        rocket: 'LVM3 — Chandrayaan-3',
        year: 2023,
        blurb: 'India becomes the first nation to soft-land at the lunar south polar region, with the Vikram lander and Pragyan rover.',
    },
    starship: {
        lat: 25.997, lon: -97.157,
        name: 'Starbase, Boca Chica, Texas',
        rocket: 'Starship — Integrated Flight Test',
        year: 2024,
        blurb: 'The largest and most powerful launch vehicle ever flown — a fully reusable system designed for Mars, caught by the launch tower’s arms on return.',
    },
};

// ---------------------------------------------------------------------------
// Stylised heliocentric layout (compressed distances, creative license —
// covered by the on-screen "not to scale" disclaimer).
// ---------------------------------------------------------------------------
export const SUN_DISTANCE = 55;          // scene units, Earth <-> Sun
export const AU_COMPRESSION = 0.45;      // ring radius = SUN_DISTANCE * au^C

export const PLANETS = {
    mercury: { au: 0.387, size: 0.22, color: 0x9c8f84, label: 'Mercury', angle: 25 },
    venus:   { au: 0.723, size: 0.38, color: 0xd9b380, label: 'Venus',   angle: -65 },
    mars:    { au: 1.524, size: 0.28, color: 0xc96f4a, label: 'Mars',    angle: 135 },
    ceres:   { au: 2.767, size: 0.13, color: 0xb0a89b, label: 'Ceres',   angle: 15 },
    jupiter: { au: 5.203, size: 1.35, color: 0xd8b28a, label: 'Jupiter', angle: -110 },
    saturn:  { au: 9.537, size: 1.10, color: 0xe0c894, label: 'Saturn',  angle: 65, rings: true },
    uranus:  { au: 19.19, size: 0.62, color: 0x9fd4dc, label: 'Uranus',  angle: 170 },
    neptune: { au: 30.07, size: 0.60, color: 0x6f8fd8, label: 'Neptune', angle: -150 },
    pluto:   { au: 39.48, size: 0.17, color: 0xbfae9f, label: 'Pluto',   angle: 105 },
};

// ---------------------------------------------------------------------------
// Deep-space probe archive. Each route is a stylised replay: waypoints are
// planet encounters (angle = position on that planet's orbit ring, degrees
// from the Earth direction) and the ending is either an escape out of the
// system or an orbit insertion at the final body.
// ---------------------------------------------------------------------------
export const PROBES = {
    voyager: {
        name: 'Voyager 1 & 2',
        meta: 'Launched 1977 · NASA · Status: Interstellar space',
        blurb: 'Launched to execute a grand tour of the Jovian and Saturnian systems. Both spacecraft have crossed the heliopause and now operate in interstellar space, still returning data after four decades.',
        action: 'Replay the Grand Tour',
        color: 0x00e5ff,
        route: {
            launchYear: 1977,
            endYear: 2012,
            waypoints: [
                { body: 'jupiter', angle: 28, note: 'Gravity assist — Jupiter (1979)' },
                { body: 'saturn', angle: 52, note: 'Gravity assist — Saturn (1980)' },
            ],
            end: { type: 'escape', note: 'Heliopause crossed — interstellar space' },
        },
    },
    pioneer: {
        name: 'Pioneer 10 & 11',
        meta: 'Launched 1972 / 1973 · NASA · Status: Outward drift',
        blurb: 'Pioneered asteroid-belt traversal and the first close encounters with Jupiter and Saturn. Both are now silent, drifting outward toward the stellar neighbourhood carrying the Pioneer plaques.',
        action: 'Replay Pioneer exit',
        color: 0x7ee787,
        route: {
            launchYear: 1972,
            endYear: 1995,
            waypoints: [
                { body: 'jupiter', angle: -155, note: 'First Jupiter flyby (1973)' },
                { body: 'saturn', angle: -125, note: 'First Saturn flyby (1979)' },
            ],
            end: { type: 'escape', note: 'Outward drift — toward the stars' },
        },
    },
    cassini: {
        name: 'Cassini–Huygens',
        meta: 'Launched 1997 · NASA / ESA / ASI · Status: Mission complete',
        blurb: 'Orbited Saturn for 13 years, delivered the Huygens lander to Titan, and captured ring and atmospheric dynamics before a deliberate end-of-mission descent into Saturn in 2017.',
        action: 'Replay orbital insertion',
        color: 0xf0b429,
        route: {
            launchYear: 1997,
            endYear: 2004,
            waypoints: [
                { body: 'venus', angle: -95, note: 'Gravity assist — Venus (1998–99)' },
                { body: 'jupiter', angle: -55, note: 'Gravity assist — Jupiter (2000)' },
                { body: 'saturn', angle: 40, note: 'Approaching the ringed giant' },
            ],
            end: { type: 'orbit', body: 'saturn', note: 'Saturn orbit insertion (2004)' },
        },
    },
    newhorizons: {
        name: 'New Horizons',
        meta: 'Launched 2006 · NASA · Status: Kuiper Belt',
        blurb: 'Executed the first flyby of Pluto in 2015 and of the Kuiper Belt object Arrokoth in 2019 — the most distant close encounter ever performed. It continues outward at over 13 km/s.',
        action: 'Replay Pluto flyby',
        color: 0xff5cf4,
        route: {
            launchYear: 2006,
            endYear: 2019,
            waypoints: [
                { body: 'jupiter', angle: 75, note: 'Gravity assist — Jupiter (2007)' },
                { body: 'pluto', angle: 95, note: 'Pluto flyby (2015)' },
            ],
            end: { type: 'escape', note: 'Arrokoth flyby — deep Kuiper Belt' },
        },
    },
    juno: {
        name: 'Juno',
        meta: 'Launched 2011 · NASA · Status: Active polar orbit',
        blurb: 'Orbiting Jupiter on extreme 53-day polar ellipses, Juno measures deep atmospheric water content, gravity harmonics, and the dynamics of the strongest magnetosphere in the Solar System.',
        action: 'Replay Jupiter transfer',
        color: 0xfff06e,
        route: {
            launchYear: 2011,
            endYear: 2016,
            waypoints: [
                { body: 'mars', angle: -25, note: 'Cruise — beyond the orbit of Mars' },
                { body: 'jupiter', angle: -80, note: 'Approaching the gas giant' },
            ],
            end: { type: 'orbit', body: 'jupiter', note: 'Jupiter orbit insertion (2016)' },
        },
    },
    parker: {
        name: 'Parker Solar Probe',
        meta: 'Launched 2018 · NASA · Status: Solar corona',
        blurb: 'Descending inside the Sun’s coronal boundary via repeated Venus gravity assists, Parker holds the record as the fastest human-made object — over 190 km/s at perihelion.',
        action: 'Replay solar descent',
        color: 0xff7a45,
        route: {
            launchYear: 2018,
            endYear: 2024,
            waypoints: [
                { body: 'venus', angle: 55, note: 'Gravity assist — Venus' },
            ],
            end: { type: 'orbit', body: 'sun', note: 'Perihelion — inside the corona' },
        },
    },
    galileo: {
        name: 'Galileo',
        meta: 'Launched 1989 · NASA · Status: Mission complete',
        blurb: 'The first Jupiter orbiter looped past Venus and Earth to gain speed, dropped a probe into Jupiter’s atmosphere, and studied the Galilean moons for eight years before a deliberate final plunge.',
        action: 'Replay VEEGA transfer',
        color: 0x8affc1,
        route: {
            launchYear: 1989,
            endYear: 1995,
            waypoints: [
                { body: 'venus', angle: -130, note: 'Gravity assist — Venus (1990)' },
                { body: 'jupiter', angle: -35, note: 'Approaching the Jovian system' },
            ],
            end: { type: 'orbit', body: 'jupiter', note: 'Jupiter orbit insertion (1995)' },
        },
    },
    messenger: {
        name: 'MESSENGER',
        meta: 'Launched 2004 · NASA · Status: Mission complete',
        blurb: 'Six planetary flybys were needed to slow down enough to orbit Mercury — the first spacecraft ever to do so. It mapped the entire innermost planet before impacting its surface in 2015.',
        action: 'Replay Mercury spiral',
        color: 0xd0b8ff,
        route: {
            launchYear: 2004,
            endYear: 2011,
            waypoints: [
                { body: 'venus', angle: 150, note: 'Gravity assist — Venus (2006–07)' },
                { body: 'mercury', angle: 100, note: 'Mercury flybys (2008–09)' },
            ],
            end: { type: 'orbit', body: 'mercury', note: 'Mercury orbit insertion (2011)' },
        },
    },
    rosetta: {
        name: 'Rosetta',
        meta: 'Launched 2004 · ESA · Status: Mission complete',
        blurb: 'After a decade of cruising and a Mars gravity assist, Rosetta became the first spacecraft to orbit a comet — 67P/Churyumov–Gerasimenko — and landed Philae on its surface.',
        action: 'Replay comet chase',
        color: 0x7fd0ff,
        route: {
            launchYear: 2004,
            endYear: 2014,
            waypoints: [
                { body: 'mars', angle: -160, note: 'Gravity assist — Mars (2007)' },
                { body: 'ceres', angle: -175, note: 'Deep-space hibernation — asteroid belt' },
            ],
            end: { type: 'escape', escapeLength: 14, note: 'Rendezvous — comet 67P (2014)' },
        },
    },
    dawn: {
        name: 'Dawn',
        meta: 'Launched 2007 · NASA · Status: Mission complete',
        blurb: 'Propelled by ion engines, Dawn was the first spacecraft to orbit two extraterrestrial bodies — the protoplanet Vesta and the dwarf planet Ceres — rewriting the story of the early Solar System.',
        action: 'Replay ion cruise',
        color: 0xffd166,
        route: {
            launchYear: 2007,
            endYear: 2015,
            waypoints: [
                { body: 'mars', angle: 60, note: 'Gravity assist — Mars (2009)' },
            ],
            end: { type: 'orbit', body: 'ceres', note: 'Ceres orbit (2015) — first dwarf-planet orbiter' },
        },
    },
};

// ---------------------------------------------------------------------------
// The Moon: displayed at a compressed distance (real: ~60 Earth radii), at its
// true present direction in the sky from a simplified lunar ephemeris.
// ---------------------------------------------------------------------------
export const MOON_DISTANCE = 14;                       // scene units (display)
export const MOON_RADIUS = EARTH_RADIUS * 0.2727;      // true size ratio

export const MOON_LANDINGS = [
    { key: 'a11', mission: 'Apollo 11', year: 1969, lat: 0.674, lon: 23.473,
      site: 'Sea of Tranquility',
      crew: 'Armstrong · Aldrin · Collins',
      blurb: '“That’s one small step for man…” — the first human footsteps on another world, watched live by 600 million people.' },
    { key: 'a12', mission: 'Apollo 12', year: 1969, lat: -3.012, lon: -23.422,
      site: 'Ocean of Storms',
      crew: 'Conrad · Gordon · Bean',
      blurb: 'A pinpoint landing within walking distance of the Surveyor 3 probe, proving precision targeting on the lunar surface.' },
    { key: 'a14', mission: 'Apollo 14', year: 1971, lat: -3.646, lon: -17.472,
      site: 'Fra Mauro Highlands',
      crew: 'Shepard · Roosa · Mitchell',
      blurb: 'Alan Shepard — America’s first astronaut — reached the Moon at 47, and famously hit two golf balls across Fra Mauro.' },
    { key: 'a15', mission: 'Apollo 15', year: 1971, lat: 26.132, lon: 3.634,
      site: 'Hadley–Apennine',
      crew: 'Scott · Worden · Irwin',
      blurb: 'The first mission with the Lunar Roving Vehicle, exploring Hadley Rille beneath the towering Apennine mountains.' },
    { key: 'a16', mission: 'Apollo 16', year: 1972, lat: -8.973, lon: 15.500,
      site: 'Descartes Highlands',
      crew: 'Young · Mattingly · Duke',
      blurb: 'The first landing in the lunar highlands revealed that the bright terrain was shaped by impacts, not volcanoes.' },
    { key: 'a17', mission: 'Apollo 17', year: 1972, lat: 20.191, lon: 30.772,
      site: 'Taurus–Littrow Valley',
      crew: 'Cernan · Evans · Schmitt',
      blurb: 'The last — and longest — lunar expedition, with geologist Harrison Schmitt discovering orange volcanic glass. No one has returned since.' },
];

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
