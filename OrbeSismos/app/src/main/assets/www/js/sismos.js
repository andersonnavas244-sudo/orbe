/* Orbe Sismos – sismos, tsunamis y volcanes en vivo sobre un globo 3D */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const N = window.AndroidSismos || null;
  const NATIVE = !!(N && typeof N.fetchText === 'function');
  const nf = new Intl.NumberFormat('es');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sismos.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sismos.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐';

  const state = {
    quakes: [], context: [], range: 'day', showVolc: true,
    me: store.get('me', null), places: store.get('places', []), addLabel: null,
    settings: Object.assign({ minMag: 4.5, radius: 300, world: true, tsunami: true, watch: true, rain: true, voice: true }, store.get('alerts', {})),
    volc: [], activeVolc: [], hist: [], radios: [], lugares: null, tsunamis: [], sheet: null, premium: false
  };

  // ---------- red: en Android pasa por la app (sin restricciones del navegador) ----------
  const pending = new Map(); let seq = 0;
  window.__orbeFetched = (id, ok, text) => {
    const p = pending.get(id); if (!p) return;
    pending.delete(id); ok ? p.res(text) : p.rej(new Error(text || 'error'));
  };
  function getText(url) {
    if (NATIVE) {
      return new Promise((res, rej) => {
        const id = ++seq; pending.set(id, { res, rej });
        N.fetchText(url, id);
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('tiempo agotado')); } }, 25000);
      });
    }
    return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }
  const getJSON = url => getText(url).then(t => JSON.parse(t));
  const local = url => fetch(url).then(r => r.json());

  // ---------- utilidades ----------
  let toastTimer;
  function toast(msg, ms = 2800) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  window.orbeToast = m => toast(m, 3500);
  function distKm(aLat, aLng, bLat, bLng) {
    const R = 6371, r = Math.PI / 180;
    const x = Math.sin((bLat - aLat) * r / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin((bLng - aLng) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'hace instantes';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const d = Math.round(s / 86400); return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  }
  const fmtDate = t => new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  const DIR = { N: 'N', S: 'S', E: 'E', W: 'O' };
  function esPlace(p) {
    if (!p) return 'Lugar sin nombre';
    const m = p.match(/^(\d+(?:\.\d+)?) km ([NSEW]{1,3}) of (.+)$/);
    if (m) return `${m[1]} km al ${m[2].split('').map(c => DIR[c]).join('')} de ${m[3]}`;
    return p.replace(/ region$/i, ' (región)');
  }
  const title = s => s.toLowerCase().replace(/(^|[\s,(\-/])(\S)/g, (a, b, c) => b + c.toUpperCase());
  function magColor(m) {
    return m >= 7 ? '#ff2d55' : m >= 6 ? '#ff5a3c' : m >= 5 ? '#ff9a2e' : m >= 4 ? '#ffd166' : m >= 3 ? '#b7e36a' : '#7fd1ff';
  }
  function ageColor(q) {
    const h = (Date.now() - q.time) / 3600000;
    return h < 1 ? '#ff2d55' : h < 24 ? '#ff8a3d' : h < 168 ? '#ffd166' : '#9fb3cf';
  }
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); };
  function explainMag(m) {
    if (m < 2.5) return 'Microsismo: en general no se siente.';
    if (m < 4) return 'Leve: se siente cerca del epicentro, rara vez causa daños.';
    if (m < 5) return 'Moderado: se siente con claridad y puede mover objetos. Los daños son poco comunes.';
    if (m < 6) return 'Fuerte: puede causar daños en construcciones débiles cerca del epicentro.';
    if (m < 7) return 'Muy fuerte: puede causar daños importantes en zonas pobladas.';
    if (m < 8) return 'Mayor: puede causar daños graves en áreas amplias.';
    return 'Gran terremoto: puede causar destrucción en cientos de kilómetros y tsunamis si ocurre en el mar.';
  }
  const near = q => { const n = nearestPlace(q); return !!n && n.d <= state.settings.radius; };
  const distTxt = q => { const n = nearestPlace(q); return n ? `${nf.format(Math.round(n.d))} km de ${n.place.label === 'Casa' ? 'ti' : n.place.name}` : ''; };

  // ---------- fuentes de sismos (USGS + EMSC) ----------
  const USGS = {
    hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'
  };
  const RANGE = { hour: [1, 0], day: [24, 2], week: [168, 3], month: [720, 4] };   // horas, magnitud mínima EMSC
  function emscUrl(range) {
    const [h, mm] = RANGE[range];
    const start = new Date(Date.now() - h * 3600000).toISOString().slice(0, 19);
    return `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=2000&minmag=${mm}&starttime=${start}`;
  }
  function fromUsgs(f) {
    const p = f.properties, [lon, lat, depth] = f.geometry.coordinates;
    return { id: 'us:' + f.id, mag: p.mag ?? 0, lat, lon, depth: depth || 0, time: p.time, place: esPlace(p.place),
      url: p.url, tsunami: !!p.tsunami, felt: p.felt || 0, src: 'USGS', alert: p.alert || '' };
  }
  function fromEmsc(f) {
    const p = f.properties;
    return { id: 'em:' + (p.unid || f.id), mag: p.mag ?? 0, lat: p.lat, lon: p.lon, depth: p.depth || 0, time: Date.parse(p.time),
      place: title(p.flynn_region || ''), url: `https://www.emsc-csem.org/Earthquake_information/earthquake.php?id=${p.source_id}`,
      tsunami: false, felt: 0, src: 'EMSC', alert: '' };
  }
  // Une USGS y EMSC sin repetir el mismo sismo (misma hora ±90 s y a menos de 150 km)
  function merge(a, b) {
    const out = a.slice();
    for (const q of b) {
      const dup = out.find(x => Math.abs(x.time - q.time) < 90000 && distKm(x.lat, x.lon, q.lat, q.lon) < 150);
      if (!dup) out.push(q);
    }
    return out.filter(q => isFinite(q.lat) && isFinite(q.lon) && q.time).sort((x, y) => y.time - x.time);
  }
  async function loadQuakes(range) {
    const [u, e] = await Promise.allSettled([getJSON(USGS[range]), getJSON(emscUrl(range))]);
    const us = u.status === 'fulfilled' ? u.value.features.map(fromUsgs) : [];
    const em = e.status === 'fulfilled' ? e.value.features.map(fromEmsc) : [];
    if (!us.length && !em.length) throw new Error('sin datos');
    return merge(us, em);
  }

  // ---------- globo ----------
  let globe;
  function initGlobe() {
    globe = new Globe($('#globe'), { animateIn: true, waitForGlobeReady: true, rendererConfig: { antialias: true, powerPreference: 'high-performance' } })
      .globeImageUrl('img/earth-blue-marble.jpg')
      .bumpImageUrl('img/earth-topology.png')
      .backgroundImageUrl('img/stars-4k.jpg')
      .globeCurvatureResolution(2)
      .showAtmosphere(true).atmosphereColor('#5ec8ff').atmosphereAltitude(0.17)
      // Sismos: columnas de luz (altura y grosor según magnitud, color según qué tan reciente)
      .pointLat('lat').pointLng('lon')
      .pointAltitude(q => 0.003 + Math.max(0, q.mag) ** 1.5 * 0.0035)
      .pointRadius(q => 0.12 + Math.max(0, q.mag) ** 1.5 * 0.045)
      .pointColor(q => ageColor(q)).pointResolution(6)
      .pointsTransitionDuration(0)
      .pointLabel(q => `<b>M${q.mag.toFixed(1)}</b> · ${esc(q.place)}<br><span style="opacity:.75">${ago(q.time)}</span>`)
      .onPointClick(q => openQuake(q, true))
      // Últimas 24 h: ondas que laten
      .ringLat('lat').ringLng('lon')
      .ringColor(r => t => `rgba(${r.rgb},${(1 - t) * 0.9})`)
      .ringMaxRadius(r => r.max).ringPropagationSpeed(r => r.speed).ringRepeatPeriod(r => r.period).ringAltitude(0.004)
      // Volcanes: puntos naranjas; los activos esta semana con 🌋
      .particleLat('lat').particleLng('lon').particleAltitude(0.004).particlesList(d => d.items)
      .particlesSize(() => 2.4).particlesSizeAttenuation(false).particlesColor(() => '#c77dff')
      .particleLabel(v => v && v.name ? `🌋 <b>${esc(v.name)}</b><br>${esc(v.country)}` : '')
      .onParticleClick(v => v && v.name && openVolcano(v))
      .htmlLat('lat').htmlLng('lon').htmlAltitude(0.012).htmlElement(d => d.el)
      .onGlobeClick(c => nearestQuake(c))
      .onGlobeReady(() => {
        setupHD();
        const sp = $('#splash'); $('#splash-bar').style.width = '100%';
        setTimeout(() => sp.classList.add('gone'), 200); setTimeout(() => sp.remove(), 900);
      });
    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(window.devicePixelRatio || 1, 2));   // el regulador de fluidez ajusta
    const c = globe.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.3; c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 101.5; c.maxDistance = 900;
    c.addEventListener('start', () => { c.autoRotate = false; });
    const pov = state.me ? { lat: state.me.lat, lng: state.me.lon, altitude: 1.9 } : { lat: 5, lng: -75, altitude: 2.2 };
    globe.pointOfView(pov);
    window.addEventListener('resize', () => globe.width(innerWidth).height(innerHeight));
  }
  // Tierra Ultra HD (js/tierra-hd.js): día y noche reales, relieve, reflejo del mar y atmósfera.
  // La noche se deja un poco más clara para que el mapa se lea bien junto a los sismos.
  function setupHD() {
    if (!window.TierraHD || !TierraHD.init(globe)) return;
    const big = TierraHD.can8k();
    TierraHD.createEarth({ day: big ? 'img/8k/8k_earth_daymap.jpg' : 'img/earth-blue-marble.jpg', night: 'img/earth-night.jpg',
      normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' }, { nightAmbient: 0.22 })
      .then(mat => globe.globeMaterial(mat)).catch(() => {});
  }
  function drawQuakes() {
    if (!globe) return;
    globe.pointsData(state.quakes);
    const day = Date.now() - 86400000;
    const rings = state.quakes.filter(q => q.time > day && q.mag >= 3.5).slice(0, 60).map(q => ({
      lat: q.lat, lon: q.lon, rgb: hexRgb(magColor(q.mag)),
      max: 1.5 + q.mag ** 1.6 * 0.35, speed: 1.2 + q.mag * 0.3, period: 1600 - Math.min(900, q.mag * 120)
    }));
    if (state.me) rings.push({ lat: state.me.lat, lon: state.me.lon, rgb: '34,211,238', max: state.settings.radius / 111, speed: state.settings.radius / 111 * 0.6, period: 2600 });
    globe.ringsData(rings);
    updateStats();
  }
  function drawMarkers() {
    if (!globe) return;
    const els = [];
    if (state.showVolc) {
      for (const v of state.activeVolc) {
        const el = document.createElement('div');
        el.className = 'volc-active'; el.textContent = '🌋'; el.title = v.name;
        el.addEventListener('click', ev => { ev.stopPropagation(); openVolcano(v); });
        els.push({ lat: v.lat, lon: v.lon, el });
      }
    }
    for (const pl of allPlaces()) {
      const el = document.createElement('div'); el.className = 'me-pin'; el.title = pl.label + ': ' + pl.name;
      els.push({ lat: pl.lat, lon: pl.lon, el });
    }
    globe.htmlElementsData(els);
    globe.particlesData(state.showVolc ? [{ items: state.volc }] : []);
  }
  function flyTo(lat, lon, alt = 0.9) {
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat, lng: lon, altitude: alt }, 1300);
  }
  function nearestQuake(c) {
    if (!c) return;
    let best = null, bd = Infinity;
    for (const q of state.quakes) { const d = distKm(c.lat, c.lng, q.lat, q.lon); if (d < bd) { bd = d; best = q; } }
    if (best && bd < 400) openQuake(best, false);
  }

  // ---------- cabecera ----------
  function updateStats() {
    const n = state.quakes.length;
    const strong = state.quakes.filter(q => q.mag >= 5).length;
    const lbl = { hour: 'la última hora', day: 'las últimas 24 h', week: 'los últimos 7 días', month: 'los últimos 30 días' }[state.range];
    $('#stats').innerHTML = `<b>${nf.format(n)}</b> sismos en ${lbl} · <b>${strong}</b> de magnitud 5 o más · fuentes: USGS y EMSC`;
    updateZone();
  }
  function updateZone() {
    const dot = $('#zone-dot');
    if (!state.me) { $('#zone-title').textContent = 'Elige tu ubicación'; $('#zone-sub').textContent = 'Para avisarte de sismos cerca de ti'; return; }
    const pool = merge(state.context, state.quakes);
    const nearQ = pool.filter(near).sort((a, b) => b.time - a.time);
    const last = nearQ[0];
    $('#zone-title').textContent = `📍 ${state.me.name}`;
    if (!last) {
      $('#zone-sub').textContent = `Sin sismos registrados a menos de ${state.settings.radius} km esta semana`;
      dot.style.background = dot.style.color = 'var(--ok)';
    } else {
      $('#zone-sub').textContent = `Último cerca: M${last.mag.toFixed(1)} ${ago(last.time)} · ${distTxt(last)}`;
      const c = last.mag >= state.settings.minMag ? 'var(--danger)' : last.mag >= 3.5 ? 'var(--warn)' : 'var(--ok)';
      dot.style.background = dot.style.color = c;
    }
  }

  // ---------- hoja (pestañas) ----------
  function openSheet(cfg) {
    state.sheet = cfg;
    $('#sheet-title').textContent = cfg.title;
    $('#sheet-sub').textContent = cfg.sub || '';
    $('#sheet-tabs').innerHTML = cfg.tabs.length > 1 ? cfg.tabs.map(t => `<button class="tab" data-tab="${t.id}">${esc(t.label)}</button>`).join('') : '';
    showTab(cfg.active || cfg.tabs[0].id);
    $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false');
  }
  function showTab(id) {
    const cfg = state.sheet; if (!cfg) return;
    const t = cfg.tabs.find(x => x.id === id) || cfg.tabs[0];
    cfg.active = t.id;
    document.querySelectorAll('#sheet-tabs .tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t.id)));
    const body = $('#sheet-body'); body.scrollTop = 0;
    t.render(body);
  }
  function closeSheet() {
    $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true');
    state.sheet = null; selectTab('mapa', true);
  }
  const isOpen = () => $('#sheet').classList.contains('open');
  function selectTab(tab, silent) {
    document.querySelectorAll('#tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (silent) return;
    if (tab === 'mapa') { if (isOpen()) closeSheet(); return; }
    ({ sismos: openSismos, noticias: openNoticias, radio: openRadio, seguridad: openSeguridad })[tab]();
  }

  // ---------- pestaña Sismos ----------
  function qRow(q) {
    const isNew = Date.now() - q.time < 3600000;
    return `<button class="q" data-q="${esc(q.id)}">
      <span class="mag" style="background:${magColor(q.mag)}">${q.mag.toFixed(1)}</span>
      <span class="meta"><span class="name">${esc(q.place)}</span>
      <span class="sub">${ago(q.time)} · ${Math.round(q.depth)} km de profundidad${state.me ? ' · ' + distTxt(q) : ''}
      ${isNew ? '<span class="badge new">NUEVO</span>' : ''}${near(q) ? '<span class="badge near">CERCA</span>' : ''}${q.tsunami ? '<span class="badge tsu">TSUNAMI</span>' : ''}</span></span>
    </button>`;
  }
  let listCache = [];
  function renderList(list, empty) {
    return body => {
      listCache = list;
      body.innerHTML = list.length ? list.slice(0, 200).map(qRow).join('') : `<div class="empty">${esc(empty)}</div>`;
    };
  }
  function openSismos(active) {
    const pool = merge(state.context, state.quakes);
    const zone = state.me ? pool.filter(near) : [];
    const histRows = state.hist.map(h => ({ id: 'h:' + h.id, mag: h.mag, lat: h.lat, lon: h.lon, depth: h.depth, time: h.time, place: esPlace(h.place), url: `https://earthquake.usgs.gov/earthquakes/eventpage/${h.id}`, tsunami: !!h.tsunami, src: 'USGS (histórico)' }));
    openSheet({
      title: 'Sismos', sub: 'Datos en vivo de USGS (EE. UU.) y EMSC (Europa)',
      tabs: [
        { id: 'rec', label: 'Recientes', render: renderList(state.quakes.slice().sort((a, b) => b.time - a.time), 'Sin sismos en este periodo.') },
        { id: 'fuertes', label: 'Más fuertes', render: renderList(state.quakes.slice().sort((a, b) => b.mag - a.mag), 'Sin datos.') },
        { id: 'zona', label: 'Tu zona', render: body => renderZone(body, zone) },
        { id: 'hist', label: 'Históricos', render: renderList(histRows, 'Sin datos.') },
        { id: 'volc', label: 'Volcanes', render: renderVolcanes },
        { id: 'stats', label: 'Estadísticas', render: renderStats(state.statsCc) }
      ],
      active
    });
  }
  function renderZone(body, zone) {
    if (!state.me) { body.innerHTML = `<div class="empty">Elige tu ubicación para ver los sismos de tu zona.<br><br><button class="btn primary" data-act="ubicacion">Elegir ubicación</button></div>`; return; }
    const month = zone.filter(q => Date.now() - q.time < 30 * 86400000);
    const max = month.slice().sort((a, b) => b.mag - a.mag)[0];
    body.innerHTML = `<div class="explain">📍 <b>${esc(state.me.name)}</b> · radio de ${state.settings.radius} km<br>
      <b>${month.length}</b> sismos registrados en los datos cargados${max ? ` · el más fuerte: <b>M${max.mag.toFixed(1)}</b> (${esc(max.place)}, ${ago(max.time)})` : ''}.<br>
      <small>USGS y EMSC registran sobre todo los sismos de magnitud media y alta; los muy pequeños los publica la agencia de cada país.</small></div>` +
      (zone.length ? zone.slice(0, 150).map(qRow).join('') : '<div class="empty">Sin sismos cerca en los datos cargados. Prueba con “30 días”.</div>');
    listCache = zone;
  }
  function renderVolcanes(body) {
    const act = state.activeVolc;
    body.innerHTML = `<div class="explain">🌋 Reporte semanal de actividad volcánica (Smithsonian / USGS). ${act.length} volcanes con actividad esta semana.</div>` +
      (act.length ? act.map(v => `<button class="q" data-v="${v.id}"><span class="mag" style="background:#ff6a3d;font-size:22px">🌋</span>
        <span class="meta"><span class="name">${esc(v.name)}</span><span class="sub">${esc(v.country)} · ${esc(v.status || '')}</span></span></button>`).join('')
        : '<div class="empty">No se pudo cargar el reporte semanal.</div>');
  }

  function openQuake(q, fly) {
    if (fly !== false) flyTo(q.lat, q.lon, 0.75);
    const tsuNote = q.tsunami ? '<div class="explain" style="border:1px solid #1e6bff">🌊 <b>Sismo en zona oceánica con posible generación de tsunami.</b> Revisa los boletines oficiales en Seguridad → Tsunami y sigue a las autoridades locales.</div>' : '';
    openSheet({
      title: `M${q.mag.toFixed(1)} · ${q.place}`, sub: `${fmtDate(q.time)} (${ago(q.time)})`,
      tabs: [{ id: 'd', label: 'Detalle', render: body => {
        body.innerHTML = `<div class="detail">
          <div class="big"><span class="mag" style="background:${magColor(q.mag)}">${q.mag.toFixed(1)}</span>
            <div><b>${esc(q.place)}</b><br><small style="color:var(--muted)">${near(q) ? '🔴 Cerca de ti · ' : ''}${distTxt(q)}</small></div></div>
          <div class="explain">${explainMag(q.mag)} ${q.depth < 70 ? 'Es superficial (menos de 70 km), por eso se siente más.' : 'Es profundo, por eso se siente menos en la superficie.'}</div>
          ${tsuNote}
          <div id="felt"></div>
          <div class="kv"><span>Magnitud</span><b>${q.mag.toFixed(1)}</b><span>Profundidad</span><b>${Math.round(q.depth)} km</b>
            <span>Hora local</span><b>${fmtDate(q.time)}</b><span>Coordenadas</span><b>${q.lat.toFixed(2)}, ${q.lon.toFixed(2)}</b>
            <span>Fuente</span><b>${esc(q.src)}</b>${q.felt ? `<span>Reportes</span><b>${nf.format(q.felt)} personas lo sintieron</b>` : ''}</div>
          <div class="actions">
            <button class="action wa" data-act="estoybien">✅<br>Estoy bien</button>
            <button class="action" data-act="compartir-img">🖼️<br>Compartir imagen</button>
            ${q.url ? `<button class="action" data-act="fuente">🔗<br>Ver fuente</button>` : ''}
          </div></div>`;
      } }]
    });
    state.currentQuake = q;
    loadFelt(q);
  }
  function openVolcano(v) {
    flyTo(v.lat, v.lon, 0.8);
    const act = state.activeVolc.find(a => a.id === v.id || a.name === v.name);
    openSheet({
      title: `🌋 ${v.name}`, sub: v.country,
      tabs: [{ id: 'v', label: 'Volcán', render: body => {
        body.innerHTML = `<div class="detail">
          ${act ? `<div class="explain" style="border:1px solid #ff6a3d">🔥 <b>Actividad esta semana:</b> ${esc(act.status || 'reportada')}.<br><small>${esc(act.summary || '')}</small></div>` : ''}
          <div class="kv"><span>Tipo</span><b>${esc(v.type || '—')}</b><span>Altura</span><b>${v.elevation ? nf.format(v.elevation) + ' m' : '—'}</b>
          <span>Última erupción</span><b>${v.lastEruption == null ? 'desconocida' : v.lastEruption < 0 ? Math.abs(v.lastEruption) + ' a. C.' : v.lastEruption}</b>
          <span>Coordenadas</span><b>${v.lat.toFixed(2)}, ${v.lon.toFixed(2)}</b>${state.me ? `<span>Distancia</span><b>${nf.format(Math.round(distKm(state.me.lat, state.me.lon, v.lat, v.lon)))} km de ti</b>` : ''}</div>
          <div class="explain">Para el estado oficial de alerta de un volcán, sigue al servicio geológico de tu país (en Colombia, el Servicio Geológico Colombiano).</div>
          <div class="actions"><button class="action" data-act="gvp" data-id="${v.id}">🔗<br>Smithsonian</button></div></div>`;
      } }]
    });
  }

  // ---------- pestaña Noticias ----------
  async function openNoticias() {
    const cc = (state.me && state.me.cc) || 'CO';
    openSheet({ title: 'Noticias de sismos', sub: 'Google Noticias en español · ' + flag(cc), tabs: [{ id: 'n', label: 'Noticias', render: b => { b.innerHTML = '<div class="empty">Cargando noticias…</div>'; } }] });
    try {
      const url = `https://news.google.com/rss/search?q=sismo+OR+temblor+OR+terremoto+OR+tsunami+OR+volc%C3%A1n&hl=es-419&gl=${cc}&ceid=${cc}:es-419`;
      const xml = new DOMParser().parseFromString(await getText(url), 'text/xml');
      const items = [...xml.querySelectorAll('item')].slice(0, 40).map(it => ({
        title: it.querySelector('title')?.textContent || '', link: it.querySelector('link')?.textContent || '',
        date: Date.parse(it.querySelector('pubDate')?.textContent || '') || 0, source: it.querySelector('source')?.textContent || ''
      }));
      if (state.sheet && state.sheet.title === 'Noticias de sismos') {
        $('#sheet-body').innerHTML = items.map(n => `<button class="news" data-link="${esc(n.link)}"><b>${esc(n.title.replace(/ - [^-]+$/, ''))}</b>
          <small>${esc(n.source)} · ${n.date ? ago(n.date) : ''}</small></button>`).join('') || '<div class="empty">Sin noticias.</div>';
      }
    } catch (e) {
      $('#sheet-body').innerHTML = `<div class="empty">No se pudieron cargar las noticias${NATIVE ? '' : ' (en el navegador Google Noticias bloquea la lectura directa; en la app de Android sí funciona)'}.</div>`;
    }
  }

  // ---------- pestaña Radio ----------
  const audio = new Audio(); let hls = null;
  function openRadio(cc) {
    const my = (state.me && state.me.cc) || 'CO';
    cc = typeof cc === 'string' ? cc : my;
    const countries = [...new Set(state.radios.map(r => r.cc))];
    countries.sort((a, b) => (a === my ? -1 : b === my ? 1 : 0));
    const list = state.radios.filter(r => r.cc === cc);
    openSheet({
      title: 'Radios de noticias', sub: 'Escucha la información oficial en una emergencia',
      tabs: [{ id: 'r', label: 'Radio', render: body => {
        body.innerHTML = `<div class="chips" style="padding:2px 6px 8px">${countries.map(c => `<button class="chip" data-cc="${c}" aria-selected="${c === cc}">${flag(c)} ${c}</button>`).join('')}</div>` +
          list.map(r => `<button class="q${state.radioId === r.id ? ' cur' : ''}" data-radio="${esc(r.id)}">${radioLogo(r)}
            <span class="meta"><span class="name">${esc(displayName(r.name))}</span><span class="sub"><span class="pill live">EN VIVO</span><span class="pill">${flag(r.cc)} Noticias</span>
            ${state.radioId === r.id ? '<span class="pill" style="background:#22d3ee;color:#0a0f1d">● SONANDO</span>' : ''}</span></span></button>`).join('');
      } }]
    });
  }
  function displayName(n) {
    const c = String(n || '').replace(/\s*[\(\[][^\)\]]*[\)\]]?/g, '').replace(/\s*[-–|·]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    return c.length >= 3 ? c : n;
  }
  function radioLogo(r, cls = '') {
    const initial = esc((r.name.replace(/[^\p{L}\p{N}]/gu, '')[0] || '📻').toUpperCase());
    const img = r.favicon ? `<img src="${esc(r.favicon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok');if(this.naturalWidth<100)this.classList.add('lo')" onerror="this.remove()">` : '';
    return `<span class="logo ${cls}" style="width:56px;height:56px;background:linear-gradient(135deg,#22d3ee,#1b2540)">${initial}${img}</span>`;
  }
  function playRadio(r) {
    state.radioId = r.id;
    $('#rb-logo').innerHTML = radioLogo(r);
    if (state.sheet && state.sheet.title === 'Radios de noticias') openRadio(r.cc);
    if (hls) { hls.destroy(); hls = null; }
    if (/\.m3u8/i.test(r.url) && window.Hls && Hls.isSupported()) { hls = new Hls(); hls.loadSource(r.url); hls.attachMedia(audio); }
    else audio.src = r.url;
    audio.play().catch(() => toast('Esta emisora no está disponible ahora. Prueba otra.'));
    $('#rb-name').textContent = displayName(r.name); $('#radio-bar').hidden = false;
    document.documentElement.style.setProperty('--rb-h', '56px');
  }
  function stopRadio() {
    if (hls) { hls.destroy(); hls = null; }
    audio.pause(); audio.removeAttribute('src'); audio.load();
    $('#radio-bar').hidden = true; document.documentElement.style.setProperty('--rb-h', '0px');
    state.radioId = null;
  }
  audio.addEventListener('error', () => { if (audio.src) toast('Esta emisora no está disponible ahora. Prueba otra.'); });

  // ---------- pestaña Seguridad ----------
  function openSeguridad(active) {
    openSheet({
      title: 'Seguridad', sub: 'Qué hacer, a quién llamar y cómo avisar',
      tabs: [{ id: 's', label: 'Seguridad', render: body => {
        const tsu = state.tsunamis.filter(t => Date.now() - t.time < 86400000 && t.level >= 2);
        const G = OrbeGuias.cards();
        body.innerHTML = `<h3 class="g-sec">En una emergencia</h3><div class="cards">
          <button class="card green" data-act="estoybien"><span class="ico">✅</span><b>Estoy bien</b><small>Avisa por WhatsApp con tu ubicación</small></button>
          <button class="card red" data-act="sos"><span class="ico">🆘</span><b>SOS</b><small>Sirena, linterna y pantalla de rescate</small></button>
          <button class="card" data-act="numeros"><span class="ico">☎️</span><b>Números de emergencia</b><small>Llama con un toque</small></button>
          <button class="card" data-act="tsunami"><span class="ico">🌊</span><b>Tsunami</b><small>${tsu.length ? '⚠️ Hay boletines activos' : 'Boletines oficiales y qué hacer'}</small></button>
          <button class="card" data-act="guia"><span class="ico">📋</span><b>Qué hacer en un sismo</b><small>Antes, durante y después</small></button>
          ${G.apagon}
        </div>
        <h3 class="g-sec">Prepárate</h3><div class="cards">
          ${G.test}
          <button class="card" data-act="plan"><span class="ico">👨‍👩‍👧</span><b>Plan familiar</b><small>Punto de encuentro y datos médicos</small></button>
          ${G.mochila}
          ${G.casa}
          <button class="card" data-act="simulacro"><span class="ico">🔔</span><b>Simulacro</b><small>Practica con tu familia</small></button>
          <button class="card wide" data-act="temprana"><span class="ico">📳</span><b>Alerta temprana en tu celular</b><small>Cómo activar el sistema de Android que avisa segundos antes de que llegue el temblor fuerte</small></button>
          <button class="card wide" data-act="lluvia"><span class="ico">🌧️</span><b>Lluvias fuertes</b><small>Pronóstico de lluvia de tus lugares para hoy y los próximos días</small></button>
        </div>
        <h3 class="g-sec">Guías sin internet</h3><div class="cards">${G.guias}</div>`;
      } }],
      active
    });
  }
  function subSheet(titleTxt, sub, html, after) {
    state.sheetKind = null;
    openSheet({ title: titleTxt, sub, tabs: [{ id: 'x', label: titleTxt, render: body => { body.innerHTML = html; if (after) after(body); } }] });
  }
  const GUIA = `<div class="guide">
    <h4>🏠 Antes</h4><ul><li>Identifica los lugares seguros de tu casa: junto a muros de carga, bajo mesas firmes.</li>
    <li>Asegura muebles altos, espejos y objetos pesados a la pared.</li><li>Acuerda un punto de encuentro y un contacto fuera de la ciudad.</li>
    <li>Ten lista la mochila de emergencia y practica simulacros.</li></ul>
    <h4>🌎 Durante</h4><ul><li><b>Agáchate, cúbrete y sujétate</b> bajo una mesa firme, lejos de ventanas.</li>
    <li>Si estás en la cama, quédate y protege tu cabeza con la almohada.</li><li>No uses ascensores ni corras hacia las escaleras.</li>
    <li>En la calle, aléjate de edificios, postes y cables. En el carro, detente en un lugar abierto.</li>
    <li>En la costa, si el sismo es fuerte o largo, <b>sube a un lugar alto de inmediato</b>: no esperes la alerta de tsunami.</li></ul>
    <h4>✅ Después</h4><ul><li>Revisa si hay heridos y presta primeros auxilios.</li><li>Sal con calma si la construcción tiene daños; espera réplicas.</li>
    <li>Cierra el gas y no enciendas fósforos si huele a gas.</li><li>Usa mensajes, no llamadas: deja las líneas libres para emergencias.</li>
    <li>Informate solo por fuentes oficiales y radio.</li></ul></div>`;

  function showNumeros() {
    const cc = (state.me && state.me.cc) || 'CO';
    const nums = (state.lugares && state.lugares.emergencias[cc]) || [['Emergencias', '112']];
    subSheet('Números de emergencia', `${flag(cc)} Verifica los números de tu ciudad`,
      nums.map(([n, t]) => `<button class="num" data-tel="${t}"><span>${esc(n)}</span><b>📞 ${t}</b></button>`).join('') +
      `<div class="explain">Desde la mayoría de celulares también puedes marcar <b>112</b> o <b>911</b>. Si no hay señal, el mensaje de texto a veces llega cuando la llamada no.</div>`);
  }
  function showTsunami() {
    const list = state.tsunamis.slice().sort((a, b) => b.time - a.time);
    const lvl = ['Información', 'Información', 'Vigilancia', 'Aviso', 'ALERTA'];
    subSheet('Tsunami', 'Boletines oficiales de los centros de alerta (NOAA)',
      `<div class="explain">🌊 <b>Señales naturales:</b> si estás en la costa y sientes un sismo fuerte o largo, o ves que el mar se retira de golpe, <b>sube a un lugar alto de inmediato</b> (30 m o más) o aléjate de la costa. Un tsunami puede llegar en minutos.</div>` +
      (list.length ? list.map(t => `<div class="news"><b>${t.level >= 3 ? '⚠️ ' : ''}${esc(lvl[t.level] || 'Boletín')}: ${esc(t.title)}</b><small>${esc(t.center)} · ${ago(t.time)}</small></div>`).join('')
        : '<div class="empty">Sin boletines recientes.</div>'));
  }
  function showPlan() {
    const p = store.get('plan', {});
    const f = (k, l, ph = '') => `<label class="field"><span>${l}</span><input data-plan="${k}" value="${esc(p[k] || '')}" placeholder="${esc(ph)}"></label>`;
    subSheet('Plan familiar', 'Se guarda solo en este teléfono',
      f('encuentro', 'Punto de encuentro', 'Ej.: parque frente a la casa') + f('contacto1', 'Contacto 1 (nombre y teléfono)') + f('contacto2', 'Contacto 2 (fuera de la ciudad)') +
      f('sangre', 'Tipo de sangre') + f('alergias', 'Alergias') + f('medicamentos', 'Medicamentos') +
      `<label class="field"><span>Notas</span><textarea data-plan="notas" rows="3">${esc(p.notas || '')}</textarea></label>
      <div class="actions"><button class="action" data-act="plan-guardar">💾<br>Guardar</button><button class="action wa" data-act="plan-compartir">📤<br>Compartir plan</button></div>`);
  }
  function showTemprana() {
    subSheet('Alerta temprana', 'Sistema de alertas de terremotos de Android (Google)',
      `<div class="explain">📳 Muchos celulares Android detectan el inicio de un sismo y, entre todos, avisan <b>segundos antes</b> de que llegue el movimiento fuerte (de 5 a 60 s según la distancia). Está disponible en muchos países; donde exista, es la alerta más rápida posible.</div>
      <div class="guide"><h4>Cómo activarla</h4><ul><li>Abre <b>Ajustes</b> del teléfono.</li><li>Entra a <b>Seguridad y emergencia</b> (o <b>Ubicación → Avanzado</b>).</li>
      <li>Activa <b>Alertas de terremotos</b>.</li><li>Deja la ubicación activada para que la alerta sea de tu zona.</li></ul>
      <h4>Lo que hace Orbe Sismos</h4><ul><li>Te avisa en cuanto los centros sismológicos publican un sismo (normalmente entre 1 y 5 minutos después).</li>
      <li>Te avisa de los boletines oficiales de tsunami, que sí pueden llegar minutos u horas antes de las olas.</li>
      <li><b>Nadie puede predecir un sismo con minutos de anticipación.</b> Desconfía de quien lo prometa.</li></ul></div>
      ${NATIVE ? '<div class="actions"><button class="action" data-act="abrir-ajustes">⚙️<br>Abrir ajustes</button></div>' : ''}`);
  }

  // Que las alarmas lleguen siempre: ahorro de batería e inicio automático
  const BRAND_TIPS = {
    xiaomi: 'En Xiaomi, Redmi y POCO: activa "Inicio automático" y en Ahorro de batería elige "Sin restricciones".',
    redmi: 'En Xiaomi, Redmi y POCO: activa "Inicio automático" y en Ahorro de batería elige "Sin restricciones".',
    poco: 'En Xiaomi, Redmi y POCO: activa "Inicio automático" y en Ahorro de batería elige "Sin restricciones".',
    huawei: 'En Huawei y Honor: en "Inicio de aplicaciones" desactiva "Gestionar automáticamente" y deja todo encendido.',
    honor: 'En Huawei y Honor: en "Inicio de aplicaciones" desactiva "Gestionar automáticamente" y deja todo encendido.',
    samsung: 'En Samsung: en Batería, pon Orbe Sismos en "Aplicaciones que nunca entran en suspensión".',
    oppo: 'En Oppo y Realme: permite "Inicio automático" y "Actividad en segundo plano".',
    realme: 'En Oppo y Realme: permite "Inicio automático" y "Actividad en segundo plano".',
    oneplus: 'En OnePlus: en Batería → Optimización, elige "No optimizar" para Orbe Sismos.',
    vivo: 'En Vivo: permite "Inicio automático" y "Alto consumo en segundo plano".',
    motorola: 'En Motorola: en Batería → Optimización, elige "No optimizar".'
  };
  function batteryBox() {
    if (!NATIVE || typeof N.isBatteryFree !== 'function') return '';
    const free = N.isBatteryFree();
    const brand = (N.brand() || '').toLowerCase();
    const tip = BRAND_TIPS[brand] || Object.keys(BRAND_TIPS).filter(k => brand.includes(k)).map(k => BRAND_TIPS[k])[0] || '';
    const strict = /xiaomi|redmi|poco|huawei|honor|oppo|realme|vivo|samsung|oneplus|asus|letv/.test(brand);
    return `<h3>Que las alarmas lleguen siempre</h3>
      <div class="explain" style="${free ? 'border-color:rgba(47,210,122,.5)' : 'border-color:rgba(255,176,0,.6);background:rgba(255,176,0,.08)'}">
        ${free ? '✅ <b>Ahorro de batería desactivado</b> para Orbe Sismos: Android no la cerrará en segundo plano.'
          : '⚠️ <b>Android puede cerrar Orbe Sismos para ahorrar batería</b> y las alarmas llegarían tarde o no llegarían. Toca el botón, busca <b>Orbe Sismos</b> y elige <b>"No optimizar"</b> o <b>"Sin restricciones"</b>.'}
        ${tip ? `<br><br>📱 ${esc(tip)}` : ''}
      </div>
      <div class="actions" style="padding:0">
        ${free ? '' : '<button class="action" data-act="bateria">🔋<br>Quitar ahorro de batería</button>'}
        ${strict || !free ? '<button class="action" data-act="autoinicio">🚀<br>Permitir inicio automático</button>' : ''}
      </div>`;
  }
  // Al volver de los ajustes del teléfono se actualiza el estado
  window.orbeResume = () => { if (state.sheetKind === 'alertas' && isOpen()) openAlertas(); };

  // Alarmas y ubicación
  function openAlertas() {
    setTimeout(() => { state.sheetKind = 'alertas'; }, 0);
    const s = state.settings;
    const seg = (key, vals, fmt) => `<div class="seg" style="grid-template-columns:repeat(${vals.length},1fr)">${vals.map(v => `<button data-set="${key}" data-val="${v}" aria-pressed="${s[key] === v}">${fmt(v)}</button>`).join('')}</div>`;
    const tog = (key, l, sub) => `<button class="toggle" data-tog="${key}" role="switch" aria-checked="${!!s[key]}"><span>${l}<span class="t-sub">${sub}</span></span><span class="switch"></span></button>`;
    subSheet('Alarmas y ubicación', state.me ? `📍 ${state.me.name}` : 'Elige tu ubicación',
      `<div class="settings">
        <h3>Tu ubicación (casa)</h3>
        <div class="actions" style="padding:0"><button class="action" data-act="gps">📍<br>Usar mi ubicación</button><button class="action" data-act="ubicacion">🏙️<br>Elegir ciudad</button></div>
        <h3>Otros lugares vigilados</h3>
        ${state.places.map((pl, i) => `<div class="num"><span>${pl.label === 'Trabajo' ? '💼' : '👨‍👩‍👧'} <b style="font-size:15px;color:var(--text)">${esc(pl.label)}</b> · ${esc(pl.name)}</span><button class="btn link" data-delplace="${i}">Quitar</button></div>`).join('')}
        ${state.places.length < 2 ? `<div class="actions" style="padding:6px 0 0">${state.places.some(p => p.label === 'Trabajo') ? '' : '<button class="action" data-addplace="Trabajo">💼<br>Agregar trabajo</button>'}${state.places.some(p => p.label === 'Familia') ? '' : '<button class="action" data-addplace="Familia">👨‍👩‍👧<br>Agregar familia</button>'}</div>` : ''}
        <h3>Alarma de sismo cercano: magnitud mínima</h3>${seg('minMag', [3, 4, 4.5, 5, 6], v => 'M' + v)}
        <h3>Distancia máxima</h3>${seg('radius', [100, 300, 500, 1000], v => v + ' km')}
        ${tog('world', 'Sismos muy fuertes en cualquier parte', 'Aviso si hay uno de magnitud 7 o más en el mundo')}
        ${tog('tsunami', 'Boletines de tsunami', 'Aviso con alarma si hay alerta cerca de ti')}
        ${tog('watch', 'Vigilancia en tiempo real', 'Revisa cada minuto aunque la app esté cerrada (usa muy poca batería)')}
        ${batteryBox()}
        ${tog('voice', 'Leer la alarma en voz alta', '“Sismo de magnitud 5 a 120 kilómetros de Bogotá”')}
        ${tog('rain', 'Lluvias muy fuertes', 'Aviso para tus lugares (revisa cada 3 horas)')}
        <div class="actions" style="padding:10px 0 0"><button class="action" data-act="probar">🔔<br>Probar alarma</button></div>
        <p class="about">Las alarmas avisan cuando USGS o EMSC publican el sismo (normalmente 1 a 5 minutos después). Para avisos <b>antes</b> del temblor fuerte, activa también la alerta temprana de Android en Seguridad.</p>
        ${NATIVE && !state.tv ? `<h3>Premium</h3><div class="premium">${state.premium ? '<h4>✨ Premium</h4><p class="ok">Activo: sin anuncios.</p>' : `<h4>✨ Orbe Sismos Premium</h4><p>Sin anuncios. Las alarmas nunca llevan anuncios.</p><button class="btn primary block" data-act="premium">Quitar anuncios</button>`}</div>` : ''}
      </div>`);
  }
  // Ciudades: las de Latinoamérica de siempre + 1.817 del mundo (data/ciudades-mundo.json)
  const allCities = () => state.mundo && state.mundo.length ? state.mundo : ((state.lugares && state.lugares.ciudades) || []);
  const foldTxt = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function chooseCity() {
    const cs = allCities();
    subSheet('Elige tu ciudad', 'O usa “Usar mi ubicación”',
      `<div class="search" style="height:40px;margin:2px 6px 8px"><input id="cq" placeholder="Buscar ciudad…" autocomplete="off"></div><div id="clist"></div>`,
      body => {
        const draw = q => { const f = foldTxt(q); $('#clist').innerHTML = (f ? cs.filter(c => foldTxt(c[0]).includes(f)).sort((a, b) => (foldTxt(b[0]).startsWith(f) - foldTxt(a[0]).startsWith(f)) || ((b[4] || 0) - (a[4] || 0))) : cs).slice(0, 80).map(c =>
          `<button class="country" data-city="${esc(c[0])}"><span class="flag">${flag(c[1])}</span><span class="cname">${esc(c[0])}</span></button>`).join(''); };
        draw(''); $('#cq').addEventListener('input', e => draw(e.target.value));
      });
  }
  function setMe(me) {
    state.me = me; store.set('me', me);
    syncNative(); drawMarkers(); drawQuakes();
    flyTo(me.lat, me.lon, 1.6);
    toast(`📍 Ubicación: ${me.name}`);
  }
  function nearestCity(lat, lon) {
    let best = null, bd = Infinity;
    for (const c of allCities()) { const d = distKm(lat, lon, c[2], c[3]); if (d < bd) { bd = d; best = c; } }
    return best ? { name: bd < 60 ? best[0] : `Cerca de ${best[0]}`, cc: best[1] } : { name: 'Tu ubicación', cc: '' };
  }
  window.__orbeLocation = (lat, lon) => {
    if (lat == null) { toast('No se pudo obtener la ubicación. Elige tu ciudad.'); chooseCity(); return; }
    const c = nearestCity(lat, lon); setMe({ lat, lon, name: c.name, cc: c.cc });
  };
  function askGps() {
    if (NATIVE) { N.requestLocation(); return; }
    if (!navigator.geolocation) { chooseCity(); return; }
    navigator.geolocation.getCurrentPosition(p => window.__orbeLocation(p.coords.latitude, p.coords.longitude), () => window.__orbeLocation(null), { timeout: 15000 });
  }
  function syncNative() {
    store.set('alerts', state.settings);
    store.set('places', state.places);
    if (globe) drawMarkers();
    if (NATIVE && N.setAlertSettings) N.setAlertSettings(JSON.stringify(Object.assign({}, state.settings, state.me || {}, { places: allPlaces() })));
  }

  // Compartir / Estoy bien
  function share(text) {
    if (NATIVE) N.share(text); else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }
  function estoyBien() {
    const q = state.currentQuake;
    const loc = state.me ? `https://maps.google.com/?q=${state.me.lat.toFixed(4)},${state.me.lon.toFixed(4)}` : '';
    share(`✅ Estoy bien.${q ? ` Después del sismo de magnitud ${q.mag.toFixed(1)} (${q.place}, ${fmtDate(q.time)}).` : ''}${loc ? '\n📍 Mi ubicación: ' + loc : ''}\nEnviado con Orbe Sismos`);
  }

  // SOS
  let webSiren = null;
  function sos(on) {
    $('#sos').hidden = !on;
    if (NATIVE) { on ? N.sosStart() : N.sosStop(); return; }
    if (on) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.25; o.start();
        let up = true; const iv = setInterval(() => { o.frequency.setTargetAtTime(up ? 1400 : 600, ctx.currentTime, 0.25); up = !up; }, 600);
        webSiren = () => { clearInterval(iv); o.stop(); ctx.close(); };
      } catch (e) { /* sin audio */ }
    } else if (webSiren) { webSiren(); webSiren = null; }
  }

  // Simulacro
  let drillTimer = null;
  const DRILL = [['🚨 ¡Simulacro de sismo!', 3], ['⬇️ Agáchate', 3], ['🛡️ Cúbrete bajo una mesa firme', 4], ['✊ Sujétate hasta que pare', 20],
    ['👀 Ya pasó: revisa si hay heridos', 6], ['🚪 Sal con calma al punto de encuentro', 8], ['✅ Avisa que estás bien', 5]];
  function drill(on) {
    clearInterval(drillTimer);
    $('#drill').hidden = !on;
    if (!on) { if (NATIVE) N.alarm(false); return; }
    if (NATIVE) N.alarm(true);
    let i = 0, left = DRILL[0][1];
    const tick = () => {
      $('#drill-step').textContent = DRILL[i][0]; $('#drill-count').textContent = left;
      if (--left < 0) {
        if (++i >= DRILL.length) { drill(false); toast('🎉 ¡Simulacro completo! Repítelo cada pocos meses.'); return; }
        if (i === 1 && NATIVE) N.alarm(false);
        left = DRILL[i][1];
      }
    };
    tick(); drillTimer = setInterval(tick, 1000);
  }

  // =====================================================================
  //  Lugares vigilados (casa + trabajo + familia)
  // =====================================================================
  function allPlaces() {
    const out = [];
    if (state.me) out.push(Object.assign({ label: 'Casa' }, state.me));
    for (const p of state.places) out.push(p);
    return out;
  }
  function nearestPlace(q) {
    let best = null, bd = Infinity;
    for (const p of allPlaces()) { const d = distKm(p.lat, p.lon, q.lat, q.lon); if (d < bd) { bd = d; best = p; } }
    return best ? { place: best, d: bd } : null;
  }

  // =====================================================================
  //  ¿Lo sentiste? (reportes oficiales: USGS "Did You Feel It?" y EMSC)
  // =====================================================================
  const MMI = ['', 'I · No sentido', 'II · Débil', 'III · Débil', 'IV · Leve', 'V · Moderado', 'VI · Fuerte', 'VII · Muy fuerte',
    'VIII · Severo', 'IX · Violento', 'X · Extremo', 'XI · Extremo', 'XII · Extremo'];
  async function loadFelt(q) {
    const box = document.getElementById('felt'); if (!box) return;
    const report = q.src === 'USGS' || q.src === 'USGS (histórico)';
    const rawId = q.id.replace(/^(us|h):/, '');
    const reportUrl = report ? `https://earthquake.usgs.gov/earthquakes/eventpage/${rawId}/tellus` : q.url;
    box.innerHTML = `<div class="explain">🙋 <b>¿Lo sentiste?</b> Cuéntalo al centro sismológico: tu reporte ayuda a medir cómo se sintió en cada lugar.
      <div class="actions" style="padding:8px 0 0"><button class="action" data-act="senti" data-url="${esc(reportUrl || '')}">🙋<br>Sí, lo sentí</button></div>
      <div id="felt-data"><small style="color:var(--muted)">Cargando reportes…</small></div></div>`;
    if (!report) { document.getElementById('felt-data').innerHTML = '<small style="color:var(--muted)">Los reportes de este sismo están en la página de EMSC.</small>'; return; }
    try {
      const d = await getJSON(`https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${encodeURIComponent(rawId)}&format=geojson`);
      const p = d.properties, dy = p.products && p.products.dyfi && p.products.dyfi[0];
      const felt = p.felt || 0, cdi = p.cdi ? Math.round(p.cdi) : 0;
      const img = dy && (dy.contents[`${rawId}_ciim.jpg`] || dy.contents[`${rawId}_ciim_geo.jpg`]);
      const el = document.getElementById('felt-data'); if (!el) return;
      el.innerHTML = felt
        ? `<p style="margin:8px 0 4px"><b>${nf.format(felt)}</b> personas reportaron haberlo sentido${cdi ? ` · intensidad máxima <b>${MMI[cdi] || cdi}</b>` : ''}.</p>
           ${img ? `<img src="${esc(img.url)}" alt="Mapa de intensidad reportada" style="width:100%;border-radius:12px;background:#fff;margin-top:6px" loading="lazy">
           <small style="color:var(--muted)">Mapa de intensidad reportada por la gente (USGS).</small>` : ''}`
        : '<small style="color:var(--muted)">Todavía nadie lo ha reportado. ¡Sé el primero!</small>';
    } catch (e) {
      const el = document.getElementById('felt-data'); if (el) el.innerHTML = '<small style="color:var(--muted)">No se pudieron cargar los reportes.</small>';
    }
  }

  // =====================================================================
  //  Lluvias fuertes (MET Norway: gratis y con uso comercial permitido)
  // =====================================================================
  const rainLevel = mm => mm >= 50 ? ['Muy fuerte', 'var(--danger)'] : mm >= 20 ? ['Fuerte', '#ff9a2e'] : mm >= 5 ? ['Moderada', '#ffd166'] : mm > 0.5 ? ['Débil', '#7fd1ff'] : ['Sin lluvia', 'var(--ok)'];
  const mm1 = v => v.toFixed(1).replace('.', ',');
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dayName = s => new Date(s + 'T12:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric' });
  /** Lluvia por día (hora local del teléfono) y aguacero más fuerte de las próximas 24 h. */
  function rainDays(ts) {
    const days = {}; let covered = 0, maxH = 0;
    ts.forEach((e, k) => {
      const t = Date.parse(e.time), d = e.data || {};
      const n1 = d.next_1_hours, n6 = d.next_6_hours;
      let mm = null, prob = null;
      if (n1 && n1.details) { mm = n1.details.precipitation_amount || 0; prob = n1.details.probability_of_precipitation; covered = t + 3600e3; if (k < 24) maxH = Math.max(maxH, mm); }
      else if (n6 && n6.details && t >= covered) { mm = n6.details.precipitation_amount || 0; prob = n6.details.probability_of_precipitation; covered = t + 6 * 3600e3; }
      if (mm == null) return;
      const dk = dayKey(t), o = days[dk] || (days[dk] = { mm: 0, prob: null });
      o.mm += mm; if (prob != null) o.prob = Math.max(o.prob || 0, prob);
    });
    return { days: Object.entries(days).slice(0, 3), maxH };
  }
  async function openLluvia() {
    const places = allPlaces();
    if (!places.length) { toast('Primero elige tu ubicación'); openAlertas(); return; }
    subSheet('Lluvias fuertes', 'Pronóstico de MET Norway', '<div class="empty">Consultando el pronóstico…</div>');
    let html = '';
    for (const pl of places) {
      try {
        const f = await getJSON(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${(+pl.lat).toFixed(3)}&lon=${(+pl.lon).toFixed(3)}`);
        const { days, maxH } = rainDays(f.properties.timeseries);
        const rows = days.map(([t, o]) => { const [lv, c] = rainLevel(o.mm);
          return `<div class="kv" style="margin:4px 0"><span style="text-transform:capitalize">${dayName(t)}</span><b><span style="color:${c}">●</span> ${mm1(o.mm)} mm · ${lv}${o.prob != null ? ` · ${Math.round(o.prob)}% de probabilidad` : ''}</b></div>`; }).join('');
        html += `<div class="explain"><b>📍 ${esc(pl.label)}: ${esc(pl.name)}</b>${rows}
          <p style="margin:6px 0 0">⛈️ Aguacero más fuerte en las próximas 24 h: <b>${mm1(maxH)} mm/h</b>${maxH >= 20 ? ' — <b style="color:var(--danger)">intenso</b>' : ''}</p></div>`;
      } catch (e) { html += `<div class="explain">📍 ${esc(pl.name)}: no se pudo consultar el pronóstico.</div>`; }
    }
    html += `<div class="guide"><h4>Ante lluvias fuertes</h4><ul><li>No cruces ríos ni calles inundadas, ni a pie ni en carro.</li>
      <li>Aléjate de laderas y quebradas: después de mucha lluvia puede haber crecientes, deslizamientos y avenidas torrenciales.</li>
      <li>Sigue los avisos del instituto de meteorología de tu país (en Colombia, el IDEAM).</li></ul></div>
      <p class="about">Pronóstico: MET Norway (CC BY 4.0). Es una estimación de un modelo y no reemplaza los avisos oficiales.</p>`;
    if (state.sheet && state.sheet.title === 'Lluvias fuertes') $('#sheet-body').innerHTML = html;
  }

  // =====================================================================
  //  Estadísticas por país (USGS, magnitud 2.5+, este año)
  // =====================================================================
  let geoCountries = null; const statsCache = {};
  async function countryShape(cc) {
    if (!geoCountries) geoCountries = await local('lib/countries.geojson');
    const fix = { France: 'FR', Norway: 'NO' };
    const f = geoCountries.features.find(x => (x.properties.ISO_A2 !== '-99' ? x.properties.ISO_A2 : fix[x.properties.ADMIN]) === cc);
    if (!f) return null;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    for (const p of polys) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { polys, bbox: [x0, y0, x1, y1], name: f.properties.NAME_ES || f.properties.NAME };
  }
  function inRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  async function countryStats(cc) {
    if (statsCache[cc]) return statsCache[cc];
    const sh = await countryShape(cc); if (!sh) throw new Error('país');
    const [x0, y0, x1, y1] = sh.bbox, pad = 0.6, year = new Date().getFullYear();
    const d = await getJSON(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${year}-01-01&minmagnitude=2.5&limit=20000` +
      `&minlatitude=${y0 - pad}&maxlatitude=${y1 + pad}&minlongitude=${x0 - pad}&maxlongitude=${x1 + pad}`);
    const qs = d.features.map(fromUsgs).filter(q => sh.polys.some(p => inRing(q.lon, q.lat, p[0])));
    return (statsCache[cc] = { cc, name: sh.name, year, qs });
  }
  function renderStats(cc) {
    return async body => {
      const my = (state.me && state.me.cc) || 'CO';
      cc = cc || my;
      const ccs = Object.keys((state.lugares && state.lugares.emergencias) || { CO: 1 });
      ccs.sort((a, b) => (a === my ? -1 : b === my ? 1 : 0));
      body.innerHTML = `<div class="chips" style="padding:2px 6px 8px">${ccs.map(c => `<button class="chip" data-stat="${c}" aria-selected="${c === cc}">${flag(c)} ${c}</button>`).join('')}</div>
        <div id="stats-box"><div class="empty">Calculando estadísticas…</div></div>`;
      try {
        const s = await countryStats(cc);
        const box = document.getElementById('stats-box'); if (!box) return;
        const months = new Array(12).fill(0), now = new Date();
        s.qs.forEach(q => months[new Date(q.time).getMonth()]++);
        const upto = s.year === now.getFullYear() ? now.getMonth() + 1 : 12;
        const maxM = Math.max(1, ...months);
        const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const W = 330, H = 150, bw = W / 12;
        const bars = months.map((n, i) => { const h = Math.round((n / maxM) * (H - 34)); const x = i * bw + 3;
          return `<rect x="${x}" y="${H - 18 - h}" width="${bw - 6}" height="${h}" rx="3" fill="${i < upto ? '#ff8a3d' : '#2a3550'}"/>
            <text x="${x + (bw - 6) / 2}" y="${H - 4}" font-size="9" fill="#93a1bd" text-anchor="middle">${names[i]}</text>
            ${n ? `<text x="${x + (bw - 6) / 2}" y="${H - 22 - h}" font-size="9" fill="#eef3ff" text-anchor="middle">${n}</text>` : ''}`; }).join('');
        const bands = [[2.5, 4], [4, 5], [5, 6], [6, 10]].map(([a, b]) => [a, b, s.qs.filter(q => q.mag >= a && q.mag < b).length]);
        const top = s.qs.slice().sort((a, b) => b.mag - a.mag).slice(0, 5);
        box.innerHTML = `<div class="explain">${flag(cc)} <b>${esc(s.name)}</b> · ${s.year}<br><b style="font-size:22px">${nf.format(s.qs.length)}</b> sismos de magnitud 2.5 o más registrados por USGS este año.</div>
          <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin:4px 0" role="img" aria-label="Sismos por mes">${bars}</svg>
          <div class="kv">${bands.map(([a, b, n]) => `<span>Magnitud ${a}${b < 10 ? '–' + b : '+'}</span><b>${nf.format(n)}</b>`).join('')}</div>
          <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:10px 4px 4px">Los más fuertes del año</h3>` +
          top.map(qRow).join('') + `<p class="about">USGS registra sobre todo los sismos de magnitud 2.5 o más. La agencia nacional de cada país publica también los más pequeños.</p>`;
        listCache = top;
      } catch (e) {
        const box = document.getElementById('stats-box'); if (box) box.innerHTML = '<div class="empty">No se pudieron calcular las estadísticas.</div>';
      }
    };
  }

  // =====================================================================
  //  Tarjeta del sismo como imagen (para compartir en redes)
  // =====================================================================
  async function quakeCard(q) {
    if (!geoCountries) geoCountries = await local('lib/countries.geojson');
    const W = 1080, H = 1350, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1430'); bg.addColorStop(1, '#04060c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // Mapa: proyección equirectangular centrada en el epicentro (±14° de longitud)
    const mx = 60, my = 300, mw = W - 120, mh = 640, span = 14;
    const sx = lon => mx + ((lon - q.lon) / span + 1) / 2 * mw;
    const sy = lat => my + (1 - ((lat - q.lat) / (span * mh / mw) + 1) / 2) * mh;
    g.save(); g.beginPath(); g.roundRect(mx, my, mw, mh, 36); g.clip();
    g.fillStyle = '#0d2a52'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = '#21344f'; g.strokeStyle = '#4a6a95'; g.lineWidth = 2;
    for (const f of geoCountries.features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const p of polys) { g.beginPath(); p[0].forEach(([x, y], i) => i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))); g.closePath(); g.fill(); g.stroke(); }
    }
    const ex = sx(q.lon), ey = sy(q.lat), col = magColor(q.mag);
    for (let i = 4; i >= 1; i--) { g.beginPath(); g.arc(ex, ey, 26 * i * (0.6 + q.mag / 10), 0, Math.PI * 2); g.strokeStyle = col; g.globalAlpha = 0.18 + 0.15 * (4 - i); g.lineWidth = 5; g.stroke(); }
    g.globalAlpha = 1; g.beginPath(); g.arc(ex, ey, 16, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    for (const pl of allPlaces()) {
      const px = sx(pl.lon), py = sy(pl.lat);
      if (px > mx && px < mx + mw && py > my && py < my + mh) {
        g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fillStyle = '#22d3ee'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke();
        g.fillStyle = '#fff'; g.font = '600 30px Roboto, sans-serif'; g.fillText(pl.name, px + 18, py + 10);
      }
    }
    g.restore();
    // Textos
    g.fillStyle = '#93a1bd'; g.font = '600 36px Roboto, sans-serif'; g.fillText('ORBE SISMOS', 60, 90);
    g.fillStyle = col; g.beginPath(); g.roundRect(60, 120, 170, 150, 28); g.fill();
    g.fillStyle = '#0a0f1d'; g.font = '900 84px Roboto, sans-serif'; g.textAlign = 'center'; g.fillText(q.mag.toFixed(1), 145, 225); g.textAlign = 'left';
    g.fillStyle = '#fff'; g.font = '800 44px Roboto, sans-serif';
    const words = q.place.split(' '); let line = '', y = 175;
    for (const w of words) { if (g.measureText(line + w).width > 760) { g.fillText(line, 260, y); line = ''; y += 52; } line += w + ' '; }
    g.fillText(line, 260, y);
    g.fillStyle = '#c5cee3'; g.font = '400 36px Roboto, sans-serif';
    g.fillText(`${fmtDate(q.time)} · ${Math.round(q.depth)} km de profundidad`, 60, 1010);
    const np = nearestPlace(q);
    if (np) g.fillText(`A ${nf.format(Math.round(np.d))} km de ${np.place.name}`, 60, 1062);
    g.fillStyle = '#93a1bd'; g.font = '400 30px Roboto, sans-serif'; g.fillText(`Fuente: ${q.src} · ${explainMag(q.mag).split(':')[0]}`, 60, 1112);
    const cta = g.createLinearGradient(60, 0, W - 60, 0); cta.addColorStop(0, '#22d3ee'); cta.addColorStop(1, '#ff4fa3');
    g.fillStyle = cta; g.beginPath(); g.roundRect(60, 1180, W - 120, 110, 55); g.fill();
    g.fillStyle = '#fff'; g.font = '800 40px Roboto, sans-serif'; g.textAlign = 'center';
    g.fillText('Sismos en vivo y alarmas: Orbe Sismos', W / 2, 1248); g.textAlign = 'left';
    return c.toDataURL('image/png');
  }
  async function shareCard(q) {
    toast('Creando la imagen…', 1500);
    const url = await quakeCard(q);
    const text = `🌎 Sismo de magnitud ${q.mag.toFixed(1)} en ${q.place} (${fmtDate(q.time)}). Visto en Orbe Sismos`;
    if (NATIVE && N.shareImage) { N.shareImage(url.split(',')[1], text); return; }
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'sismo.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { /* sin navigator.share */ }
    const a = document.createElement('a'); a.href = url; a.download = 'sismo.png'; a.click();
  }

  // ---------- eventos ----------
  function bind() {
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) selectTab(b.dataset.tab); });
    $('#sheet-close').addEventListener('click', closeSheet);
    $('#sheet-tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) showTab(t.dataset.tab); });
    $('#zone').addEventListener('click', () => state.me ? openSismos('zona') : openAlertas());
    $('#btn-alerts').addEventListener('click', openAlertas);
    $('#rb-stop').addEventListener('click', stopRadio);
    $('#sos-stop').addEventListener('click', () => sos(false));
    $('#drill-stop').addEventListener('click', () => drill(false));
    $('#tsunami-banner').addEventListener('click', showTsunami);
    $('#ranges').addEventListener('click', async e => {
      const b = e.target.closest('.chip'); if (!b) return;
      if (b.dataset.layer) {
        state.showVolc = !state.showVolc; b.setAttribute('aria-selected', String(state.showVolc)); drawMarkers(); return;
      }
      document.querySelectorAll('#ranges [data-range]').forEach(c => c.setAttribute('aria-selected', String(c === b)));
      state.range = b.dataset.range; await refresh(true);
    });
    $('#sheet-body').addEventListener('input', e => { if (e.target.dataset.plan) { const p = store.get('plan', {}); p[e.target.dataset.plan] = e.target.value; store.set('plan', p); } });
    $('#sheet-body').addEventListener('click', e => {
      const t = e.target;
      const qb = t.closest('[data-q]'); if (qb) { const q = listCache.find(x => x.id === qb.dataset.q) || state.quakes.find(x => x.id === qb.dataset.q); if (q) openQuake(q, true); return; }
      const vb = t.closest('[data-v]'); if (vb) { const v = state.activeVolc.find(x => String(x.id) === vb.dataset.v); if (v) openVolcano(v); return; }
      const nb = t.closest('[data-link]'); if (nb) { NATIVE ? N.openNews(nb.dataset.link) : window.open(nb.dataset.link, '_blank', 'noopener'); return; }
      const rb = t.closest('[data-radio]'); if (rb) { const r = state.radios.find(x => x.id === rb.dataset.radio); if (r) playRadio(r); return; }
      const cb = t.closest('[data-cc]'); if (cb) { openRadio(cb.dataset.cc); return; }
      const city = t.closest('[data-city]'); if (city) {
        const c = allCities().find(x => x[0] === city.dataset.city);
        if (state.addLabel) { state.places.push({ label: state.addLabel, name: c[0], cc: c[1], lat: c[2], lon: c[3] }); state.addLabel = null; syncNative(); drawQuakes(); toast(`✅ Ahora también vigilamos ${c[0]}`); openAlertas(); return; }
        setMe({ name: c[0], cc: c[1], lat: c[2], lon: c[3] }); closeSheet(); return; }
      const ap = t.closest('[data-addplace]'); if (ap) { state.addLabel = ap.dataset.addplace; chooseCity(); return; }
      const dp = t.closest('[data-delplace]'); if (dp) { state.places.splice(+dp.dataset.delplace, 1); syncNative(); drawQuakes(); openAlertas(); return; }
      const sc = t.closest('[data-stat]'); if (sc) { state.statsCc = sc.dataset.stat; renderStats(sc.dataset.stat)($('#sheet-body')); return; }
      const tel = t.closest('[data-tel]'); if (tel) { NATIVE ? N.dial(tel.dataset.tel) : (location.href = 'tel:' + tel.dataset.tel); return; }
      const mo = t.closest('[data-mochila]'); if (mo) { const ok = store.get('mochila', {}); ok[mo.dataset.mochila] = !ok[mo.dataset.mochila]; store.set('mochila', ok); const top = $('#sheet-body').scrollTop; OrbeGuias.mochila(); $('#sheet-body').scrollTop = top; return; }
      const st = t.closest('[data-set]'); if (st) { state.settings[st.dataset.set] = +st.dataset.val; syncNative(); drawQuakes(); openAlertas(); return; }
      const tg = t.closest('[data-tog]'); if (tg) {
        const k = tg.dataset.tog; state.settings[k] = !state.settings[k]; tg.setAttribute('aria-checked', String(state.settings[k])); syncNative();
        if (k === 'watch' && state.settings.watch && NATIVE && typeof N.isBatteryFree === 'function' && !N.isBatteryFree()) toast('⚠️ Para que funcione siempre, quita el ahorro de batería (abajo)', 5000);
        return;
      }
      if (window.OrbeGuias && OrbeGuias.click(t)) return;
      const a = t.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act, q = state.currentQuake;
      if (act === 'estoybien') estoyBien();
      else if (act === 'compartir-q' && q) share(`🌎 Sismo de magnitud ${q.mag.toFixed(1)} en ${q.place}, ${fmtDate(q.time)} (${q.src}).\nVisto en Orbe Sismos`);
      else if (act === 'fuente' && q && q.url) NATIVE ? N.openUrl(q.url) : window.open(q.url, '_blank', 'noopener');
      else if (act === 'gvp') { const u = 'https://volcano.si.edu/volcano.cfm?vn=' + a.dataset.id; NATIVE ? N.openUrl(u) : window.open(u, '_blank', 'noopener'); }
      else if (act === 'sos') sos(true);
      else if (act === 'numeros') showNumeros();
      else if (act === 'tsunami') showTsunami();
      else if (act === 'guia') subSheet('Qué hacer en un sismo', 'Antes, durante y después', GUIA);
      else if (act === 'simulacro') { closeSheet(); drill(true); }
      else if (act === 'plan') showPlan();
      else if (act === 'plan-guardar') toast('💾 Plan guardado en este teléfono');
      else if (act === 'plan-compartir') { const p = store.get('plan', {}); share(`👨‍👩‍👧 Nuestro plan de emergencia\n📍 Punto de encuentro: ${p.encuentro || '-'}\n📞 Contactos: ${p.contacto1 || '-'} / ${p.contacto2 || '-'}\n🩸 Sangre: ${p.sangre || '-'} · Alergias: ${p.alergias || '-'} · Medicamentos: ${p.medicamentos || '-'}\n${p.notas || ''}\nCreado con Orbe Sismos`); }
      else if (act === 'mochila') OrbeGuias.mochila();
      else if (act === 'temprana') showTemprana();
      else if (act === 'abrir-ajustes') N.openSettings();
      else if (act === 'bateria') { N.openBatterySettings(); toast('Busca Orbe Sismos y elige "No optimizar"', 5000); }
      else if (act === 'autoinicio') { N.openAutostart(); toast('Activa Orbe Sismos y vuelve a la app', 5000); }
      else if (act === 'gps') askGps();
      else if (act === 'ubicacion') chooseCity();
      else if (act === 'probar') { if (NATIVE) N.testAlarm(); else toast('🔔 En la app de Android sonará la alarma de prueba'); }
      else if (act === 'premium') N.buyPremium();
      else if (act === 'senti') { const u = a.dataset.url; if (u) NATIVE ? N.openUrl(u) : window.open(u, '_blank', 'noopener'); }
      else if (act === 'compartir-img' && q) shareCard(q);
      else if (act === 'lluvia') openLluvia();
    });
    // Deslizar la hoja hacia abajo para cerrarla
    let y0 = null; const sh = $('#sheet');
    sh.addEventListener('touchstart', e => { if ($('#sheet-body').scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 !== null && e.touches[0].clientY - y0 > 90) { y0 = null; closeSheet(); } }, { passive: true });
  }
  window.orbeBack = () => {
    if (!$('#sos').hidden) { sos(false); return true; }
    if (!$('#drill').hidden) { drill(false); return true; }
    if (isOpen()) { closeSheet(); return true; }
    return false;
  };
  // Desde una notificación: abrir ese sismo
  window.orbeOpenQuake = json => {
    try { const q = JSON.parse(json); q.place = q.place || ''; openQuake(q, true); } catch (e) { /* ignorar */ }
  };
  window.onNativePremium = on => { state.premium = !!on; };

  // ---------- datos ----------
  async function refresh(showToast) {
    try {
      state.quakes = await loadQuakes(state.range);
      drawQuakes();
      if (state.sheet && state.sheet.title === 'Sismos') openSismos(state.sheet.active);
    } catch (e) {
      if (showToast !== false) toast('Sin conexión con los centros sismológicos. Reintentando…');
    }
  }
  async function loadContext() {
    try { state.context = await loadQuakes('week'); updateZone(); } catch (e) { /* opcional */ }
  }
  async function loadVolcanoActivity() {
    try {
      const xml = new DOMParser().parseFromString(await getText('https://volcano.si.edu/news/WeeklyVolcanoRSS.xml'), 'text/xml');
      const items = [...xml.querySelectorAll('item')];
      state.activeVolc = items.map(it => {
        const t = it.querySelector('title')?.textContent || '';
        const m = t.match(/^(.+?) \((.+?)\) - Report for .+? - (.+)$/);
        if (!m) return null;
        const pt = (it.getElementsByTagName('georss:point')[0] || it.getElementsByTagNameNS('http://www.georss.org/georss', 'point')[0])?.textContent;
        let lat, lon;
        if (pt) [lat, lon] = pt.trim().split(/\s+/).map(Number);
        const v = state.volc.find(x => x.name.toLowerCase() === m[1].toLowerCase());
        if ((lat == null || isNaN(lat)) && v) { lat = v.lat; lon = v.lon; }
        if (lat == null || isNaN(lat)) return null;
        const desc = (it.querySelector('description')?.textContent || '').replace(/<[^>]+>/g, '').slice(0, 260);
        const status = /New Eruptive/i.test(m[3]) ? 'Nueva actividad eruptiva' : /Continuing/i.test(m[3]) ? 'Actividad eruptiva continua' : 'Actividad reportada';
        return { id: v ? v.id : m[1], name: m[1], country: m[2], lat, lon, status, summary: desc, type: v && v.type, elevation: v && v.elevation, lastEruption: v && v.lastEruption };
      }).filter(Boolean);
      drawMarkers();
    } catch (e) { /* opcional */ }
  }
  async function loadTsunami() {
    const feeds = [['https://www.tsunami.gov/events/xml/PHEBAtom.xml', 'Centro del Pacífico (PTWC)'], ['https://www.tsunami.gov/events/xml/PAAQAtom.xml', 'Centro Nacional de EE. UU. (NTWC)']];
    const out = [];
    for (const [url, center] of feeds) {
      try {
        const xml = new DOMParser().parseFromString(await getText(url), 'text/xml');
        for (const en of xml.querySelectorAll('entry')) {
          const t = (en.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim();
          const lvl = /warning/i.test(t) ? 4 : /advisory/i.test(t) ? 3 : /watch|threat/i.test(t) ? 2 : 1;
          out.push({ title: t, center, level: lvl, time: Date.parse(en.querySelector('updated')?.textContent || '') || 0 });
        }
      } catch (e) { /* sin acceso */ }
    }
    state.tsunamis = out;
    const active = out.filter(t => Date.now() - t.time < 6 * 3600000 && t.level >= 2);
    const bn = $('#tsunami-banner');
    bn.hidden = !active.length;
    if (active.length) bn.textContent = `🌊 Boletín de tsunami activo: ${active[0].title}. Toca para ver qué hacer.`;
  }

  async function start() {
    const bar = $('#splash-bar'); bar.style.width = '25%';
    const [volc, hist, radios, lugares] = await Promise.all([
      local('data/volcanes.json'), local('data/historicos.json'), local('data/radios.json'), local('data/lugares.json')]);
    state.volc = volc.rows.map(r => ({ id: r[0], name: r[1], country: r[2], lat: r[3], lon: r[4], type: r[5], lastEruption: r[6], elevation: r[7] }));
    state.hist = hist.rows.map(r => ({ id: r[0], time: r[1], mag: r[2], lat: r[3], lon: r[4], depth: r[5], place: r[6], tsunami: r[7] }));
    state.radios = radios.rows.map(r => ({ id: r[0], name: r[1], url: r[2], cc: r[3], favicon: r[4], hls: r[5], tags: r[6] }));
    state.lugares = lugares;
    local('data/ciudades-mundo.json').then(m => { state.mundo = m; }).catch(() => {});
    bar.style.width = '50%';
    $('#splash-msg').textContent = 'Descargando los sismos más recientes…';
    bind();
    if (window.OrbeGuias) OrbeGuias.init({
      subSheet, store, esc, share, toast, N, NATIVE, closeSheet,
      where: () => state.me ? `Mi ubicación: https://maps.google.com/?q=${state.me.lat.toFixed(4)},${state.me.lon.toFixed(4)}` : '',
      setLowPower: on => { if (!globe) return; if (on) globe.pauseAnimation(); else globe.resumeAnimation(); }
    });
    initGlobe();
    drawMarkers();
    await refresh(true);
    bar.style.width = '80%';
    loadContext(); loadVolcanoActivity(); loadTsunami();
    syncNative();
    if (!state.me) setTimeout(() => toast('📍 Elige tu ubicación para recibir alarmas de sismos cercanos', 4500), 2500);
    // Actualización automática: cada minuto con la app abierta
    setInterval(() => { if (document.visibilityState === 'visible') refresh(false); }, 60000);
    setInterval(() => { if (document.visibilityState === 'visible') { loadTsunami(); loadContext(); } }, 5 * 60000);
  }
  start().catch(e => { $('#splash-msg').textContent = 'Error al iniciar: ' + e.message; });
})();
