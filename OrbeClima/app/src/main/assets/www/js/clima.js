/* Orbe Clima – viento, lluvia, humedad, temperatura y huracanes del planeta en un globo 3D */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const N = window.AndroidClima || null;
  const NATIVE = !!(N && typeof N.fetchText === 'function');
  const I = window.OrbeIcons;
  const nf = new Intl.NumberFormat('es-CO');
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  // Fuentes gratuitas que permiten uso comercial:
  //  · MET Norway (pronóstico de cada lugar, CC BY 4.0) · NOAA GFS vía ERDDAP de PacIOOS (mapa mundial, dominio público)
  //  · OpenStreetMap Nominatim (buscador de ciudades: solo al pulsar Buscar, como pide su política)
  const MET = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
  const ERDDAP = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ncep_global.json';
  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const GDACS_LIST = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC';
  const qs = new URLSearchParams(location.search);
  // Copia del mapa mundial en GitHub Pages (ClimaConfig.MIRROR_URL). ?mirror=… solo para pruebas.
  const MIRROR = (NATIVE && typeof N.getMirror === 'function' && N.getMirror()) || qs.get('mirror') || '';

  const store = {
    get(k, d) { try { const v = localStorage.getItem('clima.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('clima.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐';
  const regionName = (() => { try { const d = new Intl.DisplayNames(['es'], { type: 'region' }); return cc => { try { return d.of(cc); } catch (e) { return cc; } }; } catch (e) { return cc => cc; } })();

  const state = {
    me: store.get('me', null), places: store.get('places', []), sel: 0,
    layer: (l => l === 'nubes' ? 'humedad' : l)(store.get('layer', 'viento')), grid: null, tIdx: 0, nowIdx: 0, playing: false,
    settings: Object.assign({ quality: 'ultra', particles: true, labels: true }, store.get('settings', {})),
    alerts: Object.assign({ rain: true, storm: true, wind: true, heat: true, cold: true, hurricane: true, radius: 600 }, store.get('alerts', {})),
    storms: null, stormGeo: {}, fc: {}, aq: {}, sheet: null, premium: false, price: '$9.000 COP/mes', probe: null, geo: null, ciudades: []
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
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('tiempo agotado')); } }, 60000);
      });
    }
    const key = 'cache:' + url;
    const c = maxAgeMin > 0 ? store.get(key, null) : null;
    if (c && Date.now() - c.t < maxAgeMin * 60000) return Promise.resolve(c.v);
    return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(t => { if (maxAgeMin > 0 && t.length < 1200000) store.set(key, { t: Date.now(), v: t }); return t; })
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
  function fmtDay(t, long) {
    const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 864e5);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    return d.toLocaleDateString('es', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' }).replace('.', '');
  }
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const dirTxt = deg => DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

  // ---------- país u océano bajo un punto ----------
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
    if (lat < -60) return 'Océano Antártico';
    if (lat > 66) return 'Océano Ártico';
    if (lng > 20 && lng < 120 && lat < 30) return 'Océano Índico';
    if (lng > -100 && lng <= -70 && lat > 8 && lat < 32) return 'Mar Caribe';
    if (lng > -70 && lng <= 20) return 'Océano Atlántico';
    return 'Océano Pacífico';
  }
  const placeLabel = (lat, lng) => { const cc = countryAt(lat, lng); return cc ? `${regionName(cc)} ${flag(cc)}` : oceanAt(lat, lng); };

  // ---------- escalas de color de las capas ----------
  const SCALES = {
    viento: { name: 'Viento', unit: 'km/h', desc: 'Las líneas blancas muestran hacia dónde sopla; el color, qué tan fuerte.', stops: [[0, [30, 60, 140, 0]], [8, [40, 110, 220, 95]], [20, [40, 190, 210, 135]], [35, [110, 225, 100, 155]], [50, [245, 220, 60, 175]], [70, [255, 140, 50, 190]], [100, [255, 60, 90, 205]], [140, [200, 60, 255, 215]]], labels: ['0', '20', '50', '100+'] },
    lluvia: { name: 'Lluvia', unit: 'mm en 3 h', desc: 'Dónde va a llover y cuánto, en las 3 horas de la hora elegida.', stops: [[0, [90, 170, 255, 0]], [0.2, [90, 170, 255, 0]], [0.6, [90, 175, 255, 125]], [2, [60, 125, 255, 175]], [5, [115, 75, 255, 195]], [10, [205, 60, 240, 210]], [20, [255, 60, 150, 220]], [40, [255, 225, 240, 230]]], labels: ['0', '2', '10', '40+'] },
    humedad: { name: 'Humedad', unit: '%', desc: 'Humedad del aire: cuanto más azul, más húmedo (y más probable que haya nubes o lluvia).', stops: [[0, [255, 190, 110, 0]], [30, [255, 196, 120, 45]], [50, [150, 215, 255, 60]], [70, [90, 170, 255, 120]], [85, [70, 115, 255, 165]], [100, [125, 85, 255, 200]]], labels: ['0', '50', '100 %'] },
    temp: { name: 'Temperatura', unit: '°C', desc: 'Temperatura del aire: azul frío, amarillo templado, rojo calor.', stops: [[-40, [150, 90, 255, 175]], [-20, [70, 120, 255, 175]], [-5, [80, 200, 255, 170]], [5, [90, 230, 180, 165]], [15, [170, 230, 90, 165]], [25, [250, 210, 60, 175]], [32, [255, 140, 50, 185]], [42, [255, 55, 60, 195]]], labels: ['−20', '0', '20', '40 °C'] }
  };
  function colorAt(stops, v) {
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (v - a) / (b - a);
        return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f, ca[3] + (cb[3] - ca[3]) * f];
      }
    }
    return stops[stops.length - 1][1];
  }
  const gradCss = sc => `linear-gradient(90deg, ${sc.stops.map(([, c], i) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0.35, c[3] / 255).toFixed(2)}) ${(i / (sc.stops.length - 1) * 100).toFixed(0)}%`).join(', ')})`;

  // ---------- rejilla mundial (NOAA GFS) ----------
  /** Convierte la tabla de ERDDAP (tiempo, lat, lon, u, v, temperatura, lluvia, humedad) a la rejilla de la app. */
  function toGrid(table, step) {
    const ci = n => table.columnNames.indexOf(n);
    const [iT, iLa, iLo, iU, iV, iTm, iP, iH] = ['time', 'latitude', 'longitude', 'ugrd10m', 'vgrd10m', 'tmp2m', 'pratesfc', 'rh2m'].map(ci);
    const times = [...new Set(table.rows.map(r => r[iT]))].sort().map(t => Date.parse(t));
    const lat0 = -84, nlat = Math.round(168 / step) + 1, lng0 = -180, nlng = Math.round(360 / step);
    const n = nlat * nlng, steps = times.length;
    const mk = () => Array.from({ length: steps }, () => new Array(n).fill(0));
    const g = { generated: new Date().toISOString(), lat0, dlat: step, nlat, lng0, dlng: step, nlng, times, u: mk(), v: mk(), p: mk(), h: mk(), t: mk() };
    const tIdx = new Map(times.map((t, i) => [t, i]));
    for (const r of table.rows) {
      const k0 = tIdx.get(Date.parse(r[iT]));
      const i = Math.round((r[iLa] - lat0) / step);
      let lon = r[iLo]; if (lon >= 180) lon -= 360;
      const j = Math.round((lon - lng0) / step);
      if (k0 == null || i < 0 || i >= nlat || j < 0 || j >= nlng) continue;
      const k = i * nlng + j;
      g.u[k0][k] = (r[iU] || 0) * 3.6; g.v[k0][k] = (r[iV] || 0) * 3.6;
      g.p[k0][k] = Math.max(0, r[iP] || 0) * 3600 * 3 * 10;
      g.t[k0][k] = (r[iTm] || 273.15) - 273.15; g.h[k0][k] = r[iH] || 0;
    }
    return g;
  }
  async function loadGrid() {
    if (MIRROR) {
      try {
        const g = await getJSON(MIRROR, 120);
        if (g && g.times && g.u && g.h) return g;
      } catch (e) { /* si falla, consulta directa */ }
    }
    // Consulta directa a NOAA (rejilla de 12°): solo mientras la copia de GitHub Pages no esté disponible
    const iso = d => d.toISOString().slice(0, 13) + ':00:00Z';
    const sub = encodeURIComponent(`[(${iso(new Date())}):1:(${iso(new Date(Date.now() + 48 * 3600e3))})][(-84):24:(84)][(0):24:(348)]`).replace(/%3A/g, ':');
    const url = ERDDAP + '?' + ['ugrd10m', 'vgrd10m', 'tmp2m', 'pratesfc', 'rh2m'].map(v => v + sub).join(',');
    const j = await getJSON(url, 180);
    return toGrid(j.table, 12);
  }
  // Valor interpolado (bilineal en el espacio) de un campo en un paso de tiempo
  function sample(field, s, lat, lng) {
    const g = state.grid, arr = g[field][s];
    let fi = (lat - g.lat0) / g.dlat; fi = Math.max(0, Math.min(g.nlat - 1.0001, fi));
    let fj = (lng - g.lng0) / g.dlng; fj = ((fj % g.nlng) + g.nlng) % g.nlng;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), i1 = Math.min(g.nlat - 1, i0 + 1), j1 = (j0 + 1) % g.nlng;
    const di = fi - i0, dj = fj - j0, W = g.nlng;
    const a = arr[i0 * W + j0], b = arr[i0 * W + j1], c = arr[i1 * W + j0], d = arr[i1 * W + j1];
    return (a * (1 - dj) + b * dj) * (1 - di) + (c * (1 - dj) + d * dj) * di;
  }
  function sampleT(field, t, lat, lng) {
    const s0 = Math.floor(t), s1 = Math.min(state.grid.times.length - 1, s0 + 1), f = t - s0;
    const a = sample(field, s0, lat, lng);
    return f > 0.001 ? a + (sample(field, s1, lat, lng) - a) * f : a;
  }
  const layerValue = (layer, s, lat, lng) => layer === 'viento' ? Math.hypot(sample('u', s, lat, lng), sample('v', s, lat, lng))
    : layer === 'lluvia' ? sample('p', s, lat, lng) / 10 : layer === 'humedad' ? sample('h', s, lat, lng) : sample('t', s, lat, lng);

  // ---------- globo ----------
  const TEXTURES = { day: { k8: 'img/8k/8k_earth_daymap.jpg', k4: 'img/earth-blue-marble.jpg' }, night: 'img/earth-night.jpg' };
  let globe, maxTex = 4096, maxAniso = 1, baseMat = null, dnMat = null, globeMesh = null, Shader = null, Tex = null, hdReady = false;
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
      vec4 nightColor = texture2D(nightTexture, vUv) * 1.4 + vec4(0.025, 0.035, 0.07, 0.0);
      gl_FragColor = mix(nightColor, dayColor, smoothstep(-0.14, 0.14, intensity));
    }`;
  const OV_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const OV_FRAG = `uniform sampler2D map; uniform float opacity; varying vec2 vUv;
    void main() { vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb, c.a * opacity); }`;

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

  function initGlobe() {
    globe = new Globe($('#globe'), { animateIn: true, waitForGlobeReady: true,
      rendererConfig: { antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false } });
    try { const caps = globe.renderer().capabilities; maxTex = caps.maxTextureSize || 4096; maxAniso = caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1; } catch (e) { /* por defecto */ }
    globe.globeImageUrl(use8k() ? TEXTURES.day.k8 : TEXTURES.day.k4)
      .bumpImageUrl('img/earth-topology.png')
      .backgroundImageUrl('img/stars-4k.jpg')
      .globeCurvatureResolution(2)
      .showAtmosphere(true).atmosphereColor('#7cc8ff').atmosphereAltitude(0.17)
      .polygonAltitude(0.0015).polygonCapColor(() => 'rgba(0,0,0,0)')     // por debajo de las capas del clima (no las tapa)
      .polygonSideColor(() => 'rgba(0,0,0,0)').polygonStrokeColor(() => 'rgba(210,230,255,0.32)')
      .polygonsTransitionDuration(0).polygonLabel(() => '')
      .pathPoints('pts').pathPointLat(p => p[1]).pathPointLng(p => p[0]).pathPointAlt(0.014)
      .pathColor(p => p.color).pathStroke(p => p.stroke).pathDashLength(p => p.dash || 1).pathDashGap(p => p.gap || 0)
      .pathDashAnimateTime(p => p.anim || 0).pathTransitionDuration(0)
      .htmlLat('lat').htmlLng('lng').htmlAltitude(d => d.alt || 0.012).htmlElement(d => d.el)
      .onGlobeClick(c => c && probe(c.lat, c.lng))
      .onPolygonClick((p, ev, c) => c && probe(c.lat, c.lng))
      .onZoom(pov => { if (dnMat) dnMat.uniforms.globeRotation.value = [pov.lng, pov.lat]; })
      .onGlobeReady(onGlobeReady);
    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(window.devicePixelRatio || 1, 2));   // el regulador de fluidez ajusta
    const c = globe.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.18; c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 101.5; c.maxDistance = 700;
    c.addEventListener('start', () => { c.autoRotate = false; });
    const me = state.me;
    // En teléfonos (vertical) se ve el planeta completo; en tabletas y TV, más cerca
    globe.pointOfView({ lat: me ? Math.max(-35, Math.min(35, me.lat)) : 12, lng: me ? me.lng : -72, altitude: innerWidth < innerHeight ? 2.75 : 2.2 });
    globe.renderer().domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
    globe.renderer().domElement.addEventListener('webglcontextrestored', () => location.reload(), false);
    window.addEventListener('resize', () => globe.width(innerWidth).height(innerHeight));
  }

  function onGlobeReady() {
    baseMat = globe.globeMaterial();
    if (baseMat.map) { baseMat.map.anisotropy = maxAniso; baseMat.map.needsUpdate = true; }
    if (baseMat.bumpMap) baseMat.bumpScale = 5;
    globe.scene().traverse(o => {
      if (!globeMesh && o.isMesh && o.material === baseMat) globeMesh = o;
      if (!Shader && o.material && o.material.type === 'ShaderMaterial') Shader = o.material.constructor;
    });
    Tex = baseMat.map && baseMat.map.constructor;
    hdReady = TierraHD.init(globe);
    enableDayNight();
    setupOverlays();
    local('lib/countries.geojson').then(geo => {
      state.geo = geo.features.filter(f => f.properties.ISO_A2 !== 'AQ').map(f => {
        let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const p of polys) for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        f.bbox = [x0, y0, x1, y1]; f.cc = f.properties.ISO_A2 === '-99' ? (f.properties.ISO_A2_EH && f.properties.ISO_A2_EH !== '-99' ? f.properties.ISO_A2_EH : null) : f.properties.ISO_A2; return f;
      });
      refreshPolygons();
    }).catch(() => {});
    refreshHtml();
    splash(75, 'Calculando el viento del planeta…');
  }
  function enableDayNight() {
    if (!hdReady) return;
    // Tierra Ultra HD: relieve, reflejo del Sol en el mar, atardecer y atmósfera (js/tierra-hd.js)
    TierraHD.createEarth({ day: use8k() ? TEXTURES.day.k8 : TEXTURES.day.k4, night: TEXTURES.night, normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' }, { nightAmbient: 0.09 })
      .then(mat => { dnMat = mat; globe.globeMaterial(dnMat); }).catch(() => {});
  }

  // ---------- capas del clima sobre el globo (texturas dibujadas en la app) ----------
  const FW = 1024, FH = 512;                // capa de color (suavizada)
  let field = null, stepCache = {};
  function makeOverlay(canvas, scale) {
    const tex = new Tex(canvas); tex.anisotropy = maxAniso; tex.needsUpdate = true;
    const mat = new Shader({ uniforms: { map: { value: tex }, opacity: { value: 1 } }, vertexShader: OV_VERT, fragmentShader: OV_FRAG, transparent: true, depthWrite: false });
    const mesh = new globeMesh.constructor(globeMesh.geometry, mat);
    mesh.scale.setScalar(scale); mesh.renderOrder = 3;
    globeMesh.parent.add(mesh);
    return { canvas, ctx: canvas.getContext('2d'), tex, mat, mesh };
  }
  function setupOverlays() {
    if (!globeMesh || !Shader || !Tex) return;
    const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
    field = makeOverlay(fc, 1.0035);
    setupWind();
    if (state.grid) drawField(true);
    requestAnimationFrame(frame);
  }
  // Imagen de un paso de tiempo de la capa (360×180, se amplía con suavizado)
  function stepCanvas(layer, s) {
    const key = layer + s;
    if (stepCache[key]) return stepCache[key];
    const c = document.createElement('canvas'); c.width = 360; c.height = 180;
    const x = c.getContext('2d'), img = x.createImageData(360, 180), d = img.data, stops = SCALES[layer].stops;
    for (let py = 0; py < 180; py++) {
      const lat = 90 - (py + 0.5);
      for (let px = 0; px < 360; px++) {
        const lng = -180 + (px + 0.5);
        const col = colorAt(stops, layerValue(layer, s, lat, lng));
        const k = (py * 360 + px) * 4;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = col[3];
      }
    }
    x.putImageData(img, 0, 0);
    return (stepCache[key] = c);
  }
  let lastDrawn = -1;
  function drawField(force) {
    if (!field || !state.grid) return;
    const t = state.tIdx;
    if (!force && Math.abs(t - lastDrawn) < 0.015) return;
    lastDrawn = t;
    const s0 = Math.floor(t), s1 = Math.min(state.grid.times.length - 1, s0 + 1), f = t - s0;
    const ctx = field.ctx;
    ctx.clearRect(0, 0, FW, FH);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const paint = c2 => {
      c2.globalAlpha = 1; c2.drawImage(stepCanvas(state.layer, s0), 0, 0, FW, FH);
      if (f > 0.02 && s1 !== s0) { c2.globalAlpha = f; c2.drawImage(stepCanvas(state.layer, s1), 0, 0, FW, FH); c2.globalAlpha = 1; }
    };
    paint(ctx);
    field.tex.needsUpdate = true;
  }

  // ---------- viento animado: cintas 3D dibujadas por la tarjeta gráfica ----------
  // Cada partícula deja una estela de TRAIL puntos convertida en una cinta con grosor real (más gruesa en
  // la punta). Solo se recalculan posiciones: sin repintar imágenes, así corre fluido en teléfonos sencillos.
  const TRAIL = 8, WR = 100 * 1.007;
  const WIND_VERT = `attribute float alpha; varying float vA;
    void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const WIND_FRAG = `uniform vec3 color; varying float vA; void main() { gl_FragColor = vec4(color * vA, vA); }`;
  let wind = null;
  function setupWind() {
    const Geo = Object.getPrototypeOf(globeMesh.geometry.constructor.prototype).constructor;       // BufferGeometry
    const Attr = Object.getPrototypeOf(globeMesh.geometry.getAttribute('position').constructor.prototype).constructor;   // BufferAttribute
    const lvl = window.TierraHD ? TierraHD.level : 0;
    const n = lvl >= 2 ? 1300 : lvl >= 1 ? 1900 : 2600;
    const segs = TRAIL - 1, verts = n * segs * 4;
    const idx = new Uint32Array(n * segs * 6);
    for (let q = 0, v = 0, o = 0; q < n * segs; q++, v += 4) { idx[o++] = v; idx[o++] = v + 1; idx[o++] = v + 2; idx[o++] = v + 2; idx[o++] = v + 1; idx[o++] = v + 3; }
    const geom = new Geo();
    const pos = new Attr(new Float32Array(verts * 3), 3), alp = new Attr(new Float32Array(verts), 1);
    geom.setAttribute('position', pos); geom.setAttribute('alpha', alp);
    geom.setIndex(new Attr(idx, 1));
    const mat = new Shader({ uniforms: { color: { value: [1, 1, 1] } }, vertexShader: WIND_VERT, fragmentShader: WIND_FRAG,
      transparent: true, depthWrite: false, blending: 2 /* aditiva */, side: 2 });
    const mesh = new globeMesh.constructor(geom, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 4;
    globeMesh.parent.add(mesh);
    wind = { n, mesh, pos, alp, mat, hist: new Float32Array(n * TRAIL * 3), head: new Int32Array(n), age: new Int32Array(n), max: new Int32Array(n),
      lat: new Float32Array(n), lng: new Float32Array(n), spd: new Float32Array(n) };
    for (let i = 0; i < n; i++) respawn(i, true);
    setWindColor();
  }
  function xyz(lat, lng, out, o) {
    const phi = (90 - lat) * D2R, th = (90 - lng) * D2R, s = Math.sin(phi);
    out[o] = WR * s * Math.cos(th); out[o + 1] = WR * Math.cos(phi); out[o + 2] = WR * s * Math.sin(th);
  }
  function respawn(i, first) {
    const W = wind;
    W.lat[i] = Math.asin(2 * Math.random() - 1) * R2D * 0.97; W.lng[i] = Math.random() * 360 - 180;
    W.age[i] = first ? Math.floor(Math.random() * 80) : 0; W.max[i] = 70 + Math.floor(Math.random() * 90);
    W.head[i] = 0;
    const base = i * TRAIL * 3;
    for (let k = 0; k < TRAIL; k++) xyz(W.lat[i], W.lng[i], W.hist, base + k * 3);
  }
  function setWindColor() {
    if (!wind) return;
    wind.mat.uniforms.color.value = state.layer === 'humedad' ? [0.75, 0.88, 1] : [1, 1, 1];
    wind.mesh.visible = !!state.settings.particles;
  }
  function stepWind() {
    const W = wind, g = state.grid;
    if (!W || !g || !W.mesh.visible) return;
    const t = state.tIdx, k = 0.016, P = W.pos.array, A = W.alp.array, H = W.hist;
    // grosor en unidades del globo: constante en pantalla aunque acerques o alejes la cámara
    const alt = globe.pointOfView().altitude, wid = 0.16 + 0.2 * alt;
    let v = 0;
    for (let i = 0; i < W.n; i++) {
      if (++W.age[i] > W.max[i]) respawn(i, false);
      const la = W.lat[i], lo = W.lng[i];
      const u = sampleT('u', t, la, lo), vv = sampleT('v', t, la, lo), sp = Math.hypot(u, vv);
      if (sp < 0.5 || la > 84 || la < -84) respawn(i, false);
      else {
        const cl = Math.max(0.2, Math.cos(la * D2R));
        let nl = lo + u * k / cl; if (nl > 180) nl -= 360; else if (nl < -180) nl += 360;
        W.lat[i] = la + vv * k; W.lng[i] = nl; W.spd[i] = sp;
        const h = (W.head[i] + 1) % TRAIL; W.head[i] = h;
        xyz(W.lat[i], W.lng[i], H, (i * TRAIL + h) * 3);
      }
      const life = Math.max(0, Math.min(1, W.age[i] / 14, (W.max[i] - W.age[i]) / 14));
      const bright = Math.min(1, 0.4 + W.spd[i] / 40) * life;
      const base = i * TRAIL * 3;
      for (let s = 0; s < TRAIL - 1; s++) {
        const a = (W.head[i] - s + TRAIL) % TRAIL, b = (a - 1 + TRAIL) % TRAIL;
        const pa = base + a * 3, pb = base + b * 3;
        const ax = H[pa], ay = H[pa + 1], az = H[pa + 2], bx = H[pb], by = H[pb + 1], bz = H[pb + 2];
        // lado de la cinta: perpendicular al tramo y a la vertical del lugar
        let dx = ax - bx, dy = ay - by, dz = az - bz;
        let sx = dy * az - dz * ay, sy = dz * ax - dx * az, sz = dx * ay - dy * ax;
        const sl = Math.hypot(sx, sy, sz) || 1;
        const wa = wid * (1 - s / (TRAIL - 1) * 0.75) / sl, wb = wid * (1 - (s + 1) / (TRAIL - 1) * 0.75) / sl;
        const fa = bright * (1 - s / (TRAIL - 1)), fb = bright * (1 - (s + 1) / (TRAIL - 1));
        let o = v * 3;
        P[o] = ax + sx * wa; P[o + 1] = ay + sy * wa; P[o + 2] = az + sz * wa;
        P[o + 3] = ax - sx * wa; P[o + 4] = ay - sy * wa; P[o + 5] = az - sz * wa;
        P[o + 6] = bx + sx * wb; P[o + 7] = by + sy * wb; P[o + 8] = bz + sz * wb;
        P[o + 9] = bx - sx * wb; P[o + 10] = by - sy * wb; P[o + 11] = bz - sz * wb;
        A[v] = fa; A[v + 1] = fa; A[v + 2] = fb; A[v + 3] = fb;
        v += 4;
      }
    }
    W.pos.needsUpdate = true; W.alp.needsUpdate = true;
  }
  function seedParticles() { if (wind) for (let i = 0; i < wind.n; i++) respawn(i, true); }
  let frameNo = 0;
  function frame() {
    requestAnimationFrame(frame);
    frameNo++;
    if (state.playing && state.grid) {
      state.tIdx += 0.035;
      if (state.tIdx > state.grid.times.length - 1) state.tIdx = state.nowIdx;
      if (frameNo % 3 === 0) updateTimeline();
    }
    if (frameNo % 10 === 0) updateLabels(false);
    if (frameNo % 6 === 0) cullLabels();
    // la capa de color se repinta solo cuando cambia la hora (y como mucho cada 3 cuadros al reproducir)
    if (!state.playing || frameNo % 3 === 0) drawField(false);
    stepWind();
  }

  // ---------- línea de tiempo ----------
  function nowIndex(g) {
    const now = Date.now();
    let best = 0;
    for (let i = 0; i < g.times.length; i++) if (g.times[i] <= now + 90 * 60000) best = i;
    const f = Math.max(0, Math.min(0.99, (now - g.times[best]) / ((g.times[best + 1] || g.times[best] + 3 * 36e5) - g.times[best])));
    return best + f;
  }
  function tAt(idx) {
    const g = state.grid, s0 = Math.floor(idx), s1 = Math.min(g.times.length - 1, s0 + 1);
    return g.times[s0] + (g.times[s1] - g.times[s0]) * (idx - s0);
  }
  function updateTimeline() {
    const g = state.grid; if (!g) return;
    const r = $('#tl-range'), t = tAt(state.tIdx);
    r.max = g.times.length - 1; r.value = state.tIdx;
    r.style.setProperty('--p', (state.tIdx / (g.times.length - 1) * 100).toFixed(1) + '%');
    const isNow = Math.abs(state.tIdx - state.nowIdx) < 0.12;
    $('#tl-time').textContent = isNow ? `Ahora · ${fmtTime(Date.now())}` : `${fmtDay(t)} · ${fmtTime(Math.round(t / 36e5) * 36e5)}`;
    $('#play').innerHTML = I.ui(state.playing ? 'pause' : 'play');
  }
  function renderTimelineDays() {
    const g = state.grid; if (!g) return;
    const labels = [];
    const h = Math.round((g.times[g.times.length - 1] - g.times[0]) / 36e5);
    for (let k = 0; k <= 4; k++) labels.push(k === 0 ? 'Ahora' : `+${Math.round(h * k / 4 / 3) * 3} h`);
    $('#tl-days').innerHTML = labels.map(l => `<span>${esc(l)}</span>`).join('');
    $('#tl-src').textContent = 'Pronóstico 48 h · NOAA';
  }

  // ---------- capas ----------
  const LAYERS = [['viento', 'Viento'], ['lluvia', 'Lluvia'], ['humedad', 'Humedad'], ['temp', 'Temperatura']];
  function renderLayers() {
    $('#layers').innerHTML = LAYERS.map(([id, label]) => `<button class="chip" data-layer="${id}" aria-selected="${state.layer === id}">${I.layer(id)}${label}</button>`).join('')
      + `<button class="chip" data-go="huracanes">${I.layer('huracan')}Huracanes</button>`;
    const sc = SCALES[state.layer];
    $('#scale').innerHTML = `<b>${sc.name} · ${sc.unit}</b><div class="bar" style="background:${gradCss(sc)}"></div><div class="lbl">${sc.labels.map(l => `<span>${l}</span>`).join('')}</div><p class="sdesc">${sc.desc}</p>`;
    updateLabels(true);
  }
  function setLayer(id) {
    state.layer = id; store.set('layer', id); renderLayers(); drawField(true); setWindColor();
  }

  // ---------- consulta al tocar el mapa ----------
  function probe(lat, lng) {
    state.probe = { lat, lng }; refreshHtml();
    const label = placeLabel(lat, lng);
    let quick = '';
    if (state.grid) {
      const t = state.tIdx, u = sampleT('u', t, lat, lng), v = sampleT('v', t, lat, lng);
      quick = `<div class="stat-grid">
        <div class="stat">${I.ui('temp')}<span><small>Temperatura</small><b>${Math.round(sampleT('t', t, lat, lng))}<i>°C</i></b></span></div>
        <div class="stat">${I.ui('wind')}<span><small>Viento</small><b>${Math.round(Math.hypot(u, v))}<i>km/h ${dirTxt(Math.atan2(-u, -v) * R2D)}</i></b></span></div>
        <div class="stat">${I.ui('rain')}<span><small>Lluvia 3 h</small><b>${(sampleT('p', t, lat, lng) / 10).toFixed(1).replace('.', ',')}<i>mm</i></b></span></div>
        <div class="stat">${I.ui('drop')}<span><small>Humedad</small><b>${Math.round(sampleT('h', t, lat, lng))}<i>%</i></b></span></div></div>`;
    }
    openSheet({
      title: label, sub: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'O'} · a la hora del mapa`, probe: true,
      render: body => {
        body.innerHTML = quick + '<div id="pr-fc"><div class="spinner"></div></div>';
        loadForecast({ lat, lng, name: label }).then(fc => {
          const el = $('#pr-fc'); if (!el) return;
          // El pronóstico exacto del punto reemplaza los valores aproximados del mapa
          body.innerHTML = `<div id="pr-fc">${forecastBlocks(fc, { lat, lng, name: label }, true)}<button class="btn primary block" id="pr-save">${I.ui('plus')}Guardar este lugar</button></div>`;
          $('#sheet-sub').textContent = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'O'} · pronóstico exacto de este punto`;
          $('#pr-save').onclick = () => addPlace({ lat: +lat.toFixed(3), lng: +lng.toFixed(3), name: label.replace(/\s\S+$/u, '') || label });
        }).catch(() => { const el = $('#pr-fc'); if (el) el.innerHTML = '<div class="empty">No se pudo cargar el pronóstico de este punto.</div>'; });
      }
    });
  }

  // ---------- pronóstico de un lugar ----------
  const fcKey = p => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
  // Zona horaria del lugar (para mostrar sus horas y agrupar los días): país → zona; si no, por longitud
  const TZ = { co: 'America/Bogota', ar: 'America/Argentina/Buenos_Aires', cl: 'America/Santiago', pe: 'America/Lima', ec: 'America/Guayaquil',
    ve: 'America/Caracas', bo: 'America/La_Paz', py: 'America/Asuncion', uy: 'America/Montevideo', cr: 'America/Costa_Rica', pa: 'America/Panama',
    gt: 'America/Guatemala', hn: 'America/Tegucigalpa', sv: 'America/El_Salvador', ni: 'America/Managua', do: 'America/Santo_Domingo',
    pr: 'America/Puerto_Rico', cu: 'America/Havana', jm: 'America/Jamaica', ht: 'America/Port-au-Prince', tt: 'America/Port_of_Spain',
    pt: 'Europe/Lisbon', gb: 'Europe/London', ie: 'Europe/Dublin', fr: 'Europe/Paris', de: 'Europe/Berlin', it: 'Europe/Rome', nl: 'Europe/Amsterdam',
    be: 'Europe/Brussels', ch: 'Europe/Zurich', at: 'Europe/Vienna', se: 'Europe/Stockholm', no: 'Europe/Oslo', dk: 'Europe/Copenhagen',
    fi: 'Europe/Helsinki', pl: 'Europe/Warsaw', cz: 'Europe/Prague', gr: 'Europe/Athens', tr: 'Europe/Istanbul', ua: 'Europe/Kyiv',
    ro: 'Europe/Bucharest', hu: 'Europe/Budapest', il: 'Asia/Jerusalem', ae: 'Asia/Dubai', sa: 'Asia/Riyadh', eg: 'Africa/Cairo',
    za: 'Africa/Johannesburg', ng: 'Africa/Lagos', ke: 'Africa/Nairobi', ma: 'Africa/Casablanca', in: 'Asia/Kolkata', pk: 'Asia/Karachi',
    ph: 'Asia/Manila', th: 'Asia/Bangkok', vn: 'Asia/Ho_Chi_Minh', my: 'Asia/Kuala_Lumpur', sg: 'Asia/Singapore', jp: 'Asia/Tokyo', kr: 'Asia/Seoul',
    cn: 'Asia/Shanghai', tw: 'Asia/Taipei', hk: 'Asia/Hong_Kong', nz: 'Pacific/Auckland', ma2: '' };
  function tzOf(p) {
    const cc = (countryAt(p.lat, p.lng) || '').toLowerCase(), x = p.lng, y = p.lat;
    if (cc === 'us') return x < -160 ? 'Pacific/Honolulu' : y > 51 && x < -130 ? 'America/Anchorage' : x < -114.5 ? 'America/Los_Angeles' : x < -101.5 ? 'America/Denver' : x < -85.5 ? 'America/Chicago' : 'America/New_York';
    if (cc === 'mx') return x < -114 ? 'America/Tijuana' : x < -104.5 ? 'America/Mazatlan' : x > -87.5 ? 'America/Cancun' : 'America/Mexico_City';
    if (cc === 'ca') return x < -120 ? 'America/Vancouver' : x < -110 ? 'America/Edmonton' : x < -90 ? 'America/Winnipeg' : x < -63 ? 'America/Toronto' : x < -57 ? 'America/Halifax' : 'America/St_Johns';
    if (cc === 'br') return x < -67.5 ? 'America/Rio_Branco' : x < -60 ? 'America/Manaus' : 'America/Sao_Paulo';
    if (cc === 'es') return x < -13 ? 'Atlantic/Canary' : 'Europe/Madrid';
    if (cc === 'au') return x < 129 ? 'Australia/Perth' : x < 141 ? (y < -26 ? 'Australia/Adelaide' : 'Australia/Darwin') : y > -29 ? 'Australia/Brisbane' : 'Australia/Sydney';
    if (cc === 'id') return x < 115 ? 'Asia/Jakarta' : x < 129 ? 'Asia/Makassar' : 'Asia/Jayapura';
    if (cc === 'ru') return x < 22 ? 'Europe/Kaliningrad' : x < 50 ? 'Europe/Moscow' : x < 66 ? 'Asia/Yekaterinburg' : x < 90 ? 'Asia/Novosibirsk' : x < 120 ? 'Asia/Irkutsk' : x < 140 ? 'Asia/Vladivostok' : 'Asia/Magadan';
    if (TZ[cc]) return TZ[cc];
    if (state.me && p.lat === state.me.lat && p.lng === state.me.lng) { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* sigue */ } }
    const h = Math.round(x / 15);
    return h === 0 ? 'Etc/GMT' : `Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}`;
  }
  /** Diferencia de una zona horaria con UTC (segundos) en un instante; tiene en cuenta el horario de verano. */
  function offsetSec(tz, t) {
    try {
      const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      const o = {}; for (const x of f.formatToParts(new Date(t))) o[x.type] = x.value;
      return Math.round((Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute) - Math.floor(t / 60000) * 60000) / 1000);
    } catch (e) { return 0; }
  }
  // Símbolos de MET Norway → códigos WMO (los que usan los iconos)
  function symToWmo(sym) {
    const k = String(sym || '').replace(/_(day|night|polartwilight)$/, '');
    if (/thunder/.test(k)) return /heavy/.test(k) ? 99 : 95;
    return ({ clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45, lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 81,
      heavyrainshowers: 82, lightsleet: 66, sleet: 66, heavysleet: 67, lightsleetshowers: 66, sleetshowers: 66, heavysleetshowers: 67,
      lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86 })[k] ?? 3;
  }
  // Altura del Sol (grados) en un lugar y momento: para saber si es de día y calcular amanecer y atardecer
  function sunElev(lat, lng, t) {
    const [slng, slat] = sunPosition(new Date(t));
    const r = D2R, c = Math.sin(lat * r) * Math.sin(slat * r) + Math.cos(lat * r) * Math.cos(slat * r) * Math.cos((lng - slng) * r);
    return Math.asin(Math.max(-1, Math.min(1, c))) * R2D;
  }
  function sunEvent(lat, lng, dayStartUtc, rising) {
    // busca el cruce de −0,83° en el día (pasos de 10 min y luego refina)
    let prev = sunElev(lat, lng, dayStartUtc) > -0.83;
    for (let m = 10; m <= 1440; m += 10) {
      const t = dayStartUtc + m * 60000, up = sunElev(lat, lng, t) > -0.83;
      if (up !== prev && up === rising) {
        let a = t - 600000, b = t;
        for (let k = 0; k < 10; k++) { const mid = (a + b) / 2; if ((sunElev(lat, lng, mid) > -0.83) === rising) b = mid; else a = mid; }
        return b;
      }
      prev = up;
    }
    return null;
  }
  /** Pronóstico de MET Norway convertido al formato que dibuja la app. */
  async function loadForecast(p) {
    const j = await getJSON(`${MET}?lat=${p.lat.toFixed(3)}&lon=${p.lng.toFixed(3)}`, 45);
    const ts = j.properties.timeseries;
    const tz = tzOf(p), off = offsetSec(tz, Date.parse(ts[0].time));
    const loc = t => new Date(t + off * 1000).toISOString().slice(0, 16);
    const kmh = x => x == null ? null : x * 3.6;
    const isDay = t => sunElev(p.lat, p.lng, t) > -0.83 ? 1 : 0;
    const now = ts[0], ni = now.data.instant.details, n1 = now.data.next_1_hours || now.data.next_6_hours || {};
    const current = { temperature_2m: ni.air_temperature, apparent_temperature: ni.apparent_air_temperature ?? ni.air_temperature,
      relative_humidity_2m: ni.relative_humidity, weather_code: symToWmo(n1.summary && n1.summary.symbol_code), is_day: isDay(Date.parse(now.time)),
      wind_speed_10m: kmh(ni.wind_speed), wind_direction_10m: ni.wind_from_direction, wind_gusts_10m: kmh(ni.wind_speed_of_gust),
      precipitation: (n1.details && n1.details.precipitation_amount) || 0, pressure_msl: ni.air_pressure_at_sea_level, cloud_cover: ni.cloud_area_fraction,
      uv_index: ni.ultraviolet_index_clear_sky, dew_point: ni.dew_point_temperature };
    const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], precipitation: [], is_day: [], wind_gusts_10m: [] };
    for (const e of ts) {
      if (!e.data.next_1_hours || hourly.time.length >= 48) continue;
      const t = Date.parse(e.time), d = e.data.instant.details, h1 = e.data.next_1_hours;
      hourly.time.push(loc(t)); hourly.temperature_2m.push(d.air_temperature); hourly.weather_code.push(symToWmo(h1.summary.symbol_code));
      hourly.precipitation_probability.push(h1.details.probability_of_precipitation ?? null);
      hourly.precipitation.push(h1.details.precipitation_amount || 0); hourly.is_day.push(isDay(t)); hourly.wind_gusts_10m.push(kmh(d.wind_speed_of_gust));
    }
    // Días (hora local del lugar)
    const days = new Map(); let covered = 0;
    for (const e of ts) {
      const t = Date.parse(e.time), key = loc(t).slice(0, 10), d = e.data.instant.details;
      let D = days.get(key);
      if (!D) days.set(key, D = { n: 0, max: -1e9, min: 1e9, rain: 0, pp: null, wmax: 0, gmax: null, uv: 0, sym: null, symD: 1e9, worst: 0 });
      D.n++; D.max = Math.max(D.max, d.air_temperature); D.min = Math.min(D.min, d.air_temperature);
      D.wmax = Math.max(D.wmax, kmh(d.wind_speed) || 0); if (d.wind_speed_of_gust != null) D.gmax = Math.max(D.gmax || 0, kmh(d.wind_speed_of_gust));
      D.uv = Math.max(D.uv, d.ultraviolet_index_clear_sky || 0);
      const n6 = e.data.next_6_hours, n1h = e.data.next_1_hours;
      if (n6 && n6.details) { if (n6.details.air_temperature_max != null) D.max = Math.max(D.max, n6.details.air_temperature_max); if (n6.details.air_temperature_min != null) D.min = Math.min(D.min, n6.details.air_temperature_min); }
      if (t >= covered) {
        if (n1h) { D.rain += n1h.details.precipitation_amount || 0; covered = t + 3600e3; }
        else if (n6) { D.rain += n6.details.precipitation_amount || 0; covered = t + 6 * 3600e3; }
      }
      const prob = (n1h && n1h.details.probability_of_precipitation) ?? (n6 && n6.details.probability_of_precipitation);
      if (prob != null) D.pp = Math.max(D.pp || 0, prob);
      const sym = (n6 || n1h || e.data.next_12_hours || {}).summary;
      if (sym) {
        const hour = +loc(t).slice(11, 13), dist = Math.abs(hour - 11);
        const code = symToWmo(sym.symbol_code);
        if (dist < D.symD) { D.symD = dist; D.sym = code; }
        if (code >= 95) D.worst = code;
      }
    }
    const daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [], precipitation_probability_max: [],
      wind_speed_10m_max: [], wind_gusts_10m_max: [], sunrise: [], sunset: [], uv_index_max: [] };
    for (const [key, D] of days) {
      if (D.n < 2 && daily.time.length) continue;
      const start = Date.parse(key + 'T00:00:00Z') - off * 1000;
      const rise = sunEvent(p.lat, p.lng, start, true), set = sunEvent(p.lat, p.lng, start, false);
      daily.time.push(key); daily.weather_code.push(D.worst || (D.sym ?? 3)); daily.temperature_2m_max.push(D.max); daily.temperature_2m_min.push(D.min);
      daily.precipitation_sum.push(D.rain); daily.precipitation_probability_max.push(D.pp); daily.wind_speed_10m_max.push(D.wmax); daily.wind_gusts_10m_max.push(D.gmax);
      daily.sunrise.push(rise ? loc(rise) : ''); daily.sunset.push(set ? loc(set) : ''); daily.uv_index_max.push(D.uv);
      if (daily.time.length >= 10) break;
    }
    const fc = { utc_offset_seconds: off, timezone: tz, current, hourly, daily };
    state.fc[fcKey(p)] = fc;
    return fc;
  }
  const localTime = (fc, iso) => Date.parse(iso + ':00Z') - (fc.utc_offset_seconds || 0) * 1000;   // hora local del lugar → instante real
  function uvTxt(u) { return u < 3 ? 'Bajo' : u < 6 ? 'Moderado' : u < 8 ? 'Alto' : u < 11 ? 'Muy alto' : 'Extremo'; }
  function forecastBlocks(fc, p, compact) {
    const c = fc.current, d = fc.daily, h = fc.hourly;
    const now = Date.now();
    let start = h.time.findIndex(t => localTime(fc, t) > now - 3600e3); if (start < 0) start = 0;
    const hours = h.time.slice(start, start + 24).map((t, k) => {
      const i = start + k;
      const pp = h.precipitation_probability[i], mm = h.precipitation[i];
      return `<div class="hour ${k === 0 ? 'now' : ''}"><small>${k === 0 ? 'Ahora' : +t.slice(11, 13) + 'h'}</small>${I.weather(h.weather_code[i], !!h.is_day[i], 38)}
        <b>${Math.round(h.temperature_2m[i])}°</b><span class="pp">${pp != null ? (pp >= 20 ? pp + '%' : '') : mm >= 0.1 ? mm.toFixed(1).replace('.', ',') + ' mm' : ''}</span></div>`;
    }).join('');
    const tmin = Math.min(...d.temperature_2m_min), tmax = Math.max(...d.temperature_2m_max), span = Math.max(1, tmax - tmin);
    const days = d.time.map((t, i) => {
      const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
      const left = (lo - tmin) / span * 100, w = Math.max(6, (hi - lo) / span * 100);
      const pp = d.precipitation_probability_max[i], mm = d.precipitation_sum[i];
      const rain = pp != null ? (pp >= 20 ? '💧 ' + pp + '%' : '') : mm >= 0.5 ? '💧 ' + (mm < 10 ? mm.toFixed(1).replace('.', ',') : Math.round(mm)) + ' mm' : '';
      return `<div class="day"><span>${i === 0 ? 'Hoy' : cap(new Date(t + 'T12:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' }).replace('.', ''))}<small>${rain}</small></span>
        ${I.weather(d.weather_code[i], true, 38)}
        <div class="range"><span>${Math.round(lo)}°</span><div class="rb"><i style="left:${left.toFixed(0)}%;width:${w.toFixed(0)}%;background:linear-gradient(90deg, rgba(${colorAt(SCALES.temp.stops, lo).slice(0, 3).map(Math.round)}), rgba(${colorAt(SCALES.temp.stops, hi).slice(0, 3).map(Math.round)}))"></i></div><span>${Math.round(hi)}°</span></div></div>`;
    }).join('');
    return `
      <div class="wx-hero">${I.weather(c.weather_code, !!c.is_day, 96)}<div><div class="big">${Math.round(c.temperature_2m)}<sup>°C</sup></div>
        <b>${esc(I.WMO[c.weather_code] || '')}</b><small>Sensación ${Math.round(c.apparent_temperature)}° · Máx ${Math.round(d.temperature_2m_max[0])}° · Mín ${Math.round(d.temperature_2m_min[0])}°</small></div></div>
      <div class="stat-grid">
        <div class="stat">${I.ui('wind')}<span><small>Viento</small><b>${Math.round(c.wind_speed_10m)}<i>km/h ${dirTxt(c.wind_direction_10m)}</i></b></span></div>
        <div class="stat">${I.ui('wind')}<span><small>Ráfagas</small><b>${c.wind_gusts_10m != null ? Math.round(c.wind_gusts_10m) + '<i>km/h</i>' : Math.round(d.wind_speed_10m_max[0]) + '<i>km/h máx.</i>'}</b></span></div>
        <div class="stat">${I.ui('drop')}<span><small>Humedad</small><b>${Math.round(c.relative_humidity_2m)}<i>%</i></b></span></div>
        <div class="stat">${I.ui('rain')}<span><small>Lluvia hoy</small><b>${d.precipitation_sum[0].toFixed(1).replace('.', ',')}<i>mm</i></b></span></div>
        ${compact ? '' : `<div class="stat">${I.ui('uv')}<span><small>UV (cielo despejado)</small><b>${Math.round(d.uv_index_max[0])}<i>${uvTxt(d.uv_index_max[0])}</i></b></span></div>
        <div class="stat">${I.ui('gauge')}<span><small>Presión</small><b>${Math.round(c.pressure_msl)}<i>hPa</i></b></span></div>
        <div class="stat">${I.ui('drop')}<span><small>Punto de rocío</small><b>${c.dew_point != null ? Math.round(c.dew_point) : '—'}<i>°C</i></b></span></div>
        <div class="stat">${I.ui('cloud')}<span><small>Nubosidad</small><b>${c.cloud_cover != null ? Math.round(c.cloud_cover) : '—'}<i>%</i></b></span></div>
        <div class="stat">${I.ui('sunrise')}<span><small>Amanecer</small><b>${d.sunrise[0] ? d.sunrise[0].slice(11, 16) : '—'}</b></span></div>
        <div class="stat">${I.ui('sunrise')}<span><small>Atardecer</small><b>${d.sunset[0] ? d.sunset[0].slice(11, 16) : '—'}</b></span></div>`}
      </div>
      <div class="section-h"><h3>Próximas 24 horas</h3><small>Hora local · lluvia esperada</small></div>
      <div class="hours">${hours}</div>
      <div class="section-h"><h3>${d.time.length} días</h3><small>Mín · Máx</small></div>
      <div>${days}</div>`;
  }

  // ---------- lugares ----------
  const allPlaces = () => [state.me, ...state.places].filter(Boolean);
  function setMe(p) {
    state.me = p; store.set('me', p);
    refreshHtml(); syncAlerts(); updateNow();
    toast(`Tu ciudad: ${p.name}`);
  }
  function addPlace(p) {
    if (!state.me) { setMe(p); openClima(); return; }
    if (state.places.length >= 2) { toast('Puedes guardar hasta 3 lugares: borra uno primero'); return; }
    state.places.push(p); store.set('places', state.places); syncAlerts(); refreshHtml();
    state.sel = allPlaces().length - 1; toast(`Lugar guardado: ${p.name}`); openClima();
  }
  function askLocation() {
    if (NATIVE) { toast('Buscando tu ubicación…'); N.requestLocation(); return; }
    if (!navigator.geolocation) { openCityPicker(); return; }
    toast('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(p => window.__orbeLocation(p.coords.latitude, p.coords.longitude), () => { toast('Elige tu ciudad'); openCityPicker(); }, { timeout: 15000 });
  }
  window.__orbeLocation = (lat, lng) => {
    if (lat == null) { toast('Sin permiso de ubicación: elige tu ciudad'); openCityPicker(); return; }
    let best = null, bd = 60;
    for (const c of state.ciudades) { const d = distKm(lat, lng, c[2], c[3]); if (d < bd) { bd = d; best = c; } }
    const cc = countryAt(lat, lng);
    setMe({ lat: +lat.toFixed(3), lng: +lng.toFixed(3), name: best ? best[0] : cc ? `Mi ubicación (${regionName(cc)})` : 'Mi ubicación' });
    openClima();
  };
  function openCityPicker(mode = 'me') {
    openSheet({
      title: mode === 'add' ? 'Agregar un lugar' : 'Elige tu ciudad', sub: 'Escribe cualquier ciudad del mundo',
      render: body => {
        body.innerHTML = `<form class="search" id="cf">${I.ui('search')}<input id="cq" type="search" enterkeyhint="search" placeholder="Bogotá, Lima, Madrid…" autocomplete="off"><button class="btn" style="height:36px;padding:0 12px">Buscar</button></form>
          ${mode === 'me' ? `<button class="btn block" id="c-gps" style="margin-bottom:10px">${I.ui('gps')}Usar mi ubicación</button>` : ''}<div id="c-res"></div>`;
        const res = $('#c-res'), input = $('#cq');
        const pick = c => { const p = { lat: c[2], lng: c[3], name: c[0] }; if (mode === 'add') addPlace(p); else { setMe(p); openClima(); } };
        const draw = list => {
          res.innerHTML = list.map((c, k) => `<button class="row-card" data-c="${k}"><span style="font-size:24px">${flag(c[1])}</span><div class="meta"><div class="name">${esc(c[0])}</div><div class="sub">${esc(typeof c[4] === 'string' ? c[4] : regionName(c[1]))}</div></div></button>`).join('') || '<div class="empty">Sin resultados</div>';
          res.querySelectorAll('[data-c]').forEach(b => b.onclick = () => pick(list[+b.dataset.c]));
        };
        draw(state.ciudades.slice(0, 60));
        const g = $('#c-gps'); if (g) g.onclick = askLocation;
        const fold = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        input.addEventListener('input', () => {
          const v = input.value.trim(), fv = fold(v);
          const hits = v ? state.ciudades.filter(c => fold(c[0]).includes(fv) || fold(regionName(c[1]) || '').startsWith(fv)) : state.ciudades;
          hits.sort((a, b) => (fold(b[0]).startsWith(fv) - fold(a[0]).startsWith(fv)) || ((b[4] || 0) - (a[4] || 0)));
          draw(hits.slice(0, 80));
        });
        // Cualquier ciudad del mundo: OpenStreetMap (una búsqueda por toque, como pide su política de uso)
        $('#cf').addEventListener('submit', e => {
          e.preventDefault();
          const v = input.value.trim(); if (v.length < 2) return;
          res.innerHTML = '<div class="spinner"></div>';
          getJSON(`${NOMINATIM}?q=${encodeURIComponent(v)}&format=jsonv2&limit=10&accept-language=es&addressdetails=1`, 1440)
            .then(j => draw(j.filter(r => r.lat && r.lon).map(r => [r.name || r.display_name.split(',')[0], ((r.address || {}).country_code || '').toUpperCase(), +(+r.lat).toFixed(3), +(+r.lon).toFixed(3),
              r.display_name.split(',').slice(1).map(x => x.trim()).filter(Boolean).slice(-3).join(', ')])
              // la misma ciudad suele venir repetida (ciudad, provincia, región): dejamos una
              .filter((c, k, all) => all.findIndex(o => fold(o[0]) === fold(c[0]) && o[1] === c[1]) === k)))
            .catch(() => { res.innerHTML = '<div class="empty">No se pudo buscar. Revisa tu conexión.</div>'; });
          input.blur();
        });
        setTimeout(() => input.focus(), 350);
      }
    });
  }

  // ---------- cabecera: el tiempo ahora ----------
  async function updateNow() {
    if (!state.me) return;
    try {
      const fc = await loadForecast(state.me), c = fc.current, d = fc.daily;
      $('#now-ico').innerHTML = I.weather(c.weather_code, !!c.is_day, 62);
      $('#now-temp').innerHTML = `${Math.round(c.temperature_2m)}<sup>°</sup>`;
      $('#now-place').textContent = state.me.name;
      $('#now-desc').textContent = I.WMO[c.weather_code] || '';
      $('#now-sub').innerHTML = `Máx <em>${Math.round(d.temperature_2m_max[0])}°</em> · Mín <em>${Math.round(d.temperature_2m_min[0])}°</em> · 💨 <em>${Math.round(c.wind_speed_10m)}</em> km/h${d.precipitation_sum[0] >= 0.5 ? ` · 💧 <em>${d.precipitation_sum[0] < 10 ? d.precipitation_sum[0].toFixed(1).replace('.', ',') : Math.round(d.precipitation_sum[0])}</em> mm` : ''}`;
    } catch (e) { /* sin conexión */ }
  }
  function tickClock() {
    const d = new Date();
    $('#clock').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' }).replace(/\./g, '')}`;
  }

  // ---------- hoja (pestañas) ----------
  function openSheet(cfg) {
    state.sheet = cfg;
    $('#sheet-title').textContent = cfg.title;
    $('#sheet-sub').textContent = cfg.sub || '';
    const tabs = cfg.tabs || [{ id: 'main', render: cfg.render }];
    cfg.tabs = tabs;
    $('#sheet-tabs').innerHTML = tabs.length > 1 ? tabs.map(t => `<button class="tab" data-tab="${t.id}">${esc(t.label)}</button>`).join('') : '';
    showTab(cfg.active || tabs[0].id);
    $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false');
    $('#timeline').classList.add('hide'); $('#scale').classList.add('hide');
  }
  function showTab(id) {
    const cfg = state.sheet; if (!cfg) return;
    const t = cfg.tabs.find(x => x.id === id) || cfg.tabs[0];
    cfg.active = t.id;
    document.querySelectorAll('#sheet-tabs .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t.id)));
    const body = $('#sheet-body'); body.scrollTop = 0;
    t.render(body);
  }
  const rerender = () => { if (state.sheet) showTab(state.sheet.active); };
  function closeSheet(silent) {
    $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true');
    $('#timeline').classList.remove('hide'); $('#scale').classList.remove('hide');
    if (state.sheet && state.sheet.probe) { state.probe = null; refreshHtml(); }
    state.sheet = null;
    if (!silent) selectTab('mapa', true);
  }
  const isOpen = () => $('#sheet').classList.contains('open');
  function selectTab(tab, silent) {
    document.querySelectorAll('#tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (silent) return;
    if (tab === 'mapa') { if (isOpen()) closeSheet(true); return; }
    ({ clima: openClima, huracanes: openStorms, alertas: openAlerts })[tab]();
  }
  window.orbeOpen = tab => { if (['clima', 'huracanes', 'alertas'].includes(tab)) selectTab(tab); };
  window.orbeBack = () => { if (isOpen()) { closeSheet(); return true; } return false; };

  // ---------- Mi clima ----------
  function openClima() {
    selectTab('clima', true);
    const list = allPlaces();
    if (!list.length) { openCityPicker('me'); return; }
    state.sel = Math.min(state.sel, list.length - 1);
    const p = list[state.sel];
    openSheet({
      title: p.name, sub: state.sel === 0 ? 'Tu ciudad · pronóstico de MET Norway' : 'Lugar guardado · pronóstico de MET Norway',
      render: body => {
        body.innerHTML = `<div class="place-chips">${list.map((x, i) => `<button class="chip" data-pl="${i}" aria-selected="${i === state.sel}">${i === 0 ? '📍' : '⭐'} ${esc(x.name)}</button>`).join('')}
            ${list.length < 3 ? `<button class="chip" id="pl-add">${I.ui('plus')}Agregar</button>` : ''}</div><div id="fc-body"><div class="spinner"></div></div>`;
        body.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => { state.sel = +b.dataset.pl; openClima(); });
        const add = $('#pl-add'); if (add) add.onclick = () => openCityPicker('add');
        loadForecast(p).then(fc => {
          const el = $('#fc-body'); if (!el) return;
          const alerts = alertsFor(p, fc);
          el.innerHTML = (alerts.length ? alerts.map(alertCard).join('') : '') + forecastBlocks(fc, p, false) + `
            <div class="btn-row"><button class="btn" id="fc-map">${I.ui('pin')}Ver en el mapa</button><button class="btn" id="fc-share">${I.ui('share')}Compartir</button>
            ${state.sel > 0 ? `<button class="btn" id="fc-del">${I.ui('trash')}</button>` : `<button class="btn" id="fc-chg">Cambiar</button>`}</div>
            <p class="about">Pronóstico: MET Norway (Instituto Meteorológico de Noruega, CC BY 4.0). Horas en la hora local del lugar.</p>`;
          $('#fc-map').onclick = () => { closeSheet(); globe.controls().autoRotate = false; globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 0.9 }, 1400); };
          $('#fc-share').onclick = () => {
            const c = fc.current, d = fc.daily;
            const txt = `${p.name}: ${Math.round(c.temperature_2m)} °C, ${(I.WMO[c.weather_code] || '').toLowerCase()}. Hoy máx ${Math.round(d.temperature_2m_max[0])}° y mín ${Math.round(d.temperature_2m_min[0])}°${d.precipitation_probability_max[0] >= 20 ? `, ${d.precipitation_probability_max[0]}% de probabilidad de lluvia` : ''}. Pronóstico de Orbe Clima.`;
            if (NATIVE) N.share(txt); else if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast(txt, 5000);
          };
          const del = $('#fc-del'); if (del) del.onclick = () => { state.places.splice(state.sel - 1, 1); store.set('places', state.places); state.sel = 0; syncAlerts(); refreshHtml(); openClima(); };
          const chg = $('#fc-chg'); if (chg) chg.onclick = () => openCityPicker('me');
        }).catch(() => { const el = $('#fc-body'); if (el) el.innerHTML = '<div class="empty">No se pudo cargar el pronóstico. Revisa tu conexión.</div>'; });
      }
    });
  }

  // ---------- alertas ----------
  function alertsFor(p, fc) {
    const out = [], h = fc.hourly, d = fc.daily, now = Date.now(), a = state.alerts;
    let start = h.time.findIndex(t => localTime(fc, t) > now - 3600e3); if (start < 0) start = 0;
    let sum = 0, maxRate = 0, gust = 0, storm = -1;
    for (let i = start; i < Math.min(h.time.length, start + 24); i++) {
      sum += h.precipitation[i] || 0; maxRate = Math.max(maxRate, h.precipitation[i] || 0); gust = Math.max(gust, h.wind_gusts_10m[i] || 0);
      if (storm < 0 && i - start < 12 && [95, 96, 99].includes(h.weather_code[i])) storm = i - start;
    }
    if (a.rain && (sum >= 50 || maxRate >= 15)) out.push({ lvl: 'red', ico: '🌧️', t: `Lluvia muy fuerte en ${p.name}`, d: `Se esperan ${Math.round(sum)} mm en 24 horas (hasta ${Math.round(maxRate)} mm en una hora). Atento a inundaciones y deslizamientos.` });
    else if (a.rain && sum >= 20) out.push({ lvl: 'orange', ico: '🌧️', t: `Lluvia fuerte en ${p.name}`, d: `Se esperan ${Math.round(sum)} mm en las próximas 24 horas.` });
    if (a.storm && storm >= 0) out.push({ lvl: 'orange', ico: '⛈️', t: `Tormenta eléctrica en ${p.name}`, d: `Posibles tormentas con rayos ${storm <= 1 ? 'en la próxima hora' : `en unas ${storm} horas`}. Busca refugio bajo techo.` });
    if (a.wind && gust >= 70) out.push({ lvl: gust >= 90 ? 'red' : 'orange', ico: '💨', t: `Viento fuerte en ${p.name}`, d: `Ráfagas de hasta ${Math.round(gust)} km/h en las próximas 24 horas.` });
    if (a.heat && d.temperature_2m_max[0] >= 38) out.push({ lvl: 'red', ico: '🌡️', t: `Calor extremo en ${p.name}`, d: `Máxima de ${Math.round(d.temperature_2m_max[0])} °C. Toma agua y evita el sol del mediodía.` });
    if (a.cold && d.temperature_2m_min[0] <= -5) out.push({ lvl: 'orange', ico: '🥶', t: `Frío extremo en ${p.name}`, d: `Mínima de ${Math.round(d.temperature_2m_min[0])} °C.` });
    if (a.hurricane && state.storms) for (const s of state.storms.filter(x => x.current)) {
      const dk = distKm(s.lat, s.lng, p.lat, p.lng);
      if (dk <= a.radius) out.push({ lvl: 'red', ico: '🌀', t: `${s.kind} ${s.name} a ${nf.format(Math.round(dk))} km de ${p.name}`, d: `Vientos de hasta ${Math.round(s.wind)} km/h. Sigue las indicaciones de las autoridades.` });
    }
    return out;
  }
  const alertCard = a => `<div class="alert-card ${a.lvl}"><span class="ai">${a.ico}</span><div><b>${esc(a.t)}</b><p>${esc(a.d)}</p></div></div>`;
  function syncAlerts() {
    store.set('alerts', state.alerts);
    if (NATIVE && typeof N.setAlertSettings === 'function') {
      try { N.setAlertSettings(JSON.stringify(Object.assign({}, state.alerts, { places: allPlaces() }))); } catch (e) { /* nada */ }
    }
  }
  function openAlerts() {
    selectTab('alertas', true);
    openSheet({
      title: 'Alertas del clima', sub: 'Te avisamos aunque la app esté cerrada',
      render: body => {
        const a = state.alerts;
        const tog = (k, t, sub) => `<button class="toggle" data-al="${k}" role="switch" aria-checked="${!!a[k]}"><span><b>${t}</b><span class="t-sub">${sub}</span></span><span class="switch"></span></button>`;
        body.innerHTML = `<div id="al-now"><div class="spinner"></div></div>
          <div class="section-h"><h3>Qué quieres que te avisemos</h3><small>Revisamos cada hora</small></div>
          ${tog('rain', '🌧️ Lluvia muy fuerte', '50 mm o más en 24 horas, o 15 mm en una hora')}
          ${tog('storm', '⛈️ Tormentas eléctricas', 'Rayos y tormentas en las próximas 12 horas')}
          ${tog('wind', '💨 Viento fuerte', 'Ráfagas de 70 km/h o más')}
          ${tog('heat', '🌡️ Calor extremo', 'Máxima de 38 °C o más')}
          ${tog('cold', '🥶 Frío extremo', 'Mínima de −5 °C o menos')}
          ${tog('hurricane', '🌀 Huracanes y tormentas tropicales', 'Cuando un ciclón activo está cerca de tus lugares')}
          <div class="seg" id="al-rad" style="grid-template-columns:repeat(3,1fr);margin-top:12px">${[300, 600, 1000].map(r => `<button data-r="${r}" aria-pressed="${a.radius === r}">${nf.format(r)} km</button>`).join('')}</div>
          <p class="about">Distancia para avisarte de un ciclón. Los lugares vigilados son tu ciudad y los que guardes en "Mi clima" (hasta 3).</p>
          ${NATIVE ? `<button class="btn block" id="al-test">${I.ui('alertas')}Probar una alerta</button>` : ''}
          <p class="about">Las alertas de lluvia, viento, tormenta y temperatura se basan en el pronóstico de MET Norway; las de ciclones, en los avisos de GDACS (Comisión Europea y ONU). No reemplazan los avisos oficiales de tu país: síguelos siempre.</p>`;
        body.querySelectorAll('[data-al]').forEach(b => b.onclick = () => { a[b.dataset.al] = !a[b.dataset.al]; b.setAttribute('aria-checked', String(a[b.dataset.al])); syncAlerts(); });
        body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { a.radius = +b.dataset.r; syncAlerts(); rerender(); });
        const t = $('#al-test'); if (t) t.onclick = () => N.testAlert();
        const list = allPlaces();
        if (!list.length) { $('#al-now').innerHTML = `<div class="alert-card"><span class="ai">📍</span><div><b>Elige tu ciudad</b><p>Así podremos avisarte de lluvias fuertes, tormentas y huracanes cerca.</p></div></div><button class="btn primary block" id="al-city">Elegir mi ciudad</button>`; $('#al-city').onclick = () => openCityPicker('me'); return; }
        Promise.all(list.map(p => loadForecast(p).then(fc => alertsFor(p, fc)).catch(() => []))).then(all => {
          const el = $('#al-now'); if (!el) return;
          const flat = all.flat();
          el.innerHTML = `<div class="section-h" style="margin-top:4px"><h3>Ahora en tus lugares</h3><small>${list.map(p => esc(p.name)).join(' · ')}</small></div>` +
            (flat.length ? flat.map(alertCard).join('') : `<div class="alert-card ok"><span class="ai">✅</span><div><b>Sin alertas por ahora</b><p>No se esperan lluvias muy fuertes, tormentas, vientos ni temperaturas extremas en las próximas 24 horas.</p></div></div>`);
        });
      }
    });
  }

  // ---------- huracanes y tormentas tropicales (GDACS) ----------
  const SS = [['DT', 'Depresión', 0, '#5ce1ff'], ['TT', 'Tormenta', 63, '#34e0a1'], ['1', 'Cat. 1', 119, '#ffd166'], ['2', 'Cat. 2', 154, '#ffa94d'], ['3', 'Cat. 3', 178, '#ff7043'], ['4', 'Cat. 4', 209, '#ff4f6d'], ['5', 'Cat. 5', 252, '#c13cff']];
  const catOf = w => { let c = SS[0]; for (const s of SS) if (w >= s[2]) c = s; return c; };
  const kindOf = (w, lng) => w < 63 ? 'Depresión tropical' : w < 119 ? 'Tormenta tropical' : (lng > 100 || lng < -180 + 0) ? 'Tifón' : lng > 30 && lng <= 100 ? 'Ciclón' : 'Huracán';
  async function loadStorms() {
    try {
      const j = await getJSON(GDACS_LIST, 30);
      state.storms = j.features.map(f => {
        const p = f.properties, w = (p.severitydata && p.severitydata.severity) || 0, [lng, lat] = f.geometry.coordinates;
        return { id: p.eventid, ep: p.episodeid, name: cap((p.eventname || '').replace(/-\d+$/, '').toLowerCase()), lat, lng, wind: w, alert: p.alertlevel,
          current: p.iscurrent === 'true' || p.iscurrent === true, from: Date.parse(p.fromdate + 'Z'), to: Date.parse(p.todate + 'Z'), countries: p.country || '',
          geom: p.url && p.url.geometry, report: p.url && p.url.report, kind: kindOf(w, lng) };
      }).sort((a, b) => (b.current - a.current) || b.from - a.from);
      for (const s of state.storms.filter(x => x.current)) loadStormGeo(s).then(refreshPaths).catch(() => {});
      refreshHtml();
      if (state.sheet && state.sheet.storms) rerender();
    } catch (e) { if (!state.storms) state.storms = []; if (state.sheet && state.sheet.storms) rerender(); }
  }
  async function loadStormGeo(s) {
    if (state.stormGeo[s.id]) return state.stormGeo[s.id];
    const j = await getJSON(`https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${s.id}&episodeid=${s.ep}`, 60);
    const segs = [], cones = []; let countries = [];
    for (const f of j.features) {
      const p = f.properties || {}, cls = p.Class || '';
      if (cls.startsWith('Line_Line') && f.geometry.type === 'LineString') segs.push({ pts: f.geometry.coordinates, label: p.polygonlabel, forecast: p.forecast === true || p.forecast === 'true' });
      else if (cls === 'Poly_Cones') cones.push(f);
      if (!countries.length && p.affectedcountries) countries = p.affectedcountries.map(c => c.iso2).filter(Boolean);
    }
    return (state.stormGeo[s.id] = { segs, cones, countries });
  }
  const segColor = l => ({ TD: '#5ce1ff', TS: '#34e0a1', HU: '#ff8a3d', TY: '#ff4f6d', STY: '#c13cff' }[l] || '#ffd166');
  let shownStorm = null;
  function refreshPaths() {
    const paths = [];
    const ids = new Set((state.storms || []).filter(s => s.current).map(s => s.id));
    if (shownStorm) ids.add(shownStorm);
    for (const id of ids) {
      const g = state.stormGeo[id]; if (!g) continue;
      for (const sg of g.segs) paths.push({ pts: sg.pts, color: segColor(sg.label), stroke: 2.4, dash: sg.forecast ? 0.03 : 1, gap: sg.forecast ? 0.02 : 0 });
      // Cono de incertidumbre del pronóstico (solo el contorno, para no tapar las capas)
      for (const c of g.cones) {
        const rings = c.geometry.type === 'Polygon' ? [c.geometry.coordinates[0]] : c.geometry.coordinates.map(p => p[0]);
        for (const r of rings) paths.push({ pts: r, color: 'rgba(255,214,150,0.85)', stroke: 1.2, dash: 0.012, gap: 0.008 });
      }
    }
    globe.pathsData(paths);
    refreshPolygons();
  }
  function refreshPolygons() { globe.polygonsData(state.geo || []); }
  function stormCard(s) {
    const c = catOf(s.wind);
    return `<button class="storm-card ${s.current ? 'cur' : ''}" data-st="${s.id}"><span class="ico">${I.storm()}</span><div class="meta"><b>${esc(s.name)} <span class="cat" style="background:${c[3]}">${c[1]}</span></b>
      <small>${esc(s.kind)} · ${s.current ? 'ACTIVO AHORA' : new Date(s.from).toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' – ' + new Date(s.to).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</small>
      <small>${esc(s.countries)}</small></div><div class="w"><b>${Math.round(s.wind)}</b><small>km/h máx.</small></div></button>`;
  }
  function openStorms() {
    selectTab('huracanes', true);
    if (NATIVE && N.adBreak) N.adBreak();
    openSheet({
      title: 'Huracanes y tifones', sub: 'Ciclones tropicales de todo el mundo · GDACS', storms: true,
      render: body => {
        if (!state.storms) { body.innerHTML = '<div class="spinner"></div>'; loadStorms(); return; }
        const cur = state.storms.filter(s => s.current), past = state.storms.filter(s => !s.current);
        body.innerHTML = (cur.length ? `<div class="section-h"><h3>Activos ahora</h3><small>${cur.length}</small></div>${cur.map(stormCard).join('')}`
          : `<div class="alert-card ok"><span class="ai">✅</span><div><b>No hay ciclones tropicales activos</b><p>Ahora mismo no hay huracanes, tifones ni tormentas tropicales en el planeta. Si se forma uno cerca de tus lugares, te avisaremos.</p></div></div>`)
          + (past.length ? `<div class="section-h"><h3>Temporada ${new Date().getFullYear()}</h3><small>Los más recientes</small></div>${past.map(stormCard).join('')}` : '')
          + `<div class="section-h"><h3>Escala Saffir-Simpson</h3><small>Viento sostenido</small></div>
            <div class="saffir">${SS.slice(2).map(s => `<div class="on" style="background:${s[3]}">${s[1]}<small>${s[2]}+ km/h</small></div>`).join('')}</div>
            <p class="about">Temporadas: Atlántico y Caribe del 1 de junio al 30 de noviembre; Pacífico oriental del 15 de mayo al 30 de noviembre; en Asia los tifones pueden darse todo el año. Datos: GDACS (Comisión Europea y Naciones Unidas), con información de NOAA y JTWC.</p>`;
        body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => openStorm(+b.dataset.st));
      }
    });
  }
  function openStorm(id) {
    const s = (state.storms || []).find(x => x.id === id); if (!s) return;
    const c = catOf(s.wind);
    openSheet({
      title: `${s.kind} ${s.name}`, sub: s.current ? 'Activo ahora · datos de GDACS' : `${new Date(s.from).toLocaleDateString('es', { day: 'numeric', month: 'long' })} – ${new Date(s.to).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`, storms: true,
      render: body => {
        const me = state.me, dk = me ? distKm(s.lat, s.lng, me.lat, me.lng) : null;
        body.innerHTML = `<div class="wx-hero"><span style="width:96px;height:96px;display:block">${I.storm()}</span><div><div class="big" style="font-size:52px">${Math.round(s.wind)}<sup style="font-size:18px;vertical-align:24px">km/h</sup></div>
            <b>${esc(c[1] === 'Depresión' || c[1] === 'Tormenta' ? s.kind : `${s.kind} categoría ${c[0]}`)}</b><small>Viento máximo sostenido</small></div></div>
          <div class="saffir">${SS.slice(2).map(x => `<div class="${x === c ? 'on' : ''}" style="background:${x[3]}">${x[1]}<small>${x[2]}+</small></div>`).join('')}</div>
          <div class="kv">
            <span>Alerta GDACS</span><b>${s.alert === 'Red' ? '🔴 Roja' : s.alert === 'Orange' ? '🟠 Naranja' : '🟢 Verde'}</b>
            <span>Última posición</span><b>${Math.abs(s.lat).toFixed(1)}° ${s.lat >= 0 ? 'N' : 'S'}, ${Math.abs(s.lng).toFixed(1)}° ${s.lng >= 0 ? 'E' : 'O'}</b>
            ${dk != null ? `<span>Distancia a ${esc(me.name)}</span><b>${nf.format(Math.round(dk))} km</b>` : ''}
            <span>Desde</span><b>${new Date(s.from).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b>
            <span>Hasta</span><b>${new Date(s.to).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b>
          </div>
          <div class="section-h"><h3>Países afectados</h3></div><div class="explain" id="st-cc">${esc(s.countries)}</div>
          <div class="btn-row"><button class="btn primary" id="st-map">${I.ui('pin')}Ver trayectoria</button><button class="btn" id="st-rep">Informe GDACS</button></div>
          <p class="about">En el mapa: línea continua = recorrido; punteada = pronóstico; contorno punteado claro = cono de incertidumbre. Colores: celeste depresión, verde tormenta, naranja huracán/tifón.</p>`;
        loadStormGeo(s).then(g => { const el = $('#st-cc'); if (el && g.countries.length) el.textContent = g.countries.map(cc => `${flag(cc)} ${regionName(cc)}`).join(' · '); }).catch(() => {});
        $('#st-map').onclick = () => {
          shownStorm = s.id; refreshHtml();
          loadStormGeo(s).then(() => { refreshPaths(); refreshHtml(); }).catch(() => toast('No se pudo cargar la trayectoria'));
          closeSheet(); globe.controls().autoRotate = false;
          globe.pointOfView({ lat: s.lat - 4, lng: s.lng - 6, altitude: 1.35 }, 1500);
        };
        $('#st-rep').onclick = () => { if (s.report) { if (NATIVE) N.openLink(s.report); else window.open(s.report, '_blank'); } };
      }
    });
  }

  // ---------- nombres de ciudades sobre el globo (con el dato de la capa elegida) ----------
  let labelCities = [], labelEls = [], labelT = -1, labelLayer = '';
  function pickLabelCities() {
    // las más grandes, separadas al menos 1.300 km para que no se amontonen
    const out = [];
    for (const c of state.ciudades) {
      if (out.length >= 34) break;
      if (out.every(o => distKm(o[2], o[3], c[2], c[3]) > 1300)) out.push(c);
    }
    labelCities = out;
  }
  function labelValue(lat, lng) {
    const t = state.tIdx, L = state.layer;
    if (L === 'viento') return `${Math.round(Math.hypot(sampleT('u', t, lat, lng), sampleT('v', t, lat, lng)))}<small> km/h</small>`;
    if (L === 'lluvia') { const v = sampleT('p', t, lat, lng) / 10; return v < 0.1 ? '<small>sin lluvia</small>' : `${v < 10 ? v.toFixed(1) : Math.round(v)}<small> mm</small>`; }
    if (L === 'humedad') return `${Math.round(sampleT('h', t, lat, lng))}<small> %</small>`;
    return `${Math.round(sampleT('t', t, lat, lng))}°`;
  }
  function updateLabels(force) {
    if (!state.grid || !labelEls.length) return;
    if (!force && Math.abs(state.tIdx - labelT) < 0.2 && labelLayer === state.layer) return;
    labelT = state.tIdx; labelLayer = state.layer;
    for (const { el, c } of labelEls) el.lastChild.innerHTML = labelValue(c[2], c[3]);
  }
  // Oculta los nombres que quedan cerca del borde del planeta (allí se amontonan y no se leen)
  let lastPov = '';
  function cullLabels() {
    if (!globe || !labelEls.length) return;
    const pov = globe.pointOfView(), key = pov.lat.toFixed(1) + pov.lng.toFixed(1) + pov.altitude.toFixed(2);
    if (key === lastPov) return; lastPov = key;
    const lim = pov.altitude > 1.6 ? 58 : pov.altitude > 0.8 ? 48 : 36;
    for (const L of labelEls) {
      const d = distKm(pov.lat, pov.lng, L.c[2], L.c[3]) / 111.2;
      const show = d < lim;
      if (show !== L.shown) { L.shown = show; L.el.style.opacity = show ? '1' : '0'; L.el.style.pointerEvents = show ? 'auto' : 'none'; }
    }
  }

  // ---------- marcadores HTML ----------
  function refreshHtml() {
    if (!globe) return;
    const els = [];
    for (const p of allPlaces()) {
      const el = document.createElement('div'); el.className = 'me-pin'; el.title = p.name;
      els.push({ lat: p.lat, lng: p.lng, el, alt: 0.016 });
    }
    if (state.probe) { const el = document.createElement('div'); el.className = 'probe-pin'; els.push({ lat: state.probe.lat, lng: state.probe.lng, el, alt: 0.016 }); }
    labelEls = [];
    const season = (state.storms || []).filter(x => x.current || x.id === shownStorm || Date.now() - x.to < 120 * 864e5).slice(0, 14);
    if (state.settings.labels !== false) for (const c of labelCities) {
      if (allPlaces().some(p => distKm(p.lat, p.lng, c[2], c[3]) < 150)) continue;
      if (season.some(x => distKm(x.lat, x.lng, c[2], c[3]) < 650)) continue;     // no encimar con un ciclón
      const el = document.createElement('div'); el.className = 'city-lbl';
      el.innerHTML = `<b>${esc(c[0])}</b><span></span>`;
      el.addEventListener('click', ev => { ev.stopPropagation(); probe(c[2], c[3]); });
      labelEls.push({ el, c, shown: true });
      els.push({ lat: c[2], lng: c[3], el, alt: 0.012 });
    }
    // Ciclones: los activos giran; los de la temporada quedan marcados (más tenues) para ver dónde pasaron
    for (const s of season) {
      const el = document.createElement('div'); el.className = 'storm-mk' + (s.current || s.id === shownStorm ? '' : ' past');
      el.innerHTML = `<span class="sp">${I.storm()}</span><small>${esc(s.name)} · ${s.current ? Math.round(s.wind) + ' km/h' : new Date(s.from).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '')}</small>`;
      el.addEventListener('click', ev => { ev.stopPropagation(); openStorm(s.id); });
      els.push({ lat: s.lat, lng: s.lng, el, alt: 0.02 });
    }
    globe.htmlElementsData(els);
    lastPov = ''; updateLabels(true);
  }

  // ---------- menú ----------
  function openMenu() {
    openSheet({
      title: 'Orbe Clima', sub: 'Ajustes, Premium y fuentes de datos',
      render: body => {
        const s = state.settings;
        const tog = (k, t, sub) => `<button class="toggle" data-set="${k}" role="switch" aria-checked="${k === 'quality' ? s.quality === 'ultra' : !!s[k]}"><span><b>${t}</b><span class="t-sub">${sub}</span></span><span class="switch"></span></button>`;
        body.innerHTML = `
          <div class="premium">${state.premium ? '<h4>Premium activo ✨</h4><p class="ok">Gracias por apoyar Orbe Clima: no verás anuncios.</p><button class="btn" id="m-manage">Administrar suscripción</button>'
            : `<h4>Orbe Clima Premium</h4><p>Sin anuncios mientras estés suscrito. ${esc(state.price)}.</p><button class="btn primary block" id="m-buy">Quitar anuncios</button>`}</div>
          ${tog('particles', 'Viento animado', 'Partículas que muestran hacia dónde sopla el viento')}
          ${tog('labels', 'Nombres de ciudades en el mapa', 'Con la temperatura, el viento o la lluvia de cada una')}
          ${tog('quality', 'Ultra HD', 'Tierra en 8K y más partículas (si tu equipo lo soporta)')}
          <div class="section-h"><h3>Cómo leer el mapa</h3></div>
          <p class="about" style="padding-top:0">Las líneas blancas que se mueven son el viento: cuanto más largas y rápidas, más fuerte sopla. Elige arriba la capa de color (viento, lluvia, humedad o temperatura) y mueve la línea de tiempo para ver las próximas 48 horas. Toca cualquier punto del planeta para ver su pronóstico.</p>
          <p class="about"><b>Fuentes:</b> pronóstico de cada lugar de MET Norway (CC BY 4.0), mapa mundial del modelo GFS de NOAA (vía ERDDAP de PacIOOS), búsqueda de ciudades © OpenStreetMap, ciclones tropicales de GDACS (Comisión Europea y ONU), fronteras de Natural Earth, texturas de la Tierra de Solar System Scope (CC BY 4.0) y NASA.<br>
          Mapa: ${state.grid ? `actualizado ${new Date(state.grid.generated).toLocaleString('es', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}` : 'cargando'}.<br>Orbe Clima 1.1</p>`;
        body.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
          const k = b.dataset.set;
          if (k === 'quality') { s.quality = s.quality === 'ultra' ? 'high' : 'ultra'; toast('Se aplicará al volver a abrir la app'); }
          else { s[k] = s[k] === false ? true : !s[k]; if (k === 'particles') setWindColor(); if (k === 'labels') refreshHtml(); }
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
    $('#now-ico').innerHTML = I.weather(2, true, 62);
    $('#play').innerHTML = I.ui('play');
    document.querySelectorAll('.ti').forEach(t => { t.innerHTML = I.ui(t.dataset.ico); });
    renderLayers();
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) selectTab(b.dataset.tab); });
    $('#sheet-close').onclick = () => closeSheet();
    $('#sheet-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });
    $('#layers').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      if (b.dataset.go) selectTab(b.dataset.go); else { setLayer(b.dataset.layer); if (isOpen()) closeSheet(); }
    });
    $('#now-card').onclick = () => { state.sel = 0; if (state.me) openClima(); else openCityPicker('me'); };
    $('#btn-search').onclick = () => openCityPicker(state.me ? 'add' : 'me');
    $('#btn-menu').onclick = openMenu;
    $('#play').onclick = () => { state.playing = !state.playing; if (state.playing && state.tIdx >= state.grid.times.length - 1.05) state.tIdx = state.nowIdx; updateTimeline(); };
    $('#tl-range').addEventListener('input', e => { state.playing = false; state.tIdx = +e.target.value; updateTimeline(); updateLabels(false); });
  }

  // ---------- arranque ----------
  async function boot() {
    wire();
    splash(15, 'Cargando la Tierra en Ultra HD…');
    initGlobe();
    tickClock(); setInterval(tickClock, 20000);
    local('data/ciudades-mundo.json').then(c => { state.ciudades = c; pickLabelCities(); refreshHtml(); }).catch(() => {});
    if (NATIVE && typeof N.isPremium === 'function') state.premium = !!N.isPremium();
    updateNow(); setInterval(updateNow, 15 * 60000);
    loadStorms(); setInterval(loadStorms, 30 * 60000);
    syncAlerts();
    try {
      state.grid = await loadGrid();
      state.nowIdx = state.tIdx = nowIndex(state.grid);
      stepCache = {};
      renderTimelineDays(); updateTimeline();
      if (field) drawField(true);
      seedParticles();
      splash(100);
    } catch (e) {
      splash(100);
      toast('No se pudo cargar el mapa del clima. Revisa tu conexión.', 5000);
    }
    setTimeout(() => splash(100), 9000);
    // Cada 3 horas se renueva el mapa
    setInterval(async () => { try { const g = await loadGrid(); state.grid = g; stepCache = {}; state.nowIdx = nowIndex(g); renderTimelineDays(); drawField(true); } catch (e) { /* luego */ } }, 3 * 3600e3);
  }
  window.__orbeDebug = { state, sample, loadGrid };
  boot();
})();
