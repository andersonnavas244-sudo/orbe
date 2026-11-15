/* Orbe Biblia – la Biblia completa (Reina-Valera 1909, dominio público) con el versículo del día sobre un planeta 3D */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const N = window.AndroidBiblia || null;
  const NATIVE = !!(N && typeof N.share === 'function');
  const PLAY = 'https://play.google.com/store/apps/details?id=com.orbebiblia.app';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('biblia.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('biblia.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const DAY = 86400000;

  // ---------- iconos (trazos simples, se ven nítidos a cualquier tamaño) ----------
  const ICO = {
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/><path d="M12 6v8M9 9h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 14h3M8 17.5h6"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
    share: '<circle cx="18" cy="5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="19" r="2.8"/><path d="m8.5 10.7 7-4.1M8.5 13.3l7 4.1"/>',
    audio: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    back: '<path d="m15 5-7 7 7 7"/>', next: '<path d="m9 5 7 7-7 7"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
    font: '<path d="M4 19 9.5 5h1L16 19M6.3 14h7.4M17 19l2.5-6.5L22 19M18 17h3"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>'
  };
  const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICO[n] || ''}</svg>`;
  const paintIcons = (root = document) => root.querySelectorAll('i[data-ico]').forEach(i => { if (!i.firstChild) i.innerHTML = svg(i.dataset.ico); });

  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  window.orbeToast = m => toast(m, 3500);

  // ---------- datos ----------
  const state = { libros: [], byCode: {}, cache: new Map(), diario: [], temas: {}, tab: 'hoy', reader: null, sel: new Set(), speaking: null, premium: false };
  const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const loadBook = code => {
    if (!state.cache.has(code)) state.cache.set(code, getJSON(`data/biblia/${code}.json`));
    return state.cache.get(code);
  };
  const bookName = code => (state.byCode[code] || {}).n || code;
  const refOf = (code, c, vs) => `${bookName(code)} ${c}:${vs.length > 1 ? `${vs[0]}-${vs[vs.length - 1]}` : vs[0]}`;
  const keyOf = (code, c, v) => `${code}.${c}.${v}`;
  function parseRef(ref) {   // "Salmos 23:1" -> {code, c, v}
    const m = ref.match(/^(.+?) (\d+):(\d+)/);
    if (!m) return null;
    const b = state.libros.find(x => fold(x.n) === fold(m[1]));
    return b ? { code: b.c, c: +m[2], v: +m[3] } : null;
  }
  const dayOfYear = d => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / DAY);
  const todayVerse = () => { const v = state.diario[(dayOfYear(new Date()) - 1) % state.diario.length]; return { ref: v[0], text: v[1], tema: v[2] }; };

  // =====================================================================
  //  Planeta 3D al amanecer
  // =====================================================================
  // cuadro.img: imagen de fondo (Jesús sosteniendo el mundo) y dónde va el planeta en ella.
  // Sin imagen, el planeta se muestra grande, al centro, con la luz dorada del amanecer.
  let globe, cuadro = { img: null }, heroBox = null;
  // Coloca el cuadro y el planeta: el cuadro ocupa el ancho de la pantalla (debajo de la cabecera)
  // y el globo 3D queda exactamente sobre la esfera de cristal que Jesús sostiene.
  function layoutHero() {
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0) + 62;
    const maxH = innerHeight - 66 - top - 12;
    let w, h, g;
    const pic = $('#cuadro');
    if (cuadro.img) {
      // que las manos (abajo del cuadro) queden por encima de la barra de pestañas
      w = Math.min(innerWidth, 620); h = w * cuadro.ratio;
      if (h > maxH) { h = maxH; w = h / cuadro.ratio; }
      g = cuadro.globo;
      if (pic.getAttribute('src') !== cuadro.img) pic.src = cuadro.img;
      pic.hidden = false;
    } else {
      w = innerWidth; h = Math.min(maxH, innerWidth * 1.25);
      g = { x: 0.5, y: 0.47, r: Math.min(0.36, (h * 0.34) / w) };
      pic.hidden = true;
    }
    const x = (innerWidth - w) / 2;
    const hero = $('#hero');
    Object.assign(hero.style, { left: x + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
    const r = g.r * w, S = Math.round(r * 2.7);
    const cx = g.x * w, cy = g.y * h;
    Object.assign($('#globe').style, { left: (cx - S / 2) + 'px', top: (cy - S / 2) + 'px', width: S + 'px', height: S + 'px' });
    Object.assign($('#sheen').style, { left: (cx - r) + 'px', top: (cy - r) + 'px', width: 2 * r + 'px', height: 2 * r + 'px' });
    const hr = r * 3.2;
    Object.assign($('#halo').style, { left: (cx - hr) + 'px', top: (cy - hr) + 'px', width: 2 * hr + 'px', height: 2 * hr + 'px' });
    heroBox = { x, top, w, h, r, S, g };
    document.body.classList.toggle('con-cuadro', !!cuadro.img);
    document.documentElement.style.setProperty('--hero-pad', Math.max(200, top + h - 74 - 10) + 'px');
    if (globe) {
      globe.width(S).height(S);
      // altura de cámara para que el radio del planeta en pantalla sea r
      const fov = (globe.camera().fov || 50) * Math.PI / 180;
      const th = Math.atan((r / (S / 2)) * Math.tan(fov / 2));
      const alt = 1 / Math.sin(th) - 1;
      const pov = globe.pointOfView();
      globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: alt });
    }
  }
  function initGlobe() {
    if (typeof Globe !== 'function') return;
    globe = new Globe($('#globe'), { animateIn: false, rendererConfig: { antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' } })
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl('img/earth-blue-marble.jpg').bumpImageUrl('img/earth-topology.png')
      .showAtmosphere(true).atmosphereColor('#9fd2ff').atmosphereAltitude(0.16)
      .onGlobeReady(() => {
        if (window.TierraHD && TierraHD.init(globe)) {
          const big = TierraHD.can8k();
          TierraHD.createEarth({ day: big ? 'img/8k/8k_earth_daymap.jpg' : 'img/earth-blue-marble.jpg', night: 'img/earth-night.jpg',
            normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' }, { nightAmbient: 0.25 }).then(m => globe.globeMaterial(m)).catch(() => {});
          TierraHD.createClouds('img/clouds-4k.jpg', { opacity: 0.75 }).catch(() => {});
        }
        hideSplash();
      });
    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(devicePixelRatio || 1, 2));
    const c = globe.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.9; c.enableZoom = false; c.enablePan = false; c.enableRotate = false;
    // de frente, con la parte iluminada por el Sol hacia nosotros
    const now = new Date();
    const sunLng = -((now.getUTCHours() + now.getUTCMinutes() / 60) - 12) * 15;
    globe.pointOfView({ lat: 12, lng: ((sunLng + 20 + 540) % 360) - 180, altitude: 2 });
    layoutHero();
    addEventListener('resize', layoutHero);
    // el cuadro sube un poco más lento que el texto (efecto de profundidad)
    $('#v-hoy').addEventListener('scroll', e => {
      const st = e.target.scrollTop;
      $('#hero').style.transform = `translateY(${-st * 0.45}px)`;
    }, { passive: true });
  }
  function hideSplash() {
    const sp = $('#splash'); if (!sp || sp.classList.contains('gone')) return;
    sp.classList.add('gone'); setTimeout(() => sp.remove(), 700);
  }
  function pauseGlobe(p) { if (globe) p ? globe.pauseAnimation() : globe.resumeAnimation(); }

  // Polvo de luz dorado (muy liviano)
  function dust() {
    const cv = $('#dust'), ctx = cv.getContext('2d');
    let W, H, parts = [];
    const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; parts = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.8, s: 0.08 + Math.random() * 0.25, a: Math.random() * 6.28 })); };
    size(); addEventListener('resize', size);
    const step = () => {
      if (!document.hidden && !document.body.classList.contains('reading')) {
        ctx.clearRect(0, 0, W, H);
        for (const p of parts) {
          p.y -= p.s; p.a += 0.01; p.x += Math.sin(p.a) * 0.15;
          if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
          ctx.globalAlpha = 0.35 + 0.35 * Math.sin(p.a * 2);
          ctx.fillStyle = '#ffd98e'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // =====================================================================
  //  Hoy
  // =====================================================================
  const TEMA_UI = { animo: ['💪', '#ff9f43'], fe: ['🙏', '#f5c26b'], amor: ['❤️', '#ff4f7a'], paz: ['🕊️', '#6fb8ff'], familia: ['👨‍👩‍👧', '#2fd27a'],
    gratitud: ['🙌', '#ffd166'], sabiduria: ['📜', '#c9a7ff'], esperanza: ['🌅', '#ff7ce5'] };
  function renderHoy() {
    const v = todayVerse();
    const fecha = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#today-date').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    $('#vd-tema').textContent = `Versículo del día · ${v.tema}`;
    $('#vd-text').textContent = v.text;
    $('#vd-ref').textContent = v.ref;
    const r = parseRef(v.ref);
    $('[data-act="vd-fav"]').classList.toggle('on', !!(r && isFav(keyOf(r.code, r.c, r.v))));
    $('#temas').innerHTML = Object.entries(state.temas).map(([k, t]) => {
      const [em, col] = TEMA_UI[k] || ['✨', '#f5c26b'];
      return `<button class="tema" data-tema="${k}"><span class="em" style="background:linear-gradient(135deg,${col},${col}88)">${em}</span>${esc(t.n)}</button>`;
    }).join('');
    renderOraciones();
    renderHoyPlan();
    const last = store.get('ultimo', null);
    $('#continuar').innerHTML = last
      ? `<button class="row" data-open="${last.code}.${last.c}"><span class="badge-ico">📖</span><span><b>${esc(bookName(last.code))} ${last.c}</b><small>Donde quedaste</small></span><i class="go" data-ico="next"></i></button>`
      : `<button class="row" data-open="JOH.1"><span class="badge-ico">📖</span><span><b>Empieza por Juan</b><small>El evangelio de Juan es ideal para comenzar</small></span><i class="go" data-ico="next"></i></button>`;
    paintIcons($('#v-hoy'));
  }
  const ORACIONES = [
    ['🙏', 'Padre Nuestro', 'La oración que Jesús enseñó', 'MAT', 6, 9, 13],
    ['🐑', 'Salmo 23', 'Jehová es mi pastor', 'PSA', 23, 1, 6],
    ['🛡️', 'Salmo 91', 'Protección de Dios', 'PSA', 91, 1, 16],
    ['⛰️', 'Salmo 121', 'Mi socorro viene de Jehová', 'PSA', 121, 1, 8],
    ['✨', 'Bienaventuranzas', 'El Sermón del monte', 'MAT', 5, 3, 12],
    ['❤️', 'El amor', '1 Corintios 13', '1CO', 13, 4, 8],
    ['🕊️', 'Bendición', 'Jehová te bendiga y te guarde', 'NUM', 6, 24, 26],
    ['💧', 'Salmo 51', 'Para pedir perdón', 'PSA', 51, 1, 12]
  ];
  function renderOraciones() {
    $('#oraciones').innerHTML = `<div class="oras">${ORACIONES.map((o, i) => `<button class="ora" data-ora="${i}"><span class="em">${o[0]}</span><b>${esc(o[1])}</b><small>${esc(o[2])}</small></button>`).join('')}</div>`;
  }
  async function openOracion(i) {
    const [em, name, , code, c, v0, v1] = ORACIONES[i];
    const d = await loadBook(code);
    const vs = d[c - 1].slice(v0 - 1, v1);
    const ref = refOf(code, c, v1 > v0 ? [v0, v1] : [v0]);
    state.oracion = { text: vs.join(' '), ref };
    openSheet(`${em} ${name}`, ref, `<div class="prayer">${vs.map((t, j) => `<span class="n">${v0 + j}</span>${esc(t)} `).join('')}</div>
      <div class="prayer-acts"><button class="btn" data-act="ora-listen">${svg('audio')}Escuchar</button><button class="btn gold" data-act="ora-share">${svg('share')}Compartir</button>
      <button class="btn" data-open="${code}.${c}.${v0}">${svg('book')}Leer</button></div>`);
  }
  function openTema(k) {
    const t = state.temas[k]; if (!t) return;
    openSheet(t.n, `${t.v.length} versículos`, t.v.map(([ref, text]) => verseCard(ref, text)).join(''));
  }
  function verseCard(ref, text) {
    const r = parseRef(ref); const fk = r ? keyOf(r.code, r.c, r.v) : '';
    return `<div class="tv"><p>${esc(text)}</p><div class="foot"><cite>${esc(ref)}</cite><div class="mini">
      <button data-share-ref="${esc(ref)}" aria-label="Compartir">${svg('share')}</button>
      <button data-fav-ref="${esc(ref)}" aria-label="Guardar" style="${isFav(fk) ? 'color:#ff6b8a' : ''}">${svg('heart')}</button>
      <button data-open="${r ? `${r.code}.${r.c}.${r.v}` : ''}" aria-label="Leer">${svg('book')}</button></div></div></div>`;
  }

  // =====================================================================
  //  Favoritos y resaltados
  // =====================================================================
  const favs = () => store.get('favs', {});
  const isFav = k => !!favs()[k];
  function toggleFav(k, ref, text) {
    const f = favs();
    if (f[k]) { delete f[k]; toast('Quitado de tus favoritos'); } else { f[k] = { ref, text, t: Date.now() }; toast('❤️ Guardado en tus favoritos'); }
    store.set('favs', f);
    return !!f[k];
  }
  const highlights = () => store.get('hl', {});

  // =====================================================================
  //  Libros y lector
  // =====================================================================
  function renderBooks(t = store.get('testamento', 'AT')) {
    store.set('testamento', t);
    document.querySelectorAll('#testamento button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t)));
    $('#books').innerHTML = state.libros.filter(b => b.t === t).map(b => `<button class="book" data-book="${b.c}"><b>${esc(b.n)}</b><small>${b.caps} cap.</small></button>`).join('');
  }
  function pickChapter(code) {
    const b = state.byCode[code]; const read = store.get('leidos', {});
    openSheet(b.n, `${b.caps} capítulos · elige uno`, `<div class="caps">${Array.from({ length: b.caps }, (_, i) =>
      `<button data-open="${code}.${i + 1}" class="${read[`${code}.${i + 1}`] ? 'done' : ''}">${i + 1}</button>`).join('')}</div>`);
  }
  let chapterTurns = 0;
  async function openReader(code, c, v) {
    closeSheet();
    const b = state.byCode[code]; if (!b) return;
    c = Math.max(1, Math.min(b.caps, c));
    state.reader = { code, c };
    state.sel.clear(); $('#r-sel').hidden = true;
    stopSpeak();
    $('#reader').hidden = false; document.body.classList.add('reading'); pauseGlobe(true);
    $('#r-title').textContent = `${b.n} ${c}`;
    const body = $('#r-body');
    body.innerHTML = '<div class="spinner"></div>';
    const data = await loadBook(code);
    if (!state.reader || state.reader.code !== code || state.reader.c !== c) return;
    const hl = highlights(), f = favs();
    body.innerHTML = `<h2>${esc(b.n)} ${c}</h2><span class="orn">✦ ✦ ✦</span>` + data[c - 1].map((t, i) => {
      const k = keyOf(code, c, i + 1);
      const cls = `v${hl[k] ? ' hl-' + hl[k] : ''}${f[k] ? ' fav' : ''}`;
      // primera letra del capítulo grande y dorada, como en las Biblias impresas
      if (i === 0 && t) return `<p class="${cls}" data-v="1"><span class="cap">${esc(t[0])}</span>${esc(t.slice(1))}</p>`;
      return `<p class="${cls}" data-v="${i + 1}"><sup>${i + 1}</sup>${esc(t)}</p>`;
    }).join('');
    body.scrollTop = 0;
    if (v) { const el = body.querySelector(`[data-v="${v}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } }
    store.set('ultimo', { code, c });
    const read = store.get('leidos', {}); read[`${code}.${c}`] = Date.now(); store.set('leidos', read);
    // una pausa publicitaria cada 6 capítulos (la app limita a 2 cada 40 minutos)
    if (++chapterTurns % 6 === 0 && NATIVE && !state.premium) N.adBreak();
  }
  function closeReader() {
    stopSpeak();
    $('#reader').hidden = true; document.body.classList.remove('reading'); pauseGlobe(false);
    state.reader = null; renderHoy();
  }
  function stepChapter(d) {
    const r = state.reader; if (!r) return;
    const i = state.libros.findIndex(b => b.c === r.code);
    let c = r.c + d, bi = i;
    if (c < 1) { bi = i - 1; if (bi < 0) return; c = state.libros[bi].caps; }
    if (c > state.libros[bi].caps) { bi = i + 1; if (bi >= state.libros.length) return; c = 1; }
    openReader(state.libros[bi].c, c);
  }
  function selectedVerses() {
    const r = state.reader; if (!r) return null;
    const vs = [...state.sel].sort((a, b) => a - b);
    const texts = vs.map(v => verseText(v));
    return { ...r, vs, text: texts.join(' '), ref: refOf(r.code, r.c, vs) };
  }
  // texto de un versículo del lector (sin el número)
  function verseText(v) {
    const el = $(`#r-body [data-v="${v}"]`); if (!el) return '';
    const sup = el.querySelector('sup');
    return sup ? el.textContent.slice(sup.textContent.length) : el.textContent;
  }
  const TEMAS_LECTURA = ['noche', 'sepia', 'claro'];
  function setReaderTheme(t) {
    store.set('tema-lectura', t);
    const r = $('#reader'); TEMAS_LECTURA.forEach(x => r.classList.toggle(x, x === t && t !== 'noche'));
  }
  function updateSel() { $('#r-sel').hidden = !state.sel.size; paintIcons($('#r-sel')); }
  function setFontSize(px) {
    store.set('letra', px);
    document.documentElement.style.setProperty('--fs', px + 'px');
  }

  // =====================================================================
  //  Voz
  // =====================================================================
  function speak(text, label) {
    stopSpeak();
    state.speaking = label || 'texto';
    const rate = store.get('velocidad', 0.95);
    if (NATIVE && N.speak) N.speak(text, rate);
    else if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = rate; u.onend = () => onSpeech('done');
      speechSynthesis.speak(u);
    }
    toast('🔊 Leyendo en voz alta… toca otra vez para detener');
    markSpeaking(true);
  }
  function stopSpeak() {
    if (!state.speaking) return;
    state.speaking = null;
    if (NATIVE && N.stopSpeak) N.stopSpeak(); else if ('speechSynthesis' in window) speechSynthesis.cancel();
    markSpeaking(false);
  }
  function markSpeaking(on) {
    document.querySelectorAll('[data-act="r-listen"] i, [data-act="vd-listen"] i').forEach(i => { i.innerHTML = svg(on ? 'stop' : 'audio'); });
  }
  function onSpeech(ev) { if (ev === 'done' || ev === 'error') { state.speaking = null; markSpeaking(false); if (ev === 'error') toast('No se pudo leer en voz alta: revisa la voz en español del teléfono'); } }
  window.onNativeSpeech = onSpeech;

  // =====================================================================
  //  Compartir el versículo como imagen (para estados de WhatsApp)
  // =====================================================================
  function wrapLines(ctx, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  async function shareImage(text, ref) {
    toast('Preparando la imagen…');
    const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#05060d'; ctx.fillRect(0, 0, W, H);
    // Jesús sosteniendo el planeta (el cuadro arriba y el globo tal como se ve ahora en su mano)
    const ph = 1220, pw = cuadro.img ? ph / cuadro.ratio : W, px = (W - pw) / 2;
    try {
      const gc = globe && globe.renderer().domElement;
      if (cuadro.img) {
        ctx.drawImage(await loadImg(cuadro.img), px, 0, pw, ph);
      } else {
        // luz dorada del amanecer detrás del planeta
        const lg = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 760);
        lg.addColorStop(0, 'rgba(255,205,125,.55)'); lg.addColorStop(0.45, 'rgba(255,170,90,.18)'); lg.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = lg; ctx.fillRect(0, 0, W, ph);
      }
      if (gc && gc.width && heroBox) {
        const g = heroBox.g, size = heroBox.S * pw / heroBox.w;
        const gy = cuadro.img ? g.y * ph : 560;
        ctx.drawImage(gc, px + g.x * pw - size / 2, gy - size / 2, size, size);
      }
      const side = ctx.createLinearGradient(0, 0, W, 0);
      side.addColorStop(0, 'rgba(5,6,13,1)'); side.addColorStop(px / W + 0.06, 'rgba(5,6,13,0)');
      side.addColorStop(1 - px / W - 0.06, 'rgba(5,6,13,0)'); side.addColorStop(1, 'rgba(5,6,13,1)');
      ctx.fillStyle = side; ctx.fillRect(0, 0, W, ph);
    } catch (e) { /* sin cuadro */ }
    let g = ctx.createLinearGradient(0, ph - 420, 0, ph + 40);
    g.addColorStop(0, 'rgba(5,6,13,0)'); g.addColorStop(1, 'rgba(5,6,13,1)');
    ctx.fillStyle = g; ctx.fillRect(0, ph - 420, W, 460);
    g = ctx.createRadialGradient(W / 2, 1450, 10, W / 2, 1450, 700);
    g.addColorStop(0, 'rgba(255,200,110,.16)'); g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 900, W, 1020);
    // texto del versículo (debajo del cuadro)
    let size = 64, lines;
    do { ctx.font = `italic ${size}px 'Noto Serif', Georgia, serif`; lines = wrapLines(ctx, `“${text}”`, W - 150); size -= 3; } while (lines.length * size * 1.42 > 470 && size > 30);
    size += 3;
    const lh = size * 1.42, top = 1180 + Math.max(0, (470 - lines.length * lh) / 2) + size;
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff8ea'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 22;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
    ctx.shadowBlur = 0;
    ctx.font = `600 46px 'Space Grotesk', sans-serif`;
    const gr = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0); gr.addColorStop(0, '#ffe4a3'); gr.addColorStop(1, '#ff9f43');
    ctx.fillStyle = gr; ctx.fillText(ref, W / 2, top + (lines.length - 1) * lh + 80);
    // marca
    try { ctx.drawImage(await loadImg('img/icono.png'), W / 2 - 215, H - 175, 70, 70); } catch (e) { /* sin icono */ }
    ctx.textAlign = 'left'; ctx.font = `700 40px 'Space Grotesk', sans-serif`; ctx.fillStyle = '#ffffff';
    ctx.fillText('Orbe Biblia', W / 2 - 128, H - 140);
    ctx.font = `400 26px 'Inter', sans-serif`; ctx.fillStyle = 'rgba(230,232,245,.8)';
    ctx.fillText('La Biblia completa · Gratis en Google Play', W / 2 - 128, H - 102);
    const b64 = cv.toDataURL('image/png').split(',')[1];
    const msg = `“${text}” ${ref}\n\nVersículo de Orbe Biblia: ${PLAY}`;
    if (NATIVE && N.shareImage) N.shareImage(b64, msg);
    else if (!window.__sinDescarga) { const a = document.createElement('a'); a.href = 'data:image/png;base64,' + b64; a.download = 'versiculo.png'; a.click(); }
    return b64;
  }

  // =====================================================================
  //  Buscar
  // =====================================================================
  let allLoaded = null;
  const loadAll = () => allLoaded || (allLoaded = Promise.all(state.libros.map(b => loadBook(b.c).then(d => [b.c, d]))));
  async function search(q) {
    q = q.trim(); if (q.length < 2) return;
    $('#sq').value = q; $('#s-hint').hidden = true;
    $('#s-res').innerHTML = '<div class="spinner"></div>';
    const all = await loadAll();
    const fq = fold(q), out = [];
    let total = 0;
    for (const [code, chs] of all) chs.forEach((vs, ci) => vs.forEach((t, vi) => {
      if (fold(t).includes(fq)) { total++; if (out.length < 300) out.push([code, ci + 1, vi + 1, t]); }
    }));
    const mark = t => { const f = fold(t), i = f.indexOf(fq); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
    $('#s-res').innerHTML = (total ? `<p class="hint">${total.toLocaleString('es')} versículos${total > 300 ? ' (se muestran los primeros 300)' : ''}</p>` : '<div class="empty">No se encontró. Prueba con otra palabra.</div>')
      + out.map(([code, c, v, t]) => `<button class="res" data-open="${code}.${c}.${v}"><cite>${esc(bookName(code))} ${c}:${v}</cite><p>${mark(t)}</p></button>`).join('');
  }

  // =====================================================================
  //  Planes de lectura
  // =====================================================================
  const PLANES = {
    anio: { n: 'La Biblia en 1 año', d: 'Toda la Biblia, de Génesis a Apocalipsis, en 365 días (unos 3 capítulos al día).', em: '📖', dias: 365 },
    nt90: { n: 'Nuevo Testamento en 90 días', d: 'La vida de Jesús y las cartas de los apóstoles, unos 3 capítulos al día.', em: '✝️', dias: 90 },
    salpro: { n: 'Salmos y Proverbios en 31 días', d: 'Un capítulo de Proverbios y unos 5 Salmos cada día: sabiduría y oración.', em: '🕊️', dias: 31 }
  };
  function planDays(id) {
    const caps = (codes) => state.libros.filter(b => codes(b)).flatMap(b => Array.from({ length: b.caps }, (_, i) => [b.c, i + 1]));
    const split = (list, n) => Array.from({ length: n }, (_, d) => list.slice(Math.floor(d * list.length / n), Math.floor((d + 1) * list.length / n)));
    if (id === 'anio') return split(caps(() => true), 365);
    if (id === 'nt90') return split(caps(b => b.t === 'NT'), 90);
    const ps = split(caps(b => b.c === 'PSA'), 31);
    return ps.map((p, d) => [['PRO', d + 1], ...p]);
  }
  const planState = () => store.get('plan', null);
  function planToday(p) { return Math.min(PLANES[p.id].dias - 1, Math.max(0, Math.floor((Date.now() - p.start) / DAY))); }
  function planDayHtml(p, compact) {
    const days = planDays(p.id), d = planToday(p), done = new Set(p.done || []);
    const read = store.get('leidos', {});
    const pct = Math.round(done.size / PLANES[p.id].dias * 100);
    const chips = days[d].map(([code, c]) => `<button data-open="${code}.${c}" class="${read[`${code}.${c}`] > p.start ? 'done' : ''}">${esc(bookName(code))} ${c}</button>`).join('');
    return `<div class="plan"><span class="em">${PLANES[p.id].em}</span><h4>${esc(PLANES[p.id].n)}</h4><p>Día ${d + 1} de ${PLANES[p.id].dias} · ${done.size} días completados</p>
      <div class="bar"><i style="width:${pct}%"></i></div><div class="today">${chips}</div>
      ${done.has(d) ? '<p style="color:var(--gold)">✅ Lectura de hoy completada. ¡Sigue así!</p>' : '<button class="btn gold block" data-act="plan-done">✅ Marcar la lectura de hoy</button>'}
      ${compact ? '' : '<button class="btn block" data-act="plan-stop" style="margin-top:8px">Cambiar de plan</button>'}</div>`;
  }
  function renderPlanes() {
    const p = planState();
    $('#v-planes').innerHTML = (p ? `<section class="block" style="margin-top:4px"><h3>Tu plan</h3>${planDayHtml(p)}</section>` : '')
      + `<section class="block"><h3>${p ? 'Otros planes' : 'Elige un plan de lectura'}</h3>`
      + Object.entries(PLANES).filter(([id]) => !p || p.id !== id).map(([id, x]) => `<button class="plan" data-plan="${id}"><span class="em">${x.em}</span><h4>${esc(x.n)}</h4><p>${esc(x.d)}</p></button>`).join('')
      + '</section><p class="about">Marca cada día tu lectura: la app lleva la cuenta y te muestra qué te toca hoy.</p>';
  }
  function renderHoyPlan() {
    const p = planState();
    $('#hoy-plan').innerHTML = p ? `<h3>Tu lectura de hoy</h3>${planDayHtml(p, true)}`
      : `<h3>Lee la Biblia completa</h3><button class="row" data-tab-go="planes"><span class="badge-ico">📅</span><span><b>Planes de lectura</b><small>La Biblia en 1 año, el Nuevo Testamento en 90 días…</small></span><i class="go" data-ico="next"></i></button>`;
  }

  // =====================================================================
  //  Más: favoritos y ajustes
  // =====================================================================
  function renderMas() {
    const f = Object.entries(favs()).sort((a, b) => b[1].t - a[1].t);
    const daily = NATIVE && N.getDaily ? JSON.parse(N.getDaily()) : store.get('diario', { on: true, h: 7, m: 0 });
    const fs = store.get('letra', 19), vel = store.get('velocidad', 0.95);
    const pad = n => String(n).padStart(2, '0');
    $('#v-mas').innerHTML = `<section class="block" style="margin-top:4px"><h3>Tus favoritos (${f.length})</h3>
      ${f.length ? f.slice(0, 60).map(([, x]) => verseCard(x.ref, x.text)).join('') : '<div class="empty">Toca ♥ en cualquier versículo para guardarlo aquí.</div>'}</section>
      <section class="block"><h3>Versículo del día</h3>
        <button class="toggle" data-set="diario" role="switch" aria-checked="${daily.on}"><span>Notificación diaria<small>Un versículo cada mañana para empezar el día</small></span><span class="switch"></span></button>
        <label class="field"><span>Hora</span><input type="time" id="diario-hora" value="${pad(daily.h)}:${pad(daily.m)}"></label>
        <button class="btn block" data-act="test-diario" style="margin-top:10px">🔔 Probar la notificación</button></section>
      <section class="block"><h3>Lectura</h3>
        <div class="field"><span>Tamaño de letra</span><div class="sizes">${[16, 19, 22, 26].map((s, i) => `<button data-fs="${s}" aria-pressed="${fs === s}" style="font-size:${13 + i * 3}px">A</button>`).join('')}</div></div>
        <div class="field"><span>Velocidad de la voz</span><div class="sizes">${[[0.8, 'Lenta'], [0.95, 'Normal'], [1.15, 'Rápida']].map(([v, l]) => `<button data-vel="${v}" aria-pressed="${vel === v}" style="width:auto;padding:0 10px;font-family:inherit">${l}</button>`).join('')}</div></div></section>
      ${NATIVE ? `<div class="premium">${state.premium ? '<h4>✨ Premium activo</h4><p>Gracias por apoyar Orbe Biblia: no verás anuncios.</p><button class="btn block" data-act="premium-manage">Administrar suscripción</button>'
        : '<h4>✨ Orbe Biblia Premium</h4><p>Lee y medita sin anuncios.</p><button class="btn gold block" data-act="premium">Quitar anuncios</button>'}</div>` : ''}
      <button class="btn block" data-act="share-app" style="margin-top:12px">📲 Compartir Orbe Biblia</button>
      <p class="about">Texto bíblico: Santa Biblia Reina-Valera 1909 (dominio público), con la ortografía original. Imágenes del planeta: NASA. Orbe Biblia funciona sin internet; los anuncios necesitan conexión.</p>`;
  }

  // =====================================================================
  //  Pestañas, hoja y eventos
  // =====================================================================
  function selectTab(tab) {
    state.tab = tab;
    document.querySelectorAll('#tabbar button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + tab));
    if (tab === 'hoy') renderHoy();
    if (tab === 'biblia') renderBooks();
    if (tab === 'planes') renderPlanes();
    if (tab === 'mas') renderMas();
    if (tab === 'buscar') setTimeout(() => $('#sq').focus(), 300);
    paintIcons();
  }
  function openSheet(title, sub, html) {
    $('#sheet-title').textContent = title; $('#sheet-sub').textContent = sub || '';
    $('#sheet-body').innerHTML = html; $('#sheet-body').scrollTop = 0;
    $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false');
  }
  function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true'); }
  const sheetOpen = () => $('#sheet').classList.contains('open');

  function openRef(s) { const [code, c, v] = s.split('.'); if (code) openReader(code, +c || 1, +v || 0); }
  function shareRef(ref) { const r = parseRef(ref); if (!r) return; loadBook(r.code).then(d => shareImage(d[r.c - 1][r.v - 1], ref)); }

  function bind() {
    document.addEventListener('click', e => {
      const t = e.target;
      const tb = t.closest('#tabbar [data-tab]'); if (tb) { closeSheet(); selectTab(tb.dataset.tab); return; }
      const go = t.closest('[data-tab-go]'); if (go) { selectTab(go.dataset.tabGo); return; }
      const op = t.closest('[data-open]'); if (op && op.dataset.open) { openRef(op.dataset.open); return; }
      const bk = t.closest('[data-book]'); if (bk) { pickChapter(bk.dataset.book); return; }
      const tm = t.closest('[data-tema]'); if (tm) { openTema(tm.dataset.tema); return; }
      const or = t.closest('[data-ora]'); if (or) { openOracion(+or.dataset.ora); return; }
      const ts = t.closest('#testamento [data-t]'); if (ts) { renderBooks(ts.dataset.t); return; }
      const ch = t.closest('[data-q]'); if (ch) { search(ch.dataset.q); return; }
      const sr = t.closest('[data-share-ref]'); if (sr) { shareRef(sr.dataset.shareRef); return; }
      const fr = t.closest('[data-fav-ref]'); if (fr) {
        const r = parseRef(fr.dataset.favRef); if (!r) return;
        const txt = fr.closest('.tv').querySelector('p').textContent;
        fr.style.color = toggleFav(keyOf(r.code, r.c, r.v), fr.dataset.favRef, txt) ? '#ff6b8a' : '';
        if (state.tab === 'mas') renderMas();
        return;
      }
      const pl = t.closest('[data-plan]'); if (pl) { store.set('plan', { id: pl.dataset.plan, start: new Date().setHours(0, 0, 0, 0), done: [] }); toast(`📅 Empezaste: ${PLANES[pl.dataset.plan].n}`); renderPlanes(); return; }
      const fsb = t.closest('[data-fs]'); if (fsb) { setFontSize(+fsb.dataset.fs); renderMas(); return; }
      const vb = t.closest('[data-vel]'); if (vb) { store.set('velocidad', +vb.dataset.vel); renderMas(); return; }
      const st = t.closest('[data-set="diario"]'); if (st) {
        const on = st.getAttribute('aria-checked') !== 'true'; st.setAttribute('aria-checked', String(on));
        saveDaily(on); return;
      }
      // versículos en el lector: tocar para seleccionar
      const vv = t.closest('#r-body .v'); if (vv) {
        const n = +vv.dataset.v; state.sel.has(n) ? state.sel.delete(n) : state.sel.add(n);
        vv.classList.toggle('sel', state.sel.has(n)); updateSel(); return;
      }
      const hl = t.closest('[data-hl]'); if (hl) {
        const s = selectedVerses(); if (!s) return; const h = highlights();
        s.vs.forEach(v => { const k = keyOf(s.code, s.c, v); if (hl.dataset.hl) h[k] = hl.dataset.hl; else delete h[k];
          const el = $(`#r-body [data-v="${v}"]`); el.className = 'v' + (h[k] ? ' hl-' + h[k] : '') + (isFav(k) ? ' fav' : ''); });
        store.set('hl', h); state.sel.clear(); updateSel(); return;
      }
      const a = t.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act, v = todayVerse();
      if (act === 'vd-share') shareImage(v.text, v.ref);
      else if (act === 'vd-listen') state.speaking ? stopSpeak() : speak(`${v.text}. ${v.ref}.`, 'hoy');
      else if (act === 'vd-fav') { const r = parseRef(v.ref); if (r) a.classList.toggle('on', toggleFav(keyOf(r.code, r.c, r.v), v.ref, v.text)); }
      else if (act === 'vd-read') { const r = parseRef(v.ref); if (r) openReader(r.code, r.c, r.v); }
      else if (act === 'r-close') closeReader();
      else if (act === 'r-pick') { if (state.reader) pickChapter(state.reader.code); }
      else if (act === 'r-prev') stepChapter(-1);
      else if (act === 'r-next') stepChapter(1);
      else if (act === 'r-theme') {
        const cur = store.get('tema-lectura', 'noche'); const nx = TEMAS_LECTURA[(TEMAS_LECTURA.indexOf(cur) + 1) % 3];
        setReaderTheme(nx); toast({ noche: '🌙 Lectura de noche', sepia: '📜 Lectura en sepia', claro: '☀️ Lectura clara' }[nx]);
      }
      else if (act === 'r-font') { const sizes = [16, 19, 22, 26]; const cur = store.get('letra', 19); setFontSize(sizes[(sizes.indexOf(cur) + 1) % sizes.length]); }
      else if (act === 'r-listen') {
        if (state.speaking) { stopSpeak(); return; }
        const r = state.reader; if (!r) return;
        loadBook(r.code).then(d => speak(`${bookName(r.code)}, capítulo ${r.c}. ` + d[r.c - 1].join(' '), 'capitulo'));
      }
      else if (act === 's-fav') {
        const s = selectedVerses(); if (!s) return;
        s.vs.forEach(n => { const k = keyOf(s.code, s.c, n); const txt = verseText(n);
          const on = toggleFav(k, refOf(s.code, s.c, [n]), txt); $(`#r-body [data-v="${n}"]`).classList.toggle('fav', on); });
        state.sel.clear(); document.querySelectorAll('#r-body .sel').forEach(x => x.classList.remove('sel')); updateSel();
      }
      else if (act === 's-share') { const s = selectedVerses(); if (s) shareImage(s.text, s.ref); }
      else if (act === 's-copy') {
        const s = selectedVerses(); if (!s) return;
        const txt = `“${s.text}” ${s.ref} (RV1909)`;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 Copiado')).catch(() => { if (NATIVE) N.share(txt); });
      }
      else if (act === 's-listen') { const s = selectedVerses(); if (s) speak(`${s.text}. ${s.ref}.`, 'sel'); }
      else if (act === 'sheet-close') closeSheet();
      else if (act === 'ora-listen' && state.oracion) state.speaking ? stopSpeak() : speak(`${state.oracion.text}. ${state.oracion.ref}.`, 'oracion');
      else if (act === 'ora-share' && state.oracion) shareImage(state.oracion.text, state.oracion.ref);
      else if (act === 'plan-done') {
        const p = planState(); const d = planToday(p); p.done = [...new Set([...(p.done || []), d])]; store.set('plan', p);
        toast('🙌 ¡Lectura de hoy completada!'); renderPlanes(); renderHoyPlan(); paintIcons();
        if (NATIVE && !state.premium) setTimeout(() => N.adBreak(), 1200);
      }
      else if (act === 'plan-stop') { store.set('plan', null); renderPlanes(); }
      else if (act === 'test-diario') { if (NATIVE) N.testDaily(); else toast('En el teléfono llega la notificación del versículo'); }
      else if (act === 'premium') N.buyPremium();
      else if (act === 'premium-manage') N.manageSubscription();
      else if (act === 'share-app') {
        const txt = `📖 Te recomiendo Orbe Biblia: la Biblia completa sin internet, con un versículo para cada día. Gratis: ${PLAY}`;
        NATIVE ? N.share(txt) : window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      }
    });
    document.addEventListener('change', e => { if (e.target.id === 'diario-hora') saveDaily(true); });
    $('#sf').addEventListener('submit', e => { e.preventDefault(); $('#sq').blur(); search($('#sq').value); });
    $('#btn-search-top').onclick = () => selectTab('buscar');
    $('#btn-music').onclick = () => toggleMusic();
    // deslizar la hoja hacia abajo para cerrarla
    let y0 = null;
    $('#sheet').addEventListener('touchstart', e => { if ($('#sheet-body').scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    $('#sheet').addEventListener('touchmove', e => { if (y0 !== null && e.touches[0].clientY - y0 > 90) { y0 = null; closeSheet(); } }, { passive: true });
    // deslizar en el lector para cambiar de capítulo
    let sx = null, sy = null;
    $('#r-body').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    $('#r-body').addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2) stepChapter(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  function toggleMusic(force) {
    const a = $('#musica'), on = force != null ? force : a.paused;
    if (on) { a.volume = 0.55; a.play().then(() => toast('🎵 Música para orar y leer')).catch(() => toast('No se pudo reproducir la música')); }
    else a.pause();
    $('#btn-music').classList.toggle('on', on);
    store.set('musica', on);
  }
  function saveDaily(on) {
    const [h, m] = ($('#diario-hora') ? $('#diario-hora').value : '07:00').split(':').map(Number);
    const tg = $('[data-set="diario"]'); if (tg) on = tg.getAttribute('aria-checked') === 'true';
    store.set('diario', { on, h, m });
    if (NATIVE && N.setDaily) N.setDaily(on, h || 0, m || 0);
    toast(on ? `🔔 Te enviaremos el versículo a las ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : 'Notificación diaria apagada');
  }

  window.orbeBack = () => {
    if (state.sel.size) { state.sel.clear(); document.querySelectorAll('#r-body .sel').forEach(x => x.classList.remove('sel')); updateSel(); return true; }
    if (sheetOpen()) { closeSheet(); return true; }
    if (!$('#reader').hidden) { closeReader(); return true; }
    if (state.tab !== 'hoy') { selectTab('hoy'); return true; }
    return false;
  };
  window.orbeOpen = what => { if (what === 'hoy') { if (!$('#reader').hidden) closeReader(); closeSheet(); selectTab('hoy'); } };
  window.onNativePremium = (p) => { state.premium = !!p; if (state.tab === 'mas') renderMas(); };
  // Para el video y las capturas de la tienda
  window.__orbeDebug = { state, openReader, selectTab, openTema, openOracion, search, shareImage, layoutHero, get globe() { return globe; } };

  async function start() {
    setFontSize(store.get('letra', 19));
    paintIcons();
    const [libros, diario, temas, cd] = await Promise.all([getJSON('data/biblia/libros.json'), getJSON('data/diario.json'), getJSON('data/temas.json'),
      getJSON('data/cuadro.json').catch(() => null)]);
    if (cd) cuadro = cd;
    setReaderTheme(store.get('tema-lectura', 'noche'));
    state.libros = libros; libros.forEach(b => { state.byCode[b.c] = b; });
    state.diario = diario; state.temas = temas;
    if (NATIVE && N.isPremium) state.premium = N.isPremium();
    bind();
    renderHoy();
    dust();
    try { initGlobe(); } catch (e) { hideSplash(); }
    setTimeout(hideSplash, 6000);   // si el 3D tarda, la app igual se puede usar
  }
  start().catch(e => { hideSplash(); toast('Error al iniciar: ' + e.message, 6000); });
})();
