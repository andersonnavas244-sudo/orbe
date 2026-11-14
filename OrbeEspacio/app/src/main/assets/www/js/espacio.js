/* Orbe Espacio – la Estación Espacial y miles de satélites en vivo sobre un globo 3D */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const N = window.AndroidEspacio || null;
  const NATIVE = !!(N && typeof N.fetchText === 'function');
  const SAT = window.satellite;
  const I = window.OrbeIcons;
  const nf = new Intl.NumberFormat('es-CO');
  const nf1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const D2R = Math.PI / 180, R2D = 180 / Math.PI, RE = 6378.137, MU = 398600.4418;
  const ISS_ID = 25544, CSS_ID = 48274, HST_ID = 20580;
  const CELESTRAK = g => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`;
  const LL2 = 'https://ll.thespacedevs.com/2.2.0';
  // Copia diaria del catálogo en GitHub Pages (la publica .github/workflows/actualizar-listas.yml).
  // Pon aquí tu dirección cuando publiques el repositorio, p. ej.:
  //   'https://andersonnavas244-sudo.github.io/orbe/espacio/sats.json'
  // Mientras esté vacía, la app descarga directamente de CelesTrak.
  const MIRROR = 'https://andersonnavas244-sudo.github.io/orbe/espacio/sats.json';

  const store = {
    get(k, d) { try { const v = localStorage.getItem('espacio.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('espacio.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐';
  const regionName = (() => { try { const d = new Intl.DisplayNames(['es'], { type: 'region' }); return cc => { try { return d.of(cc); } catch (e) { return cc; } }; } catch (e) { return cc => cc; } })();

  // ---------- tipos de satélite ----------
  const CATS = {
    est: { name: 'Estaciones espaciales', short: 'Estaciones', desc: 'Casas en el espacio donde viven y trabajan astronautas.' },
    starlink: { name: 'Starlink', short: 'Starlink', desc: 'La red de SpaceX: miles de satélites que dan internet desde el espacio.' },
    net: { name: 'Internet satelital', short: 'Internet', desc: 'OneWeb, Kuiper (Amazon) y Qianfan: otras redes de internet en órbita baja.' },
    nav: { name: 'Navegación (GPS)', short: 'GPS', desc: 'GPS, Galileo, GLONASS y BeiDou: le dicen a tu teléfono dónde estás.' },
    clima: { name: 'Meteorología', short: 'Clima', desc: 'Vigilan nubes, huracanes y tormentas para el pronóstico del tiempo.' },
    tierra: { name: 'Observación de la Tierra', short: 'Observación', desc: 'Fotografían el planeta: bosques, cultivos, ciudades, hielo y desastres.' },
    ciencia: { name: 'Ciencia y telescopios', short: 'Ciencia', desc: 'Telescopios como el Hubble y satélites que estudian el universo y la Tierra.' },
    com: { name: 'Comunicaciones', short: 'Comunicaciones', desc: 'Llevan televisión, telefonía y datos entre países y continentes.' },
    edu: { name: 'Educativos y radioaficionados', short: 'Educativos', desc: 'Pequeños satélites (CubeSats) de universidades, colegios y radioaficionados.' },
    mil: { name: 'Defensa y gobierno', short: 'Gobierno', desc: 'Satélites de defensa y de agencias gubernamentales.' },
    otros: { name: 'Otros satélites', short: 'Otros', desc: 'Satélites de prueba, tecnología y otros usos.' }
  };
  const CAT_ORDER = ['est', 'starlink', 'net', 'nav', 'clima', 'tierra', 'ciencia', 'com', 'edu', 'mil', 'otros'];
  function classify(name) {
    const n = name.toUpperCase();
    if (/^STARLINK/.test(n)) return 'starlink';
    if (/^(ONEWEB|KUIPER|QIANFAN|GUOWANG|SPACESAIL|HULIANWANG)/.test(n)) return 'net';
    if (/(NAVSTAR|GPS |GLONASS|GALILEO|BEIDOU|QZS|IRNSS|NAVIC|GSAT0)/.test(n)) return 'nav';
    if (/(NOAA|GOES|METEOSAT|METOP|HIMAWARI|FENGYUN|FY-\d|ELEKTRO|METEOR|DMSP|JPSS|SUOMI|GEO-KOMPSAT)/.test(n)) return 'clima';
    if (/(LANDSAT|SENTINEL|WORLDVIEW|PLEIADES|SPOT |FLOCK|LEMUR|SKYSAT|ICEYE|CAPELLA|RADARSAT|TERRA|AQUA|GAOFEN|JILIN|SUPERVIEW|PLANETSCOPE|CBERS)/.test(n)) return 'tierra';
    if (/(^HST$|HUBBLE|CHANDRA|SWIFT|FERMI|NUSTAR|TESS|XMM|INTEGRAL|ASTROSAT|EINSTEIN|AGILE|GRACE|ICESAT|CALIPSO|SMAP|SWOT)/.test(n)) return 'ciencia';
    if (/(IRIDIUM|INTELSAT|SES|EUTELSAT|ASTRA|GLOBALSTAR|ORBCOMM|INMARSAT|TELSTAR|ECHOSTAR|VIASAT|AMAZONAS|HISPASAT|ARABSAT|TURKSAT|CHINASAT|APSTAR|ASIASAT|JCSAT|SKYNET|DIRECTV|O3B|TDRS|MUOS|NILESAT|YAMAL|EXPRESS)/.test(n)) return 'com';
    if (/(CUBESAT|AMSAT|OSCAR|FUNCUBE|^AO-|^SO-|^FO-|^IO-|^CAS-)/.test(n)) return 'edu';
    if (/^(USA |COSMOS|YAOGAN|NROL|SBIRS|WGS|AEHF|OFEK)/.test(n)) return 'mil';
    if (/^(ISS|CSS|TIANHE|WENTIAN|MENGTIAN)/.test(n)) return 'est';
    return 'otros';
  }

  const state = {
    sats: [], byId: new Map(), filter: 'all', sel: -1, follow: false, showOrbit: true,
    me: store.get('me', null), passTarget: ISS_ID, passes: {}, passTab: 'vis',
    rem: Object.assign({ on: true, lead: 10, sats: [ISS_ID] }, store.get('rem', {})),
    launchRem: new Set(store.get('launchRem', [])),
    settings: Object.assign({ quality: 'ultra', clouds: true, labels: true }, store.get('settings', {})),
    launches: null, astros: null, geo: null, ciudades: [], sheet: null, premium: false, price: '$9.000 COP/mes',
    catalogDate: null, catalogLive: false
  };

  // ---------- red: en Android pasa por la app (con caché y sin restricciones del navegador) ----------
  const pending = new Map(); let seq = 0;
  window.__orbeFetched = (id, ok, text) => {
    const p = pending.get(id); if (!p) return;
    pending.delete(id); ok ? p.res(text) : p.rej(new Error(text || 'error'));
  };
  function getText(url, maxAgeMin = 0) {
    if (NATIVE) {
      return new Promise((res, rej) => {
        const id = ++seq; pending.set(id, { res, rej });
        N.fetchText(url, id, maxAgeMin | 0);
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('tiempo agotado')); } }, 90000);
      });
    }
    // Navegador: caché ligera en localStorage para no gastar el límite de las APIs gratuitas
    const key = 'cache:' + url;
    const c = maxAgeMin > 0 ? store.get(key, null) : null;
    if (c && Date.now() - c.t < maxAgeMin * 60000) return Promise.resolve(c.v);
    return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(t => { if (maxAgeMin > 0 && t.length < 1500000) store.set(key, { t: Date.now(), v: t }); return t; })
      .catch(e => { if (c) return c.v; throw e; });
  }
  const getJSON = (url, maxAge) => getText(url, maxAge).then(t => JSON.parse(t));
  const local = url => fetch(url).then(r => r.json());

  // ---------- utilidades ----------
  let toastTimer;
  function toast(msg, ms = 2800) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  window.orbeToast = m => toast(m, 3800);
  function distKm(aLat, aLng, bLat, bLng) {
    const x = Math.sin((bLat - aLat) * D2R / 2) ** 2 + Math.cos(aLat * D2R) * Math.cos(bLat * D2R) * Math.sin((bLng - aLng) * D2R / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  const pad2 = n => String(n).padStart(2, '0');
  const fmtTime = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = t => {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.floor((new Date(d).setHours(0, 0, 0, 0) - today) / 864e5);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  };
  const fmtDate = t => new Date(t).toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  function until(ms) {
    if (ms <= 0) return 'ahora';
    const m = Math.round(ms / 60000);
    if (m < 60) return `en ${m} min`;
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return `en ${h} h ${mm ? mm + ' min' : ''}`.trim();
    const d = Math.floor(h / 24); return `en ${d} día${d > 1 ? 's' : ''} ${h % 24 ? (h % 24) + ' h' : ''}`.trim();
  }
  function ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400); return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  }
  function countdown(ms) {
    const neg = ms < 0; ms = Math.abs(ms);
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    return { d, h, m, s, neg, txt: `${neg ? 'T+' : 'T−'}${d ? d + 'd ' : ''}${pad2(h)}:${pad2(m)}:${pad2(s)}` };
  }
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const COMPASS_LONG = { N: 'el norte', NNE: 'el norte-noreste', NE: 'el noreste', ENE: 'el este-noreste', E: 'el este', ESE: 'el este-sureste', SE: 'el sureste',
    SSE: 'el sur-sureste', S: 'el sur', SSO: 'el sur-suroeste', SO: 'el suroeste', OSO: 'el oeste-suroeste', O: 'el oeste', ONO: 'el oeste-noroeste', NO: 'el noroeste', NNO: 'el norte-noroeste' };
  const compass = az => COMPASS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  const hexLin = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.pow(v / 255, 2.2)); };

  // ---------- Sol ----------
  // Punto de la Tierra con el Sol justo encima (aprox. NOAA), en grados [lng, lat].
  function sunPosition(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const doy = (d - start) / 864e5;
    const g = 2 * Math.PI / 365 * (doy - 1 + (d.getUTCHours() - 12) / 24);
    const decl = (0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
      + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)) * R2D;
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    let lng = -(utcMin + eot - 720) / 4;
    lng = ((lng + 540) % 360) - 180;
    return [lng, decl];
  }
  // Vector Tierra→Sol en coordenadas inerciales (km), fórmula del Almanaque Astronómico
  function sunEci(t) {
    const n = t / 864e5 + 2440587.5 - 2451545.0;
    const L = (280.460 + 0.9856474 * n) * D2R, g = (357.528 + 0.9856003 * n) * D2R;
    const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const eps = (23.439 - 0.0000004 * n) * D2R;
    const r = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * 149597870.7;
    return { x: r * Math.cos(lam), y: r * Math.cos(eps) * Math.sin(lam), z: r * Math.sin(eps) * Math.sin(lam), r };
  }

  // ---------- satélites ----------
  const omm = s => ({ OBJECT_NAME: s.name, NORAD_CAT_ID: s.id, OBJECT_ID: s.cospar, EPOCH: s.epoch, MEAN_MOTION: s.mm, ECCENTRICITY: s.ecc,
    INCLINATION: s.inc, RA_OF_ASC_NODE: s.raan, ARG_OF_PERICENTER: s.argp, MEAN_ANOMALY: s.ma, BSTAR: s.bstar,
    MEAN_MOTION_DOT: s.ndot, MEAN_MOTION_DDOT: s.nddot });
  const toRow = s => [s.name, s.id, s.cospar, s.epoch, s.mm, s.ecc, s.inc, s.raan, s.argp, s.ma, s.bstar, s.ndot, s.nddot, s.cat];
  const fromRow = r => ({ name: r[0], id: r[1], cospar: r[2] || '', epoch: r[3], mm: r[4], ecc: r[5], inc: r[6], raan: r[7], argp: r[8], ma: r[9],
    bstar: r[10], ndot: r[11], nddot: r[12], cat: r[13] || classify(r[0]) });
  function satrecOf(s) {
    if (s.rec === undefined) { try { s.rec = SAT.json2satrec(omm(s)); } catch (e) { s.rec = null; } }
    return s.rec;
  }
  function stateAt(s, t = Date.now()) {
    const rec = satrecOf(s); if (!rec) return null;
    const d = new Date(t);
    let pv; try { pv = SAT.propagate(rec, d); } catch (e) { return null; }
    if (!pv || !pv.position || !pv.velocity) return null;
    const gmst = SAT.gstime(d);
    const g = SAT.eciToGeodetic(pv.position, gmst);
    const v = pv.velocity;
    if (!isFinite(g.height)) return null;
    return { lat: SAT.degreesLat(g.latitude), lng: SAT.degreesLong(g.longitude), alt: g.height, speed: Math.hypot(v.x, v.y, v.z), eci: pv.position, gmst };
  }
  function elements(s) {
    const n = s.mm * 2 * Math.PI / 86400;
    const a = Math.cbrt(MU / (n * n));
    return { period: 1440 / s.mm, a, apo: a * (1 + s.ecc) - RE, peri: a * (1 - s.ecc) - RE };
  }
  function orbitType(s) {
    const e = elements(s);
    if (s.ecc > 0.25) return ['HEO', 'Órbita elíptica alta'];
    if (e.apo < 2000) return ['LEO', 'Órbita baja'];
    if (Math.abs(e.a - 42164) < 700 && s.inc < 20) return ['GEO', 'Geoestacionaria'];
    if (e.apo < 30000) return ['MEO', 'Órbita media'];
    return ['HEO', 'Órbita alta'];
  }
  const launchYear = s => { const m = /^(\d{4})-/.exec(s.cospar || ''); return m ? +m[1] : null; };
  function displayName(s) {
    if (s.id === ISS_ID) return 'Estación Espacial Internacional';
    if (s.id === CSS_ID) return 'Estación espacial china Tiangong';
    if (s.id === HST_ID) return 'Telescopio espacial Hubble';
    return s.name.replace(/\s+\[.*?\]$/, '');
  }

  // ---------- lugares: país u océano bajo un punto ----------
  function inRing(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function countryAt(lat, lng) {
    if (!state.geo) return null;
    for (const f of state.geo) {
      const b = f.bbox; if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const p of polys) if (inRing(p[0], lng, lat)) return f.cc;
    }
    return null;
  }
  function oceanAt(lat, lng) {
    if (lat < -60) return 'el océano Antártico';
    if (lat > 66) return 'el océano Ártico';
    if (lng > 20 && lng < 120 && lat < 30) return 'el océano Índico';
    if (lng > -70 && lng <= 20 && !(lng < -20 && lat < -55)) return 'el océano Atlántico';
    if (lng > -100 && lng <= -70 && lat > 8 && lat < 32) return 'el mar Caribe y el golfo de México';
    return 'el océano Pacífico';
  }
  function overText(lat, lng) {
    const cc = countryAt(lat, lng);
    return cc ? { txt: `Sobre ${regionName(cc)} ${flag(cc)}`, cc } : { txt: `Sobre ${oceanAt(lat, lng)}`, cc: null };
  }

  // ---------- globo ----------
  const TEXTURES = { day: { k8: 'img/8k/8k_earth_daymap.jpg', k4: 'img/earth-blue-marble.jpg' }, night: 'img/earth-night.jpg' };
  let globe, maxTex = 4096, maxAniso = 1, baseMat = null, dnMat = null, clouds = null, hdReady = false;
  const use8k = () => state.settings.quality === 'ultra' && window.TierraHD && TierraHD.maxTex >= 8192 && TierraHD.can8k();
  const DN_VERT = `varying vec3 vNormal; varying vec2 vUv;
    void main() { vNormal = normalize(normalMatrix * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const DN_FRAG = `#define PI 3.141592653589793
    uniform sampler2D dayTexture; uniform sampler2D nightTexture; uniform vec2 sunPosition; uniform vec2 globeRotation;
    varying vec3 vNormal; varying vec2 vUv;
    float toRad(in float a) { return a * PI / 180.0; }
    vec3 polar2Cartesian(in vec2 c) { float theta = toRad(90.0 - c.x); float phi = toRad(90.0 - c.y); return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta)); }
    void main() {
      float invLon = toRad(globeRotation.x); float invLat = -toRad(globeRotation.y);
      mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
      mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
      vec3 sunDir = rotX * rotY * polar2Cartesian(sunPosition);
      float intensity = dot(normalize(vNormal), normalize(sunDir));
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv) * 1.45;
      float blendFactor = smoothstep(-0.14, 0.14, intensity);
      gl_FragColor = mix(nightColor, dayColor, blendFactor);
    }`;

  function initGlobe() {
    globe = new Globe($('#globe'), { animateIn: true, waitForGlobeReady: true,
      rendererConfig: { antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false } });
    try { const caps = globe.renderer().capabilities; maxTex = caps.maxTextureSize || 4096; maxAniso = caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1; } catch (e) { /* por defecto */ }
    globe.globeImageUrl(use8k() ? TEXTURES.day.k8 : TEXTURES.day.k4)
      .bumpImageUrl('img/earth-topology.png')
      .backgroundImageUrl('img/stars-4k.jpg')
      .globeCurvatureResolution(2)
      .showAtmosphere(true).atmosphereColor('#6cc8ff').atmosphereAltitude(0.16)
      .polygonAltitude(0.003).polygonCapColor(() => 'rgba(0,0,0,0)').polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => 'rgba(190,225,255,0.22)').polygonsTransitionDuration(0).polygonLabel(() => '')
      // Órbita y zona de visibilidad del satélite elegido
      .pathPoints('pts').pathPointLat(p => p[0]).pathPointLng(p => p[1]).pathPointAlt(p => p[2])
      .pathColor(p => p.color).pathStroke(p => p.stroke).pathDashLength(p => p.dash || 1).pathDashGap(p => p.gap || 0)
      .pathDashAnimateTime(p => p.anim || 0).pathTransitionDuration(0).pathResolution(1)
      // Plataformas de lanzamiento y tu ubicación
      .htmlLat('lat').htmlLng('lng').htmlAltitude(d => d.alt || 0.01).htmlElement(d => d.el)
      .particleLat('lat').particleLng('lng').particleAltitude(0.01).particlesList(d => d)
      .onZoom(onZoom)
      .onGlobeReady(onGlobeReady);
    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(window.devicePixelRatio || 1, 2));   // el regulador de fluidez ajusta
    const c = globe.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.22; c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 101.5; c.maxDistance = 1500;
    c.addEventListener('start', () => { c.autoRotate = false; if (state.follow) { state.follow = false; refreshFollowBtn(); } });
    const me = state.me;
    globe.pointOfView({ lat: me ? me.lat : 8, lng: me ? me.lng : -62, altitude: 2.7 });
    globe.renderer().domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
    globe.renderer().domElement.addEventListener('webglcontextrestored', () => location.reload(), false);
    window.addEventListener('resize', () => { globe.width(innerWidth).height(innerHeight); });
    setupPicking();
  }

  function onGlobeReady() {
    baseMat = globe.globeMaterial();
    const m = baseMat;
    if (m.map) { m.map.anisotropy = maxAniso; m.map.needsUpdate = true; }
    if (m.bumpMap) m.bumpScale = 5;
    hdReady = TierraHD.init(globe);
    enableDayNight();
    if (state.settings.clouds) setClouds(true);
    splash(70, 'Poniendo en órbita los satélites…');
    grabThree(() => { buildPoints(); startWorker(); drawOrbit(); });
    refreshHtml();
    local('lib/countries.geojson').then(geo => {
      state.geo = geo.features.filter(f => f.properties.ISO_A2 !== 'AQ').map(f => {
        let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const p of polys) for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        f.bbox = [x0, y0, x1, y1]; f.cc = f.properties.ISO_A2 === '-99' ? null : f.properties.ISO_A2; return f;
      });
      globe.polygonsData(state.geo);
    }).catch(() => {});
  }

  function enableDayNight() {
    if (!hdReady) return;
    // Tierra Ultra HD: relieve, reflejo del Sol en el mar, atardecer y atmósfera (js/tierra-hd.js)
    TierraHD.createEarth({ day: use8k() ? TEXTURES.day.k8 : TEXTURES.day.k4, night: TEXTURES.night, normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' })
      .then(mat => { dnMat = mat; globe.globeMaterial(dnMat); }).catch(() => {});
  }
  let cloudsLoading = false;
  function setClouds(on) {
    if (!on) { if (clouds) TierraHD.setCloudsVisible(false); return; }
    if (clouds) { TierraHD.setCloudsVisible(true); return; }
    if (!hdReady || cloudsLoading) return;
    cloudsLoading = true;
    TierraHD.createClouds('img/clouds-4k.jpg', { opacity: 0.8 }).then(m => { clouds = m; cloudsLoading = false; TierraHD.setCloudsVisible(state.settings.clouds); })
      .catch(() => { cloudsLoading = false; });
  }
  let sizeStep = -1;
  function onZoom(pov) {
    if (dnMat) dnMat.uniforms.globeRotation.value = [pov.lng, pov.lat];
    const step = pov.altitude > 3 ? 0 : pov.altitude > 1.6 ? 1 : pov.altitude > 0.7 ? 2 : 3;
    if (step !== sizeStep && ptsMat) { sizeStep = step; ptsMat.size = [2.4, 3, 3.8, 4.8][step]; }
  }

  // ---------- capa propia de satélites (miles de puntos que se mueven con suavidad) ----------
  let T = null, pts = null, ptsMat = null, ptsParent = null, posAttr = null, colAttr = null;
  function grabThree(done) {
    // globe.gl no expone three.js: se toman sus clases de una capa de partículas temporal
    globe.particlesData([[{ lat: 0, lng: 0 }]]);
    let tries = 0;
    (function look() {
      let p = null;
      globe.scene().traverse(o => { if (!p && o.isPoints) p = o; });
      if (!p) { if (tries++ < 80) return setTimeout(look, 50); return; }
      let root = p; while (root.parent && root.parent !== globe.scene()) root = root.parent;
      T = { Points: p.constructor, Geometry: p.geometry.constructor, Attr: p.geometry.getAttribute('position').constructor,
        Material: p.material.constructor, Texture: baseMat.map.constructor, Vector3: globe.camera().position.constructor };
      ptsParent = root;
      globe.particlesData([]);
      done();
    })();
  }
  function spriteTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.28, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new T.Texture(c); t.needsUpdate = true; return t;
  }
  function buildPoints() {
    const n = state.sats.length;
    if (pts) { ptsParent.remove(pts); pts.geometry.dispose(); }
    const geom = new T.Geometry();
    posAttr = new T.Attr(new Float32Array(n * 3), 3); colAttr = new T.Attr(new Float32Array(n * 3), 3);
    geom.setAttribute('position', posAttr); geom.setAttribute('color', colAttr);
    if (!ptsMat) {
      ptsMat = new T.Material({ size: 3, sizeAttenuation: false, vertexColors: true, map: spriteTexture(), transparent: true, depthWrite: false, alphaTest: 0.04 });
      onZoom(globe.pointOfView());
    }
    pts = new T.Points(geom, ptsMat);
    pts.frustumCulled = false; pts.renderOrder = 2;
    ptsParent.add(pts);
    baseColors = state.sats.map(s => hexLin(I.COLORS[s.cat] ? I.COLORS[s.cat][0] : '#8b96ad'));
  }
  let baseColors = [];

  // ---------- órbitas en segundo plano (Web Worker con SGP4) ----------
  let worker = null, gen = 0, snaps = [], inflight = false, firstPos = false;
  const STEP = 2000;
  function onWorkerMsg(e) {
    const m = e.data;
    if (m.type === 'ready') workerOk = true;
    if (m.type === 'pos') {
      workerOk = true; inflight = false;
      if (m.id !== gen) return;
      snaps.push({ t: m.t, pos: m.pos, lit: m.lit, colored: false });
      if (!firstPos) { firstPos = true; splash(100); }
    }
  }
  // Si el equipo no permite workers, el cálculo se hace en la página (un poco menos fluido)
  function localWorker() {
    const w = { onmessage: null, postMessage(m) { setTimeout(() => window.OrbitasLocal(m, d => w.onmessage && w.onmessage({ data: d })), 0); } };
    return w;
  }
  let workerOk = false;
  function startWorker() {
    gen++; snaps = []; inflight = false;
    if (!worker) {
      try { worker = new Worker('js/orbitas-worker.js'); worker.onerror = () => fallbackWorker(); }
      catch (e) { worker = localWorker(); }
      worker.onmessage = onWorkerMsg;
      setTimeout(() => { if (!workerOk) fallbackWorker(); }, 6000);
    }
    worker.postMessage({ type: 'init', rows: state.sats.map(toRow) });
    requestStep(Date.now());
  }
  function fallbackWorker() {
    if (workerOk || worker && worker.local) return;
    try { if (worker && worker.terminate) worker.terminate(); } catch (e) { /* nada */ }
    worker = localWorker(); worker.local = true; worker.onmessage = onWorkerMsg;
    worker.postMessage({ type: 'init', rows: state.sats.map(toRow) });
    inflight = false; requestStep(Date.now());
  }
  function requestStep(t) {
    if (!worker || inflight) return;
    inflight = true;
    const [sunLng, sunLat] = sunPosition(new Date(t));
    worker.postMessage({ type: 'step', t, id: gen, sunLat, sunLng });
  }
  function applyColors(snap) {
    const col = colAttr.array, lit = snap.lit, f = state.filter, sats = state.sats;
    for (let i = 0; i < sats.length; i++) {
      const b = baseColors[i], k = lit[i] === 0 ? 0.32 : 1;
      col[i * 3] = b[0] * k; col[i * 3 + 1] = b[1] * k; col[i * 3 + 2] = b[2] * k;
    }
    colAttr.needsUpdate = true; snap.colored = true; lastColored = snap;
  }
  let lastColored = null;
  const curPos = i => posAttr ? [posAttr.array[i * 3], posAttr.array[i * 3 + 1], posAttr.array[i * 3 + 2]] : null;

  function frame() {
    requestAnimationFrame(frame);
    if (!pts || !snaps.length) return;
    const now = Date.now();
    while (snaps.length > 2 && now >= snaps[1].t) snaps.shift();
    const A = snaps[0], B = snaps[1] || snaps[0];
    if (snaps.length < 3) requestStep(Math.max(now, snaps[snaps.length - 1].t + STEP));
    if (!A.colored && lastColored !== A) applyColors(A);
    const f = B === A ? 0 : Math.min(1.5, Math.max(0, (now - A.t) / (B.t - A.t)));
    const pa = A.pos, pb = B.pos, out = posAttr.array, lit = A.lit, flt = state.filter, sats = state.sats;
    const n = Math.min(sats.length, pa.length / 3);
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      if (lit[i] === 255 || (flt !== 'all' && sats[i].cat !== flt && i !== state.sel)) { out[j] = out[j + 1] = out[j + 2] = 0; continue; }
      out[j] = pa[j] + (pb[j] - pa[j]) * f; out[j + 1] = pa[j + 1] + (pb[j + 1] - pa[j + 1]) * f; out[j + 2] = pa[j + 2] + (pb[j + 2] - pa[j + 2]) * f;
    }
    posAttr.needsUpdate = true;
    updateOverlays();
  }

  // ---------- marcadores HTML que siguen a la EEI, Tiangong y al satélite elegido ----------
  const overlay = { iss: null, css: null, ring: null };
  let V3 = null;
  function makeMarkers() {
    const host = $('#overlay');
    overlay.iss = document.createElement('div'); overlay.iss.className = 'mk iss';
    overlay.iss.innerHTML = I.iss() + '<span class="mk-lbl">EEI</span>';
    overlay.css = document.createElement('div'); overlay.css.className = 'mk css';
    overlay.css.innerHTML = I.css() + '<span class="mk-lbl">TIANGONG</span>';
    overlay.ring = document.createElement('div'); overlay.ring.className = 'sel-ring hidden';
    host.append(overlay.iss, overlay.css, overlay.ring);
    overlay.iss.addEventListener('click', () => { const i = state.byId.get(ISS_ID); if (i != null) openSat(i, true); });
    overlay.css.addEventListener('click', () => { const i = state.byId.get(CSS_ID); if (i != null) openSat(i, true); });
  }
  function project(x, y, z) {
    const cam = globe.camera();
    // ¿La Tierra tapa el punto? (el segmento cámara→punto corta la esfera)
    const c = cam.position, dx = x - c.x, dy = y - c.y, dz = z - c.z;
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (c.x * dx + c.y * dy + c.z * dz), cc = c.x * c.x + c.y * c.y + c.z * c.z - 99.6 * 99.6;
    const disc = b * b - 4 * a * cc;
    if (disc > 0) { const t1 = (-b - Math.sqrt(disc)) / (2 * a); if (t1 > 0 && t1 < 1) return null; }
    if (!V3) V3 = new T.Vector3();
    V3.set(x, y, z).project(cam);
    if (V3.z > 1 || V3.z < -1) return null;
    return [(V3.x + 1) / 2 * innerWidth, (1 - V3.y) / 2 * innerHeight];
  }
  function place(el, idx, cls) {
    if (!el) return;
    const p = idx == null || idx < 0 ? null : curPos(idx);
    const s = p && (p[0] || p[1] || p[2]) ? project(p[0], p[1], p[2]) : null;
    if (!s || (cls && !state.settings.labels)) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.style.transform = cls ? `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)` : `translate(${s[0]}px, ${s[1]}px)`;
  }
  function updateOverlays() {
    if (!overlay.iss) makeMarkers();
    place(overlay.iss, state.byId.get(ISS_ID), true);
    place(overlay.css, state.byId.get(CSS_ID), true);
    const sel = state.sel;
    if (sel >= 0 && sel !== state.byId.get(ISS_ID) && sel !== state.byId.get(CSS_ID)) place(overlay.ring, sel, false);
    else overlay.ring.classList.add('hidden');
    if (state.follow && sel >= 0) {
      const p = curPos(sel);
      if (p && (p[0] || p[1])) {
        const r = Math.hypot(p[0], p[1], p[2]);
        const lat = 90 - Math.acos(p[1] / r) * R2D, lng = 90 - Math.atan2(p[2], p[0]) * R2D;
        const pov = globe.pointOfView();
        globe.pointOfView({ lat, lng: ((lng + 540) % 360) - 180, altitude: pov.altitude });
      }
    }
  }

  // Tocar el espacio: elige el satélite más cercano al dedo
  function setupPicking() {
    const el = $('#globe'); let down = null;
    el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    el.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = Date.now() - down.t; down = null;
      if (moved > 8 || dt > 600 || !posAttr) return;
      let best = -1, bd = 26 * 26;
      const arr = posAttr.array;
      for (let i = 0; i < state.sats.length; i++) {
        const x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
        if (!x && !y && !z) continue;
        const s = project(x, y, z); if (!s) continue;
        const d = (s[0] - e.clientX) ** 2 + (s[1] - e.clientY) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) openSat(best, false);
    });
  }

  // ---------- órbita del satélite elegido ----------
  function orbitPaths(i) {
    const s = state.sats[i]; if (!s) return [];
    const now = Date.now(), period = elements(s).period * 60000;
    const span = Math.min(period * 1.02, 26 * 3600e3), n = 180, out = [], back = [];
    let prevLng = null, off = 0;
    for (let k = 0; k <= n; k++) {
      const st = stateAt(s, now + span * k / n); if (!st) continue;
      if (prevLng != null) { const d = st.lng - prevLng; if (d > 180) off -= 360; else if (d < -180) off += 360; }
      prevLng = st.lng;
      out.push([st.lat, st.lng + off, st.alt / 6371]);
    }
    prevLng = null; off = 0;
    for (let k = 0; k <= 60; k++) {
      const st = stateAt(s, now - period * 0.35 * (60 - k) / 60); if (!st) continue;
      if (prevLng != null) { const d = st.lng - prevLng; if (d > 180) off -= 360; else if (d < -180) off += 360; }
      prevLng = st.lng;
      back.push([st.lat, st.lng + off, st.alt / 6371]);
    }
    const c = I.COLORS[s.cat] ? I.COLORS[s.cat][0] : '#5ce1ff';
    const paths = [
      { pts: out, color: [c, c + 'aa', 'rgba(255,255,255,0.08)'], stroke: 2.4 },
      { pts: back, color: 'rgba(255,255,255,0.28)', stroke: 1, dash: 0.02, gap: 0.015 }
    ];
    // Zona de la Tierra desde donde se ve ahora (horizonte del satélite)
    const st = stateAt(s, now);
    if (st && st.alt < 3000) {
      const lam = Math.acos(6371 / (6371 + st.alt)), ring = [];
      for (let k = 0; k <= 72; k++) {
        const b = k / 72 * 2 * Math.PI, la = st.lat * D2R, lo = st.lng * D2R;
        const lat2 = Math.asin(Math.sin(la) * Math.cos(lam) + Math.cos(la) * Math.sin(lam) * Math.cos(b));
        const lng2 = lo + Math.atan2(Math.sin(b) * Math.sin(lam) * Math.cos(la), Math.cos(lam) - Math.sin(la) * Math.sin(lat2));
        ring.push([lat2 * R2D, lng2 * R2D, 0.004]);
      }
      paths.push({ pts: ring, color: 'rgba(92,225,255,0.55)', stroke: 1, dash: 0.03, gap: 0.02, anim: 9000 });
    }
    return paths;
  }
  let orbitTimer = null;
  function drawOrbit() {
    clearInterval(orbitTimer);
    const i = state.sel >= 0 ? state.sel : (state.showOrbit ? state.byId.get(ISS_ID) : -1);
    if (i == null || i < 0) { globe.pathsData([]); return; }
    globe.pathsData(orbitPaths(i));
    orbitTimer = setInterval(() => globe.pathsData(orbitPaths(i)), 20000);
  }

  // ---------- catálogo ----------
  function setCatalog(rows, live) {
    const selId = state.sel >= 0 ? state.sats[state.sel].id : null;
    state.sats = rows.map(fromRow).filter(s => s.mm > 0.9 && s.mm < 17.5);
    state.byId = new Map(state.sats.map((s, i) => [s.id, i]));
    state.sel = selId != null && state.byId.has(selId) ? state.byId.get(selId) : -1;
    state.catalogLive = live;
    renderCats();
    if (T) { buildPoints(); startWorker(); drawOrbit(); }
    updateIssCard();
  }
  async function refreshCatalog(snapshotCats) {
    if (MIRROR) {
      try {
        const j = JSON.parse(await getText(MIRROR, 360));
        if (j.rows && j.rows.length > 1000) { setCatalog(j.rows, true); state.catalogDate = Date.parse(j.generated) || Date.now(); computeAllPasses(); return; }
      } catch (e) { /* si falla, se intenta con CelesTrak */ }
    }
    try {
      const [act, st] = await Promise.allSettled([getText(CELESTRAK('active'), 720), getText(CELESTRAK('stations'), 120)]);
      let list = act.status === 'fulfilled' && act.value.trim().startsWith('[') ? JSON.parse(act.value) : null;
      const stations = st.status === 'fulfilled' && st.value.trim().startsWith('[') ? JSON.parse(st.value) : [];
      if (!list && !stations.length) return;
      const rows = list ? list.map(o => [o.OBJECT_NAME, o.NORAD_CAT_ID, o.OBJECT_ID, o.EPOCH, o.MEAN_MOTION, o.ECCENTRICITY, o.INCLINATION,
        o.RA_OF_ASC_NODE, o.ARG_OF_PERICENTER, o.MEAN_ANOMALY, o.BSTAR, o.MEAN_MOTION_DOT, o.MEAN_MOTION_DDOT,
        snapshotCats.get(o.NORAD_CAT_ID) || classify(o.OBJECT_NAME)]) : state.sats.map(toRow);
      // Las estaciones con los datos más frescos
      const idx = new Map(rows.map((r, i) => [r[1], i]));
      for (const o of stations) {
        const r = [o.OBJECT_NAME, o.NORAD_CAT_ID, o.OBJECT_ID, o.EPOCH, o.MEAN_MOTION, o.ECCENTRICITY, o.INCLINATION, o.RA_OF_ASC_NODE,
          o.ARG_OF_PERICENTER, o.MEAN_ANOMALY, o.BSTAR, o.MEAN_MOTION_DOT, o.MEAN_MOTION_DDOT, snapshotCats.get(o.NORAD_CAT_ID) || 'est'];
        if (idx.has(o.NORAD_CAT_ID)) rows[idx.get(o.NORAD_CAT_ID)] = r; else rows.push(r);
      }
      setCatalog(rows, !!list);
      state.catalogDate = Date.now();
      computeAllPasses();
    } catch (e) { /* se queda con la copia incluida */ }
  }

  // ---------- cabecera ----------
  function tickClock() {
    const d = new Date();
    $('#utc').textContent = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
  }
  function updateIssCard() {
    const i = state.byId.get(ISS_ID); if (i == null) return;
    const st = stateAt(state.sats[i]); if (!st) return;
    $('#iss-over').textContent = overText(st.lat, st.lng).txt;
    $('#iss-alt').textContent = nf.format(Math.round(st.alt));
    $('#iss-vel').textContent = nf.format(Math.round(st.speed * 3600 / 10) * 10);
    if (state.astros) $('#iss-crew').textContent = state.astros.filter(a => a.station === 'EEI').length || '—';
  }
  function renderCats() {
    const counts = {}; for (const s of state.sats) counts[s.cat] = (counts[s.cat] || 0) + 1;
    const chip = (id, label, n) => `<button class="chip" data-cat="${id}" aria-selected="${state.filter === id}">${I.cat(id, 26)}${esc(label)}<span class="n">${nf.format(n)}</span></button>`;
    $('#cats').innerHTML = chip('all', 'Todos', state.sats.length) + CAT_ORDER.filter(c => counts[c]).map(c => chip(c, CATS[c].short, counts[c])).join('');
    state.counts = counts;
  }
  function setFilter(cat) {
    state.filter = cat;
    document.querySelectorAll('#cats .chip').forEach(b => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
    if (lastColored) applyColors(lastColored);
    if (cat !== 'all') toast(`${CATS[cat].name}: ${nf.format(state.counts[cat] || 0)} en órbita`);
  }

  // ---------- hoja (pestañas) ----------
  let liveTimer = null;
  function openSheet(cfg) {
    clearInterval(liveTimer); liveTimer = null;
    if (state.sheet && state.sheet.sat && !cfg.sat) { state.sel = -1; state.follow = false; drawOrbit(); }
    state.sheet = cfg;
    $('#sheet-title').textContent = cfg.title;
    $('#sheet-sub').textContent = cfg.sub || '';
    const tabs = cfg.tabs || [{ id: 'main', render: cfg.render }];
    cfg.tabs = tabs;
    $('#sheet-tabs').innerHTML = tabs.length > 1 ? tabs.map(t => `<button class="tab" data-tab="${t.id}">${esc(t.label)}</button>`).join('') : '';
    showTab(cfg.active || tabs[0].id);
    $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false');
  }
  function showTab(id) {
    const cfg = state.sheet; if (!cfg) return;
    const t = cfg.tabs.find(x => x.id === id) || cfg.tabs[0];
    cfg.active = t.id;
    document.querySelectorAll('#sheet-tabs .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t.id)));
    const body = $('#sheet-body'); body.scrollTop = 0;
    clearInterval(liveTimer); liveTimer = null;
    t.render(body);
  }
  function rerender() { if (state.sheet) showTab(state.sheet.active); }
  function closeSheet(silent) {
    clearInterval(liveTimer); liveTimer = null;
    $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true');
    const wasSat = state.sheet && state.sheet.sat;
    state.sheet = null;
    if (wasSat) { state.sel = -1; state.follow = false; drawOrbit(); }
    if (!silent) selectTab('mapa', true);
  }
  const isOpen = () => $('#sheet').classList.contains('open');
  function selectTab(tab, silent) {
    document.querySelectorAll('#tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (silent) return;
    if (tab === 'mapa') { if (isOpen()) closeSheet(true); return; }
    ({ sats: openSatsTab, pasos: openPasos, lanz: openLaunches, astro: openAstros })[tab]();
  }
  window.orbeOpen = tab => { if (['sats', 'pasos', 'lanz', 'astro'].includes(tab)) selectTab(tab); };
  window.orbeBack = () => { if (isOpen()) { closeSheet(); return true; } return false; };

  // ---------- pestaña Satélites ----------
  const FACTS = [
    ['27.600 km/h', 'Es la velocidad de la Estación Espacial: cruza Colombia de punta a punta en menos de 3 minutos.'],
    ['16 amaneceres', 'Los astronautas de la Estación ven salir el Sol 16 veces cada día, porque dan una vuelta a la Tierra cada 92 minutos.'],
    ['35.786 km', 'A esa altura, los satélites geoestacionarios giran igual que la Tierra y parecen quietos en el cielo: por eso las antenas de TV no se mueven.'],
    ['4 satélites', 'Tu teléfono necesita la señal de al menos 4 satélites de navegación para saber dónde estás.'],
    ['1957', 'El Sputnik 1 fue el primer satélite artificial. Hoy hay más de 14.000 activos.'],
    ['109 metros', 'Mide la Estación Espacial de punta a punta: casi como una cancha de fútbol.']
  ];
  const FEATURED = [ISS_ID, CSS_ID, HST_ID];
  function featured() {
    const out = FEATURED.map(id => state.byId.get(id)).filter(i => i != null);
    const want = [/^NOAA 21/, /^GOES 19/, /^LANDSAT 9/, /^SENTINEL-2C/, /^GPS BIII/, /^GALILEO/, /^TERRA$/, /^STARLINK/];
    for (const re of want) { const i = state.sats.findIndex(s => re.test(s.name)); if (i >= 0) out.push(i); }
    return out;
  }
  function satRow(i) {
    const s = state.sats[i], e = elements(s), y = launchYear(s);
    return `<button class="row-card" data-sat="${i}">${I.cat(s.cat, 44)}<div class="meta"><div class="name">${esc(displayName(s))}</div>
      <div class="sub"><span class="pill">${orbitType(s)[0]}</span><span>${nf.format(Math.round((e.apo + e.peri) / 2))} km</span><span>· ${nf1.format(s.inc)}°</span>${y ? `<span>· ${y}</span>` : ''}</div></div>
      <div class="end"><small>NORAD</small><b>${s.id}</b></div></button>`;
  }
  function openSatsTab() {
    openSheet({
      title: 'Satélites en órbita', sub: `${nf.format(state.sats.length)} satélites activos · datos de CelesTrak`,
      render: body => {
        const cnt = state.counts || {};
        body.innerHTML = `
          <label class="search">${I.ui('search')}<input id="q" type="search" placeholder="Busca por nombre o número NORAD…" autocomplete="off"></label>
          <div id="q-res"></div>
          <div id="q-hide">
            <div class="rail">${FACTS.map(f => `<div class="fact"><b>${f[0]}</b><p>${f[1]}</p></div>`).join('')}</div>
            <div class="section-h"><h3>Destacados</h3><small>Toca para verlo en vivo</small></div>
            <div class="rail">${featured().map(i => { const s = state.sats[i]; return `<button class="feat" data-sat="${i}">${I.cat(s.cat, 48)}<b>${esc(displayName(s))}</b><small>${esc(CATS[s.cat].short)} · ${orbitType(s)[0]}</small></button>`; }).join('')}</div>
            <div class="section-h"><h3>Por tipo</h3><small>Toca para verlos en el globo</small></div>
            <div class="cat-grid">${CAT_ORDER.filter(c => cnt[c]).map(c => `<button class="cat-card" data-catlist="${c}" style="--c:${I.COLORS[c][0]}">${I.cat(c, 42)}
              <span class="cnt" style="color:${I.COLORS[c][0]}">${nf.format(cnt[c])}</span><b>${esc(CATS[c].name)}</b><small>${esc(CATS[c].desc)}</small></button>`).join('')}</div>
            <p class="about">Las posiciones se calculan en tu teléfono con el modelo SGP4 a partir de los datos orbitales públicos de CelesTrak${state.catalogLive ? ', actualizados hoy' : ''}.</p>
          </div>`;
        const q = $('#q');
        q.addEventListener('input', () => searchInto(q.value, $('#q-res'), $('#q-hide')));
      }
    });
  }
  function searchInto(text, out, hide) {
    const v = text.trim().toUpperCase();
    if (!v) { out.innerHTML = ''; hide.hidden = false; return; }
    hide.hidden = true;
    const num = /^\d+$/.test(v) ? +v : null, res = [];
    const alias = { 'EEI': ISS_ID, 'ISS': ISS_ID, 'ESTACION': ISS_ID, 'ESTACIÓN': ISS_ID, 'TIANGONG': CSS_ID, 'HUBBLE': HST_ID };
    if (alias[v] && state.byId.has(alias[v])) res.push(state.byId.get(alias[v]));
    for (let i = 0; i < state.sats.length && res.length < 60; i++) {
      const s = state.sats[i];
      if ((num && s.id === num) || s.name.toUpperCase().includes(v)) { if (!res.includes(i)) res.push(i); }
    }
    out.innerHTML = res.length ? res.map(satRow).join('') : `<div class="empty">No hay satélites activos con "${esc(text)}".</div>`;
  }
  function openCatList(cat) {
    setFilter(cat);
    const list = []; state.sats.forEach((s, i) => { if (s.cat === cat) list.push(i); });
    list.sort((a, b) => state.sats[a].name.localeCompare(state.sats[b].name, 'es', { numeric: true }));
    let shown = 60;
    openSheet({
      title: CATS[cat].name, sub: `${nf.format(list.length)} en órbita · ${CATS[cat].desc}`,
      render: body => {
        const draw = () => {
          body.innerHTML = list.slice(0, shown).map(satRow).join('') +
            (list.length > shown ? `<button class="btn block" id="more">Ver más (${nf.format(list.length - shown)})</button>` : '') +
            `<button class="btn block" id="all" style="margin-top:8px">Ver todos los tipos en el globo</button>`;
          const m = $('#more'); if (m) m.onclick = () => { shown += 120; draw(); };
          $('#all').onclick = () => { setFilter('all'); closeSheet(); };
        };
        draw();
      }
    });
  }

  // ---------- detalle de un satélite (telemetría en vivo) ----------
  const ABOUT = {
    [ISS_ID]: 'La <b>Estación Espacial Internacional</b> es lo más grande que la humanidad ha construido en el espacio: mide 109 m y pesa unas 420 toneladas. La construyeron juntos EE. UU., Rusia, Europa, Japón y Canadá. Hay astronautas a bordo sin parar desde el año 2000.',
    [CSS_ID]: 'La estación espacial china <b>Tiangong</b> ("Palacio celestial") tiene tres módulos y suele tener tres tripulantes, llamados taikonautas. Se terminó de armar en 2022.',
    [HST_ID]: 'El <b>telescopio espacial Hubble</b> fue lanzado en 1990. Desde arriba de la atmósfera ha tomado algunas de las fotos más famosas del universo y ayudó a medir la edad del cosmos: unos 13.800 millones de años.'
  };
  function openSat(i, fly) {
    const s = state.sats[i]; if (!s) return;
    state.sel = i; state.follow = false;
    drawOrbit();
    const st0 = stateAt(s);
    if (fly && st0) { globe.controls().autoRotate = false; globe.pointOfView({ lat: st0.lat, lng: st0.lng, altitude: Math.max(1.2, st0.alt / 6371 + 1.1) }, 1400); }
    if (overlay.ring) { overlay.ring.dataset.name = displayName(s); overlay.ring.style.setProperty('--c', I.COLORS[s.cat][0]); }
    const e = elements(s), [ot, otName] = orbitType(s), y = launchYear(s);
    const art = s.id === ISS_ID ? `<span class="art">${I.iss()}</span>` : s.id === CSS_ID ? `<span class="art">${I.css()}</span>` : I.cat(s.cat, 64);
    const epoch = Date.parse(s.epoch.endsWith('Z') ? s.epoch : s.epoch + 'Z');
    const canPass = s.cat === 'est' || s.id === HST_ID || e.apo < 1500;
    openSheet({
      title: displayName(s), sub: `${CATS[s.cat].name} · NORAD ${s.id}`, sat: true,
      render: body => {
        body.innerHTML = `
          <div class="hero">${art}<div><b>${esc(s.name)}</b><div class="pills"><span class="pill" style="background:${I.COLORS[s.cat][0]}26;color:${I.COLORS[s.cat][1]}">${esc(CATS[s.cat].short)}</span>
            <span class="pill cyan">${ot} · ${otName}</span>${y ? `<span class="pill">Lanzado en ${y}</span>` : ''}</div></div></div>
          <div class="tele">
            <div><small>Altitud</small><b id="t-alt">—</b></div><div><small>Velocidad</small><b id="t-vel">—</b></div>
            <div><small>Latitud</small><b id="t-lat">—</b></div><div><small>Longitud</small><b id="t-lng">—</b></div>
            <div class="wide"><small>Ahora pasa</small><b id="t-over" style="font-family:var(--display);font-size:16px">—</b></div>
          </div>
          ${s.id === ISS_ID ? liveCard() : ''}
          <div class="actions">
            <button class="action" id="a-follow">${I.ui('follow')}<span>Seguir</span></button>
            ${canPass ? `<button class="action" id="a-pass">${I.ui('pasos')}<span>Verla pasar</span></button>` : `<button class="action" id="a-orbit">${I.ui('orbit')}<span>Ver órbita</span></button>`}
            <button class="action" id="a-share">${I.ui('share')}<span>Compartir</span></button>
          </div>
          ${ABOUT[s.id] ? `<div class="explain">${ABOUT[s.id]}</div>` : `<div class="explain"><b>${esc(CATS[s.cat].name)}.</b> ${esc(CATS[s.cat].desc)}</div>`}
          <div class="section-h"><h3>Datos técnicos</h3><small>Elementos orbitales</small></div>
          <div class="kv">
            <span>Número NORAD</span><b>${s.id}</b>
            <span>Designación internacional</span><b>${esc(s.cospar || '—')}</b>
            <span>Tipo de órbita</span><b>${ot} (${otName})</b>
            <span>Periodo orbital</span><b>${nf1.format(e.period)} min</b>
            <span>Vueltas a la Tierra por día</span><b>${nf1.format(s.mm)}</b>
            <span>Inclinación</span><b>${nf1.format(s.inc)}°</b>
            <span>Excentricidad</span><b>${s.ecc.toFixed(5)}</b>
            <span>Apogeo (punto más alto)</span><b>${nf.format(Math.round(e.apo))} km</b>
            <span>Perigeo (punto más bajo)</span><b>${nf.format(Math.round(e.peri))} km</b>
            <span>Semieje mayor</span><b>${nf.format(Math.round(e.a))} km</b>
            <span>Datos orbitales</span><b>${ago(epoch)}</b>
          </div>
          <p class="about">Toca "Seguir" para que la cámara acompañe al satélite. La línea de color es su recorrido durante la próxima vuelta; el círculo punteado es la zona de la Tierra desde donde se ve ahora.</p>`;
        const tick = () => {
          const st = stateAt(s); if (!st) return;
          const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
          set('t-alt', `${nf.format(Math.round(st.alt))}<i>km</i>`);
          set('t-vel', `${nf.format(Math.round(st.speed * 3600))}<i>km/h</i>`);
          set('t-lat', `${nf.format(Math.abs(st.lat).toFixed(2))}°<i>${st.lat >= 0 ? 'N' : 'S'}</i>`);
          set('t-lng', `${nf.format(Math.abs(st.lng).toFixed(2))}°<i>${st.lng >= 0 ? 'E' : 'O'}</i>`);
          set('t-over', esc(overText(st.lat, st.lng).txt));
        };
        tick(); liveTimer = setInterval(tick, 1000);
        $('#a-follow').onclick = () => { state.follow = !state.follow; refreshFollowBtn(); if (state.follow) toast('La cámara sigue al satélite'); };
        const ap = $('#a-pass'); if (ap) ap.onclick = () => { state.passTarget = s.id; selectTab('pasos'); };
        const ao = $('#a-orbit'); if (ao) ao.onclick = () => { const st = stateAt(s); if (st) globe.pointOfView({ lat: st.lat, lng: st.lng, altitude: Math.max(2.2, st.alt / 6371 * 1.6 + 1) }, 1200); };
        $('#a-share').onclick = () => shareSat(s);
        refreshFollowBtn();
      }
    });
  }
  // ---------- En vivo desde la Estación (cámaras exteriores de la NASA) ----------
  const ISS_LIVE = 'https://www.youtube.com/@NASA/live';
  const ISS_LIVE_MORE = 'https://www.youtube.com/results?search_query=ISS+live+NASA&sp=EgJAAQ%253D%253D';
  const liveCard = () => `<button class="live-card" data-live="main"><span class="live-ico">${I.ui('play')}</span>
      <span class="live-txt"><span class="live">EN VIVO</span><b>Cámaras de la Estación Espacial</b><small>La Tierra vista desde 400 km de altura · NASA</small></span></button>
    <p class="about" style="margin-top:-2px">Si se ve negro o azul, la Estación va por la noche del planeta o está cambiando de satélite de comunicación: vuelve en unos minutos. <a href="#" data-live="more">Más transmisiones</a></p>`;
  function openIssLive(which) {
    const url = which === 'more' ? ISS_LIVE_MORE : ISS_LIVE;
    if (NATIVE) N.openLink(url); else window.open(url, '_blank', 'noopener');
  }
  function refreshFollowBtn() { const b = $('#a-follow'); if (b) b.classList.toggle('on', state.follow); }
  function shareSat(s) {
    const st = stateAt(s);
    const txt = `🛰️ ${displayName(s)} ahora mismo: ${st ? `${overText(st.lat, st.lng).txt.replace(/^Sobre/, 'sobre')}, a ${nf.format(Math.round(st.alt))} km de altura y ${nf.format(Math.round(st.speed * 3600))} km/h.` : ''} Míralo en vivo con Orbe Espacio.`;
    if (NATIVE) N.share(txt); else if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast('Copiado: ' + txt);
  }

  // ---------- pasos visibles ----------
  const PASS_SATS = { [ISS_ID]: { short: 'EEI', name: 'la Estación Espacial', mag: -1.8 }, [CSS_ID]: { short: 'Tiangong', name: 'la estación Tiangong', mag: -1.1 }, [HST_ID]: { short: 'Hubble', name: 'el telescopio Hubble', mag: 2.2 } };
  function lookAt(rec, obs, obsGd, t) {
    const d = new Date(t);
    let pv; try { pv = SAT.propagate(rec, d); } catch (e) { return null; }
    if (!pv || !pv.position) return null;
    const gmst = SAT.gstime(d);
    const la = SAT.ecfToLookAngles(obsGd, SAT.eciToEcf(pv.position, gmst));
    return { az: la.azimuth * R2D, el: la.elevation * R2D, range: la.rangeSat, p: pv.position, gmst };
  }
  function lightAt(sample, obsEcf, t, std) {
    const s = sunEci(t), g = sample.gmst, cg = Math.cos(g), sg = Math.sin(g);
    const o = { x: obsEcf.x * cg - obsEcf.y * sg, y: obsEcf.x * sg + obsEcf.y * cg, z: obsEcf.z };
    const on = Math.hypot(o.x, o.y, o.z);
    const so = { x: s.x - o.x, y: s.y - o.y, z: s.z - o.z }, son = Math.hypot(so.x, so.y, so.z);
    const sunEl = Math.asin((so.x * o.x + so.y * o.y + so.z * o.z) / (son * on)) * R2D;
    const p = sample.p, su = { x: s.x / s.r, y: s.y / s.r, z: s.z / s.r };
    const d = p.x * su.x + p.y * su.y + p.z * su.z;
    const perp = Math.sqrt(Math.max(0, p.x * p.x + p.y * p.y + p.z * p.z - d * d));
    const sunlit = d > 0 || perp > 6371;
    // Brillo aproximado (magnitud: más negativa = más brillante)
    const vs = { x: s.x - p.x, y: s.y - p.y, z: s.z - p.z }, vo = { x: o.x - p.x, y: o.y - p.y, z: o.z - p.z };
    const beta = Math.acos(Math.max(-1, Math.min(1, (vs.x * vo.x + vs.y * vo.y + vs.z * vo.z) / (Math.hypot(vs.x, vs.y, vs.z) * Math.hypot(vo.x, vo.y, vo.z)))));
    const F = Math.max(0.02, (Math.sin(beta) + (Math.PI - beta) * Math.cos(beta)) / Math.PI);
    const mag = std + 5 * Math.log10(sample.range / 1000) - 2.5 * Math.log10(F);
    return { sunEl, sunlit, mag };
  }
  function computePasses(id, days = 10) {
    const i = state.byId.get(id); if (i == null || !state.me) return [];
    const rec = satrecOf(state.sats[i]); if (!rec) return [];
    const obsGd = { latitude: state.me.lat * D2R, longitude: state.me.lng * D2R, height: 0.15 };
    const obsEcf = SAT.geodeticToEcf(obsGd);
    const std = (PASS_SATS[id] || { mag: 1 }).mag;
    const t0 = Date.now() - 10 * 60000, t1 = t0 + days * 864e5, step = 30000, out = [];
    const elAt = t => { const l = lookAt(rec, null, obsGd, t); return l ? l.el : -90; };
    const edge = (a, b, rising) => { for (let k = 0; k < 14; k++) { const m = (a + b) / 2; if ((elAt(m) > 0) === rising) b = m; else a = m; } return (a + b) / 2; };
    let prev = elAt(t0), inPass = prev > 0, start = inPass ? t0 : null;
    for (let t = t0 + step; t <= t1; t += step) {
      const el = elAt(t);
      if (!inPass && el > 0) { inPass = true; start = edge(t - step, t, true); }
      else if (inPass && el <= 0) {
        inPass = false;
        const end = edge(t - step, t, false);
        if (start) {
          const samples = [];
          for (let u = start; u <= end; u += 5000) {
            const l = lookAt(rec, null, obsGd, u); if (!l) continue;
            const li = lightAt(l, obsEcf, u, std);
            samples.push({ t: u, az: l.az, el: l.el, range: l.range, vis: l.el >= 10 && li.sunlit && li.sunEl < -6, sunlit: li.sunlit, sunEl: li.sunEl, mag: li.mag });
          }
          if (samples.length) {
            const max = samples.reduce((a, b) => b.el > a.el ? b : a);
            const vis = samples.filter(x => x.vis);
            if (max.el >= 10) out.push({ id, start, end, samples, max, rise: samples[0], set: samples[samples.length - 1],
              vis: vis.length ? { start: vis[0], end: vis[vis.length - 1], max: vis.reduce((a, b) => b.el > a.el ? b : a), mag: Math.min(...vis.map(x => x.mag)) } : null,
              dark: max.sunEl < -6 });
          }
        }
        start = null;
      }
      prev = el;
    }
    return out.filter(p => p.end > Date.now());
  }
  function computeAllPasses() {
    if (!state.me) { updateNextPass(); return; }
    state.nextVis = {};
    for (const id of Object.keys(PASS_SATS).map(Number)) state.passes[id] = computePasses(id);
    // Si no hay pasos visibles pronto, busca el próximo en las siguientes semanas (sin bloquear la app)
    setTimeout(() => {
      for (const id of Object.keys(PASS_SATS).map(Number)) {
        if ((state.passes[id] || []).some(p => p.vis)) continue;
        const far = computePasses(id, 30).find(p => p.vis);
        state.nextVis[id] = far || null;
      }
      updateNextPass();
      if (state.sheet && state.sheet.passes) rerender();
    }, 1500);
    updateNextPass(); scheduleReminders();
    if (state.sheet && state.sheet.passes) rerender();
  }
  function brightTxt(mag) {
    if (mag <= -2.5) return ['Muy brillante', 'ok'];
    if (mag <= -1) return ['Brillante', 'ok'];
    if (mag <= 1) return ['Se ve bien', 'warn'];
    return ['Débil', 'warn'];
  }
  function scheduleReminders() {
    if (!NATIVE || typeof N.setReminders !== 'function') return;
    const items = [];
    if (state.rem.on && state.me) {
      for (const id of state.rem.sats) {
        const info = PASS_SATS[id]; if (!info) continue;
        for (const p of (state.passes[id] || [])) {
          if (!p.vis || p.vis.max.el < 15) continue;
          const at = p.vis.start.t - state.rem.lead * 60000; if (at < Date.now()) continue;
          const b = brightTxt(p.vis.mag)[0].toLowerCase();
          items.push({ at, title: `🛰️ ${info.name[0].toUpperCase() + info.name.slice(1)} pasa sobre ti en ${state.rem.lead} minutos`,
            text: `Mira hacia ${COMPASS_LONG[compass(p.vis.start.az)]} a las ${fmtTime(p.vis.start.t)}. Sube hasta ${Math.round(p.vis.max.el)}° y se verá ${b} (${nf1.format(p.vis.mag)}). Visible ${Math.max(1, Math.round((p.vis.end.t - p.vis.start.t) / 60000))} min.`,
            open: 'pasos' });
        }
      }
    }
    items.sort((a, b) => a.at - b.at);
    try { N.setReminders('pass', JSON.stringify(items.slice(0, 30))); } catch (e) { /* sin avisos */ }
  }
  function nextVisible() {
    const all = (state.passes[ISS_ID] || []).filter(p => p.vis && p.vis.end.t > Date.now());
    return all[0] || null;
  }
  function updateNextPass() {
    const b = $('#next-pass');
    if (isOpen()) { b.hidden = true; return; }
    if (!state.me) {
      b.hidden = false;
      b.innerHTML = `<span class="np-ico">${I.ui('pasos')}</span><span class="np-txt"><small>La Estación Espacial</small><b>¿Cuándo pasa sobre tu ciudad?</b><span class="sub">Toca para saberlo y recibir un aviso</span></span>`;
      return;
    }
    const p = nextVisible() || (state.nextVis && state.nextVis[ISS_ID]);
    if (!p) { b.hidden = true; return; }
    const v = p.vis, ms = v.start.t - Date.now();
    b.hidden = false;
    b.innerHTML = `<span class="np-ico">${I.ui('pasos')}</span><span class="np-txt"><small>Próximo paso visible · EEI</small>
      <b>${fmtDay(v.start.t)} ${fmtTime(v.start.t)} · mira al ${compass(v.start.az)}</b><span class="sub">${brightTxt(v.mag)[0]} · sube ${Math.round(v.max.el)}° · ${Math.max(1, Math.round((v.end.t - v.start.t) / 60000))} min</span></span>
      <span class="cd">${ms > 0 ? (ms < 3600e3 ? Math.ceil(ms / 60000) + ' min' : ms < 864e5 ? Math.floor(ms / 3600e3) + ' h' : Math.floor(ms / 864e5) + ' d') : '¡YA!'}<small>${ms > 0 ? 'FALTAN' : 'MIRA ARRIBA'}</small></span>`;
  }

  function skyChart(p) {
    const R = 120, cx = 140, cy = 140, pt = (az, el) => { const r = (90 - Math.max(0, el)) / 90 * R; return [cx + r * Math.sin(az * D2R), cy - r * Math.cos(az * D2R)]; };
    const line = arr => arr.map((s, k) => (k ? 'L' : 'M') + pt(s.az, s.el).map(v => v.toFixed(1)).join(' ')).join('');
    const vis = p.samples.filter(s => s.vis), r0 = pt(p.rise.az, p.rise.el), m = pt(p.max.az, p.max.el);
    return `<svg class="sky" viewBox="0 0 280 290" aria-label="Recorrido en el cielo">
      <defs><radialGradient id="skyg"><stop offset="0" stop-color="#16244a"/><stop offset="1" stop-color="#070c1c"/></radialGradient></defs>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#skyg)" stroke="rgba(160,200,255,.35)"/>
      <circle cx="${cx}" cy="${cy}" r="${R * 2 / 3}" fill="none" stroke="rgba(160,200,255,.14)" stroke-dasharray="3 4"/>
      <circle cx="${cx}" cy="${cy}" r="${R / 3}" fill="none" stroke="rgba(160,200,255,.14)" stroke-dasharray="3 4"/>
      <path d="M${cx} ${cy - R}V${cy + R}M${cx - R} ${cy}H${cx + R}" stroke="rgba(160,200,255,.12)"/>
      ${[['N', 0], ['E', 90], ['S', 180], ['O', 270]].map(([l, a]) => { const q = pt(a, -9); return `<text x="${q[0]}" y="${q[1] + 5}" text-anchor="middle" fill="#8d9bb8" font-family="Space Grotesk" font-weight="700" font-size="14">${l}</text>`; }).join('')}
      <text x="${cx + 4}" y="${cy - R / 3 + 12}" fill="#5f6d8a" font-size="9" font-family="JetBrains Mono">60°</text>
      <text x="${cx + 4}" y="${cy - R * 2 / 3 + 12}" fill="#5f6d8a" font-size="9" font-family="JetBrains Mono">30°</text>
      <path d="${line(p.samples)}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-dasharray="4 4"/>
      ${vis.length ? `<path d="${line(vis)}" fill="none" stroke="#ffd166" stroke-width="4" stroke-linecap="round" style="filter:drop-shadow(0 0 6px #ffb547)"/>` : ''}
      <circle cx="${r0[0]}" cy="${r0[1]}" r="5" fill="#5ce1ff"/><circle cx="${m[0]}" cy="${m[1]}" r="6" fill="#ffd166" stroke="#fff" stroke-width="2"/>
      <text x="${cx}" y="284" text-anchor="middle" fill="#8d9bb8" font-size="11" font-family="Inter">Centro = justo encima de ti · borde = horizonte</text>
    </svg>`;
  }
  function passCard(p, k) {
    const v = p.vis, main = v ? v.start : p.rise, mx = v ? v.max : p.max;
    const dur = Math.max(1, Math.round(((v ? v.end.t : p.end) - main.t) / 60000));
    const b = v ? brightTxt(v.mag) : null;
    return `<button class="pass ${v ? 'vis' : ''}" data-pass="${k}">
      <div class="day"><small>${esc(fmtDay(main.t))}</small><b>${fmtTime(main.t)}</b></div>
      <div class="meta"><b>${v ? `Visible · aparece al ${compass(main.az)}` : p.dark ? 'En la sombra de la Tierra' : 'De día · no se ve'}</b>
        <div class="sub">${v ? `<span class="pill ${b[1]}">${b[0]} ${nf1.format(v.mag)}</span>` : '<span class="pill">Solo con apps</span>'}<span>${dur} min</span><span>· ${compass(p.rise.az)} → ${compass(p.set.az)}</span></div></div>
      <div class="el"><b>${Math.round(mx.el)}°</b><small>altura máx.</small></div></button>`;
  }
  function openPasos() {
    const ids = [ISS_ID, CSS_ID, HST_ID].filter(id => state.byId.has(id));
    const render = body => {
      const id = state.passTarget, info = PASS_SATS[id] || PASS_SATS[ISS_ID];
      const list = (state.passes[id] || []).filter(p => state.passTab === 'all' || p.vis);
      const exactWarn = NATIVE && typeof N.canExact === 'function' && state.rem.on && !N.canExact();
      body.innerHTML = `
        <div class="chips" style="padding-top:0">${ids.map(x => `<button class="chip" data-target="${x}" aria-selected="${x === id}">${I.cat(x === HST_ID ? 'ciencia' : 'est', 26)}${PASS_SATS[x].short}</button>`).join('')}</div>
        <div class="loc">${I.ui('pin')}<div class="meta"><b>${state.me ? esc(state.me.name) : 'Elige dónde estás'}</b><small>${state.me ? 'Los pasos se calculan para este lugar' : 'Para calcular cuándo pasa sobre ti'}</small></div>
          <button class="btn" id="p-gps">${I.ui('gps')}GPS</button><button class="btn" id="p-city">Ciudad</button></div>
        ${state.me ? `
        <button class="toggle" id="p-rem" role="switch" aria-checked="${state.rem.on && state.rem.sats.includes(id)}"><span><b>Avisarme antes de que pase</b><span class="t-sub">Notificación aunque la app esté cerrada (solo pasos visibles)</span></span><span class="switch"></span></button>
        <div class="seg" id="p-lead">${[5, 10, 15, 30].map(m => `<button data-lead="${m}" aria-pressed="${state.rem.lead === m}">${m} min</button>`).join('')}</div>
        ${exactWarn ? `<button class="explain" id="p-exact" style="width:100%;text-align:left">⏰ Para que el aviso llegue a la hora exacta, permite <b>Alarmas y recordatorios</b> para Orbe Espacio. Toca aquí.</button>` : ''}
        <div class="sheet-tabs" style="padding:12px 0 8px">${[['vis', 'Visibles a simple vista'], ['all', 'Todos los pasos']].map(([k, l]) => `<button class="tab" data-ptab="${k}" aria-selected="${state.passTab === k}">${l}</button>`).join('')}</div>
        ${list.length ? list.slice(0, 30).map(p => passCard(p, (state.passes[id] || []).indexOf(p))).join('') :
          (state.passTab === 'vis' && state.nextVis && state.nextVis[id] ? `<div class="explain">🗓️ En los próximos 10 días ${info.name} pasa sobre ${esc(state.me.name)} solo de día o de madrugada, cuando no se ve. <b>El próximo paso visible será ${esc(fmtDay(state.nextVis[id].vis.start.t).toLowerCase())} a las ${fmtTime(state.nextVis[id].vis.start.t)}</b>, mirando hacia ${COMPASS_LONG[compass(state.nextVis[id].vis.start.az)]}. Te avisaremos si tienes los avisos activados.</div>` :
          `<div class="empty">${state.passTab === 'vis' ? `No hay pasos visibles de ${info.name} desde ${esc(state.me.name)} en los próximos 10 días. Pasa a menudo, pero solo se ve al amanecer o al anochecer, cuando el cielo está oscuro y ella todavía tiene sol.` : 'Sin pasos en los próximos 10 días.'}</div>`)}
        <p class="about">Visible = el cielo está oscuro donde estás y ${info.name} está iluminada por el Sol. Se ve como una estrella brillante que cruza el cielo sin parpadear. Cálculo SGP4 con los datos orbitales de hoy; la hora puede variar 1 o 2 minutos.</p>` : ''}`;
      body.querySelectorAll('[data-target]').forEach(b => b.onclick = () => { state.passTarget = +b.dataset.target; rerender(); });
      body.querySelectorAll('[data-ptab]').forEach(b => b.onclick = () => { state.passTab = b.dataset.ptab; rerender(); });
      $('#p-gps').onclick = askLocation;
      $('#p-city').onclick = openCityPicker;
      const rem = $('#p-rem');
      if (rem) rem.onclick = () => {
        const on = !(state.rem.on && state.rem.sats.includes(id));
        state.rem.sats = state.rem.sats.filter(x => x !== id); if (on) { state.rem.sats.push(id); state.rem.on = true; }
        store.set('rem', state.rem); scheduleReminders(); rerender();
        toast(on ? `Te avisaremos ${state.rem.lead} min antes de cada paso visible` : 'Avisos desactivados');
      };
      body.querySelectorAll('[data-lead]').forEach(b => b.onclick = () => { state.rem.lead = +b.dataset.lead; store.set('rem', state.rem); scheduleReminders(); rerender(); });
      const ex = $('#p-exact'); if (ex) ex.onclick = () => N.openExactSettings();
      body.querySelectorAll('[data-pass]').forEach(b => b.onclick = () => openPass(id, +b.dataset.pass));
    };
    openSheet({ title: 'Verla pasar', sub: 'Cuándo puedes ver la Estación Espacial desde tu ciudad', passes: true, render });
  }
  function openPass(id, k) {
    const p = (state.passes[id] || [])[k]; if (!p) return;
    const info = PASS_SATS[id], v = p.vis;
    openSheet({
      title: `${fmtDay((v || p).start.t || p.start)} a las ${fmtTime(v ? v.start.t : p.start)}`, sub: `Paso de ${info.name} sobre ${state.me.name}`, passes: true,
      render: body => {
        const b = v ? brightTxt(v.mag) : null;
        body.innerHTML = `${skyChart(p)}
          ${v ? `<div class="explain">👀 <b>Cómo verla:</b> a las <b>${fmtTime(v.start.t)}</b> mira hacia <b>${COMPASS_LONG[compass(v.start.az)]}</b>, un poco sobre el horizonte. Verás un punto ${b[0].toLowerCase()} que se mueve rápido y sin parpadear. Sube hasta <b>${Math.round(v.max.el)}°</b> y ${v.end.el > 12 ? 'se apaga de golpe al entrar en la sombra de la Tierra' : `se pierde hacia ${COMPASS_LONG[compass(v.end.az)]}`}.</div>`
            : `<div class="explain">Este paso no se verá a simple vista: ${p.dark ? `${info.name} va por la sombra de la Tierra.` : 'es de día en tu ciudad.'} Igual puedes seguirlo en vivo en el mapa.</div>`}
          <div class="tele">
            <div><small>Aparece</small><b>${fmtTime((v || p).start.t || p.start)}<i>${compass((v ? v.start : p.rise).az)}</i></b></div>
            <div><small>Altura máxima</small><b>${Math.round((v ? v.max : p.max).el)}°<i>${compass((v ? v.max : p.max).az)}</i></b></div>
            <div><small>Desaparece</small><b>${fmtTime(v ? v.end.t : p.end)}<i>${compass((v ? v.end : p.set).az)}</i></b></div>
            <div><small>Duración</small><b>${Math.max(1, Math.round(((v ? v.end.t : p.end) - (v ? v.start.t : p.start)) / 60000))}<i>min</i></b></div>
            ${v ? `<div><small>Brillo</small><b>${nf1.format(v.mag)}<i>${b[0]}</i></b></div>` : ''}
            <div><small>Distancia mínima</small><b>${nf.format(Math.round(Math.min(...p.samples.map(x => x.range))))}<i>km</i></b></div>
          </div>
          <div class="btn-row"><button class="btn primary" id="pp-share">${I.ui('share')}Compartir</button><button class="btn" id="pp-back">Ver todos</button></div>
          <p class="about">El brillo se mide en magnitudes: cuanto más negativo, más brillante (Venus llega a −4,5; las estrellas más brillantes, 0).</p>`;
        $('#pp-back').onclick = () => openPasos();
        $('#pp-share').onclick = () => {
          const t = v ? v.start.t : p.start;
          const txt = `🛰️ ${info.name[0].toUpperCase() + info.name.slice(1)} pasará sobre ${state.me.name} ${fmtDay(t).toLowerCase()} a las ${fmtTime(t)}. Mira hacia ${COMPASS_LONG[compass((v ? v.start : p.rise).az)]}${v ? `: se verá ${brightTxt(v.mag)[0].toLowerCase()} durante ${Math.max(1, Math.round((v.end.t - v.start.t) / 60000))} min` : ''}. Calculado con Orbe Espacio.`;
          if (NATIVE) N.share(txt); else if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast(txt, 5000);
        };
      }
    });
  }

  // ---------- ubicación ----------
  function setMe(lat, lng, name) {
    state.me = { lat: +lat.toFixed(3), lng: +lng.toFixed(3), name };
    store.set('me', state.me);
    drawMe();
    toast(`Ubicación: ${name}`);
    computeAllPasses();
  }
  function askLocation() {
    if (NATIVE) { toast('Buscando tu ubicación…'); N.requestLocation(); return; }
    if (!navigator.geolocation) { openCityPicker(); return; }
    toast('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(p => window.__orbeLocation(p.coords.latitude, p.coords.longitude), () => { toast('No se pudo obtener la ubicación: elige tu ciudad'); openCityPicker(); }, { timeout: 15000 });
  }
  window.__orbeLocation = (lat, lng) => {
    if (lat == null) { toast('Sin permiso de ubicación: elige tu ciudad'); openCityPicker(); return; }
    let best = null, bd = 60;
    for (const c of state.ciudades) { const d = distKm(lat, lng, c[2], c[3]); if (d < bd) { bd = d; best = c; } }
    const cc = countryAt(lat, lng);
    setMe(lat, lng, best ? best[0] : cc ? `Tu ubicación (${regionName(cc)})` : 'Tu ubicación');
  };
  function openCityPicker() {
    openSheet({
      title: 'Elige tu ciudad', sub: 'Para calcular cuándo pasa la Estación sobre ti',
      render: body => {
        body.innerHTML = `<form class="search" id="cf">${I.ui('search')}<input id="cq" type="search" enterkeyhint="search" placeholder="Escribe una ciudad de cualquier país…" autocomplete="off"><button class="btn" style="height:36px;padding:0 12px">Buscar</button></form><div id="c-res" class="city-list"></div>`;
        const res = $('#c-res'), input = $('#cq');
        const draw = list => {
          res.innerHTML = list.map((c, k) => `<button class="row-card" data-c="${k}"><span style="font-size:24px">${flag(c[1])}</span><div class="meta"><div class="name">${esc(c[0])}</div><div class="sub">${esc(typeof c[4] === 'string' ? c[4] : regionName(c[1]))}</div></div></button>`).join('') || '<div class="empty">Sin resultados</div>';
          res.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = list[+b.dataset.c]; setMe(c[2], c[3], c[0]); openPasos(); });
        };
        draw(state.ciudades.slice(0, 60));
        const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        input.addEventListener('input', () => {
          const fv = fold(input.value.trim());
          const hits = fv ? state.ciudades.filter(c => fold(c[0]).includes(fv)) : state.ciudades;
          hits.sort((a, b) => (fold(b[0]).startsWith(fv) - fold(a[0]).startsWith(fv)) || ((b[4] || 0) - (a[4] || 0)));
          draw(hits.slice(0, 80));
        });
        // Cualquier ciudad del mundo: OpenStreetMap (una búsqueda por toque, como pide su política de uso)
        $('#cf').addEventListener('submit', e => {
          e.preventDefault();
          const v = input.value.trim(); if (v.length < 2) return;
          res.innerHTML = '<div class="spinner"></div>';
          getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=jsonv2&limit=10&accept-language=es&addressdetails=1`, 1440)
            .then(j => draw(j.filter(r => r.lat && r.lon).map(r => [r.name || r.display_name.split(',')[0], ((r.address || {}).country_code || '').toUpperCase(), +(+r.lat).toFixed(3), +(+r.lon).toFixed(3),
              r.display_name.split(',').slice(1).map(x => x.trim()).filter(Boolean).slice(-3).join(', ')])))
            .catch(() => { res.innerHTML = '<div class="empty">No se pudo buscar. Revisa tu conexión.</div>'; });
          input.blur();
        });
      }
    });
  }
  function drawMe() { refreshHtml(); }

  // ---------- lanzamientos ----------
  const STATUS = { Go: ['Confirmado', 'ok'], TBD: ['Fecha por definir', 'warn'], TBC: ['Por confirmar', 'warn'], Hold: ['En pausa', 'bad'],
    'In Flight': ['En vuelo', 'live'], Success: ['Éxito', 'ok'], Failure: ['Falló', 'bad'], 'Partial Failure': ['Falla parcial', 'bad'] };
  const MTYPE = { Communications: 'Comunicaciones', 'Earth Science': 'Ciencias de la Tierra', 'Government/Top Secret': 'Gobierno (reservado)', Resupply: 'Reabastecimiento',
    'Human Exploration': 'Vuelo tripulado', Navigation: 'Navegación', 'Planetary Science': 'Ciencia planetaria', Astrophysics: 'Astrofísica', 'Test Flight': 'Vuelo de prueba',
    Technology: 'Tecnología', 'Dedicated Rideshare': 'Viaje compartido', Tourism: 'Turismo espacial', 'Robotic Exploration': 'Exploración robótica', Heliophysics: 'Física solar' };
  const ORBIT = { LEO: 'Órbita baja', SSO: 'Heliosíncrona', GTO: 'Transferencia geoestacionaria', GEO: 'Geoestacionaria', MEO: 'Órbita media', Sub: 'Suborbital',
    PO: 'Polar', 'Lunar': 'Hacia la Luna', TLI: 'Hacia la Luna', HEO: 'Órbita alta', 'Helio-N/A': 'Alrededor del Sol', 'L1': 'Punto L1', 'L2': 'Punto L2', VLEO: 'Muy baja' };
  const CC3 = { USA: 'US', CHN: 'CN', NZL: 'NZ', RUS: 'RU', KAZ: 'KZ', GUF: 'GF', FRA: 'FR', IND: 'IN', JPN: 'JP', KOR: 'KR', IRN: 'IR', PRK: 'KP', BRA: 'BR',
    AUS: 'AU', GBR: 'GB', NOR: 'NO', SWE: 'SE', ISR: 'IL', MHL: 'MH', ESP: 'ES', ARG: 'AR', ITA: 'IT', CAN: 'CA', DEU: 'DE', MEX: 'MX', COL: 'CO', PRT: 'PT' };
  function normLaunch(r) {
    const pad = r.pad || {}, loc = pad.location || {}, m = r.mission || {};
    return { id: r.id, name: r.name, net: Date.parse(r.net), status: (r.status && r.status.abbrev) || 'TBD', statusDesc: r.status && r.status.description,
      provider: (r.launch_service_provider || {}).name || '', rocket: ((r.rocket || {}).configuration || {}).full_name || ((r.rocket || {}).configuration || {}).name || '',
      mission: m.name || '', desc: m.description || '', mtype: MTYPE[m.type] || m.type || '', orbit: m.orbit ? (ORBIT[m.orbit.abbrev] || m.orbit.name) : '',
      pad: pad.name || '', place: loc.name || '', cc: CC3[loc.country_code] || '', lat: +pad.latitude, lng: +pad.longitude,
      image: r.image || '', vid: ((m.vid_urls || [])[0] || {}).url || '', live: !!r.webcast_live, prob: r.probability };
  }
  async function loadLaunches() {
    try {
      const j = await getJSON(`${LL2}/launch/upcoming/?limit=25&hide_recent_previous=true`, 30);
      state.launches = j.results.map(normLaunch).filter(l => isFinite(l.net)).sort((a, b) => a.net - b.net);
      scheduleLaunchReminders(); refreshHtml();
      if (state.sheet && state.sheet.launches) rerender();
    } catch (e) { if (!state.launches) state.launches = []; if (state.sheet && state.sheet.launches) rerender(); }
  }
  function cdShort(ms) {
    if (ms < 0) return 'EN CURSO';
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    return d ? `${d}d ${h}h` : h ? `${h}h ${pad2(m)}m` : `${m} min`;
  }
  function launchCard(l, k) {
    const s = STATUS[l.status] || [l.status, 'warn'];
    return `<button class="launch" data-l="${k}"><div class="img" style="background-image:url('${esc(l.image)}')">
      <span class="st"><span class="pill ${s[1] === 'live' ? 'live' : s[1]}">${s[0]}</span></span>
      <span class="cdwn" data-cd="${l.net}"><small>${l.net > Date.now() ? 'DESPEGUE EN' : 'DESPEGÓ'}</small><span>${countdown(l.net - Date.now()).txt}</span></span></div>
      <div class="body"><b>${esc(l.mission || l.name)}</b><div class="sub"><span>🚀 ${esc(l.rocket)}</span><span>· ${esc(l.provider)}</span></div>
      <div class="sub"><span>${flag(l.cc)} ${esc(l.place.split(',').slice(-1)[0].trim() || l.place)}</span><span>· ${esc(fmtDay(l.net))} ${fmtTime(l.net)}</span>${l.orbit ? `<span class="pill">${esc(l.orbit)}</span>` : ''}</div></div></button>`;
  }
  function tickCountdowns() {
    document.querySelectorAll('[data-cd]').forEach(el => {
      const t = +el.dataset.cd, c = countdown(t - Date.now());
      const span = el.querySelector('span'); if (span) span.textContent = c.txt;
    });
    const big = $('#bigcd'); if (big) { const c = countdown(+big.dataset.t - Date.now()); big.innerHTML = [['d', 'días'], ['h', 'horas'], ['m', 'min'], ['s', 'seg']].map(([k, l]) => `<div><b>${pad2(c[k])}</b><small>${l}</small></div>`).join(''); }
  }
  function openLaunches() {
    if (NATIVE && N.adBreak) N.adBreak();
    openSheet({
      title: 'Próximos lanzamientos', sub: 'Cohetes de todo el mundo · datos de The Space Devs', launches: true,
      render: body => {
        if (!state.launches) { body.innerHTML = '<div class="spinner"></div>'; loadLaunches(); return; }
        if (!state.launches.length) { body.innerHTML = '<div class="empty">No se pudieron cargar los lanzamientos. Revisa tu conexión.</div>'; return; }
        body.innerHTML = state.launches.map(launchCard).join('') + '<p class="about">Datos de Launch Library 2 (The Space Devs). Las fechas pueden cambiar por el clima o por problemas técnicos.</p>';
        body.querySelectorAll('[data-l]').forEach(b => b.onclick = () => openLaunch(+b.dataset.l));
        liveTimer = setInterval(tickCountdowns, 1000);
      }
    });
  }
  function openLaunch(k) {
    const l = state.launches[k]; if (!l) return;
    const s = STATUS[l.status] || [l.status, 'warn'];
    openSheet({
      title: l.mission || l.name, sub: `${l.rocket} · ${l.provider}`, launches: true,
      render: body => {
        const on = state.launchRem.has(l.id);
        body.innerHTML = `<div class="launch-hero" style="background-image:url('${esc(l.image)}')"></div>
          <div class="pills" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="pill ${s[1] === 'live' ? 'live' : s[1]}">${s[0]}</span>${l.mtype ? `<span class="pill cyan">${esc(l.mtype)}</span>` : ''}${l.orbit ? `<span class="pill">${esc(l.orbit)}</span>` : ''}${l.prob != null && l.prob >= 0 ? `<span class="pill">Clima favorable ${l.prob}%</span>` : ''}</div>
          <div class="big-cd" id="bigcd" data-t="${l.net}"></div>
          <div class="actions">
            <button class="action" id="l-watch">${I.ui('play')}<span>${l.live ? 'Ver en vivo' : 'Transmisión'}</span></button>
            <button class="action ${on ? 'on' : ''}" id="l-rem">${I.ui('bell')}<span>${on ? 'Te avisaremos' : 'Avisarme'}</span></button>
            <button class="action" id="l-map">${I.ui('pin')}<span>Ver en el mapa</span></button>
          </div>
          <div class="kv">
            <span>Fecha</span><b>${esc(fmtDate(l.net))}</b>
            <span>Cohete</span><b>${esc(l.rocket)}</b>
            <span>Empresa o agencia</span><b>${esc(l.provider)}</b>
            <span>Lugar</span><b>${flag(l.cc)} ${esc(l.pad)}</b>
            <span></span><b style="font-family:Inter;font-size:12px;color:var(--muted)">${esc(l.place)}</b>
          </div>
          ${l.desc ? `<div class="section-h"><h3>La misión</h3><small>en inglés, de la fuente</small></div><div class="explain" lang="en">${esc(l.desc)}</div>` : ''}
          <button class="btn block" id="l-share">${I.ui('share')}Compartir</button>`;
        tickCountdowns(); liveTimer = setInterval(tickCountdowns, 1000);
        $('#l-watch').onclick = () => {
          const url = l.vid || `https://www.youtube.com/results?search_query=${encodeURIComponent(l.name + ' launch live')}`;
          if (NATIVE) N.openLink(url); else window.open(url, '_blank');
        };
        $('#l-rem').onclick = () => {
          if (state.launchRem.has(l.id)) state.launchRem.delete(l.id); else state.launchRem.add(l.id);
          store.set('launchRem', [...state.launchRem]); scheduleLaunchReminders(); rerender();
          toast(state.launchRem.has(l.id) ? 'Te avisaremos 1 hora y 10 minutos antes del despegue' : 'Aviso quitado');
        };
        $('#l-map').onclick = () => { closeSheet(); if (isFinite(l.lat)) { globe.controls().autoRotate = false; globe.pointOfView({ lat: l.lat, lng: l.lng, altitude: 0.9 }, 1400); } };
        $('#l-share').onclick = () => {
          const txt = `🚀 ${l.mission || l.name}: despega ${fmtDate(l.net)} desde ${l.place}. Cohete ${l.rocket} (${l.provider}). Síguelo con Orbe Espacio.`;
          if (NATIVE) N.share(txt); else if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast(txt, 5000);
        };
      }
    });
  }
  function scheduleLaunchReminders() {
    if (!NATIVE || typeof N.setReminders !== 'function' || !state.launches) return;
    const items = [];
    for (const l of state.launches) {
      if (!state.launchRem.has(l.id)) continue;
      for (const [min, txt] of [[60, 'en 1 hora'], [10, 'en 10 minutos']]) {
        const at = l.net - min * 60000; if (at < Date.now()) continue;
        items.push({ at, title: `🚀 Despegue ${txt}: ${l.mission || l.name}`, text: `${l.rocket} (${l.provider}) desde ${l.place}. Abre Orbe Espacio para ver la transmisión.`, open: 'lanz' });
      }
    }
    try { N.setReminders('launch', JSON.stringify(items)); } catch (e) { /* sin avisos */ }
  }

  // ---------- astronautas ----------
  const NAT = { American: 'US', Russian: 'RU', Chinese: 'CN', Canadian: 'CA', Japanese: 'JP', Italian: 'IT', French: 'FR', German: 'DE', British: 'GB', Emirati: 'AE',
    Indian: 'IN', Saudi: 'SA', Turkish: 'TR', Polish: 'PL', Hungarian: 'HU', Spanish: 'ES', Danish: 'DK', Swedish: 'SE', Belarusian: 'BY', Kazakh: 'KZ',
    Brazilian: 'BR', Mexican: 'MX', Israeli: 'IL', Pakistani: 'PK', Dutch: 'NL', Belgian: 'BE', Swiss: 'CH', Australian: 'AU', 'South Korean': 'KR', Colombian: 'CO', Peruvian: 'PE', Argentine: 'AR', Chilean: 'CL' };
  function isoDur(s) {
    const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(s || ''); if (!m) return null;
    return (+(m[1] || 0)) * 864e5 + (+(m[2] || 0)) * 36e5 + (+(m[3] || 0)) * 6e4;
  }
  async function loadAstros() {
    try {
      const j = await getJSON(`${LL2}/astronaut/?in_space=true&limit=50`, 360);
      const now = Date.now();
      // Solo personas en una misión actual (la fuente también lista al maniquí "Starman" y a la perrita Laika)
      state.astros = j.results.filter(a => !a.date_of_death && a.last_flight && a.nationality !== 'Earthling' && now - Date.parse(a.last_flight) < 2 * 365 * 864e5)
        .map(a => ({ id: a.id, name: a.name, cc: NAT[a.nationality] || '', nat: a.nationality, agency: (a.agency || {}).abbrev || (a.agency || {}).name || '',
          agencyName: (a.agency || {}).name || '', photo: a.profile_image_thumbnail || a.profile_image || '', big: a.profile_image || a.profile_image_thumbnail || '',
          since: Date.parse(a.last_flight), total: isoDur(a.time_in_space), flights: a.flights_count, walks: a.spacewalks_count, age: a.age, bio: a.bio || '', wiki: a.wiki || '',
          station: /CNSA/.test((a.agency || {}).abbrev || '') ? 'Tiangong' : 'EEI' }))
        .sort((a, b) => a.since - b.since);
      updateIssCard();
      if (state.sheet && state.sheet.astros) rerender();
    } catch (e) { if (!state.astros) state.astros = []; if (state.sheet && state.sheet.astros) rerender(); }
  }
  function openAstros() {
    if (NATIVE && N.adBreak) N.adBreak();
    openSheet({
      title: 'Personas en el espacio', sub: 'Quién está en órbita ahora mismo', astros: true,
      render: body => {
        if (!state.astros) { body.innerHTML = '<div class="spinner"></div>'; loadAstros(); return; }
        if (!state.astros.length) { body.innerHTML = '<div class="empty">No se pudo cargar la tripulación. Revisa tu conexión.</div>'; return; }
        const groups = [['EEI', 'Estación Espacial Internacional', I.iss()], ['Tiangong', 'Estación espacial china Tiangong', I.css()]];
        body.innerHTML = `<div class="fact" style="width:auto;margin-bottom:6px"><b>${state.astros.length} personas</b><p>están ahora mismo fuera de la Tierra, dando vueltas al planeta a 28.000 km/h.</p></div>` + liveCard() +
          groups.map(([k, title, art]) => {
            const list = state.astros.filter(a => a.station === k); if (!list.length) return '';
            return `<div class="station-h"><span class="art">${art}</span><div><b>${title}</b><small>${list.length} a bordo</small></div></div>
              <div class="astro-grid">${list.map(a => `<button class="astro" data-a="${state.astros.indexOf(a)}"><div class="ph" style="background-image:url('${esc(a.photo)}')"><span class="flag">${flag(a.cc)}</span><span class="ag pill">${esc(a.agency)}</span></div>
                <div class="tx"><b>${esc(a.name)}</b><small>${esc(a.cc ? regionName(a.cc) : a.nat)}</small><span class="days">Día ${Math.max(1, Math.ceil((Date.now() - a.since) / 864e5))} en órbita</span></div></button>`).join('')}</div>`;
          }).join('') + '<p class="about">Datos de Launch Library 2 (The Space Devs).</p>';
        body.querySelectorAll('[data-a]').forEach(b => b.onclick = () => openAstro(+b.dataset.a));
      }
    });
  }
  function openAstro(k) {
    const a = state.astros[k]; if (!a) return;
    openSheet({
      title: a.name, sub: `${a.agencyName} · ${a.station === 'EEI' ? 'Estación Espacial Internacional' : 'Tiangong'}`, astros: true,
      render: body => {
        const days = Math.max(1, Math.ceil((Date.now() - a.since) / 864e5));
        body.innerHTML = `<div class="astro-hero"><div class="ph" style="background-image:url('${esc(a.big)}')"></div><div><div style="font-size:30px">${flag(a.cc)}</div><b style="font:700 19px/1.2 var(--display);display:block">${esc(a.name)}</b><small style="color:var(--muted)">${esc(a.cc ? regionName(a.cc) : a.nat)} · ${esc(a.agency)}</small></div></div>
          <div class="tele">
            <div><small>En esta misión</small><b>${days}<i>días</i></b></div>
            <div><small>Total en el espacio</small><b>${a.total ? nf.format(Math.round(a.total / 864e5)) : '—'}<i>días</i></b></div>
            <div><small>Vuelos espaciales</small><b>${a.flights ?? '—'}</b></div>
            <div><small>Caminatas espaciales</small><b>${a.walks ?? '—'}</b></div>
            ${a.age ? `<div><small>Edad</small><b>${a.age}<i>años</i></b></div>` : ''}
            <div><small>Despegó</small><b style="font-size:15px">${new Date(a.since).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>
          </div>
          ${a.bio ? `<div class="section-h"><h3>Biografía</h3><small>en inglés, de la fuente</small></div><div class="explain" lang="en">${esc(a.bio)}</div>` : ''}
          <div class="btn-row"><button class="btn" id="as-back">Ver tripulación</button>${a.wiki ? '<button class="btn" id="as-wiki">Wikipedia</button>' : ''}</div>`;
        $('#as-back').onclick = openAstros;
        const w = $('#as-wiki'); if (w) w.onclick = () => { if (NATIVE) N.openLink(a.wiki); else window.open(a.wiki, '_blank'); };
      }
    });
  }

  // ---------- marcadores HTML (lanzamientos y tu ubicación) ----------
  function refreshHtml() {
    if (!globe) return;
    const els = [];
    if (state.me) { const el = document.createElement('div'); el.className = 'me-pin'; el.title = state.me.name; els.push({ lat: state.me.lat, lng: state.me.lng, el, alt: 0.005 }); }
    const seen = new Set();
    for (const [k, l] of (state.launches || []).entries()) {
      if (!isFinite(l.lat) || l.net < Date.now() - 3600e3 || seen.has(l.pad) || seen.size >= 10) continue;
      seen.add(l.pad);
      const el = document.createElement('div'); el.className = 'pad-mk';
      el.innerHTML = `<span class="rk">${I.ui('lanz')}</span><small data-padcd="${l.net}">${cdShort(l.net - Date.now())}</small>`;
      el.addEventListener('click', ev => { ev.stopPropagation(); openLaunch(k); });
      els.push({ lat: l.lat, lng: l.lng, el, alt: 0.006 });
    }
    globe.htmlElementsData(els);
  }

  // ---------- menú: Premium, calidad y créditos ----------
  function openMenu() {
    openSheet({
      title: 'Orbe Espacio', sub: 'Ajustes, Premium y fuentes de datos',
      render: body => {
        const s = state.settings;
        const tog = (k, t, sub) => `<button class="toggle" data-set="${k}" role="switch" aria-checked="${!!s[k]}"><span><b>${t}</b><span class="t-sub">${sub}</span></span><span class="switch"></span></button>`;
        body.innerHTML = `
          <div class="premium">${state.premium ? '<h4>Premium activo ✨</h4><p class="ok">Gracias por apoyar Orbe Espacio: no verás anuncios.</p><button class="btn" id="m-manage">Administrar suscripción</button>'
            : `<h4>Orbe Espacio Premium</h4><p>Sin anuncios, para siempre mientras estés suscrito. ${esc(state.price)}.</p><button class="btn primary block" id="m-buy">Quitar anuncios</button>`}</div>
          ${tog('quality', 'Texturas 8K Ultra HD', 'La Tierra con más detalle (si tu equipo lo soporta)')}
          ${tog('clouds', 'Nubes', 'Capa de nubes realista sobre el planeta')}
          ${tog('labels', 'Estaciones espaciales en el mapa', 'Iconos de la EEI y Tiangong siguiendo su órbita')}
          <div class="section-h"><h3>Colores del mapa</h3><small>${nf.format(state.sats.length)} satélites</small></div>
          <div class="legend">${CAT_ORDER.map(c => `<span><i style="background:${I.COLORS[c][0]};color:${I.COLORS[c][0]}"></i>${esc(CATS[c].short)}</span>`).join('')}</div>
          <p class="about">Los satélites que van por la sombra de la Tierra se ven más apagados; los que tienen sol, brillantes.</p>
          <p class="about"><b>Fuentes de datos:</b> órbitas de CelesTrak (celestrak.org), lanzamientos y astronautas de Launch Library 2 (The Space Devs), búsqueda de ciudades © OpenStreetMap.
          Texturas de la Tierra: Solar System Scope (CC BY 4.0) y NASA. Cálculo de órbitas con satellite.js (SGP4).<br>
          Catálogo: ${state.catalogLive ? 'actualizado hoy desde CelesTrak' : 'copia incluida en la app; se actualiza al tener internet'}.<br>Orbe Espacio 1.1</p>`;
        body.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
          const k = b.dataset.set;
          if (k === 'quality') { s.quality = s.quality === 'ultra' ? 'high' : 'ultra'; toast('Se aplicará al volver a abrir la app'); }
          else { s[k] = !s[k]; if (k === 'clouds') setClouds(s.clouds); }
          store.set('settings', s); b.setAttribute('aria-checked', String(k === 'quality' ? s.quality === 'ultra' : !!s[k]));
        });
        const buy = $('#m-buy'); if (buy) buy.onclick = () => { if (NATIVE) N.buyPremium(); else toast('La suscripción se activa desde la app instalada con Google Play'); };
        const man = $('#m-manage'); if (man) man.onclick = () => NATIVE && N.manageSubscription();
      }
    });
  }
  window.onNativePremium = (p, price) => { state.premium = !!p; if (price) state.price = price; };

  // ---------- splash ----------
  function splash(pct, msg) {
    const bar = $('#splash-bar'); if (!bar) return;
    bar.style.width = pct + '%'; if (msg) $('#splash-msg').textContent = msg;
    if (pct >= 100) { const sp = $('#splash'); setTimeout(() => sp.classList.add('gone'), 250); setTimeout(() => sp.remove(), 1000); }
  }

  // ---------- eventos ----------
  function wire() {
    $('#defs-host').innerHTML = I.DEFS;
    $('#btn-search').innerHTML = I.ui('search');
    $('#btn-menu').innerHTML = I.ui('menu');
    $('#sheet-close').innerHTML = I.ui('close');
    $('#iss-ico').innerHTML = I.iss();
    document.querySelectorAll('.ti').forEach(t => { t.innerHTML = I.ui(t.dataset.ico); });
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) selectTab(b.dataset.tab); });
    $('#sheet-close').onclick = () => closeSheet();
    $('#sheet-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });
    $('#sheet-body').addEventListener('click', e => {
      const lv = e.target.closest('[data-live]'); if (lv) { e.preventDefault(); openIssLive(lv.dataset.live); return; }
      const sb = e.target.closest('[data-sat]'); if (sb) { openSat(+sb.dataset.sat, true); return; }
      const cl = e.target.closest('[data-catlist]'); if (cl) openCatList(cl.dataset.catlist);
    });
    $('#cats').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setFilter(b.dataset.cat); });
    $('#iss-card').onclick = () => { const i = state.byId.get(ISS_ID); if (i != null) openSat(i, true); };
    $('#btn-search').onclick = () => { selectTab('sats'); setTimeout(() => { const q = $('#q'); if (q) q.focus(); }, 350); };
    $('#btn-menu').onclick = openMenu;
    $('#next-pass').onclick = () => selectTab('pasos');
    // La hoja tapa el aviso de próximo paso
    new MutationObserver(() => updateNextPass()).observe($('#sheet'), { attributes: true, attributeFilter: ['class'] });
  }

  // ---------- arranque ----------
  async function boot() {
    wire();
    splash(15, 'Cargando la Tierra en Ultra HD…');
    initGlobe();
    tickClock(); setInterval(tickClock, 1000);
    requestAnimationFrame(frame);
    local('data/ciudades-mundo.json').then(c => { state.ciudades = c; }).catch(() => {});
    let snap;
    try { snap = await local('data/sats.json'); } catch (e) { snap = { rows: [] }; }
    const snapshotCats = new Map(snap.rows.map(r => [r[1], r[13]]));
    state.catalogDate = Date.parse(snap.generated) || null;
    splash(40, `Calculando ${nf.format(snap.rows.length)} órbitas…`);
    setCatalog(snap.rows, false);
    computeAllPasses();
    // Al abrir, la cámara va hacia la Estación Espacial
    setTimeout(() => { const i = state.byId.get(ISS_ID), st = i != null && stateAt(state.sats[i]); if (st && !state.sheet) globe.pointOfView({ lat: Math.max(-50, Math.min(50, st.lat)), lng: st.lng, altitude: 2.5 }, 2500); }, 2200);
    setInterval(updateIssCard, 1000);
    setInterval(() => { updateNextPass(); document.querySelectorAll('[data-padcd]').forEach(el => { el.textContent = cdShort(+el.dataset.padcd - Date.now()); }); }, 30000);
    setInterval(computeAllPasses, 30 * 60000);
    refreshCatalog(snapshotCats);
    loadLaunches(); loadAstros();
    if (NATIVE && typeof N.isPremium === 'function') state.premium = !!N.isPremium();
    setTimeout(() => splash(100), 12000);   // por si el equipo es muy lento
  }
  window.__orbeDebug = { state, computePasses, stateAt };
  boot();
})();
