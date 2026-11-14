/* Orbe Podcasts – los podcasts más escuchados de cada país sobre un globo 3D */
(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const N = window.AndroidPod || null;
  const NATIVE = !!(N && typeof N.fetchText === 'function');
  const I = window.OrbeIcons;
  const nf = new Intl.NumberFormat('es-CO');
  const D2R = Math.PI / 180;
  const TOP = cc => `https://rss.marketingtools.apple.com/api/v2/${cc}/podcasts/top/50/podcasts.json`;
  const LOOKUP = (id, cc) => `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=60&country=${cc || 'co'}`;
  const SEARCH = (q, cc) => `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=podcast&entity=podcast&country=${cc || 'co'}&limit=40`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('pod.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('pod.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '🌐';
  const regionName = (() => { try { const d = new Intl.DisplayNames(['es'], { type: 'region' }); return cc => { try { return d.of(cc.toUpperCase()); } catch (e) { return cc; } }; } catch (e) { return cc => cc; } })();
  const artUrl = (art, size = 600) => !art ? '' : /^https?:/.test(art) ? art.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${size}x${size}bb.jpg`)
    : `https://is1-ssl.mzstatic.com/image/thumb/${art.replace(/\.(jpg|png|webp)$/, '')}/${size}x${size}bb.jpg`;

  const state = {
    pods: [], byId: new Map(), paises: {}, cc: store.get('cc', null), filter: 'all',
    subs: store.get('subs', []), recents: store.get('recents', []), pos: store.get('pos', {}),
    cur: null, status: 'idle', time: 0, dur: 0, speed: store.get('speed', 1), sleep: 0,
    settings: Object.assign({ quality: 'ultra' }, store.get('settings', {})),
    sheet: null, premium: false, price: '$9.000 COP/mes', casting: false, charts: {}
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
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('tiempo agotado')); } }, 45000);
      });
    }
    const key = 'cache:' + url;
    const c = maxAgeMin > 0 ? store.get(key, null) : null;
    if (c && Date.now() - c.t < maxAgeMin * 60000) return Promise.resolve(c.v);
    return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(t => { if (maxAgeMin > 0 && t.length < 600000) store.set(key, { t: Date.now(), v: t }); return t; })
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
  const pad2 = n => String(n).padStart(2, '0');
  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
  }
  function durTxt(ms) {
    if (!ms) return '';
    const m = Math.round(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)} h ${pad2(m % 60)} min` : `${m} min`;
  }
  function when(iso) {
    const t = Date.parse(iso); if (!t) return '';
    const d = Math.floor((Date.now() - t) / 864e5);
    if (d <= 0) return 'Hoy';
    if (d === 1) return 'Ayer';
    if (d < 7) return `Hace ${d} días`;
    return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined }).replace('.', '');
  }
  const plain = html => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(br|\/p|\/li)\s*\/?>/gi, '\n'); return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim(); };
  const genName = k => (I.GEN[k] || I.GEN.otros).n;
  const share = txt => { if (NATIVE) N.share(txt); else if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else toast(txt, 5000); };
  function img(art, size, cls = '') {
    const u = artUrl(art, size);
    return `<span class="art ${cls}"><img decoding="async" alt="" src="${esc(u)}" onload="this.classList.add('ok')" onerror="this.remove()"></span>`;
  }

  // ---------- catálogo ----------
  function fromRow(r) { return { id: String(r[0]), name: r[1], author: r[2], art: r[3], g: I.genreOf(r[4]), cc: r[5], rank: r[6], charts: r[7] }; }
  function fromApple(p, cc, rank) {
    const m = /\/image\/thumb\/(.+)\/\d+x\d+bb\.(jpg|png|webp)$/.exec(p.artworkUrl100 || p.artworkUrl600 || '');
    const g = p.genres && p.genres[0] ? (typeof p.genres[0] === 'object' ? p.genres[0].genreId : (p.genreIds || [])[0]) : (p.genreIds || [])[0];
    return { id: String(p.id || p.collectionId), name: (p.name || p.collectionName || '').trim(), author: (p.artistName || '').replace(/\s{2,}.*$/, '').trim(),
      art: m ? m[1] + '.' + m[2] : (p.artworkUrl600 || ''), g: I.genreOf(g), cc, rank, charts: 1 };
  }
  const known = p => state.byId.get(String(p.id)) || p;
  async function countryTop(cc) {
    if (state.charts[cc]) return state.charts[cc];
    try {
      const j = await getJSON(TOP(cc), 720);
      const list = j.feed.results.map((p, i) => known(fromApple(p, cc, i + 1)));
      if (list.length) return (state.charts[cc] = list);
    } catch (e) { /* sin internet: se usa el catálogo incluido */ }
    return state.pods.filter(p => p.cc === cc).sort((a, b) => a.rank - b.rank);
  }
  function worldTop(n = 30, g = null) {
    return state.pods.filter(p => !g || p.g === g).slice().sort((a, b) => (b.charts - a.charts) || (a.rank - b.rank)).slice(0, n);
  }

  // ---------- globo ----------
  let globe, maxTex = 4096, dotTex = null;
  const use8k = () => state.settings.quality === 'ultra' && maxTex >= 8192 && (navigator.deviceMemory || 8) >= 4;
  function initGlobe() {
    globe = new Globe($('#globe'), { animateIn: true, waitForGlobeReady: true,
      rendererConfig: { antialias: true, powerPreference: 'high-performance' } });
    try { maxTex = globe.renderer().capabilities.maxTextureSize || 4096; } catch (e) { /* por defecto */ }
    globe.globeImageUrl(use8k() ? 'img/8k/8k_earth_daymap.jpg' : 'img/earth-blue-marble.jpg')
      .bumpImageUrl('img/earth-topology.png')
      .backgroundImageUrl(maxTex >= 8192 && (navigator.deviceMemory || 4) >= 6 ? 'img/8k/8k_stars.jpg' : 'img/stars-4k.jpg')
      .globeCurvatureResolution(2)
      .showAtmosphere(true).atmosphereColor('#a08cff').atmosphereAltitude(0.17)
      .particlesList(d => d.items).particleLat('lat').particleLng('lng').particleAltitude(0.012)
      .particlesSize(() => 3.2).particlesSizeAttenuation(false).particlesColor(d => d && d.color ? d.color : '#fff')
      .particleLabel(p => p && p.name ? `<b>${esc(p.name)}</b><br><span style="opacity:.75">${esc(p.author)} · ${flag(p.cc)}</span>` : '')
      .onParticleClick(p => p && p.id && openPodcast(p))
      .htmlLat('lat').htmlLng('lng').htmlAltitude(0.03).htmlElement(d => d.el)
      .onGlobeClick(c => c && nearestCountry(c.lat, c.lng))
      .onZoom(onZoom)
      .onGlobeReady(onReady);
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    const c = globe.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.25; c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 101.5; c.maxDistance = 650;
    c.addEventListener('start', () => { c.autoRotate = false; });
    const ctr = state.paises[state.cc] || [10, -60];
    globe.pointOfView({ lat: ctr[0] * 0.6, lng: ctr[1], altitude: innerWidth < innerHeight ? 2.6 : 2.1 });
    globe.renderer().domElement.addEventListener('webglcontextlost', e => e.preventDefault(), false);
    globe.renderer().domElement.addEventListener('webglcontextrestored', () => location.reload(), false);
    window.addEventListener('resize', () => globe.width(innerWidth).height(innerHeight));
  }
  function onReady() {
    if (window.TierraHD && TierraHD.init(globe)) {
      TierraHD.createEarth({ day: use8k() ? 'img/8k/8k_earth_daymap.jpg' : 'img/earth-blue-marble.jpg', night: 'img/earth-night.jpg',
        normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' }, { nightAmbient: 0.16 })
        .then(m => globe.globeMaterial(m)).catch(() => {});
      TierraHD.createClouds('img/clouds-4k.jpg', { opacity: 0.55 }).catch(() => {});
    }
    // Puntos redondos con brillo
    try {
      const Tex = globe.globeMaterial().map.constructor;
      const cache = {};
      dotTex = color => {
        if (cache[color]) return cache[color];
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, color); g.addColorStop(0.62, color + 'aa'); g.addColorStop(1, color + '00');
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        const t = new Tex(c); t.needsUpdate = true; return (cache[color] = t);
      };
      globe.particlesTexture(d => dotTex(d.color));
    } catch (e) { /* puntos cuadrados */ }
    drawPods(); drawCountries();
    splash(100);
  }
  let sizeStep = -1;
  function onZoom(pov) {
    const step = pov.altitude > 1.8 ? 0 : pov.altitude > 0.9 ? 1 : pov.altitude > 0.4 ? 2 : 3;
    if (step !== sizeStep) { sizeStep = step; globe.particlesSize(() => [3.2, 4.4, 6, 8][step]); }
    document.body.classList.toggle('near', pov.altitude < 1.2);
  }
  // Cada podcast en espiral alrededor de su país: los más escuchados, al centro
  function placeOf(p) {
    const c = state.paises[p.cc]; if (!c) return null;
    const a = p.rank * 2.399963, r = 0.55 + Math.sqrt(p.rank) * 0.62;
    return { lat: c[0] + r * Math.sin(a), lng: c[1] + r * Math.cos(a) / Math.max(0.35, Math.cos(c[0] * D2R)) };
  }
  function drawPods() {
    if (!globe) return;
    const sets = new Map();
    for (const p of state.pods) {
      if (state.filter !== 'all' && p.g !== state.filter) continue;
      const at = placeOf(p); if (!at) continue;
      let s = sets.get(p.g); if (!s) sets.set(p.g, s = { color: (I.GEN[p.g] || I.GEN.otros).c[0], items: [] });
      s.items.push(Object.assign(p, at));
    }
    globe.particlesData([...sets.values()]);
  }
  // Banderas de los países (tócalas para ver su top)
  function drawCountries() {
    const els = [];
    const counts = {};
    for (const p of state.pods) counts[p.cc] = (counts[p.cc] || 0) + 1;
    for (const [cc, c] of Object.entries(state.paises)) {
      if (!counts[cc]) continue;
      const el = document.createElement('button');
      el.className = 'cc-mk' + (cc === state.cc ? ' cur' : '');
      el.innerHTML = `<span>${flag(cc)}</span>`;
      el.title = regionName(cc);
      el.addEventListener('click', ev => { ev.stopPropagation(); openCountry(cc); });
      els.push({ lat: c[0], lng: c[1], el });
    }
    globe.htmlElementsData(els);
  }
  function nearestCountry(lat, lng) {
    let best = null, bd = 1e9;
    for (const [cc, c] of Object.entries(state.paises)) {
      const d = (c[0] - lat) ** 2 + ((c[1] - lng) * Math.cos(lat * D2R)) ** 2;
      if (d < bd) { bd = d; best = cc; }
    }
    if (best && bd < 220) openCountry(best);
  }
  function flyTo(cc, alt = 1.25) {
    const c = state.paises[cc]; if (!c || !globe) return;
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: c[0] - 6, lng: c[1], altitude: alt }, 1300);
  }

  // ---------- géneros (chips) y país ----------
  function renderGenres() {
    const counts = {}; for (const p of state.pods) counts[p.g] = (counts[p.g] || 0) + 1;
    const chip = (k, label, n) => `<button class="chip" data-g="${k}" aria-selected="${state.filter === k}">${k === 'all' ? `<span class="tile3d" style="--c:#ff7ab6;--c1:#ffd0e6;--c2:#8b5cff;--s:26px">${I.ui('mic')}</span>` : I.genre(k)}${esc(label)}<span class="n">${nf.format(n)}</span></button>`;
    $('#genres').innerHTML = chip('all', 'Todos', state.pods.length) + I.ORDER.filter(k => counts[k]).map(k => chip(k, genName(k), counts[k])).join('');
  }
  function setFilter(k) {
    state.filter = k;
    document.querySelectorAll('#genres .chip').forEach(b => b.setAttribute('aria-selected', String(b.dataset.g === k)));
    drawPods();
    if (k !== 'all') openGenre(k);
  }
  function setCountry(cc) {
    state.cc = cc; store.set('cc', cc);
    $('#cc-flag').textContent = flag(cc); $('#cc-name').textContent = regionName(cc).split(' ')[0];
    drawCountries(); flyTo(cc, 2.0);
  }

  // ---------- hoja ----------
  function openSheet(cfg) {
    state.sheet = cfg;
    $('#sheet-title').textContent = cfg.title;
    $('#sheet-sub').textContent = cfg.sub || '';
    const tabs = cfg.tabs || [{ id: 'main', render: cfg.render }];
    cfg.tabs = tabs;
    $('#sheet-tabs').innerHTML = tabs.length > 1 ? tabs.map(t => `<button class="tab" data-tab="${t.id}">${esc(t.label)}</button>`).join('') : '';
    showTab(cfg.active || tabs[0].id);
    $('#sheet').classList.toggle('tall', !!cfg.player);
    document.body.classList.toggle('player-open', !!cfg.player);
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
  const rerender = () => { if (state.sheet) showTab(state.sheet.active); };
  function closeSheet(silent) {
    $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('player-open');
    state.sheet = null;
    if (!silent) selectTab('mapa', true);
  }
  const isOpen = () => $('#sheet').classList.contains('open');
  function selectTab(tab, silent) {
    document.querySelectorAll('#tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (silent) return;
    if (tab === 'mapa') { if (isOpen()) closeSheet(true); return; }
    ({ explorar: openExplore, biblioteca: openLibrary, buscar: openSearch })[tab]();
  }
  window.orbeBack = () => { if (isOpen()) { closeSheet(); return true; } return false; };

  // ---------- piezas de lista ----------
  const tile = (p, num) => `<button class="pod-tile" data-pod="${esc(p.id)}">${img(p.art, 300).replace('class="art "', 'class="art"').replace('</span>', num ? `<span class="rk">${num}</span></span>` : '</span>')}
      <b>${esc(p.name)}</b><small>${esc(p.author || genName(p.g))}</small></button>`;
  const bigTile = (p, num) => `<button class="big-tile" data-pod="${esc(p.id)}" style="background-image:url('${esc(artUrl(p.art, 100))}')">
      <span class="tx"><span class="eyebrow" style="color:#ffc2dc">#${num} ${flag(p.cc)}</span><b>${esc(p.name)}</b><small>${esc(p.author)}</small></span>${img(p.art, 300)}</button>`;
  const podRow = (p, num) => `<button class="pod-row" data-pod="${esc(p.id)}">${num ? `<span class="num">${num}</span>` : ''}${img(p.art, 160)}
      <div class="meta"><div class="name">${esc(p.name)}</div><div class="sub"><span>${esc(p.author)}</span><span class="pill" style="background:${(I.GEN[p.g] || I.GEN.otros).c[0]}22;color:${(I.GEN[p.g] || I.GEN.otros).c[1]}">${esc(genName(p.g))}</span></div></div></button>`;
  const rail = (title, list, more, big) => !list.length ? '' : `<div class="rail-h"><h3>${title}</h3>${more ? `<button data-more="${more}">Ver todo</button>` : ''}</div>
      <div class="rail">${list.map((p, i) => big ? bigTile(p, i + 1) : tile(p, more && more.startsWith('cc:') ? i + 1 : 0)).join('')}</div>`;
  function progressOf(ep) {
    const v = state.pos[ep.id];
    if (v === -1) return { done: true, f: 1 };
    if (!v || !ep.dur) return { done: false, f: 0 };
    return { done: false, f: Math.min(1, v / ep.dur) };
  }
  function epRow(ep, showPod) {
    const pr = progressOf(ep), cur = state.cur && state.cur.id === ep.id;
    const playing = cur && (state.status === 'playing' || state.status === 'loading');
    const left = pr.f > 0 && !pr.done ? `${durTxt(ep.dur - state.pos[ep.id])} restantes` : durTxt(ep.dur);
    return `<div class="ep ${cur ? 'cur' : ''}">
      ${showPod ? img(ep.art, 160, '').replace('class="art "', 'class="art" style="width:56px;height:56px;border-radius:14px;margin-top:4px"') : ''}
      <button class="meta" data-ep="${esc(ep.id)}" style="text-align:left"><span class="when">${esc(when(ep.date))}${showPod ? ' · ' + esc(ep.podcast) : ''}</span><b>${esc(ep.title)}</b>
        ${ep.desc ? `<p>${esc(plain(ep.desc).slice(0, 220))}</p>` : ''}${pr.f > 0 && !pr.done ? `<div class="bar"><i style="width:${(pr.f * 100).toFixed(1)}%"></i></div>` : ''}</button>
      <div><button class="ep-play ${pr.done ? 'done' : ''}" data-play="${esc(ep.id)}" aria-label="Reproducir">${I.ui(playing ? 'pause' : pr.done ? 'check' : 'play')}</button>
        <div class="ep-dur">${esc(pr.done ? 'Escuchado' : left)}</div></div></div>`;
  }

  // ---------- Explorar ----------
  async function openExplore() {
    selectTab('explorar', true);
    openSheet({
      title: 'Explorar', sub: `Lo más escuchado en ${regionName(state.cc)} y en el mundo`,
      render: async body => {
        body.innerHTML = '<div class="spinner"></div>';
        const top = await countryTop(state.cc);
        if (!state.sheet || state.sheet.title !== 'Explorar') return;
        const world = worldTop(20);
        const genres = I.ORDER.filter(k => k !== 'otros').map(k => [k, worldTop(14, k)]).filter(([, l]) => l.length >= 5);
        body.innerHTML = rail(`Top 10 en ${flag(state.cc)} ${esc(regionName(state.cc))}`, top.slice(0, 10), 'cc:' + state.cc, true)
          + rail('🌍 Lo más escuchado del mundo', world, 'world')
          + genres.map(([k, l]) => rail(`${I.genre(k, 22)} ${esc(genName(k))}`, l, 'g:' + k)).join('')
          + `<button class="btn block" data-act="paises" style="margin-top:6px">${I.ui('globe')}Ver el top de otro país</button>
             <p class="about">Listas oficiales de Apple Podcasts de ${Object.keys(state.paises).length} países. Se actualizan cada día.</p>`;
      }
    });
  }
  async function openCountry(cc) {
    flyTo(cc);
    openSheet({
      title: `${flag(cc)} ${regionName(cc)}`, sub: 'Los 50 podcasts más escuchados ahora',
      render: async body => {
        body.innerHTML = '<div class="spinner"></div>';
        const list = await countryTop(cc);
        if (!state.sheet) return;
        body.innerHTML = (cc !== state.cc ? `<button class="btn block" data-setcc="${cc}" style="margin-bottom:10px">${flag(cc)} Usar ${esc(regionName(cc))} como mi país</button>` : '')
          + (list.length ? list.map((p, i) => podRow(p, i + 1)).join('') : '<div class="empty">No hay lista para este país.</div>');
      }
    });
  }
  function openGenre(k) {
    const inCc = state.pods.filter(p => p.g === k && p.cc === state.cc).sort((a, b) => a.rank - b.rank);
    const world = worldTop(60, k);
    openSheet({
      title: genName(k), sub: `${nf.format(state.pods.filter(p => p.g === k).length)} podcasts en el mapa`,
      tabs: [{ id: 'm', label: 'En el mundo', render: b => { b.innerHTML = world.map((p, i) => podRow(p, i + 1)).join(''); } },
        { id: 'c', label: `En ${regionName(state.cc)}`, render: b => { b.innerHTML = inCc.length ? inCc.map(p => podRow(p, p.rank)).join('') : '<div class="empty">No hay de este género en el top de tu país.</div>'; } }]
    });
  }
  function openCountries() {
    const counts = {}; for (const p of state.pods) counts[p.cc] = (counts[p.cc] || 0) + 1;
    const list = Object.keys(state.paises).filter(cc => counts[cc]).sort((a, b) => regionName(a).localeCompare(regionName(b), 'es'));
    openSheet({
      title: 'Países', sub: 'Elige un país para ver su top',
      render: b => {
        b.innerHTML = list.map(cc => `<button class="country-row ${cc === state.cc ? 'cur' : ''}" data-cc="${cc}"><span class="fl">${flag(cc)}</span><b>${esc(regionName(cc))}</b><small>${counts[cc]}</small></button>`).join('');
      }
    });
  }

  // ---------- ficha del podcast ----------
  const follows = id => state.subs.some(s => s.id === String(id));
  async function loadEpisodes(p) {
    const j = await getJSON(LOOKUP(p.id, p.cc || state.cc), 60);
    const info = j.results.find(r => r.kind === 'podcast' || r.wrapperType === 'track' && r.collectionId && !r.episodeUrl) || {};
    const eps = j.results.filter(r => r.episodeUrl).map(r => ({
      id: String(r.trackId), title: (r.trackName || '').trim(), podcast: r.collectionName || p.name, podId: String(r.collectionId || p.id),
      art: r.artworkUrl600 || artUrl(p.art, 600), url: r.episodeUrl, dur: r.trackTimeMillis || 0, date: r.releaseDate, desc: r.description || r.shortDescription || ''
    })).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    return { info, eps };
  }
  async function openPodcast(p) {
    p = known(p);
    if (globe && state.paises[p.cc]) flyTo(p.cc, 1.4);
    openSheet({
      title: p.name, sub: `${p.author}${p.cc ? ' · ' + flag(p.cc) + ' #' + p.rank + ' en ' + regionName(p.cc) : ''}`, pod: p.id,
      render: async body => {
        const g = I.GEN[p.g] || I.GEN.otros;
        body.innerHTML = `<div class="pod-hero">${img(p.art, 400)}<div><b>${esc(p.name)}</b><small>${esc(p.author)}</small>
            <div class="pills"><span class="pill" style="background:${g.c[0]}22;color:${g.c[1]}">${esc(g.n)}</span>${p.charts > 1 ? `<span class="pill gold">Top en ${p.charts} países</span>` : ''}<span class="pill" id="pc-count">…</span></div></div></div>
          <div class="btn-row"><button class="btn follow ${follows(p.id) ? 'on' : ''}" id="pc-follow">${I.ui(follows(p.id) ? 'check' : 'plus')}${follows(p.id) ? 'Siguiendo' : 'Seguir'}</button>
            <button class="btn primary" id="pc-play">${I.ui('play')}Escuchar</button><button class="btn" id="pc-share" aria-label="Compartir" style="flex:0 0 46px;padding:0">${I.ui('share')}</button></div>
          <div class="section-h"><h3>Episodios</h3><small id="pc-n"></small></div><div id="pc-eps"><div class="spinner"></div></div>`;
        $('#pc-follow').onclick = () => { toggleFollow(p); rerender(); };
        $('#pc-share').onclick = () => share(`🎧 Te recomiendo el podcast "${p.name}" de ${p.author}. Escúchalo en Orbe Podcasts.`);
        try {
          const { info, eps } = await loadEpisodes(p);
          if (!state.sheet || state.sheet.pod !== p.id) return;
          state.epsOf = state.epsOf || {}; state.epsOf[p.id] = eps;
          const cnt = $('#pc-count'); if (cnt) cnt.textContent = `${nf.format(info.trackCount || eps.length)} episodios`;
          $('#pc-n').textContent = eps.length ? `${eps.length} más recientes` : '';
          $('#pc-eps').innerHTML = eps.length ? eps.map(e => epRow(e)).join('') : '<div class="empty">Este podcast no tiene episodios disponibles.</div>';
          $('#pc-play').onclick = () => eps[0] && play(eps[0]);
          remember(eps);
        } catch (e) {
          const el = $('#pc-eps'); if (el) el.innerHTML = '<div class="empty">No se pudieron cargar los episodios. Revisa tu conexión.</div>';
        }
      }
    });
  }
  function toggleFollow(p) {
    if (follows(p.id)) { state.subs = state.subs.filter(s => s.id !== String(p.id)); toast(`Dejaste de seguir "${p.name}"`); }
    else { state.subs.unshift({ id: String(p.id), name: p.name, author: p.author, art: p.art, g: p.g, cc: p.cc, rank: p.rank, charts: p.charts }); toast(`Siguiendo "${p.name}": verás sus episodios nuevos en Biblioteca`); }
    store.set('subs', state.subs.slice(0, 200));
  }
  // Episodios vistos, para encontrarlos por id
  const epIndex = new Map();
  function remember(eps) { for (const e of eps) epIndex.set(e.id, e); }

  // ---------- Biblioteca ----------
  async function openLibrary() {
    selectTab('biblioteca', true);
    openSheet({
      title: 'Mi biblioteca', sub: 'Lo que sigues y lo que estás escuchando',
      render: async body => {
        const going = state.recents.filter(e => { const pr = progressOf(e); return !pr.done; }).slice(0, 12);
        body.innerHTML = (going.length ? `<div class="section-h"><h3>Seguir escuchando</h3></div>${going.map(e => epRow(e, true)).join('')}` : '')
          + `<div class="section-h"><h3>Siguiendo</h3><small>${state.subs.length}</small></div>`
          + (state.subs.length ? `<div class="rail">${state.subs.map(p => tile(p)).join('')}</div>`
            : '<div class="empty">Toca <b>Seguir</b> en un podcast para tenerlo aquí y ver sus episodios nuevos.</div>')
          + (state.subs.length ? '<div class="section-h"><h3>Episodios nuevos</h3><small>de lo que sigues</small></div><div id="lib-new"><div class="spinner"></div></div>' : '');
        remember(going);
        if (!state.subs.length) return;
        const all = [];
        await Promise.all(state.subs.slice(0, 25).map(p => loadEpisodes(p).then(r => all.push(...r.eps.slice(0, 3))).catch(() => {})));
        all.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        const nuevos = all.slice(0, 30);
        remember(nuevos);
        syncLibrary(nuevos);
        const el = $('#lib-new'); if (el) el.innerHTML = nuevos.length ? nuevos.map(e => epRow(e, true)).join('') : '<div class="empty">Sin episodios nuevos.</div>';
      }
    });
  }
  function syncLibrary(nuevos) {
    if (nuevos) state.nuevos = nuevos;
    if (NATIVE && typeof N.syncLibrary === 'function') {
      const slim = e => ({ id: e.id, title: e.title, podcast: e.podcast, podId: e.podId, art: e.art, url: e.url, dur: e.dur });
      N.syncLibrary(JSON.stringify({ recents: state.recents.slice(0, 20).map(slim), nuevos: (state.nuevos || []).slice(0, 30).map(slim) }));
    }
  }

  // ---------- Buscar ----------
  function openSearch() {
    selectTab('buscar', true);
    openSheet({
      title: 'Buscar', sub: 'Más de 2 millones de podcasts',
      render: body => {
        body.innerHTML = `<label class="search">${I.ui('buscar')}<input id="q" type="search" placeholder="Programa, tema o presentador…" autocomplete="off"></label><div id="q-res"></div>`;
        const input = $('#q'), out = $('#q-res');
        const fold = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const showDefault = () => { out.innerHTML = `<div class="section-h"><h3>Géneros</h3></div><div class="cat-grid">${I.ORDER.filter(k => k !== 'otros').map(k => `<button class="cat-card" data-gen="${k}" style="--c:${I.GEN[k].c[0]};min-height:90px">${I.genre(k, 40)}<b>${esc(genName(k))}</b></button>`).join('')}</div>`; };
        showDefault();
        let timer;
        input.addEventListener('input', () => {
          const v = input.value.trim();
          if (!v) { showDefault(); return; }
          const f = fold(v);
          const loc = state.pods.filter(p => fold(p.name).includes(f) || fold(p.author).includes(f)).slice(0, 20);
          out.innerHTML = loc.map(p => podRow(p)).join('') + '<div class="spinner" id="q-spin"></div>';
          clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const j = await getJSON(SEARCH(v, state.cc), 60);
              if (input.value.trim() !== v) return;
              const seen = new Set(loc.map(p => p.id));
              const more = j.results.map(r => known(fromApple(r, '', 0))).filter(p => !seen.has(p.id));
              for (const p of more) if (!state.byId.has(p.id)) state.byId.set(p.id, p);
              out.innerHTML = loc.concat(more).map(p => podRow(p)).join('') || `<div class="empty">Nada con "${esc(v)}".</div>`;
            } catch (e) { const s = $('#q-spin'); if (s) s.remove(); }
          }, 420);
        });
        setTimeout(() => input.focus(), 350);
      }
    });
  }

  // ---------- reproductor ----------
  let audio = null;
  function webAudio() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'auto';
    const st = s => { state.status = s; paintPlayer(); };
    audio.addEventListener('playing', () => st('playing'));
    audio.addEventListener('pause', () => st(audio.ended ? 'ended' : 'paused'));
    audio.addEventListener('waiting', () => st('loading'));
    audio.addEventListener('error', () => { st('error'); toast('No se pudo reproducir este episodio'); });
    audio.addEventListener('timeupdate', () => window.onNativeProgress(audio.currentTime * 1000, (audio.duration || 0) * 1000, !audio.paused));
    audio.addEventListener('ended', () => { savePos(state.cur, state.dur, state.dur); st('ended'); });
    return audio;
  }
  function play(ep, startMs) {
    if (!ep || !ep.url) return;
    const same = state.cur && state.cur.id === ep.id;
    if (same && state.status !== 'ended' && state.status !== 'error' && startMs == null) { toggle(); return; }
    const resume = startMs != null ? startMs : (state.pos[ep.id] > 0 ? state.pos[ep.id] : 0);
    state.cur = ep; state.status = 'loading'; state.time = resume; state.dur = ep.dur || 0;
    state.recents = [ep].concat(state.recents.filter(e => e.id !== ep.id)).slice(0, 40);
    store.set('recents', state.recents); store.set('cur', ep);
    remember([ep]); syncLibrary();
    if (NATIVE) N.playEpisode(JSON.stringify({ id: ep.id, title: ep.title, podcast: ep.podcast, podId: ep.podId, art: ep.art, url: ep.url, dur: ep.dur }), resume, !same);
    else {
      const a = webAudio();
      a.src = ep.url; a.playbackRate = state.speed;
      a.currentTime = resume / 1000;
      a.play().catch(() => { state.status = 'paused'; paintPlayer(); });
    }
    paintPlayer();
    if (resume > 60000) toast(`Sigues donde quedaste: ${clock(resume)}`);
  }
  function toggle() {
    if (!state.cur) return;
    if (NATIVE) { N.toggle(); return; }
    const a = webAudio();
    if (!a.src) { play(state.cur, state.time); return; }
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }
  function skip(ms) { if (NATIVE) N.skip(ms); else { const a = webAudio(); a.currentTime = Math.max(0, a.currentTime + ms / 1000); } }
  function seek(ms) { if (NATIVE) N.seekTo(ms); else webAudio().currentTime = ms / 1000; state.time = ms; paintPlayer(); }
  function setSpeed(x) { state.speed = x; store.set('speed', x); if (NATIVE) N.setSpeed(x); else if (audio) audio.playbackRate = x; paintPlayer(); }
  function setSleep(min) {
    state.sleep = min;
    if (NATIVE) N.setSleep(min);
    else { clearTimeout(webSleep); if (min > 0) webSleep = setTimeout(() => { if (audio) audio.pause(); state.sleep = 0; paintPlayer(); }, min * 60000); }
    toast(min === 0 ? 'Temporizador apagado' : min < 0 ? 'Se apagará al terminar el episodio' : `Se apagará en ${min} minutos`);
    paintPlayer();
  }
  let webSleep = null;
  function savePos(ep, ms, dur) {
    if (!ep || !ms) return;
    state.pos[ep.id] = dur > 0 && dur - ms < 30000 ? -1 : Math.round(ms);
    const keys = Object.keys(state.pos); if (keys.length > 400) delete state.pos[keys[0]];
    store.set('pos', state.pos);
  }
  let lastSave = 0;
  window.onNativeProgress = (pos, dur, playing) => {
    state.time = pos; if (dur > 0) state.dur = dur;
    if (state.cur && Date.now() - lastSave > 5000) { lastSave = Date.now(); savePos(state.cur, pos, state.dur); }
    paintProgress();
  };
  window.onNativePlayer = (st, msg) => {
    state.status = st;
    if (st === 'ended' && state.cur) savePos(state.cur, state.dur, state.dur);
    if (st === 'paused' && state.cur) savePos(state.cur, state.time, state.dur);
    if (msg) toast(msg, 4000);
    paintPlayer();
  };
  window.onNativeEpisode = json => { try { const ep = JSON.parse(json); state.cur = Object.assign({}, epIndex.get(ep.id) || {}, ep); paintPlayer(); } catch (e) { /* nada */ } };
  window.onNativeSleep = min => { state.sleep = min; paintPlayer(); };
  window.onNativeCast = (on, name) => { state.casting = on; if (on) toast(`Sonando en ${name}`); paintPlayer(); };
  window.onNativePremium = (p, price) => { state.premium = !!p; if (price) state.price = price; };

  function paintProgress() {
    const f = state.dur > 0 ? Math.min(1, state.time / state.dur) : 0;
    $('#mini-bar').style.width = (f * 100).toFixed(2) + '%';
    const r = $('#np-seek');
    if (r && !r.dragging) { r.max = Math.max(1, Math.round(state.dur / 1000)); r.value = Math.round(state.time / 1000); r.style.setProperty('--p', (f * 100).toFixed(2) + '%'); }
    const a = $('#np-a'), b = $('#np-b');
    if (a) a.textContent = clock(state.time);
    if (b) b.textContent = state.dur ? '−' + clock(state.dur - state.time) : '';
  }
  function paintPlayer() {
    const ep = state.cur, m = $('#mini');
    document.body.classList.toggle('playing', !!ep);
    if (!ep) { m.hidden = true; return; }
    m.hidden = false;
    $('#mini-art').innerHTML = `<img alt="" src="${esc(ep.art)}" onload="this.classList.add('ok')">`;
    $('#mini-art').style.backgroundImage = '';
    $('#mini-title').textContent = ep.title;
    $('#mini-sub').textContent = state.casting ? '📺 En el televisor · ' + ep.podcast : ep.podcast;
    const busy = state.status === 'loading';
    $('#mini-play').innerHTML = busy ? '<span class="spin"></span>' : I.ui(state.status === 'playing' ? 'pause' : 'play');
    paintProgress();
    const big = $('#np-play');
    if (big) {
      big.innerHTML = busy ? '<span class="spin" style="width:30px;height:30px"></span>' : I.ui(state.status === 'playing' ? 'pause' : 'play');
      $('#np-speed').textContent = `${String(state.speed).replace('.', ',')}×`;
      $('#np-speed').classList.toggle('on', state.speed !== 1);
      $('#np-sleep').classList.toggle('on', !!state.sleep);
      $('#np-sleep').innerHTML = state.sleep > 0 ? `${state.sleep}′` : state.sleep < 0 ? 'Fin' : I.ui('moon');
    }
    // Las listas de episodios marcan el que suena
    document.querySelectorAll('[data-play]').forEach(b => {
      const cur = b.dataset.play === ep.id;
      if (cur) b.innerHTML = I.ui(state.status === 'playing' || busy ? 'pause' : 'play');
    });
  }
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.8];
  function openPlayer() {
    const ep = state.cur; if (!ep) return;
    openSheet({
      title: 'Reproduciendo', sub: ep.podcast, player: true,
      render: body => {
        body.innerHTML = `<div class="np"><div class="np-bg" style="background-image:url('${esc(ep.art)}')"></div>
          <span class="art"><img alt="" src="${esc(ep.art)}" onload="this.classList.add('ok')"></span>
          <div class="np-title">${esc(ep.title)}</div><button class="np-pod" data-podid="${esc(ep.podId)}">${esc(ep.podcast)} ›</button>
          <div class="seek"><input type="range" id="np-seek" min="0" max="1" value="0" step="1" aria-label="Posición"><div class="times"><span id="np-a">0:00</span><span id="np-b"></span></div></div>
          <div class="np-ctrl"><button class="chip-s" id="np-speed">1×</button>
            <button class="icon-btn" id="np-back" aria-label="Atrás 15 segundos">${I.ui('back15')}<span class="n">15</span></button>
            <button class="big" id="np-play" aria-label="Reproducir o pausar"></button>
            <button class="icon-btn" id="np-fwd" aria-label="Adelante 30 segundos">${I.ui('fwd30')}<span class="n">30</span></button>
            <button class="chip-s" id="np-sleep" aria-label="Temporizador"></button></div>
          <div class="np-more">${NATIVE ? `<button class="btn" id="np-cast">${I.ui('cast')}Televisor</button>` : ''}<button class="btn" id="np-share">${I.ui('share')}Compartir</button></div>
          ${ep.desc ? `<div class="np-desc">${esc(plain(ep.desc).slice(0, 3000))}</div>` : ''}</div>`;
        const r = $('#np-seek');
        r.addEventListener('input', () => { r.dragging = true; const f = r.value / Math.max(1, r.max); r.style.setProperty('--p', (f * 100) + '%'); $('#np-a').textContent = clock(r.value * 1000); });
        r.addEventListener('change', () => { r.dragging = false; seek(r.value * 1000); });
        $('#np-play').onclick = toggle;
        $('#np-back').onclick = () => skip(-15000);
        $('#np-fwd').onclick = () => skip(30000);
        $('#np-speed').onclick = () => setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
        $('#np-sleep').onclick = openSleep;
        $('#np-share').onclick = () => share(`🎧 Estoy escuchando "${ep.title}" de ${ep.podcast} en Orbe Podcasts.`);
        const c = $('#np-cast'); if (c) c.onclick = () => N.cast();
        paintPlayer();
      }
    });
  }
  function openSleep() {
    openSheet({
      title: 'Temporizador', sub: 'El podcast se apaga solo',
      render: b => {
        const opts = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hora'], [-1, 'Al terminar'], [0, 'Apagado']];
        b.innerHTML = `<div class="seg-wrap">${opts.map(([v, l]) => `<button data-sleep="${v}" aria-pressed="${state.sleep === v || (v > 0 && state.sleep > 0 && state.sleep <= v && state.sleep > v - 15)}">${l}</button>`).join('')}</div>
          <button class="btn block" id="sl-back">Volver al reproductor</button>`;
        b.querySelectorAll('[data-sleep]').forEach(x => x.onclick = () => { setSleep(+x.dataset.sleep); openPlayer(); });
        $('#sl-back').onclick = openPlayer;
      }
    });
  }

  // ---------- menú ----------
  function openMenu() {
    openSheet({
      title: 'Orbe Podcasts', sub: 'Ajustes, Premium y fuentes',
      render: body => {
        const s = state.settings;
        body.innerHTML = `<div class="premium">${state.premium ? '<h4>Premium activo ✨</h4><p class="ok">Gracias por apoyar Orbe Podcasts: no verás anuncios.</p><button class="btn" id="m-manage">Administrar suscripción</button>'
            : `<h4>Orbe Podcasts Premium</h4><p>Escucha sin anuncios. ${esc(state.price)}.</p><button class="btn primary block" id="m-buy">Quitar anuncios</button>`}</div>
          <button class="toggle" id="m-q" role="switch" aria-checked="${s.quality === 'ultra'}"><span><b>Tierra en 8K Ultra HD</b><span class="t-sub">Más detalle si tu equipo lo soporta</span></span><span class="switch"></span></button>
          <div class="section-h"><h3>Colores del mapa</h3></div>
          <div class="legend">${I.ORDER.map(k => `<span><i style="background:${I.GEN[k].c[0]};color:${I.GEN[k].c[0]}"></i>${esc(genName(k))}</span>`).join('')}</div>
          <p class="about">Cada punto es un podcast del top de su país: los más escuchados quedan en el centro. Toca una bandera para ver la lista completa de ese país.</p>
          <p class="about"><b>Fuentes:</b> listas y búsqueda de Apple Podcasts (iTunes Search API). El audio llega directamente desde el servidor de cada podcast. Texturas de la Tierra: Solar System Scope (CC BY 4.0) y NASA.<br>Orbe Podcasts 1.0</p>`;
        $('#m-q').onclick = e => { s.quality = s.quality === 'ultra' ? 'high' : 'ultra'; store.set('settings', s); e.currentTarget.setAttribute('aria-checked', String(s.quality === 'ultra')); toast('Se aplicará al volver a abrir la app'); };
        const buy = $('#m-buy'); if (buy) buy.onclick = () => { if (NATIVE) N.buyPremium(); else toast('La suscripción se activa desde la app instalada con Google Play'); };
        const man = $('#m-manage'); if (man) man.onclick = () => NATIVE && N.manageSubscription();
      }
    });
  }

  // ---------- splash ----------
  function splash(pct, msg) {
    const bar = $('#splash-bar'); if (!bar) return;
    bar.style.width = pct + '%'; if (msg) $('#splash-msg').textContent = msg;
    if (pct >= 100) { const sp = $('#splash'); setTimeout(() => sp.classList.add('gone'), 250); setTimeout(() => sp.remove(), 1000); }
  }

  // ---------- eventos ----------
  function wire() {
    $('#defs-host').innerHTML = I.DEFS;
    $('#btn-menu').innerHTML = I.ui('menu');
    $('#sheet-close').innerHTML = I.ui('close');
    $('#mini-fwd').innerHTML = I.ui('fwd30');
    document.querySelectorAll('.ti').forEach(t => { t.innerHTML = I.ui(t.dataset.ico); });
    $('#tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) selectTab(b.dataset.tab); });
    $('#sheet-close').onclick = () => closeSheet();
    $('#sheet-tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });
    $('#genres').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setFilter(b.dataset.g); });
    $('#btn-country').onclick = openCountries;
    $('#btn-menu').onclick = openMenu;
    $('#mini-play').onclick = toggle;
    $('#mini-fwd').onclick = () => skip(30000);
    $('#mini-art').onclick = $('#mini-tx').onclick = openPlayer;
    $('#sheet-body').addEventListener('click', e => {
      const t = e.target;
      const pl = t.closest('[data-play]'); if (pl) { const ep = epIndex.get(pl.dataset.play); if (ep) play(ep); return; }
      const ep = t.closest('[data-ep]'); if (ep) { const x = epIndex.get(ep.dataset.ep); if (x) { if (!state.cur || state.cur.id !== x.id) play(x); openPlayer(); } return; }
      const pd = t.closest('[data-pod]'); if (pd) { const p = state.byId.get(pd.dataset.pod) || state.subs.find(s => s.id === pd.dataset.pod) || (state.charts[state.cc] || []).find(x => x.id === pd.dataset.pod); if (p) openPodcast(p); return; }
      const pid = t.closest('[data-podid]'); if (pid) { const p = state.byId.get(pid.dataset.podid) || state.subs.find(s => s.id === pid.dataset.podid); if (p) openPodcast(p); else if (state.cur) openPodcast({ id: state.cur.podId, name: state.cur.podcast, author: '', art: state.cur.art, g: 'otros', cc: '', rank: 0, charts: 0 }); return; }
      const mo = t.closest('[data-more]'); if (mo) { const v = mo.dataset.more; if (v.startsWith('cc:')) openCountry(v.slice(3)); else if (v.startsWith('g:')) openGenre(v.slice(2)); else openSheet({ title: 'Lo más escuchado del mundo', sub: 'Podcasts en el top de más países', render: b => { b.innerHTML = worldTop(80).map((p, i) => podRow(p, i + 1)).join(''); } }); return; }
      const cc = t.closest('[data-cc]'); if (cc) { openCountry(cc.dataset.cc); return; }
      const sc = t.closest('[data-setcc]'); if (sc) { setCountry(sc.dataset.setcc); toast(`Tu país: ${regionName(sc.dataset.setcc)}`); rerender(); return; }
      const gn = t.closest('[data-gen]'); if (gn) { openGenre(gn.dataset.gen); return; }
      const ac = t.closest('[data-act]'); if (ac && ac.dataset.act === 'paises') openCountries();
    });
  }

  // ---------- arranque ----------
  async function boot() {
    wire();
    splash(15, 'Cargando la Tierra en Ultra HD…');
    try { state.paises = await local('data/paises.json'); } catch (e) { state.paises = {}; }
    if (!state.cc || !state.paises[state.cc]) {
      const lang = (navigator.languages || [navigator.language || 'es-CO']).map(l => (l.split('-')[1] || '').toLowerCase()).find(c => state.paises[c]);
      state.cc = lang || 'co';
    }
    $('#cc-flag').textContent = flag(state.cc); $('#cc-name').textContent = regionName(state.cc).split(' ')[0];
    try {
      const cat = await local('data/catalogo.json');
      state.pods = cat.rows.map(fromRow);
      state.byId = new Map(state.pods.map(p => [p.id, p]));
    } catch (e) { state.pods = []; }
    $('#count').textContent = `${nf.format(state.pods.length)} · ${Object.keys(state.paises).length} países`;
    renderGenres();
    splash(45, 'Ubicando los podcasts en el mapa…');
    initGlobe();
    // Posiciones guardadas por el reproductor nativo
    if (NATIVE && typeof N.positions === 'function') { try { Object.assign(state.pos, JSON.parse(N.positions() || '{}')); store.set('pos', state.pos); } catch (e) { /* nada */ } }
    for (const e of state.recents) epIndex.set(e.id, e);
    const cur = store.get('cur', null);
    if (cur) { state.cur = cur; state.status = 'paused'; state.time = state.pos[cur.id] > 0 ? state.pos[cur.id] : 0; state.dur = cur.dur || 0; }
    paintPlayer();
    syncLibrary();
    if (NATIVE && typeof N.isPremium === 'function') state.premium = !!N.isPremium();
    countryTop(state.cc).catch(() => {});
    setTimeout(() => splash(100), 9000);
  }
  window.__orbeDebug = { state, play, openPodcast };
  boot();
})();
