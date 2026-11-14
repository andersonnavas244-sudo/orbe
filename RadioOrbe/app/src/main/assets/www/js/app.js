/* Orbe Radio – radio mundial sobre un globo 3D */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const G = window.Genres;
  const NATIVE = !!(window.AndroidRadio && typeof window.AndroidRadio.playStation === 'function');
  // Android TV / Google TV (o ?tv=1 para probar en el navegador)
  const IS_TV = (NATIVE && typeof window.AndroidRadio.isTv === 'function' && window.AndroidRadio.isTv()) || /[?&]tv=1/.test(location.search);
  const API = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];
  // Texturas 8K (8192×4096) si la GPU lo soporta; 4K (4096×2048) como respaldo.
  const TEXTURES = {
    day:    { k8: 'img/8k/8k_earth_daymap.jpg',   k4: 'img/earth-blue-marble.jpg' },
    night:  { k8: 'img/8k/8k_earth_nightmap.jpg', k4: 'img/earth-night.jpg' },
    clouds: { k8: 'img/clouds-4k.jpg',            k4: 'img/clouds-4k.jpg' }  // 4K en grises (la luz la pone el Sol)
  };
  let maxTex = 4096, maxAniso = 1;
  const use8k = () => state.settings.quality === 'ultra' && window.TierraHD && TierraHD.maxTex >= 8192 && TierraHD.can8k();
  const texUrl = name => (TEXTURES[name] || TEXTURES.day)[use8k() ? 'k8' : 'k4'];
  const nf = new Intl.NumberFormat('es');

  // ---------- almacenamiento local seguro ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('orbe.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('orbe.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  const state = {
    stations: [], byId: new Map(), countries: {}, countryCount: {}, grid: new Map(),
    genre: 'all', query: '', results: null,
    current: null, status: 'idle',
    favs: new Set(store.get('favs', [])),
    history: store.get('history', []),
    settings: Object.assign({ texture: 'real', clouds: true, borders: true, rotate: true, quality: IS_TV ? 'high' : 'ultra' }, store.get('settings', {})),
    sheet: null,
    nowTitle: '', sleepMin: 0, premium: false, premiumPrice: '$9.000 COP/mes', casting: false, castName: ''
  };

  // ---------- utilidades ----------
  const fold = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const genreOf = st => st.g >= 0 ? G.GENRES[st.g] : G.OTHER;
  const countryName = cc => state.countries[cc] || cc || 'Sin país';
  function distKm(aLat, aLng, bLat, bLng) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function stationSub(st) {
    const parts = [flag(st.cc) + ' ' + countryName(st.cc), genreOf(st).label];
    if (st.codec) parts.push(st.codec + (st.bitrate ? ' ' + st.bitrate + 'k' : ''));
    return parts.join(' · ');
  }
  // ---------- hora local de cada emisora ----------
  let TZ = null;
  const tzFmt = new Map();
  fetch('data/timezones.json').then(r => r.json()).then(t => { TZ = t; renderPlayerSub(); }).catch(() => {});
  function zoneOf(st) {
    const z = TZ && TZ[st.cc];
    if (!z || !z.length) return null;
    if (z.length === 1 || st.lng === null) return z[0][0];
    // País con varios husos: el más cercano según la longitud de la emisora.
    const target = st.lng * 4; let best = z[0], bd = Infinity;
    for (const e of z) { const d = Math.abs(e[1] - target); if (d < bd) { bd = d; best = e; } }
    return best[0];
  }
  function localTime(st) {
    const tz = zoneOf(st); if (!tz) return null;
    try {
      let f = tzFmt.get(tz);
      if (!f) { f = new Intl.DateTimeFormat('es', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); tzFmt.set(tz, f); }
      const now = new Date();
      const h = +f.formatToParts(now).find(x => x.type === 'hour').value;
      return { text: f.format(now), night: h < 6 || h >= 19 };
    } catch (e) { return null; }
  }
  function timeLabel(st) { const t = localTime(st); return t ? (t.night ? '🌙 ' : '☀️ ') + t.text : ''; }

  function logoHtml(st, cls = '') {
    const g = genreOf(st);
    const initial = esc((st.name.replace(/[^\p{L}\p{N}]/gu, '')[0] || '♪').toUpperCase());
    const img = st.favicon ? `<img src="${esc(st.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok');if(this.naturalWidth<100)this.classList.add('lo')" onerror="this.remove()">` : '';
    return `<div class="logo ${cls}" style="background:linear-gradient(135deg,${g.color},#1b2540)">${initial}${img}</div>`;
  }

  // ---------- carga del catálogo ----------
  async function loadCatalog() {
    const msg = $('#splash-msg'), bar = $('#splash-bar');
    msg.textContent = 'Cargando emisoras del mundo…';
    const res = await fetch('data/stations.json');
    if (!res.ok) throw new Error('No se pudo leer el catálogo');
    const total = +res.headers.get('Content-Length') || 0;
    let text;
    if (res.body && total) {
      const reader = res.body.getReader(); const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        bar.style.width = (5 + 75 * got / total).toFixed(1) + '%';
      }
      const all = new Uint8Array(got); let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      text = new TextDecoder().decode(all);
    } else {
      bar.style.width = '45%';
      text = await res.text();
    }
    bar.style.width = '82%';
    msg.textContent = 'Ubicando emisoras en el mapa…';
    await new Promise(r => setTimeout(r, 30));
    const data = JSON.parse(text);
    const F = Object.fromEntries(data.fields.map((f, i) => [f, i]));
    state.countries = data.countries || {};
    state.apiTotal = data.apiTotal;
    state.generated = data.generated;
    for (const r of data.rows) {
      const mask = r[F.genres];
      const st = {
        id: r[F.id], name: r[F.name], url: r[F.url], lat: r[F.lat], lng: r[F.lng], approx: r[F.approx],
        cc: r[F.cc], mask, g: G.primaryFromMask(mask), tags: r[F.tags], codec: r[F.codec], bitrate: r[F.bitrate],
        hls: r[F.hls], votes: r[F.votes], favicon: r[F.favicon], lang: r[F.lang], home: r[F.home]
      };
      st.hay = fold(st.name + ' ' + st.tags + ' ' + countryName(st.cc) + ' ' + st.lang + ' ' + st.cc);
      state.stations.push(st);
      state.byId.set(st.id, st);
      if (st.cc) state.countryCount[st.cc] = (state.countryCount[st.cc] || 0) + 1;
      if (st.lat !== null) {
        const key = Math.floor(st.lat) + ':' + Math.floor(st.lng);
        let cell = state.grid.get(key); if (!cell) state.grid.set(key, cell = []);
        cell.push(st);
      }
    }
    bar.style.width = '90%';
  }

  function nearby(lat, lng, radiusKm, limit = 80) {
    const dLat = Math.ceil(radiusKm / 111) + 1;
    const dLng = Math.min(180, Math.ceil(radiusKm / (111 * Math.max(0.15, Math.cos(lat * Math.PI / 180)))) + 1);
    const out = [];
    const la0 = Math.floor(lat), lo0 = Math.floor(lng);
    for (let a = la0 - dLat; a <= la0 + dLat; a++) {
      for (let b = lo0 - dLng; b <= lo0 + dLng; b++) {
        const bb = ((b + 180) % 360 + 360) % 360 - 180;
        const cell = state.grid.get(a + ':' + bb); if (!cell) continue;
        for (const st of cell) {
          if (!matchesGenre(st)) continue;
          const d = distKm(lat, lng, st.lat, st.lng);
          if (d <= radiusKm) out.push([d, st]);
        }
      }
    }
    out.sort((x, y) => (x[0] - y[0]) || (y[1].votes - x[1].votes));
    return out.slice(0, limit).map(x => x[1]);
  }

  function matchesGenre(st) {
    if (state.genre === 'all') return true;
    if (state.genre === 'other') return st.mask === 0;
    return (st.mask & (1 << state.genre)) !== 0;
  }

  // ---------- globo ----------
  let globe, dotTextures = null, clouds = null;

  function makeDotTextures() {
    const Tex = globe.globeMaterial().map && globe.globeMaterial().map.constructor;
    if (!Tex) return null;
    const make = color => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      const [r, g, b] = hexToRgb(color);
      const grd = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, `rgb(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)})`);
      grd.addColorStop(0.55, `rgb(${r},${g},${b})`);
      grd.addColorStop(1, `rgb(${r >> 1},${g >> 1},${b >> 1})`);
      x.fillStyle = grd; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
      const t = new Tex(c); t.needsUpdate = true;
      return t;
    };
    const map = {};
    for (const g of G.GENRES) map[g.color] = make(g.color);
    map[G.OTHER.color] = make(G.OTHER.color);
    return map;
  }

  function particleSets() {
    const list = state.results || state.stations;
    const sets = new Map();
    const single = state.genre !== 'all';
    for (const st of list) {
      if (st.lat === null || !matchesGenre(st)) continue;
      let gi = st.g;
      if (single && state.genre !== 'other') gi = state.genre;
      const key = gi;
      let s = sets.get(key);
      if (!s) sets.set(key, s = { color: (gi >= 0 ? G.GENRES[gi] : G.OTHER).color, items: [] });
      s.items.push(st);
    }
    return [...sets.values()];
  }

  function refreshGlobePoints() {
    if (!globe) return;
    globe.particlesData(particleSets());
    updateStats();
  }

  function initGlobe() {
    const el = $('#globe');
    globe = new Globe(el, {
      animateIn: true, waitForGlobeReady: true,
      rendererConfig: { antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false }
    });
    try {
      const caps = globe.renderer().capabilities;
      maxTex = caps.maxTextureSize || 4096;
      maxAniso = caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1;
    } catch (e) { /* valores por defecto */ }
    globe.globeImageUrl(texUrl(state.settings.texture))
      .bumpImageUrl('img/earth-topology.png')
      .backgroundImageUrl('img/stars-4k.jpg')
      .globeCurvatureResolution(2)
      .showAtmosphere(true).atmosphereColor('#5ec8ff').atmosphereAltitude(0.18)
      .showGraticules(false)
      // Fronteras
      .polygonAltitude(0.004)
      .polygonCapColor(() => 'rgba(0,0,0,0)')
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => 'rgba(190,225,255,0.32)')
      .polygonsTransitionDuration(0)
      .polygonLabel(() => '')
      .onPolygonClick((poly, ev, coords) => onMapTap(coords, poly))
      .onGlobeClick(coords => onMapTap(coords))
      // Emisoras
      .particlesList(d => d.items)
      .particleLat('lat').particleLng('lng').particleAltitude(0.009)
      .particlesSize(() => pointSize()).particlesSizeAttenuation(false)
      .particlesColor(d => d.color)
      .particleLabel(st => !st || !st.name ? "" : `<b>${esc(st.name)}</b><br><span style="opacity:.75">${esc(stationSub(st))}</span>`)
      .onParticleClick(st => { if (st && st.id) selectStation(st, { fly: true, list: true }); })
      // Emisora sonando: ondas
      .ringsData([])
      .ringColor(d => t => `rgba(${d.rgb},${(1 - t).toFixed(3)})`)
      .ringMaxRadius(3.2).ringPropagationSpeed(2.2).ringRepeatPeriod(800).ringAltitude(0.01)
      .onZoom(onZoom)
      .onGlobeReady(onGlobeReady);

    globe.pointOfView({ lat: 12, lng: -40, altitude: 2.4 });
    const c = globe.controls();
    c.autoRotate = state.settings.rotate; c.autoRotateSpeed = 0.35; c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 101.5; c.maxDistance = 900;
    c.addEventListener('start', () => { c.autoRotate = false; });
    applyQuality();
    // Si el sistema reclama la GPU (p. ej. al volver de segundo plano), recarga la escena.
    globe.renderer().domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); }, false);
    globe.renderer().domElement.addEventListener('webglcontextrestored', () => location.reload(), false);
    window.addEventListener('resize', () => globe.width(window.innerWidth).height(window.innerHeight));
    fetch('lib/countries.geojson').then(r => r.json()).then(geo => {
      state.geo = geo.features.filter(f => f.properties.ISO_A2 !== 'AQ');
      if (state.settings.borders) globe.polygonsData(state.geo);
    }).catch(() => {});
  }

  function onGlobeReady() {
    try {
      dotTextures = makeDotTextures();
      if (dotTextures) globe.particlesTexture(d => dotTextures[d.color]);
    } catch (e) { dotTextures = null; }
    refreshGlobePoints();
    baseMat = globe.globeMaterial();
    hdReady = TierraHD.init(globe);
    sharpenGlobe();
    if (state.settings.texture === 'real') enableDayNight();
    addOceanShine();
    if (state.settings.clouds) setClouds(true);
    const splash = $('#splash');
    $('#splash-bar').style.width = '100%';
    setTimeout(() => splash.classList.add('gone'), 250);
    setTimeout(() => splash.remove(), 1000);
  }

  // Filtrado anisotrópico: el mapa se ve nítido también cerca del horizonte.
  function sharpenGlobe() {
    const m = baseMat || globe.globeMaterial();
    if (m.map) { m.map.anisotropy = maxAniso; m.map.needsUpdate = true; }
    if (m.bumpMap) { m.bumpMap.anisotropy = maxAniso; m.bumpMap.needsUpdate = true; }
    m.bumpScale = 6;
  }
  // ---------- día y noche en tiempo real ----------
  let baseMat = null, dnMat = null, sunTimer = null, hdReady = false;
  const DN_VERT = `
    varying vec3 vNormal; varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal); vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const DN_FRAG = `
    #define PI 3.141592653589793
    uniform sampler2D dayTexture; uniform sampler2D nightTexture;
    uniform vec2 sunPosition; uniform vec2 globeRotation;
    varying vec3 vNormal; varying vec2 vUv;
    float toRad(in float a) { return a * PI / 180.0; }
    vec3 polar2Cartesian(in vec2 c) {
      float theta = toRad(90.0 - c.x); float phi = toRad(90.0 - c.y);
      return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
    }
    void main() {
      float invLon = toRad(globeRotation.x); float invLat = -toRad(globeRotation.y);
      mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
      mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
      vec3 sunDir = rotX * rotY * polar2Cartesian(sunPosition);
      float intensity = dot(normalize(vNormal), normalize(sunDir));
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv) * 1.35;
      float blendFactor = smoothstep(-0.12, 0.12, intensity);
      gl_FragColor = mix(nightColor, dayColor, blendFactor);
    }`;

  // Punto de la Tierra que tiene el sol justo encima (aprox. NOAA), en grados [lng, lat].
  function sunPosition(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const doy = (d - start) / 864e5;
    const g = 2 * Math.PI / 365 * (doy - 1 + (d.getUTCHours() - 12) / 24);
    const decl = (0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
      + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)) * 180 / Math.PI;
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    let lng = -(utcMin + eot - 720) / 4;
    lng = ((lng + 540) % 360) - 180;
    return [lng, decl];
  }
  function updateSun() { if (dnMat) dnMat.uniforms.sunPosition.value = sunPosition(new Date()); }

  function enableDayNight() {
    if (!baseMat) baseMat = globe.globeMaterial();
    TierraHD.setCloudsFlat(false);
    if (dnMat) { globe.globeMaterial(dnMat); return; }
    if (!hdReady) { toast('Este equipo no soporta el modo día y noche'); return; }
    // Tierra Ultra HD: relieve, reflejo del Sol en el mar, atardecer y atmósfera (js/tierra-hd.js)
    TierraHD.createEarth({ day: texUrl('day'), night: TEXTURES.night.k4, normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' })
      .then(mat => { dnMat = mat; if (state.settings.texture === 'real') globe.globeMaterial(dnMat); })
      .catch(() => toast('No se pudo cargar el modo día y noche'));
  }

  function setTexture(name) {
    state.settings.texture = name;
    if (name === 'real') { enableDayNight(); return; }
    if (baseMat && globe.globeMaterial() !== baseMat) globe.globeMaterial(baseMat);
    TierraHD.setCloudsFlat(true);
    globe.globeImageUrl(texUrl(name));
    // La textura nueva carga en segundo plano; se afina al terminar.
    let tries = 0; const prev = globe.globeMaterial().map;
    (function wait() { const m = globe.globeMaterial().map; if (m && m !== prev) sharpenGlobe(); else if (tries++ < 40) setTimeout(wait, 250); })();
  }
  // Brillo del sol sobre los océanos (mapa especular).
  function addOceanShine() {
    const mat = baseMat || globe.globeMaterial();
    if (!mat.map || !mat.specular) return;
    const img = new Image();
    img.onload = () => {
      const t = new mat.map.constructor(img); t.needsUpdate = true;
      mat.specularMap = t; mat.specular.set('#3d5a80'); mat.shininess = 18; mat.needsUpdate = true;
    };
    img.src = 'img/earth-water.png';
  }

  let cloudsLoading = false;
  function setClouds(on) {
    if (!on) { if (clouds) TierraHD.setCloudsVisible(false); return; }
    if (clouds) { TierraHD.setCloudsVisible(true); return; }
    if (!hdReady || cloudsLoading) return;
    cloudsLoading = true;
    // Nubes iluminadas por el Sol, con sombra sobre la superficie
    TierraHD.createClouds(texUrl('clouds'), { flat: state.settings.texture !== 'real' }).then(m => {
      clouds = m; cloudsLoading = false; TierraHD.setCloudsVisible(state.settings.clouds);
    }).catch(() => { cloudsLoading = false; });
  }

  // Tamaño de los puntos (en píxeles) según el zoom: más grandes al acercarse
  let sizeStep = -1;
  function pointSize() {
    const alt = globe ? globe.pointOfView().altitude : 2.4;
    const step = alt > 1.8 ? 0 : alt > 1 ? 1 : alt > 0.5 ? 2 : alt > 0.2 ? 3 : 4;
    const boost = (state.results || state.genre !== 'all') ? 1.5 : 0;
    return [2.6, 3.4, 4.6, 6, 8][step] + boost;
  }
  function onZoom(pov) {
    if (dnMat) dnMat.uniforms.globeRotation.value = [pov.lng, pov.lat];
    const step = pov.altitude > 1.8 ? 0 : pov.altitude > 1 ? 1 : pov.altitude > 0.5 ? 2 : pov.altitude > 0.2 ? 3 : 4;
    if (step !== sizeStep) { sizeStep = step; globe.particlesSize(() => pointSize()); }
  }

  function applyQuality() {
    // Tope según el ajuste de calidad; dentro de él, el regulador de fluidez (tierra-hd.js) decide
    TierraHD.setBudget(state.settings.quality === 'ultra' ? 3 : state.settings.quality === 'high' ? 1.6 : 1);
    globe.renderer().setPixelRatio(TierraHD.ratio());
    globe.width(window.innerWidth).height(window.innerHeight);
  }

  function flyTo(lat, lng, altitude) {
    const pov = globe.pointOfView();
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat, lng, altitude: altitude || Math.min(pov.altitude, 0.9) }, 1400);
  }

  const ccOf = f => f.properties.ISO_A2 !== '-99' ? f.properties.ISO_A2 : ({ France: 'FR', Norway: 'NO', Kosovo: 'XK' })[f.properties.ADMIN] || null;
  function inRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function countryAt(lat, lng) {
    if (!state.geo) return null;
    for (const f of state.geo) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      if (polys.some(p => inRing(lng, lat, p[0]))) return ccOf(f);
    }
    return null;
  }

  function onMapTap(coords, poly) {
    if (!coords) return;
    const alt = globe.pointOfView().altitude;
    const radius = Math.max(20, Math.min(1200, alt * 320));
    const list = nearby(coords.lat, coords.lng, radius, 120);
    const cc = poly ? ccOf(poly) : countryAt(coords.lat, coords.lng);
    if (!list.length && !cc) { toast('No hay emisoras aquí. Prueba acercándote a tierra firme.'); return; }
    const title = cc ? `${flag(cc)} ${countryName(cc)}` : 'Emisoras cercanas';
    const tabs = [{ id: 'near', label: `Cerca (${list.length})`, render: renderStations(list, 'Toca otro punto o acércate para ver más.') }];
    if (cc && state.countryCount[cc]) tabs.push({ id: 'country', label: `Todo el país (${nf.format(state.countryCount[cc])})`, render: (b) => renderStations(countryStations(cc))(b) });
    openSheet({ title, sub: `Radio de búsqueda ≈ ${Math.round(radius)} km${state.genre !== 'all' ? ' · filtro: ' + genreLabel() : ''}`, tabs, active: list.length ? 'near' : 'country' });
  }

  function countryStations(cc) {
    return state.stations.filter(s => s.cc === cc && matchesGenre(s)).sort((a, b) => b.votes - a.votes);
  }
  const genreLabel = () => state.genre === 'all' ? 'Todas' : state.genre === 'other' ? G.OTHER.label : G.GENRES[state.genre].label;

  // ---------- hoja / listas ----------
  function openSheet(cfg) {
    state.sheet = cfg;
    $('#sheet-title').textContent = cfg.title;
    $('#sheet-sub').textContent = cfg.sub || '';
    const tabsEl = $('#sheet-tabs');
    tabsEl.innerHTML = (cfg.tabs.length > 1) ? cfg.tabs.map(t => `<button class="tab" data-tab="${t.id}" role="tab">${esc(t.label)}</button>`).join('') : '';
    showTab(cfg.active || cfg.tabs[0].id);
    const sh = $('#sheet'); sh.classList.add('open'); sh.setAttribute('aria-hidden', 'false'); document.body.classList.add('sheet-open');
    tvAfterOpenSheet();
  }
  function showTab(id) {
    const cfg = state.sheet; if (!cfg) return;
    const tab = cfg.tabs.find(t => t.id === id) || cfg.tabs[0];
    cfg.active = tab.id;
    document.querySelectorAll('#sheet-tabs .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab.id)));
    const body = $('#sheet-body'); body.scrollTop = 0;
    tab.render(body);
  }
  function closeSheet() {
    const sh = $('#sheet'); sh.classList.remove('open'); sh.setAttribute('aria-hidden', 'true'); document.body.classList.remove('sheet-open');
    state.sheet = null;
    tvAfterCloseSheet();
  }
  function isSheetOpen() { return $('#sheet').classList.contains('open'); }

  const PAGE = 60;
  function renderStations(list, emptyMsg) {
    return (body) => {
      body = body || $('#sheet-body');
      if (!list.length) { body.innerHTML = `<div class="empty">${esc(emptyMsg || 'No hay emisoras para este filtro.')}</div>`; return; }
      let shown = 0;
      body.innerHTML = '';
      body._list = list;
      const more = () => {
        const html = list.slice(shown, shown + PAGE).map(stationRow).join('');
        const old = body.querySelector('.more'); if (old) old.remove();
        body.insertAdjacentHTML('beforeend', html);
        shown += PAGE;
        if (shown < list.length) body.insertAdjacentHTML('beforeend', `<button class="more">Ver más (${nf.format(list.length - shown)})</button>`);
      };
      body._more = more;
      more();
    };
  }
  function stationRow(st) {
    const cur = state.current && state.current.id === st.id;
    const on = state.favs.has(st.id);
    const g = genreOf(st), t = TZ ? timeLabel(st) : '';
    return `<div class="st${cur ? ' cur' : ''}" data-id="${st.id}" role="button" tabindex="0">
      ${logoHtml(st)}
      <div class="meta"><div class="name">${esc(st.name)}</div>
      <div class="sub">${cur ? '<span class="pill live">● SONANDO</span>' : ''}<span class="pill g" style="background:${g.color}">${esc(g.label)}</span>
        <span class="pill">${flag(st.cc)} ${esc(countryName(st.cc))}</span>${st.codec ? `<span class="pill">${esc(st.codec)}${st.bitrate ? ' ' + st.bitrate + 'k' : ''}</span>` : ''}${t ? `<span class="pill">${t}</span>` : ''}</div></div>
      <button class="fav${on ? ' on' : ''}" data-fav="${st.id}" aria-label="Favorito"><svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 11.9 2 8.1 2 5 4.4 2.6 7.5 2.6c1.7 0 3.4.8 4.5 2.1a6 6 0 0 1 4.5-2.1C19.6 2.6 22 5 22 8.1c0 3.8-3.4 6.9-8.6 11.6L12 21Z"/></svg></button>
    </div>`;
  }


  // Lista de países
  function openCountries() {
    const rows = Object.keys(state.countryCount).map(cc => {
      const n = state.stations.reduce((a, s) => a + (s.cc === cc && matchesGenre(s) ? 1 : 0), 0);
      return { cc, n };
    }).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
    const render = (body) => {
      body.innerHTML = `<div class="search" style="height:40px;margin:2px 6px 8px"><input id="cq" placeholder="Filtrar países…" autocomplete="off"></div><div id="clist"></div>`;
      const draw = (q) => {
        const f = fold(q);
        $('#clist').innerHTML = rows.filter(r => !f || fold(countryName(r.cc)).includes(f)).map(r =>
          `<button class="country" data-cc="${r.cc}"><span class="flag">${flag(r.cc)}</span><span class="cname">${esc(countryName(r.cc))}</span><span class="cnt">${nf.format(r.n)}</span></button>`).join('');
      };
      draw('');
      $('#cq').addEventListener('input', e => draw(e.target.value));
    };
    openSheet({ title: 'Países', sub: `${rows.length} países${state.genre !== 'all' ? ' con ' + genreLabel() : ''}`, tabs: [{ id: 'c', label: 'Países', render }] });
  }
  function openCountry(cc) {
    const list = countryStations(cc);
    const withGeo = list.filter(s => s.lat !== null && !s.approx);
    const ref = withGeo.length ? withGeo : list.filter(s => s.lat !== null);
    if (ref.length) {
      const lat = ref.reduce((a, s) => a + s.lat, 0) / ref.length;
      const lng = ref.reduce((a, s) => a + s.lng, 0) / ref.length;
      flyTo(lat, lng, 1.1);
    }
    openSheet({ title: `${flag(cc)} ${countryName(cc)}`, sub: `${nf.format(list.length)} emisoras · ordenadas por popularidad`, tabs: [{ id: 'all', label: 'Todas', render: renderStations(list) }] });
  }

  function openFavs() {
    const favs = [...state.favs].map(id => state.byId.get(id)).filter(Boolean);
    const hist = state.history.map(id => state.byId.get(id)).filter(Boolean);
    openSheet({
      title: 'Tu radio', sub: 'Favoritos e historial guardados en este dispositivo',
      tabs: [
        { id: 'favs', label: `Favoritos (${favs.length})`, render: renderStations(favs, 'Aún no tienes favoritos. Toca ♥ en cualquier emisora.') },
        { id: 'hist', label: `Recientes (${hist.length})`, render: renderStations(hist, 'Todavía no has escuchado ninguna emisora.') }
      ],
      active: favs.length ? 'favs' : 'hist'
    });
  }

  // Capas y ajustes
  function openLayers() {
    const s = state.settings;
    const render = (body) => {
      const tog = (key, label, sub) => `<button class="toggle" data-set="${key}" role="switch" aria-checked="${!!s[key]}"><span>${label}<span class="t-sub">${sub}</span></span><span class="switch"></span></button>`;
      const legend = G.GENRES.concat([G.OTHER]).map(g => `<div><span class="tagdot" style="background:${g.color}"></span>${g.label}</div>`).join('');
      body.innerHTML = `<div class="settings">
        <h3>Mapa</h3>
        <div class="seg seg4">
          <button data-tex="real" aria-pressed="${s.texture === 'real'}"><span class="sw" style="background:linear-gradient(90deg,transparent 45%,rgba(4,6,20,.85) 55%),url(img/earth-blue-marble.jpg) center/cover"></span>Día y noche</button>
          <button data-tex="day" aria-pressed="${s.texture === 'day'}"><span class="sw" style="background-image:url(img/earth-blue-marble.jpg)"></span>Satélite</button>
          <button data-tex="night" aria-pressed="${s.texture === 'night'}"><span class="sw" style="background-image:url(img/earth-night.jpg)"></span>Noche</button>
          <button data-tex="clouds" aria-pressed="${!!s.clouds}"><span class="sw" style="background:#2b3a5c url(img/clouds-4k.jpg) center/cover"></span>Nubes</button>
        </div>
        ${s.texture === 'real' ? `<p class="status-line">Sombra de la noche en tiempo real (hora UTC ${new Date().toISOString().slice(11, 16)}).</p>` : ''}
        ${tog('borders', 'Fronteras de países', 'Toca un país para ver sus emisoras')}
        ${tog('rotate', 'Rotación automática', 'El planeta gira cuando no lo tocas')}
        <h3>Calidad de imagen</h3>
        <div class="seg">
          <button data-q="ultra" aria-pressed="${s.quality === 'ultra'}">Ultra ${maxTex >= 8192 ? '8K' : '4K'}</button>
          <button data-q="high" aria-pressed="${s.quality === 'high'}">Full HD</button>
          <button data-q="eco" aria-pressed="${s.quality === 'eco'}">Ahorro</button>
        </div>
        ${NATIVE && !IS_TV ? `<h3>Premium</h3><div class="premium">${state.premium
          ? `<h4>✨ Premium</h4><p class="ok">Activo: sin anuncios.</p><button class="btn" data-act="manage">Administrar suscripción</button>`
          : `<h4>✨ Orbe Radio Premium</h4><p>Sin banner ni anuncios al cambiar de emisora. <b>${esc(state.premiumPrice)}</b>, cancela cuando quieras desde Google Play.</p><button class="btn primary block" data-act="premium">Quitar anuncios · ${esc(state.premiumPrice)}</button>`}</div>` : ''}
        <h3>Colores por género</h3>
        <div class="legend">${legend}</div>
        <h3>Acerca de</h3>
        <p class="about">Catálogo: <b>${nf.format(state.stations.length)}</b> emisoras activas de ${Object.keys(state.countryCount).length} países, de
        <a href="https://www.radio-browser.info" target="_blank" rel="noopener">Radio Browser</a> (base de datos libre y comunitaria)${state.generated ? ', actualizado el ' + new Date(state.generated).toLocaleDateString('es') : ''}.
        Las emisoras sin coordenadas se muestran en una ubicación aproximada dentro de su país. Texturas del planeta: ${maxTex >= 8192 ? '8K (8192×4096) de <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> (CC BY 4.0), basadas en datos de la NASA' : 'NASA Blue Marble / Black Marble (4096×2048)'}.</p>
      </div>`;
    };
    openSheet({ layers: true, title: 'Capas y ajustes', sub: '', tabs: [{ id: 's', label: 'Ajustes', render }] });
  }
  function saveSettings() { store.set('settings', state.settings); }

  // ---------- géneros ----------
  function buildChips() {
    const counts = new Array(G.GENRES.length).fill(0); let other = 0;
    for (const st of state.stations) {
      if (!st.mask) { other++; continue; }
      for (let i = 0; i < G.GENRES.length; i++) if (st.mask & (1 << i)) counts[i]++;
    }
    const short = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' mil' : String(n);
    const items = [{ id: 'all', label: 'Todas', color: '#ffffff', n: state.stations.length }]
      .concat(G.GENRES.map((g, i) => ({ id: i, label: g.label, color: g.color, n: counts[i] })).sort((a, b) => b.n - a.n))
      .concat([{ id: 'other', label: G.OTHER.label, color: G.OTHER.color, n: other }]);
    $('#chips').innerHTML = items.map(c =>
      `<button class="chip" role="tab" data-genre="${c.id}" aria-selected="${String(state.genre) === String(c.id)}"><span class="dot" style="background:${c.color};color:${c.color}"></span>${esc(c.label)} <span class="n">${short(c.n)}</span></button>`).join('');
  }
  function setGenre(id) {
    state.genre = (id === 'all' || id === 'other') ? id : +id;
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-selected', String(c.dataset.genre === String(id))));
    refreshGlobePoints();
    if (state.query) runSearch(state.query);
  }

  function updateStats() {
    const list = (state.results || state.stations).filter(st => matchesGenre(st));
    const shownCountries = new Set(list.map(s => s.cc)).size;
    let label = state.results ? `Resultados para “${esc(state.query)}”: ` : (state.genre === 'all' ? '' : genreLabel() + ': ');
    $('#stats').innerHTML = `${label}<b>${nf.format(list.length)}</b> emisoras · <b>${shownCountries}</b> países` +
      (state.liveTotal && !state.results && state.genre === 'all' ? ` · ${nf.format(state.liveTotal)} en línea en Radio Browser` : '');
  }

  // ---------- búsqueda ----------
  let searchTimer;
  function runSearch(q) {
    state.query = q.trim();
    $('#q-clear').hidden = !state.query;
    if (!state.query) { state.results = null; refreshGlobePoints(); if (state.sheet && state.sheet.search) closeSheet(); return; }
    const terms = fold(state.query).split(/\s+/).filter(Boolean);
    const res = state.stations.filter(st => terms.every(t => st.hay.includes(t)));
    res.sort((a, b) => {
      const an = fold(a.name).startsWith(terms[0]) ? 1 : 0, bn = fold(b.name).startsWith(terms[0]) ? 1 : 0;
      return (bn - an) || (b.votes - a.votes);
    });
    state.results = res;
    refreshGlobePoints();
    const filtered = res.filter(matchesGenre);
    openSheet({ search: true, title: `Búsqueda: “${state.query}”`, sub: `${nf.format(filtered.length)} emisoras${state.genre !== 'all' ? ' · ' + genreLabel() : ''} · resaltadas en el globo`, tabs: [{ id: 'r', label: 'Resultados', render: renderStations(filtered, 'Sin resultados. Prueba con otra palabra (ej. “salsa”, “Bogotá”, “jazz”).') }] });
    $('#q').focus();
  }

  // ---------- reproducción ----------
  const audio = new Audio();
  audio.preload = 'none';
  let hls = null;
  let retried = false;

  function setStatus(s, msg) {
    state.status = s;
    $('#player').dataset.status = s;
    refreshNp();
    if (s === 'error') toast(msg || 'No se pudo reproducir esta emisora. Prueba otra.');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s === 'playing' ? 'playing' : 'paused';
  }
  window.onNativePlayer = (s, msg) => {
    if (s === 'error' && !retried && state.current) { retryFresh(state.current); return; }
    setStatus(s, msg);
  };

  function selectStation(st, opts = {}) {
    if (!st) return;
    play(st);
    if (opts.fly && st.lat !== null) flyTo(st.lat, st.lng);
    if (opts.list && st.lat !== null) {
      const list = nearby(st.lat, st.lng, 60, 80);
      if (list.length > 1) openSheet({ title: `${flag(st.cc)} Cerca de ${st.name}`, sub: `${list.length} emisoras en ~60 km`, tabs: [{ id: 'n', label: 'Cerca', render: renderStations(list) }] });
    }
  }

  function payload(st, url) {
    return { id: st.id, name: st.name, url: url || st.url, sub: stationSub(st), img: st.favicon || '', cc: st.cc || '' };
  }

  // Muestra la emisora en el reproductor (sin tocar el audio)
  function showPlayer(st) {
    state.current = st;
    const p = $('#player'); p.hidden = false;
    document.documentElement.style.setProperty('--player-h', '82px');
    $('#p-name').textContent = displayName(st.name);
    $('#p-logo').outerHTML = logoHtml(st).replace('<div class="logo', '<div id="p-logo" class="logo');
    $('#p-fav').classList.toggle('on', state.favs.has(st.id));
    document.querySelectorAll('.st').forEach(r => r.classList.toggle('cur', r.dataset.id === st.id));
    const g = genreOf(st);
    if (globe && st.lat !== null) globe.ringsData([{ lat: st.lat, lng: st.lng, rgb: hexToRgb(g.color).join(',') }]);
    renderPlayerSub();
  }
  function renderPlayerSub() {
    const st = state.current; if (!st) return;
    const sub = $('#p-sub');
    if (state.nowTitle) { sub.textContent = '♪ ' + state.nowTitle; sub.classList.add('song'); }
    else {
      const t = timeLabel(st);
      sub.textContent = (state.casting ? '📺 ' + (state.castName || 'TV') + ' · ' : '') + stationSub(st) + (t ? ' · ' + t : '');
      sub.classList.remove('song');
    }
  }
  setInterval(renderPlayerSub, 30000);

  function play(st, url) {
    retried = !!url;
    state.nowTitle = '';
    showPlayer(st);
    setStatus('loading');
    state.history = [st.id].concat(state.history.filter(id => id !== st.id)).slice(0, 60);
    store.set('history', state.history);
    syncNative();
    if (!url) countClick(st);
    const streamUrl = url || st.url;
    if (NATIVE) {
      // El anuncio a pantalla completa solo va al elegir emisora (no en los reintentos).
      window.AndroidRadio.playStation(JSON.stringify(payload(st, streamUrl)), !url);
    } else {
      webPlay(streamUrl, st);
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: st.name, artist: countryName(st.cc), album: 'Orbe Radio', artwork: st.favicon ? [{ src: st.favicon }] : [] });
      } catch (e) { /* opcional */ }
    }
  }

  // ---------- avisos que llegan del reproductor nativo ----------
  window.orbeToast = (m) => toast(m, 3500);
  window.onNativeMeta = (title) => {
    if (title === state.nowTitle) return;
    state.nowTitle = title || '';
    renderPlayerSub();
    refreshNp();
    if (title && state.status === 'playing') toast('♪ ' + title, 2500);
  };
  window.onNativeStation = (json) => {
    try {
      const o = JSON.parse(json);
      const st = state.byId.get(o.id) || { id: o.id, name: o.name, url: o.url, cc: o.cc, lat: null, lng: null, g: -1, mask: 0, favicon: o.img, codec: '', bitrate: 0, votes: 0 };
      if (!state.current || state.current.id !== st.id) showPlayer(st);
    } catch (e) { /* ignorar */ }
  };
  window.onNativeSleep = (min) => {
    const was = state.sleepMin; state.sleepMin = min;
    if (was > 0 && min === 0) toast('🌙 Buenas noches: la radio se apagó');
    refreshMenuStatus();
  };
  window.onNativePremium = (on, price) => {
    state.premium = !!on; if (price) state.premiumPrice = price;
    if (state.sheet && state.sheet.layers) showTab('s');
  };
  window.onNativeCast = (on, name) => {
    const was = state.casting; state.casting = !!on; state.castName = name || '';
    $('#player').classList.toggle('casting', state.casting);
    if (on && !was) toast('📺 Transmitiendo en ' + (name || 'tu TV'));
    if (!on && was) toast('Transmisión terminada');
    renderPlayerSub(); refreshMenuStatus();
  };

  function syncNative() {
    if (!NATIVE || typeof window.AndroidRadio.syncLibrary !== 'function') return;
    const map = id => { const s = state.byId.get(id); return s ? payload(s) : null; };
    try {
      window.AndroidRadio.syncLibrary(JSON.stringify({
        favs: [...state.favs].map(map).filter(Boolean).slice(0, 100),
        recents: state.history.map(map).filter(Boolean).slice(0, 40)
      }));
    } catch (e) { /* ignorar */ }
  }

  // ---------- menú de la emisora: compartir, TV, temporizador, alarma ----------
  let webSleepTimer = null, webSleepEnds = 0;
  function shareText(st) {
    return `🎧 Estoy escuchando ${st.name} (${flag(st.cc)} ${countryName(st.cc)}) en Orbe Radio, la radio de todo el mundo en un globo 3D.\n` +
      (st.home ? st.home + '\n' : '') + `https://www.radio-browser.info/history/${st.id}`;
  }
  function shareStation(st) {
    const text = shareText(st);
    if (NATIVE) { window.AndroidRadio.share(text); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }
  function setSleep(min) {
    if (NATIVE) {
      window.AndroidRadio.setSleep(min);
    } else {
      clearTimeout(webSleepTimer); webSleepTimer = null;
      webSleepEnds = min ? Date.now() + min * 60000 : 0;
      if (min) {
        webSleepTimer = setTimeout(() => {
          audio.pause(); setStatus('paused'); state.sleepMin = 0; webSleepEnds = 0;
          toast('🌙 Buenas noches: la radio se apagó'); refreshMenuStatus();
        }, min * 60000);
      }
    }
    state.sleepMin = min;
    toast(min ? `⏲️ La radio se apagará en ${min} min` : 'Temporizador desactivado', 1800);
    refreshMenuStatus();
  }
  function sleepLeft() {
    if (!NATIVE && webSleepEnds) return Math.max(0, Math.ceil((webSleepEnds - Date.now()) / 60000));
    return state.sleepMin;
  }
  function alarmInfo() {
    if (!NATIVE || typeof window.AndroidRadio.getAlarm !== 'function') return null;
    try { return JSON.parse(window.AndroidRadio.getAlarm()); } catch (e) { return null; }
  }
  function refreshMenuStatus() {
    const el = document.getElementById('sleep-status');
    if (el) { const m = sleepLeft(); el.innerHTML = m ? `Se apaga en <b>${m} min</b>` : 'Sin temporizador'; }
    document.querySelectorAll('[data-sleep]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sleep === state.sleepMin && state.sleepMin > 0)));
    const al = document.getElementById('alarm-status');
    if (al) {
      const a = alarmInfo();
      al.innerHTML = a && a.on
        ? `⏰ Alarma diaria a las <b>${String(a.h).padStart(2, '0')}:${String(a.m).padStart(2, '0')}</b> con <b>${esc(a.name)}</b> <button class="btn link" data-alarm-off>Quitar</button>`
        : 'Sin alarma';
    }
    const tv = document.querySelector('.action.tv'); if (tv) tv.classList.toggle('on', state.casting);
  }
  function openStationMenu() {
    const st = state.current; if (!st) return;
    const render = (body) => {
      const a = alarmInfo();
      const hh = a ? String(a.h).padStart(2, '0') + ':' + String(a.m).padStart(2, '0') : '07:00';
      body.innerHTML = `<div class="hero">${logoHtml(st)}<div><b>${esc(displayName(st.name))}</b><small>${esc(stationSub(st))}</small></div></div><div class="actions">
          ${IS_TV ? '' : `<button class="action wa" data-act="share"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>Compartir por WhatsApp</button>`}
          ${NATIVE && !IS_TV ? `<button class="action tv${state.casting ? ' on' : ''}" data-act="cast"><svg viewBox="0 0 24 24"><path d="M21 3H3a2 2 0 0 0-2 2v3h2V5h18v14h-7v2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2ZM1 18v3h3a3 3 0 0 0-3-3Zm0-4v2a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7Zm0-4v2a9 9 0 0 1 9 9h2A11 11 0 0 0 1 10Z"/></svg>${state.casting ? 'En ' + esc(state.castName || 'TV') : 'Ver en TV (Chromecast)'}</button>` : ''}
          ${st.home ? `<button class="action" data-act="web"><svg viewBox="0 0 24 24"><path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3h-7ZM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7Z"/></svg>Web de la emisora</button>` : ''}
        </div>
        <div class="settings">
          <h3>Temporizador para dormir</h3>
          <div class="seg seg6">${[15, 30, 45, 60, 90].map(m => `<button data-sleep="${m}" aria-pressed="false">${m} min</button>`).join('')}<button data-sleep="0" aria-pressed="false">Apagar</button></div>
          <p class="status-line" id="sleep-status"></p>
          <h3>Alarma con radio</h3>
          ${IS_TV ? `<p class="status-line">La alarma está en la app del teléfono.</p>` : NATIVE ? `<div class="alarm-row"><input type="time" id="alarm-time" value="${hh}"><button class="btn primary" data-act="alarm" style="flex:1">Despertarme con esta emisora</button></div>
          <p class="status-line" id="alarm-status"></p>` : `<p class="status-line">La alarma está disponible en la app de Android.</p>`}
        </div>`;
      refreshMenuStatus();
    };
    const t = timeLabel(st);
    openSheet({ title: st.name, sub: stationSub(st) + (t ? ' · hora local ' + t : ''), tabs: [{ id: 'm', label: 'Opciones', render }] });
  }

  function webPlay(url, st) {
    if (hls) { hls.destroy(); hls = null; }
    audio.pause();
    const isHls = st.hls || /\.m3u8(\?|$)/i.test(url);
    if (isHls && !audio.canPlayType('application/vnd.apple.mpegurl') && window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(url); hls.attachMedia(audio);
      hls.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) onWebError(); });
    } else {
      audio.src = url;
    }
    audio.play().catch(err => { if (err && err.name === 'NotAllowedError') setStatus('paused'); else onWebError(); });
  }
  function onWebError() {
    if (!retried && state.current) retryFresh(state.current);
    else setStatus('error');
  }
  audio.addEventListener('playing', () => setStatus('playing'));
  audio.addEventListener('waiting', () => setStatus('loading'));
  audio.addEventListener('pause', () => { if (state.status !== 'loading') setStatus('paused'); });
  audio.addEventListener('error', () => { if (audio.src) onWebError(); });

  // Si el enlace guardado ya no sirve, pide a Radio Browser la URL más reciente.
  async function retryFresh(st) {
    retried = true;
    try {
      const data = await apiJson('/json/stations/byuuid/' + encodeURIComponent(st.id));
      const fresh = data && data[0] && (data[0].url_resolved || data[0].url);
      if (fresh && fresh !== st.url && state.current === st) { st.url = fresh; play(st, fresh); return; }
    } catch (e) { /* sin conexión */ }
    if (state.current === st) setStatus('error');
  }

  function togglePlay() {
    if (!state.current) { randomStation(); return; }
    if (NATIVE) { window.AndroidRadio.toggle(); return; }
    if (state.status === 'playing' || state.status === 'loading') { audio.pause(); setStatus('paused'); }
    else if (hls || audio.src) { audio.play().catch(() => onWebError()); setStatus('loading'); }
    else play(state.current);
  }

  function randomStation() {
    const pool = (state.results || state.stations).filter(s => matchesGenre(s) && s.lat !== null);
    if (!pool.length) { toast('No hay emisoras con este filtro.'); return; }
    // Prioriza emisoras con algo de popularidad para que la sorpresa suene bien
    const good = pool.filter(s => s.votes > 5);
    const src = good.length > 20 ? good : pool;
    const st = src[Math.floor(Math.random() * src.length)];
    selectStation(st, { fly: true });
    toast(`${flag(st.cc)} ${st.name}`);
  }

  function toggleFav(id) {
    if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
    store.set('favs', [...state.favs]);
    syncNative();
    const on = state.favs.has(id);
    document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b => b.classList.toggle('on', on));
    if (state.current && state.current.id === id) $('#p-fav').classList.toggle('on', on);
    toast(on ? 'Añadida a favoritos' : 'Quitada de favoritos', 1400);
  }

  // ---------- API (estadísticas y conteo de clics, opcional) ----------
  async function apiJson(path) {
    for (const base of API) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(base + path, { signal: ctl.signal }); clearTimeout(t);
        if (r.ok) return await r.json();
      } catch (e) { /* siguiente espejo */ }
    }
    throw new Error('API no disponible');
  }
  function countClick(st) { apiJson('/json/url/' + encodeURIComponent(st.id)).catch(() => {}); }


  // =====================================================================
  //  Explorar: carruseles con logos (estilo apps de música y video)
  // =====================================================================
  const LATAM_CC = ['CO', 'MX', 'AR', 'CL', 'PE', 'EC', 'VE', 'BO', 'PY', 'UY', 'CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'DO', 'CU', 'PR', 'ES', 'US'];
  // Nombre corto y limpio: sin frecuencias ni siglas entre paréntesis
  function displayName(n) {
    const c = String(n || '').replace(/\s*[\(\[][^\)\]]*[\)\]]?/g, '').replace(/\s*[-–|·]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    return c.length >= 3 ? c : n;
  }
  function userCc() {
    const h = state.history.map(id => state.byId.get(id)).find(Boolean);
    if (h && h.cc) return h.cc;
    const m = (navigator.language || '').match(/-([A-Za-z]{2})$/);
    return m ? m[1].toUpperCase() : 'CO';
  }
  const hasLogo = st => !!st.favicon;
  const gIndex = id => G.GENRES.findIndex(g => g.id === id);
  function tileHtml(st, ri) {
    const cur = state.current && state.current.id === st.id;
    return `<button class="tile${cur ? ' cur' : ''}" data-tile="${esc(st.id)}" data-rail="${ri}">${logoHtml(st)}
      <b>${esc(displayName(st.name))}</b><small>${flag(st.cc)} ${esc(countryName(st.cc))}</small></button>`;
  }
  function openExplore() {
    const rails = buildRails().filter(r => r.list.length);
    state.rails = rails.map(r => r.list);
    const render = body => {
      body.innerHTML = rails.map((r, i) => `<section class="rail"><div class="rail-head"><h3>${esc(r.title)}</h3><small>${esc(r.sub || '')}</small></div>
        <div class="rail-row">${r.list.map(st => tileHtml(st, i)).join('')}</div></section>`).join('');
    };
    openSheet({ explore: true, title: EXPLORE_TITLE, sub: EXPLORE_SUB, tabs: [{ id: 'e', label: 'Explorar', render }] });
  }

  const EXPLORE_TITLE = 'Explorar', EXPLORE_SUB = 'Las mejores emisoras para ti';
  function buildRails() {
    const cc = userCc();
    const top = (arr, n = 18) => arr.filter(s => s.lat !== null).sort((a, b) => (hasLogo(b) - hasLogo(a)) || (b.votes - a.votes)).slice(0, n);
    const rails = [];
    const rec = state.history.map(id => state.byId.get(id)).filter(Boolean).slice(0, 15);
    if (rec.length) rails.push({ title: 'Escuchadas recientemente', list: rec });
    const fav = [...state.favs].map(id => state.byId.get(id)).filter(Boolean);
    if (fav.length) rails.push({ title: 'Tus favoritas', sub: '♥', list: fav });
    rails.push({ title: `Populares en ${countryName(cc)}`, sub: flag(cc), list: top(state.stations.filter(s => s.cc === cc)) });
    rails.push({ title: 'Lo más escuchado del mundo', sub: '🌍', list: top(state.stations.slice(), 20) });
    for (const [id, t] of [['latin', 'Música latina'], ['pop', 'Pop y éxitos'], ['news', 'Noticias'], ['electronic', 'Electrónica'],
      ['rock', 'Rock'], ['oldies', 'Clásicos y retro'], ['jazz', 'Jazz y blues'], ['chill', 'Para relajarse']]) {
      const gi = gIndex(id); if (gi < 0) continue;
      rails.push({ title: t, sub: G.GENRES[gi].label, list: top(state.stations.filter(s => s.mask & (1 << gi)), 16) });
    }
    return rails;
  }

  // =====================================================================
  //  Pantalla "Reproduciendo"
  // =====================================================================
  const SVG_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const SVG_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  const SVG_MORE = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>';
  function openNowPlaying() {
    const st = state.current; if (!st) return;
    const render = body => {
      const g = genreOf(st), on = state.favs.has(st.id), t = timeLabel(st);
      const playing = state.status === 'playing' || state.status === 'loading';
      body.innerHTML = `<div class="np">
        ${st.favicon ? `<div class="np-bg" style="background-image:url('${esc(st.favicon)}')"></div>` : `<div class="np-bg" style="background:radial-gradient(circle at 50% 30%, ${g.color}, transparent 70%)"></div>`}
        ${logoHtml(st, 'big')}
        <div class="np-name">${esc(displayName(st.name))}</div>
        <div class="np-sub"><span class="pill g" style="background:${g.color}">${esc(g.label)}</span><span class="pill">${flag(st.cc)} ${esc(countryName(st.cc))}</span>
          ${st.codec ? `<span class="pill">${esc(st.codec)}${st.bitrate ? ' · ' + st.bitrate + ' kbps' : ''}</span>` : ''}${t ? `<span class="pill">${t}</span>` : ''}</div>
        ${state.nowTitle ? `<div class="np-song"><small>Sonando ahora</small>${esc(state.nowTitle)}</div>` : ''}
        <div class="np-ctrl">
          <button class="icon-btn${on ? ' on' : ''}" data-act="np-fav" aria-label="Favorito"><svg viewBox="0 0 24 24"><path d="M12 21 10.6 19.7C5.4 15 2 11.9 2 8.1 2 5 4.4 2.6 7.5 2.6c1.7 0 3.4.8 4.5 2.1a6 6 0 0 1 4.5-2.1C19.6 2.6 22 5 22 8.1c0 3.8-3.4 6.9-8.6 11.6L12 21Z"/></svg></button>
          <button class="big-play" data-act="np-play" aria-label="Reproducir o pausar">${playing ? SVG_PAUSE : SVG_PLAY}</button>
          <button class="icon-btn" data-act="np-more" aria-label="Más opciones">${SVG_MORE}</button>
        </div>
        <div class="np-links"><button class="btn" data-act="share">Compartir</button><button class="btn" data-act="np-near">Emisoras cercanas</button>
          ${st.home ? '<button class="btn" data-act="web">Web</button>' : ''}</div>
      </div>`;
    };
    openSheet({ np: true, title: 'Reproduciendo', sub: state.casting ? '📺 En ' + (state.castName || 'tu TV') : 'En vivo', tabs: [{ id: 'np', label: 'Reproduciendo', render }] });
  }
  function refreshNp() { if (state.sheet && state.sheet.np && document.activeElement.tagName !== 'INPUT') showTab('np'); }

  // ---------- eventos ----------
  function bindUI() {
    $('#q').addEventListener('input', e => { clearTimeout(searchTimer); const v = e.target.value; searchTimer = setTimeout(() => runSearch(v), 220); });
    $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); } });
    $('#q-clear').addEventListener('click', () => { $('#q').value = ''; runSearch(''); });
    $('#btn-countries').addEventListener('click', openCountries);
    $('#btn-favs').addEventListener('click', openFavs);
    $('#btn-layers').addEventListener('click', openLayers);
    $('#sheet-close').addEventListener('click', closeSheet);
    $('#chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) setGenre(c.dataset.genre); });
    $('#sheet-tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) showTab(t.dataset.tab); });
    $('#sheet-body').addEventListener('click', e => {
      const tl = e.target.closest('[data-tile]');
      if (tl) { const list = state.rails[+tl.dataset.rail] || []; const st = list.find(x => x.id === tl.dataset.tile); if (st) selectStation(st, { fly: true, ctx: list }); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        const st = state.current; const k = act.dataset.act;
        if (k === 'share' && st) shareStation(st);
        if (k === 'np-play') { togglePlay(); setTimeout(refreshNp, 300); }
        if (k === 'np-fav' && st) { toggleFav(st.id); refreshNp(); }
        if (k === 'np-more') openStationMenu();
        if (k === 'np-near' && st && st.lat !== null) { const list = nearby(st.lat, st.lng, 60, 80); openSheet({ title: `${flag(st.cc)} Cerca de ${st.name}`, sub: `${list.length} emisoras en ~60 km`, tabs: [{ id: 'n', label: 'Cerca', render: renderStations(list) }] }); }
        if (k === 'cast') window.AndroidRadio.cast();
        if (k === 'web' && st && st.home) { if (NATIVE) window.AndroidRadio.openUrl(st.home); else window.open(st.home, '_blank', 'noopener'); }
        if (k === 'alarm' && st) {
          const v = ($('#alarm-time').value || '07:00').split(':');
          window.AndroidRadio.setAlarm(+v[0], +v[1], JSON.stringify(payload(st)));
          toast(`⏰ Te despertará ${st.name} a las ${v[0]}:${v[1]}`); setTimeout(refreshMenuStatus, 300);
        }
        if (k === 'premium') window.AndroidRadio.buyPremium();
        if (k === 'manage') window.AndroidRadio.manageSubscription();
        return;
      }
      if (e.target.closest('[data-alarm-off]')) { window.AndroidRadio.cancelAlarm(); toast('Alarma quitada', 1500); setTimeout(refreshMenuStatus, 200); return; }
      const sl = e.target.closest('[data-sleep]'); if (sl) { setSleep(+sl.dataset.sleep); return; }
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
      const more = e.target.closest('.more'); if (more) { $('#sheet-body')._more(); return; }
      const row = e.target.closest('.st'); if (row) { selectStation(state.byId.get(row.dataset.id), { fly: true }); return; }
      const c = e.target.closest('.country'); if (c) { openCountry(c.dataset.cc); return; }
      const tex = e.target.closest('[data-tex]');
      if (tex) {
        const v = tex.dataset.tex;
        if (v === 'clouds') { state.settings.clouds = !state.settings.clouds; setClouds(state.settings.clouds); tex.setAttribute('aria-pressed', String(state.settings.clouds)); }
        else {
          setTexture(v);
          saveSettings(); showTab('s'); return;
        }
        saveSettings(); return;
      }
      const q = e.target.closest('[data-q]');
      if (q) {
        const was8k = use8k(); state.settings.quality = q.dataset.q; applyQuality(); TierraHD.resetQuality(); saveSettings();
        if (was8k !== use8k()) { setTexture(state.settings.texture); } document.querySelectorAll('[data-q]').forEach(b => b.setAttribute('aria-pressed', String(b === q))); return; }
      const set = e.target.closest('[data-set]');
      if (set) {
        const k = set.dataset.set; state.settings[k] = !state.settings[k]; set.setAttribute('aria-checked', String(state.settings[k])); saveSettings();
        if (k === 'borders') globe.polygonsData(state.settings.borders ? (state.geo || []) : []);
        if (k === 'rotate') globe.controls().autoRotate = state.settings.rotate;
      }
    });
    $('#sheet-body').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('st')) e.target.click(); });
    $('#p-play').addEventListener('click', togglePlay);
    $('#btn-explore').addEventListener('click', openExplore);
    $('#p-shuffle').addEventListener('click', randomStation);
    $('#p-more').addEventListener('click', openStationMenu);
    $('#p-fav').addEventListener('click', () => state.current && toggleFav(state.current.id));
    $('#player-info').addEventListener('click', openNowPlaying);

    // Deslizar la hoja hacia abajo para cerrarla
    let y0 = null;
    const sheet = $('#sheet');
    sheet.addEventListener('touchstart', e => { if ($('#sheet-body').scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchmove', e => { if (y0 !== null && e.touches[0].clientY - y0 > 90) { y0 = null; closeSheet(); } }, { passive: true });
    sheet.addEventListener('touchend', () => { y0 = null; });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('nexttrack', randomStation);
      } catch (e) { /* opcional */ }
    }
  }

  // Botón "atrás" de Android: devuelve true si la app lo gestionó
  window.orbeBack = () => {
    if (IS_TV && globeMode && !isSheetOpen()) { exitGlobeMode(); return true; }
    if (isSheetOpen()) { closeSheet(); return true; }
    if (state.query) { $('#q').value = ''; runSearch(''); return true; }
    return false;
  };

  // ---------- Android TV / Google TV: control remoto ----------
  let globeMode = false, focusBeforeSheet = null, hintTimer = null;

  function isVisibleFocusable(el) {
    if (el.disabled || el.closest('[hidden]')) return false;
    const sheet = el.closest('#sheet');
    if (sheet && !sheet.classList.contains('open')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function focusables(scope) {
    return [...scope.querySelectorAll('button, input, [tabindex="0"]')].filter(isVisibleFocusable);
  }
  function focusEl(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  // Busca el elemento más cercano en la dirección pulsada (navegación espacial).
  function moveFocus(dir) {
    const scope = isSheetOpen() ? $('#sheet') : document.body;
    const cur = document.activeElement;
    const list = focusables(scope).filter(el => el !== cur && (isSheetOpen() || !el.closest('#sheet')));
    if (!cur || cur === document.body || !scope.contains(cur)) { focusEl(list[0]); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of list) {
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      let main, cross;
      if (dir === 'right') { if (dx <= 4) continue; main = dx; cross = Math.abs(dy); }
      else if (dir === 'left') { if (dx >= -4) continue; main = -dx; cross = Math.abs(dy); }
      else if (dir === 'down') { if (dy <= 4) continue; main = dy; cross = Math.abs(dx); }
      else { if (dy >= -4) continue; main = -dy; cross = Math.abs(dx); }
      const score = main + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) focusEl(best);
  }

  function tvHint(html, ms) {
    const h = $('#tv-hint'); if (!h) return;
    h.innerHTML = html; h.classList.add('show');
    clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(() => h.classList.remove('show'), ms);
  }
  const GLOBE_HELP = '<b>◀ ▲ ▼ ▶</b> girar el planeta · <b>OK</b> acercar y ver emisoras · <b>ATRÁS</b> volver al menú';

  function enterGlobeMode() {
    globeMode = true;
    if (document.activeElement) document.activeElement.blur();
    document.documentElement.classList.add('globe-mode');
    globe.controls().autoRotate = false;
    describeCenter();
  }
  function exitGlobeMode() {
    globeMode = false;
    document.documentElement.classList.remove('globe-mode');
    $('#tv-hint').classList.remove('show');
    // Al volver al menú el planeta se aleja y sigue girando.
    const pov = globe.pointOfView();
    globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: Math.max(pov.altitude, 2.2) }, 900);
    globe.controls().autoRotate = state.settings.rotate;
    focusEl($('#btn-globe'));
  }
  let describeTimer = null;
  function describeCenter() {
    clearTimeout(describeTimer);
    describeTimer = setTimeout(() => {
      const pov = globe.pointOfView();
      const cc = countryAt(pov.lat, pov.lng);
      const n = nearby(pov.lat, pov.lng, Math.max(20, Math.min(1200, pov.altitude * 320)), 999).length;
      const where = cc ? `${flag(cc)} <b>${esc(countryName(cc))}</b>` : '🌊 Océano';
      tvHint(`${where} · ${n ? nf.format(n) + ' emisoras cerca' : 'sin emisoras aquí'}<br><span>${GLOBE_HELP}</span>`);
    }, 180);
  }
  function rotateGlobe(dir) {
    const pov = globe.pointOfView();
    const step = Math.max(0.6, pov.altitude * 8);
    let { lat, lng } = pov;
    if (dir === 'left') lng -= step;
    if (dir === 'right') lng += step;
    if (dir === 'up') lat = Math.min(80, lat + step);
    if (dir === 'down') lat = Math.max(-80, lat - step);
    globe.pointOfView({ lat, lng, altitude: pov.altitude }, 220);
    describeCenter();
  }
  function zoomGlobe(f) {
    const pov = globe.pointOfView();
    globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: Math.max(0.12, Math.min(3.5, pov.altitude * f)) }, 400);
    describeCenter();
  }
  function exploreCenter() {
    const pov = globe.pointOfView();
    const alt = Math.max(0.15, pov.altitude * 0.6);
    globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: alt }, 500);
    setTimeout(() => onMapTap({ lat: pov.lat, lng: pov.lng }), 520);
  }

  function setupTV() {
    document.documentElement.classList.add('tv');
    $('#btn-globe').hidden = false;
    $('#btn-globe').addEventListener('click', enterGlobeMode);
    document.addEventListener('keydown', e => {
      const k = e.key;
      const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[k];
      if (globeMode && !isSheetOpen()) {
        if (dir) { e.preventDefault(); rotateGlobe(dir); return; }
        if (k === 'Enter' || k === ' ') { e.preventDefault(); exploreCenter(); return; }
        if (['PageUp', 'ChannelUp', 'MediaFastForward', '+'].includes(k)) { e.preventDefault(); zoomGlobe(0.7); return; }
        if (['PageDown', 'ChannelDown', 'MediaRewind', '-'].includes(k)) { e.preventDefault(); zoomGlobe(1.45); return; }
        return;
      }
      if (!dir) return;
      const ae = document.activeElement;
      // En el buscador, izquierda/derecha mueven el cursor del texto.
      if (ae && ae.tagName === 'INPUT' && (dir === 'left' || dir === 'right') && ae.value) return;
      e.preventDefault();
      moveFocus(dir);
    }, true);
    setTimeout(() => focusEl($('#btn-globe')), 600);
    tvHint('Usa las <b>flechas</b> y <b>OK</b> del control remoto. Pulsa <b>🌍</b> para explorar el planeta.', 6000);
  }

  // Al abrir o cerrar una hoja, el foco entra en ella y vuelve después.
  function tvAfterOpenSheet() {
    if (!IS_TV) return;
    $('#tv-hint').classList.remove('show');
    if (!focusBeforeSheet && document.activeElement && document.activeElement !== document.body) focusBeforeSheet = document.activeElement;
    setTimeout(() => {
      const first = $('#sheet-body .st') || $('#sheet-body button, #sheet-body input') || $('#sheet-close');
      focusEl(first);
    }, 120);
  }
  function tvAfterCloseSheet() {
    if (!IS_TV) return;
    const back = focusBeforeSheet; focusBeforeSheet = null;
    if (globeMode) { if (document.activeElement) document.activeElement.blur(); describeCenter(); return; }
    focusEl(back && isVisibleFocusable(back) ? back : $('#btn-globe'));
  }

  // ---------- arranque ----------
  async function start() {
    try {
      await loadCatalog();
    } catch (e) {
      $('#splash-msg').textContent = 'Error cargando el catálogo: ' + e.message;
      return;
    }
    $('#splash-msg').textContent = 'Pintando el planeta en Ultra HD…';
    buildChips();
    bindUI();
    initGlobe();
    if (IS_TV) setupTV();
    if (!store.get('explored', false)) { store.set('explored', true); setTimeout(openExplore, 2200); }
    updateStats();
    syncNative();
    apiJson('/json/stats').then(s => { state.liveTotal = s.stations; updateStats(); }).catch(() => {});
  }
  start();
})();
