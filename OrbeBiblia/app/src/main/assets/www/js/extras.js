/* Orbe Biblia – funciones para cada día: ¿cómo te sientes?, buenos días con Dios, tarjetas, oración de la mañana y
   de la noche, trivia, lugares de la Biblia en 3D, racha de días y diario de oración. Usa window.__B (biblia.js). */
(() => {
  'use strict';
  let B, D = {};
  const DAY = 86400000;
  const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / DAY);
  const isMorning = () => { const h = new Date().getHours(); return h >= 4 && h < 18; };
  // fecha de hoy (para probar fechas especiales: index.html?fecha=2026-12-24)
  const hoyDate = () => { const m = location.search.match(/[?&]fecha=(\d{4})-(\d\d)-(\d\d)/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date(); };
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  // =====================================================================
  //  Racha de días
  // =====================================================================
  const BADGES = [[3, '🌱', 'Semilla'], [7, '🔥', 'Una semana'], [15, '⭐', 'Constante'], [30, '🏅', 'Un mes'], [60, '💎', 'Fiel'], [100, '👑', 'Cien días'], [365, '🌍', 'Un año']];
  function visit() {
    const days = B.store.get('visitas', []), k = todayKey();
    if (days[days.length - 1] !== k) { days.push(k); B.store.set('visitas', days.slice(-500)); }
    const st = streak();
    if (st > B.store.get('mejor-racha', 0)) B.store.set('mejor-racha', st);
    const won = BADGES.filter(b => st >= b[0]).pop();
    const shown = B.store.get('insignia', 0);
    if (won && won[0] > shown) { B.store.set('insignia', won[0]); setTimeout(() => B.toast(`${won[1]} ¡Nueva insignia: ${won[2]}! ${st} días seguidos`, 4500), 2500); }
  }
  function streak() {
    const set = new Set(B.store.get('visitas', []));
    let n = 0; const d = new Date();
    while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function openRacha() {
    const st = streak(), best = B.store.get('mejor-racha', st);
    B.openSheet(`🔥 ${st} ${st === 1 ? 'día' : 'días'} seguidos`, `Tu mejor racha: ${best} días`, `
      <p class="x-intro">Abre Orbe Biblia cada día para mantener tu racha y ganar insignias.</p>
      <div class="badges">${BADGES.map(([n, e, t]) => `<div class="badge ${st >= n ? 'on' : ''}"><span>${e}</span><b>${t}</b><small>${n} días</small></div>`).join('')}</div>
      <button class="btn gold block" data-x="racha-compartir">📤 Compartir mi racha</button>`);
  }

  // =====================================================================
  //  Fondos para las imágenes (dibujados en la app, sin descargar nada)
  // =====================================================================
  const FONDOS = ['amanecer', 'jesus', 'tierra', 'noche', 'mar', 'paz', 'cumple', 'navidad'];
  function mountains(ctx, W, H, base, color, amp, seed) {
    const r = rng(seed); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    let y = base;
    for (let x = 0; x <= W; x += 20) { y += (r() - 0.5) * amp; y = Math.max(base - amp * 2, Math.min(base + amp, y)); ctx.lineTo(x, y); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function stars(ctx, W, H, n, seed, maxY = H) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) { const a = 0.3 + r() * 0.7; ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(r() * W, r() * maxY, 0.6 + r() * 1.8, 0, 6.283); ctx.fill(); }
  }
  function rays(ctx, x, y, n, len, color) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = 0.04;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, a - w, a + w); ctx.closePath();
      const g = ctx.createRadialGradient(x, y, 0, x, y, len); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
  }
  async function drawBg(ctx, W, H, kind) {
    let g;
    if (kind === 'jesus' && B.cuadro && B.cuadro.img) {
      const im = await B.loadImg(B.cuadro.img); const h = W * B.cuadro.ratio;
      ctx.drawImage(im, 0, (H - h) / 2 - 60, W, h);
      const gc = B.globe && B.globe.renderer().domElement, hb = B.heroBox;
      if (gc && hb) { const gg = B.cuadro.globo, size = hb.S * W / hb.w; ctx.drawImage(gc, gg.x * W - size / 2, (H - h) / 2 - 60 + gg.y * h - size / 2, size, size); }
      return;
    }
    if (kind === 'tierra') {
      ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, W, H); stars(ctx, W, H, 260, 7);
      const gc = B.globe && B.globe.renderer().domElement;
      g = ctx.createRadialGradient(W / 2, H * 0.36, 40, W / 2, H * 0.36, W * 0.8); g.addColorStop(0, 'rgba(255,200,120,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (gc && gc.width) { const s = W * 1.05; ctx.drawImage(gc, (W - s) / 2, H * 0.36 - s / 2, s, s); }
      return;
    }
    const sky = {
      amanecer: [[0, '#1b2350'], [0.45, '#d9705a'], [0.62, '#ffb26b'], [0.75, '#ffd79a']],
      noche: [[0, '#02040d'], [0.6, '#0b1640'], [1, '#1d2a5c']],
      mar: [[0, '#2a1e4f'], [0.4, '#e2725b'], [0.55, '#ffbe7a'], [0.56, '#3a5f8a'], [1, '#0f2340']],
      paz: [[0, '#cfd9ee'], [0.5, '#a9b8d8'], [1, '#6f7fa6']],
      cumple: [[0, '#3a1460'], [0.5, '#b8327a'], [1, '#ff9a5a']],
      navidad: [[0, '#020617'], [0.7, '#0c1b3a'], [1, '#143058']]
    }[kind] || [[0, '#1b2350'], [1, '#ffb26b']];
    g = ctx.createLinearGradient(0, 0, 0, H); sky.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (kind === 'amanecer') {
      const sx = W / 2, sy = H * 0.62;
      rays(ctx, sx, sy, 28, H * 0.9, 'rgba(255,220,150,.20)');
      g = ctx.createRadialGradient(sx, sy, 10, sx, sy, W * 0.7); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.12, 'rgba(255,214,140,.9)'); g.addColorStop(1, 'rgba(255,180,100,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      mountains(ctx, W, H, H * 0.66, 'rgba(92,52,70,.85)', 70, 3); mountains(ctx, W, H, H * 0.72, 'rgba(52,30,50,.95)', 55, 8); mountains(ctx, W, H, H * 0.80, '#1c1226', 40, 11);
    } else if (kind === 'noche' || kind === 'navidad') {
      stars(ctx, W, H, 420, 5, H * 0.75);
      if (kind === 'noche') {
        ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(W * 0.74, H * 0.18, 70, 0, 6.283); ctx.fill();
        ctx.fillStyle = sky[0][1]; ctx.beginPath(); ctx.arc(W * 0.74 + 34, H * 0.18 - 18, 64, 0, 6.283); ctx.fill();
        g = ctx.createRadialGradient(W * 0.74, H * 0.18, 60, W * 0.74, H * 0.18, 300); g.addColorStop(0, 'rgba(255,240,200,.25)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      } else {
        const sx = W / 2, sy = H * 0.2;
        rays(ctx, sx, sy, 16, H * 0.7, 'rgba(255,240,190,.22)');
        g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 160); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.2, 'rgba(255,230,160,.8)'); g.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const r = rng(9); ctx.fillStyle = 'rgba(255,255,255,.8)';
        for (let i = 0; i < 160; i++) { ctx.beginPath(); ctx.arc(r() * W, r() * H, 1 + r() * 3, 0, 6.283); ctx.fill(); }
      }
      mountains(ctx, W, H, H * 0.82, '#070b1c', 45, 4);
    } else if (kind === 'mar') {
      const sx = W / 2, sy = H * 0.55;
      g = ctx.createRadialGradient(sx, sy, 10, sx, sy, W * 0.6); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.15, 'rgba(255,200,130,.8)'); g.addColorStop(1, 'rgba(255,160,100,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.56);
      const r = rng(2);
      for (let i = 0; i < 90; i++) { const y = sy + 10 + r() * (H - sy); const w = 30 + r() * 240 * (1 - (y - sy) / H); ctx.fillStyle = `rgba(255,210,150,${0.08 + r() * 0.25})`; ctx.fillRect(sx - w / 2 + (r() - 0.5) * 120, y, w, 3); }
    } else if (kind === 'paz') {
      const r = rng(4);
      for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H * 0.9, rr = 80 + r() * 220; g = ctx.createRadialGradient(x, y, 10, x, y, rr); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      rays(ctx, W * 0.5, -60, 18, H * 1.1, 'rgba(255,250,230,.22)');
    } else if (kind === 'cumple') {
      const r = rng(6);
      for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H, rr = 8 + r() * 46; ctx.fillStyle = `hsla(${Math.floor(r() * 360)},90%,75%,${0.12 + r() * 0.3})`; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill(); }
      for (let i = 0; i < 90; i++) { ctx.save(); ctx.translate(r() * W, r() * H); ctx.rotate(r() * 6); ctx.fillStyle = `hsl(${Math.floor(r() * 360)},90%,65%)`; ctx.fillRect(-6, -3, 12, 6); ctx.restore(); }
    }
  }

  // Imagen 1080x1920 para estados: fondo + saludo + versículo + marca
  async function makeCard({ bg, title, para, text, ref }) {
    const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    await drawBg(ctx, W, H, bg);
    const light = bg === 'paz';
    // sombra para que el texto se lea sobre cualquier fondo
    const g = ctx.createLinearGradient(0, H * 0.42, 0, H);
    g.addColorStop(0, 'rgba(4,6,14,0)'); g.addColorStop(0.35, light ? 'rgba(30,40,70,.45)' : 'rgba(4,6,14,.6)'); g.addColorStop(1, light ? 'rgba(30,40,70,.75)' : 'rgba(4,6,14,.9)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.42, W, H * 0.58);
    ctx.textAlign = 'center';
    let y = H * 0.56;
    if (para) { ctx.font = `500 44px 'Inter', sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(`Para: ${para}`, W / 2, y - 120); }
    if (title) {
      let ts = 104; ctx.font = `700 ${ts}px 'Space Grotesk', sans-serif`;
      while (ctx.measureText(title).width > W - 120 && ts > 56) { ts -= 4; ctx.font = `700 ${ts}px 'Space Grotesk', sans-serif`; }
      const gr = ctx.createLinearGradient(W / 2 - 400, 0, W / 2 + 400, 0); gr.addColorStop(0, '#ffe7ad'); gr.addColorStop(1, '#ffb15c');
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 24; ctx.fillStyle = gr; ctx.fillText(title, W / 2, y); ctx.shadowBlur = 0;
      y += 70;
    }
    let size = 60, lines;
    do { ctx.font = `italic ${size}px 'Noto Serif', Georgia, serif`; lines = B.wrapLines(ctx, `“${text}”`, W - 150); size -= 3; } while (lines.length * size * 1.42 > 560 && size > 30);
    size += 3;
    const lh = size * 1.42;
    ctx.fillStyle = '#fff8ea'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 20;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + size + i * lh));
    ctx.shadowBlur = 0;
    ctx.font = `600 44px 'Space Grotesk', sans-serif`; ctx.fillStyle = '#ffd38a';
    ctx.fillText(ref, W / 2, y + size + (lines.length - 1) * lh + 76);
    try { ctx.drawImage(await B.loadImg('img/icono.png'), W / 2 - 205, H - 165, 64, 64); } catch (e) { /* sin icono */ }
    ctx.textAlign = 'left'; ctx.font = `700 38px 'Space Grotesk', sans-serif`; ctx.fillStyle = '#fff';
    ctx.fillText('Orbe Biblia', W / 2 - 125, H - 132);
    ctx.font = `400 25px 'Inter', sans-serif`; ctx.fillStyle = 'rgba(235,238,250,.85)';
    ctx.fillText('Un versículo para cada día · Google Play', W / 2 - 125, H - 96);
    return cv;
  }
  function shareCanvas(cv, text) {
    const b64 = cv.toDataURL('image/png').split(',')[1];
    if (B.NATIVE && B.N.shareImage) B.N.shareImage(b64, `${text}\n\nOrbe Biblia: ${B.PLAY}`);
    else if (!window.__sinDescarga) { const a = document.createElement('a'); a.href = 'data:image/png;base64,' + b64; a.download = 'orbe-biblia.png'; a.click(); }
    return b64;
  }
  // vista previa: la imagen reducida dentro de un <img>
  async function preview(el, opts) { const cv = await makeCard(opts); el.src = cv.toDataURL('image/jpeg', 0.82); return cv; }

  // =====================================================================
  //  Hoy: ¿cómo te sientes?, buenos días, oración del día, trivia, lugares, tarjetas
  // =====================================================================
  function hoy() {
    renderFiesta(); renderDevocional(); renderMemo(); renderPlanTemaHoy();
    const st = streak();
    const chip = B.$('#racha'); if (chip) { chip.textContent = `🔥 ${st}`; chip.hidden = false; }
    const m = isMorning();
    B.$('#x-sentir').innerHTML = `<div class="feels">${D.sentimientos.map(s => `<button class="feel" data-feel="${s.k}"><span>${s.e}</span>${B.esc(s.n)}</button>`).join('')}</div>`;
    const sal = m ? D.saludos.manana : D.saludos.noche, vs = m ? D.saludos.versos_manana : D.saludos.versos_noche;
    const k = B.store.get('saludo-' + todayKey(), dayNum());
    B.$('#x-buenos').innerHTML = `<div class="gm"><img id="gm-img" alt=""><div class="gm-side"><b>${m ? '☀️ Buenos días con Dios' : '🌙 Buenas noches con Dios'}</b>
      <small>Una imagen lista para enviar por WhatsApp a quien quieras</small>
      <button class="btn gold block" data-x="gm-share">📤 Enviar</button><button class="btn block" data-x="gm-otra">🔄 Otra</button></div></div>`;
    state.gm = { bg: m ? (k % 2 ? 'amanecer' : 'jesus') : (k % 2 ? 'noche' : 'tierra'), title: sal[k % sal.length], text: vs[k % vs.length][1], ref: vs[k % vs.length][0] };
    preview(B.$('#gm-img'), state.gm).catch(() => {});
    const od = D.oraciones[m ? 'manana' : 'noche'], o = od[dayNum() % od.length];
    B.$('#x-oracion').innerHTML = `<div class="card od"><span class="od-ico">${m ? '🌅' : '🌙'}</span><b>${B.esc(o[0])}</b><p>${B.esc(o[1])}</p>
      <div class="od-acts"><button class="btn" data-x="od-listen">🔊 Escuchar</button><button class="btn" data-x="od-share">📤 Compartir</button><button class="btn" data-x="od-aviso">🔔 Aviso</button></div></div>`;
    const tr = B.store.get('trivia-' + todayKey(), null);
    B.$('#x-trivia').innerHTML = `<button class="row" data-x="trivia"><span class="badge-ico">🧠</span><span><b>Trivia bíblica de hoy</b><small>${tr ? `Hoy sacaste ${tr.ok} de 5 · ¡reta a tu familia!` : '5 preguntas nuevas cada día'}</small></span><i class="go" data-ico="next"></i></button>`;
    B.$('#x-lugares').innerHTML = `<button class="lugares-card" data-x="mapa"><span class="lc-glow"></span><b>🌍 Lugares de la Biblia en 3D</b><small>Belén, Jerusalén, el Mar Rojo y los viajes de Pablo sobre el planeta</small><span class="btn gold">Explorar</span></button>`;
    B.$('#x-tarjetas').innerHTML = `<div class="tarjetas">${D.tarjetas.map(t => `<button class="tj" data-tj="${t.k}"><span>${t.e}</span>${B.esc(t.n)}</button>`).join('')}</div>`;
    B.paintIcons(B.$('#v-hoy'));
  }
  const state = {};

  function openFeel(k) {
    const s = D.sentimientos.find(x => x.k === k); if (!s) return;
    B.openSheet(`${s.e} Me siento ${s.n.toLowerCase()}`, 'Palabras de Dios para este momento', `<p class="x-intro">${{
      triste: 'Dios está cerca de los que tienen el corazón quebrantado.', ansioso: 'Entrégale tus preocupaciones: él tiene cuidado de ti.',
      solo: 'Nunca estás solo: Dios promete no dejarte ni desampararte.', agradecido: 'Qué bueno es dar gracias a Dios.',
      miedo: 'No temas: Dios va contigo dondequiera que vayas.', enfermo: 'Dios es tu sanador; ora y confía en él.',
      cansado: 'Ven a Jesús y él te hará descansar.', enojado: 'Respira, ora y deja que Dios calme tu corazón.',
      confundido: 'Pide sabiduría a Dios; él te mostrará el camino.', feliz: '¡Alégrate en el Señor siempre!' }[k] || ''}</p>`
      + s.v.map(([ref, text]) => B.verseCard(ref, text)).join(''));
  }
  function openOracionDia(kind) {
    const k = kind || (isMorning() ? 'manana' : 'noche');
    const od = D.oraciones[k], o = od[dayNum() % od.length];
    state.od = { k, o };
    B.openSheet(`${k === 'manana' ? '🌅' : '🌙'} ${o[0]}`, k === 'manana' ? 'Oración de la mañana' : 'Oración de la noche',
      `<div class="prayer">${B.esc(o[1])}</div><div class="prayer-acts"><button class="btn" data-x="od-listen">🔊 Escuchar</button><button class="btn gold" data-x="od-share">📤 Compartir</button><button class="btn" data-x="od-aviso">🔔 Aviso</button></div>`);
  }
  function openTarjeta(k, vi = 0, bi = null, para = null) {
    const t = D.tarjetas.find(x => x.k === k); if (!t) return;
    const prev = state.tj && state.tj.k === k ? state.tj : null;
    para = para != null ? para : (prev ? prev.para : '');
    const bg = bi != null ? FONDOS[bi % FONDOS.length] : t.bg;
    state.tj = { k, vi: vi % t.v.length, bg, para };
    const v = t.v[state.tj.vi];
    B.openSheet(`${t.e} ${t.n}`, 'Elige el versículo y el fondo, y compártela', `
      <img class="tj-prev" id="tj-img" alt="">
      <label class="field"><span>Para (opcional)</span><input id="tj-para" maxlength="30" placeholder="Nombre de la persona" value="${B.esc(para)}"></label>
      <div class="prayer-acts"><button class="btn" data-x="tj-verso">📖 Otro versículo</button><button class="btn" data-x="tj-fondo">🎨 Otro fondo</button><button class="btn gold" data-x="tj-share">📤 Enviar</button></div>`);
    preview(B.$('#tj-img'), { bg, title: t.t, para, text: v[1], ref: v[0] }).catch(() => {});
  }

  // =====================================================================
  //  Fechas especiales: Navidad, Año Nuevo y Semana Santa
  // =====================================================================
  function pascua(Y) {   // domingo de Pascua (algoritmo anónimo gregoriano)
    const a = Y % 19, b = Math.floor(Y / 100), c = Y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Y, month - 1, day, 12);
  }
  function fiesta() {
    const d = hoyDate(), M = d.getMonth() + 1, D = d.getDate();
    if ((M === 12 && D === 31) || (M === 1 && D <= 6)) return { k: 'anonuevo', i: M === 12 ? 0 : D };
    if (M === 12) return { k: 'navidad', i: D };
    const p = pascua(d.getFullYear()), diff = Math.round((d - p) / DAY);
    if (diff >= -7 && diff <= 1) return { k: 'semanasanta', i: diff + 7 };
    return null;
  }
  function renderFiesta() {
    const f = fiesta(), box = B.$('#x-fecha');
    document.body.classList.remove('fiesta-navidad', 'fiesta-anonuevo', 'fiesta-semanasanta');
    window.__dustColor = null; window.__dustSize = 1;
    if (!f) { box.innerHTML = ''; return; }
    const x = D.fechas[f.k];
    document.body.classList.add('fiesta-' + f.k);
    if (f.k === 'navidad') { window.__dustColor = '#ffffff'; window.__dustSize = 1.6; }
    if (f.k === 'anonuevo') { window.__dustColor = '#ffe08a'; window.__dustSize = 1.4; }
    if (f.k === 'semanasanta') window.__dustColor = '#e7c8ff';
    let sub, lect;
    if (x.dias) { const dd = x.dias[Math.min(f.i, x.dias.length - 1)]; sub = `${dd[0]}: ${dd[1]}`; lect = dd.slice(1); }
    else { lect = x.lecturas[f.i % x.lecturas.length]; sub = `Lectura de hoy: ${lect[0]}`; }
    state.fiesta = { f, x, lect };
    box.innerHTML = `<div class="fiesta ${f.k}"><span class="fe">${x.e}</span><b>${B.esc(x.t)}</b><small>${B.esc(sub)}</small>
      <div class="fiesta-acts"><button class="btn" data-open="${lect[1]}.${lect[2]}.${lect[3]}">📖 Leer</button><button class="btn" data-x="fiesta-oracion">🙏 Oración</button><button class="btn" data-x="fiesta-tarjeta">🎁 Tarjeta</button></div></div>`;
  }

  // =====================================================================
  //  Devocional diario: el versículo del día + reflexión + oración
  // =====================================================================
  function devocional() {
    const v = B.todayVerse(), n = B.dayOfYear(hoyDate());
    const refl = D.devocional.reflexiones[v.tema] || D.devocional.reflexiones['Fe'];
    const ora = D.devocional.oraciones[v.tema] || D.devocional.oraciones['Fe'];
    return { v, r: refl[n % refl.length], o: ora[n % ora.length] };
  }
  function renderDevocional() {
    const d = devocional();
    B.$('#x-devocional').innerHTML = `<button class="dev" data-x="devocional"><span class="k">📖 Devocional de hoy · ${B.esc(d.v.tema)}</span>
      <b>${B.esc(d.v.ref)}</b><p>${B.esc(d.r.slice(0, 120))}…</p><span class="btn gold">Leer el devocional</span></button>`;
  }
  function openDevocional() {
    const d = devocional();
    state.dev = d;
    B.openSheet('📖 Devocional de hoy', new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }), `
      <div class="dev-v">“${B.esc(d.v.text)}”</div><div class="dev-ref">${B.esc(d.v.ref)}</div>
      <div class="dev-h">Reflexión</div><p class="dev-t">${B.esc(d.r)}</p>
      <div class="dev-h">Oración</div><p class="dev-t" style="font-style:italic">${B.esc(d.o)}</p>
      <div class="prayer-acts"><button class="btn" data-x="dev-listen">🔊 Escuchar</button><button class="btn gold" data-x="dev-share">📤 Compartir</button><button class="btn" data-x="dev-leido">✅ Leído</button></div>`);
  }

  // =====================================================================
  //  Versículo para memorizar (uno por semana) y juego de completar palabras
  // =====================================================================
  const semana = () => Math.floor((hoyDate() - new Date(2024, 0, 1)) / (7 * DAY));
  const memoVerse = () => D.memorizar[semana() % D.memorizar.length];
  function renderMemo() {
    const [ref, text] = memoVerse(), done = B.store.get('memo-' + semana(), {});
    B.$('#x-memorizar').innerHTML = `<button class="memo" data-x="memo"><span class="k">📝 Versículo de la semana</span><p>“${B.esc(text)}”</p>
      <cite>${B.esc(ref)}</cite> <small style="color:var(--muted)">${done.dificil ? '· ✅ ¡Lo memorizaste!' : done.medio ? '· nivel medio ✓' : done.facil ? '· nivel fácil ✓' : '· toca para practicar'}</small></button>`;
  }
  const NIVELES = { facil: ['Fácil', 0.3], medio: ['Medio', 0.6], dificil: ['Difícil', 1] };
  function openMemo(nivel = 'facil') {
    const [ref, text] = memoVerse(), done = B.store.get('memo-' + semana(), {});
    const words = text.split(' ');
    const cand = words.map((w, i) => [w.replace(/[.,;:¿?¡!«»“”()]/g, ''), i]).filter(([w]) => w.length >= 4);
    const r = rng(semana() * 31 + nivel.length);
    const pick = cand.filter(() => r() < NIVELES[nivel][1]);
    if (!pick.length && cand.length) pick.push(cand[0]);
    const holes = pick.map(([w, i]) => ({ w, i })).sort((a, b) => a.i - b.i);
    const bank = holes.map(h => h.w).map(w => [w, r()]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    state.memo = { nivel, holes, next: 0, ref, words, bank, errs: 0 };
    B.openSheet(`📝 ${ref}`, 'Toca las palabras en orden para completar el versículo', `
      <div class="levels">${Object.entries(NIVELES).map(([k, [n]]) => `<button data-memo-nivel="${k}" aria-pressed="${k === nivel}" class="${done[k] ? 'done' : ''}">${n}</button>`).join('')}</div>
      <div class="mg-text" id="mg-text"></div><div class="mg-bank" id="mg-bank">${bank.map((w, j) => `<button data-mg="${j}">${B.esc(w)}</button>`).join('')}</div>`);
    drawMemo();
  }
  function drawMemo() {
    const m = state.memo, holeAt = new Map(m.holes.map((h, k) => [h.i, k]));
    B.$('#mg-text').innerHTML = m.words.map((w, i) => {
      if (!holeAt.has(i)) return B.esc(w);
      const k = holeAt.get(i), h = m.holes[k];
      const tail = w.slice(w.indexOf(h.w) + h.w.length), head = w.slice(0, w.indexOf(h.w));
      return k < m.next ? `${B.esc(head)}<span class="got">${B.esc(h.w)}</span>${B.esc(tail)}` : `${B.esc(head)}<span class="hole${k === m.next ? ' next' : ''}">${B.esc(h.w)}</span>${B.esc(tail)}`;
    }).join(' ');
  }
  function memoPick(j, btn) {
    const m = state.memo; if (!m || m.next >= m.holes.length) return;
    if (m.bank[j] === m.holes[m.next].w) {
      btn.classList.add('used'); m.next++; drawMemo();
      if (m.next >= m.holes.length) {
        const done = B.store.get('memo-' + semana(), {}); done[m.nivel] = true; B.store.set('memo-' + semana(), done);
        B.toast(m.errs ? '🎉 ¡Completado! Intenta sin errores' : '🏆 ¡Perfecto, sin errores!', 3500);
        renderMemo();
        const sig = m.nivel === 'facil' ? 'medio' : m.nivel === 'medio' ? 'dificil' : null;
        if (sig) setTimeout(() => openMemo(sig), 1600);
      }
    } else { m.errs++; btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 600); if (navigator.vibrate) navigator.vibrate(60); }
  }

  // =====================================================================
  //  Planes por tema (en la pestaña Planes)
  // =====================================================================
  function planesTema() {
    const p = B.store.get('plan-tema', null);
    let html = '';
    if (p) {
      const x = D.planesTema.find(z => z.k === p.id);
      if (x) {
        const n = x.dias.length, d = Math.min(n - 1, Math.max(0, Math.floor((Date.now() - p.start) / DAY))), done = new Set(p.done || []);
        const r = x.dias[d];
        html += `<section class="block"><h3>Tu plan por tema</h3><div class="plan"><span class="em">${x.e}</span><h4>${B.esc(x.n)}</h4><p>Día ${d + 1} de ${n} · ${done.size} días completados</p>
          <div class="bar"><i style="width:${Math.round(done.size / n * 100)}%"></i></div>
          <div class="today"><button data-open="${r[1]}.${r[2]}.${r[3]}">📖 ${B.esc(r[0])}</button></div>
          ${done.has(d) ? '<p style="color:var(--gold)">✅ Lectura de hoy completada.</p>' : `<button class="btn gold block" data-x="pt-done">✅ Marcar la lectura de hoy</button>`}
          <button class="btn block" data-x="pt-stop" style="margin-top:8px">Dejar este plan</button></div></section>`;
      }
    }
    html += `<section class="block"><h3>Planes por tema</h3>${D.planesTema.filter(x => !p || x.k !== p.id).map(x =>
      `<button class="plan" data-pt="${x.k}"><span class="em">${x.e}</span><h4>${B.esc(x.n)}</h4><p>${B.esc(x.d)} · ${x.dias.length} días</p></button>`).join('')}</section>`;
    return html;
  }
  function renderPlanTemaHoy() {
    const p = B.store.get('plan-tema', null), box = B.$('#x-plan-tema');
    const x = p && D.planesTema.find(z => z.k === p.id);
    if (!x) { box.innerHTML = ''; return; }
    const d = Math.min(x.dias.length - 1, Math.max(0, Math.floor((Date.now() - p.start) / DAY))), r = x.dias[d];
    box.innerHTML = `<h3>${x.e} ${B.esc(x.n)}</h3><button class="row" data-open="${r[1]}.${r[2]}.${r[3]}"><span class="badge-ico">${x.e}</span><span><b>Día ${d + 1}: ${B.esc(r[0])}</b><small>${(p.done || []).includes(d) ? '✅ Completado' : 'Tu lectura de hoy'}</small></span><i class="go" data-ico="next"></i></button>`;
  }

  // =====================================================================
  //  Trivia
  // =====================================================================
  function todaysQuestions() {
    const n = D.trivia.length, order = Array.from({ length: n }, (_, i) => i), r = rng(1234);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const start = (dayNum() * 5) % n;
    return Array.from({ length: 5 }, (_, i) => {
      const q = D.trivia[order[(start + i) % n]], rr = rng(dayNum() * 7 + i);
      const opts = q.o.map((t, j) => ({ t, ok: j === 0 }));
      for (let a = 3; a > 0; a--) { const b = Math.floor(rr() * (a + 1)); [opts[a], opts[b]] = [opts[b], opts[a]]; }
      return { q: q.q, opts, r: q.r };
    });
  }
  function openTrivia() {
    const done = B.store.get('trivia-' + todayKey(), null);
    if (done) { triviaEnd(done); return; }
    state.tv = { qs: todaysQuestions(), i: 0, res: [] };
    triviaQ();
  }
  function triviaQ() {
    const t = state.tv, q = t.qs[t.i];
    B.openSheet(`🧠 Pregunta ${t.i + 1} de 5`, 'Trivia bíblica de hoy', `<div class="tv-q">${B.esc(q.q)}</div>
      <div class="tv-opts">${q.opts.map((o, j) => `<button class="tv-o" data-tv="${j}">${B.esc(o.t)}</button>`).join('')}</div><div id="tv-fb"></div>`);
  }
  function triviaAnswer(j) {
    const t = state.tv; if (!t || t.answered) return;
    const q = t.qs[t.i], ok = q.opts[j].ok; t.answered = true; t.res.push(ok);
    document.querySelectorAll('.tv-o').forEach((b, k) => { b.classList.add(q.opts[k].ok ? 'ok' : (k === j ? 'bad' : 'off')); b.disabled = true; });
    B.$('#tv-fb').innerHTML = `<p class="tv-fb ${ok ? 'ok' : 'bad'}">${ok ? '✅ ¡Correcto!' : '❌ Casi…'}${q.r ? ` <span>${B.esc(q.r)}</span>` : ''}</p>
      <button class="btn gold block" data-x="tv-next">${t.i < 4 ? 'Siguiente' : 'Ver resultado'}</button>`;
  }
  function triviaNext() {
    const t = state.tv; t.answered = false;
    if (t.i < 4) { t.i++; triviaQ(); return; }
    const done = { ok: t.res.filter(Boolean).length, res: t.res };
    B.store.set('trivia-' + todayKey(), done);
    triviaEnd(done); hoy();
  }
  function triviaEnd(done) {
    const msg = done.ok === 5 ? '¡Perfecto! 🏆' : done.ok >= 3 ? '¡Muy bien! 👏' : '¡Sigue aprendiendo! 📖';
    B.openSheet(`🧠 ${done.ok} de 5`, msg, `<div class="tv-score">${done.res.map(x => x ? '🟩' : '🟥').join('')}</div>
      <p class="x-intro">Vuelve mañana para 5 preguntas nuevas.</p><button class="btn gold block" data-x="tv-retar">📤 Retar a mi familia</button>`);
  }

  // =====================================================================
  //  Lugares de la Biblia en el globo 3D
  // =====================================================================
  let mapa = null;
  const MENORES = new Set(['capernaum', 'cana', 'jordan', 'jerico', 'olivos', 'samaria', 'carmelo', 'hebron', 'nebo', 'belen', 'nazaret', 'galilea']);
  function openMapa() {
    B.$('#mapa').hidden = false; document.body.classList.add('reading');
    if (B.globe) B.globe.pauseAnimation();
    if (mapa) { mapa.resumeAnimation(); return; }
    const el = B.$('#mapa-globe');
    mapa = new Globe(el, { animateIn: true, rendererConfig: { antialias: true, powerPreference: 'high-performance' } })
      .globeImageUrl('img/earth-blue-marble.jpg').bumpImageUrl('img/earth-topology.png').backgroundImageUrl('img/stars-4k.jpg')
      .showAtmosphere(true).atmosphereColor('#ffd38a').atmosphereAltitude(0.18)
      .width(innerWidth).height(innerHeight)
      .htmlElementsData(D.lugares.lugares).htmlLat('lat').htmlLng('lng').htmlAltitude(0.004)
      .htmlElement(p => { const d = document.createElement('div'); d.className = 'pin' + (MENORES.has(p.k) ? ' minor' : ''); d.innerHTML = `<i></i><span>${B.esc(p.n)}</span>`; d.onclick = () => openLugar(p.k); return d; })
      .arcsData(routeArcs()).arcStartLat('a').arcStartLng('b').arcEndLat('c').arcEndLng('d').arcColor('col')
      .arcAltitude(0.06).arcStroke(0.7).arcDashLength(0.5).arcDashGap(0.25).arcDashAnimateTime(2600);
    mapa.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    mapa.controls().autoRotate = false;
    // los lugares pequeños (muy juntos alrededor de Jerusalén) muestran su nombre al acercarse
    mapa.controls().addEventListener('change', () => { B.$('#mapa').classList.toggle('zoom', mapa.pointOfView().altitude < 0.62); });
    mapa.pointOfView({ lat: 25, lng: 10, altitude: 3.2 });
    setTimeout(() => mapa.pointOfView({ lat: 33, lng: 33, altitude: 1.15 }, 2600), 600);
    addEventListener('resize', () => mapa && mapa.width(innerWidth).height(innerHeight));
    B.$('#mapa-rutas').innerHTML = `<button class="chip on" data-ruta="todas">Todo</button>` + D.lugares.rutas.map(r => `<button class="chip" data-ruta="${r.k}" style="--c:${r.c}"><i style="background:${r.c}"></i>${B.esc(r.n)}</button>`).join('');
  }
  function routeArcs(only) {
    const out = [];
    D.lugares.rutas.filter(r => !only || only === 'todas' || r.k === only).forEach(r => {
      for (let i = 0; i < r.p.length - 1; i++) out.push({ a: r.p[i][0], b: r.p[i][1], c: r.p[i + 1][0], d: r.p[i + 1][1], col: [r.c, r.c] });
    });
    return out;
  }
  function filterRuta(k) {
    document.querySelectorAll('#mapa-rutas .chip').forEach(c => c.classList.toggle('on', c.dataset.ruta === k));
    mapa.arcsData(routeArcs(k));
    const r = D.lugares.rutas.find(x => x.k === k);
    if (r) { const mid = r.p[Math.floor(r.p.length / 2)]; mapa.pointOfView({ lat: mid[0], lng: mid[1], altitude: k.startsWith('pablo') ? 0.95 : 0.8 }, 1600); }
    else mapa.pointOfView({ lat: 33, lng: 33, altitude: 1.15 }, 1600);
  }
  function openLugar(k) {
    const p = D.lugares.lugares.find(x => x.k === k); if (!p) return;
    if (mapa) mapa.pointOfView({ lat: p.lat - 1.5, lng: p.lng, altitude: 0.45 }, 1400);
    B.openSheet(`📍 ${p.n}`, 'Lugar de la Biblia', `<p class="x-intro">${B.esc(p.d)}</p>` + p.v.map(([ref, text]) => B.verseCard(ref, text)).join(''));
  }
  function closeMapa() {
    B.$('#mapa').hidden = true; document.body.classList.remove('reading');
    if (mapa) mapa.pauseAnimation();
    if (B.globe) B.globe.resumeAnimation();
  }

  // =====================================================================
  //  Más: diario de oración y avisos de oración
  // =====================================================================
  const diario = () => B.store.get('diario-oracion', []);
  function mas() {
    const list = diario(), pend = list.filter(x => !x.r), resp = list.filter(x => x.r);
    const pr = k => (B.NATIVE && B.N.getPrayer ? JSON.parse(B.N.getPrayer(k)) : B.store.get('ora-' + k, { on: false, h: k === 'manana' ? 6 : 21, m: k === 'manana' ? 30 : 0 }));
    const pad = n => String(n).padStart(2, '0');
    const avisos = ['manana', 'noche'].map(k => { const p = pr(k); return `
      <button class="toggle" data-x="aviso-${k}" role="switch" aria-checked="${p.on}"><span>${k === 'manana' ? '🌅 Oración de la mañana' : '🌙 Oración de la noche'}<small>Un aviso con una oración corta</small></span><span class="switch"></span></button>
      <label class="field"><span>Hora</span><input type="time" data-ora-hora="${k}" value="${pad(p.h)}:${pad(p.m)}"></label>`; }).join('');
    return `<section class="block" style="margin-top:4px"><h3>🙏 Mi diario de oración</h3>
      <div class="card"><textarea id="dx-text" rows="2" maxlength="300" placeholder="Escribe tu petición de oración…"></textarea><button class="btn gold block" data-x="dx-add">Agregar petición</button></div>
      ${pend.length ? pend.map(x => `<div class="dx"><p>${B.esc(x.t)}</p><small>${new Date(x.d).toLocaleDateString('es')}</small>
        <div class="dx-acts"><button class="btn" data-dx-ok="${x.id}">🙌 Dios respondió</button><button class="icon-x" data-dx-del="${x.id}" aria-label="Borrar">✕</button></div></div>`).join('')
        : '<div class="empty" style="padding:14px">Tus peticiones aparecerán aquí. Ora por ellas cada día.</div>'}
      ${resp.length ? `<details class="dx-resp"><summary>🙌 ${resp.length} ${resp.length === 1 ? 'oración respondida' : 'oraciones respondidas'}</summary>
        ${resp.map(x => `<div class="dx done"><p>${B.esc(x.t)}</p><small>Respondida el ${new Date(x.r).toLocaleDateString('es')}</small><button class="icon-x" data-dx-del="${x.id}" aria-label="Borrar">✕</button></div>`).join('')}</details>` : ''}
    </section>
    <section class="block"><h3>Avisos para orar</h3>${avisos}</section>
    ${notasHtml()}`;
  }
  function notasHtml() {
    const n = Object.entries(B.store.get('notas', {})).sort((a, b) => b[1].d - a[1].d);
    if (!n.length) return '';
    return `<section class="block"><h3>✎ Mis notas (${n.length})</h3>${n.slice(0, 50).map(([k, x]) => {
      const [code, c, v] = k.split('.');
      return `<button class="res" data-open="${code}.${c}.${v}"><cite>${B.esc(x.ref)}</cite><p style="font-family:Inter,sans-serif;font-size:14.5px">${B.esc(x.t)}</p></button>`; }).join('')}</section>`;
  }
  function savePrayer(k, on) {
    const inp = document.querySelector(`[data-ora-hora="${k}"]`);
    const [h, m] = (inp ? inp.value : (k === 'manana' ? '06:30' : '21:00')).split(':').map(Number);
    B.store.set('ora-' + k, { on, h, m });
    if (B.NATIVE && B.N.setPrayer) B.N.setPrayer(k, on, h || 0, m || 0);
    B.toast(on ? `🔔 Te recordaremos orar a las ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : 'Aviso apagado');
  }

  // =====================================================================
  //  Eventos
  // =====================================================================
  function act(name) {   // botones con data-act que vienen de biblia.js (no usados aquí)
    return false;
  }
  function onClick(e) {
    const t = e.target;
    const fe = t.closest('[data-feel]'); if (fe) { openFeel(fe.dataset.feel); return; }
    const tj = t.closest('[data-tj]'); if (tj) { state.tj = null; openTarjeta(tj.dataset.tj); return; }
    const tv = t.closest('[data-tv]'); if (tv) { triviaAnswer(+tv.dataset.tv); return; }
    const mn = t.closest('[data-memo-nivel]'); if (mn) { openMemo(mn.dataset.memoNivel); return; }
    const mg = t.closest('[data-mg]'); if (mg) { memoPick(+mg.dataset.mg, mg); return; }
    const pt = t.closest('[data-pt]'); if (pt) { B.store.set('plan-tema', { id: pt.dataset.pt, start: new Date().setHours(0, 0, 0, 0), done: [] }); B.toast('📅 Plan iniciado'); B.renderPlanes(); return; }
    const ru = t.closest('[data-ruta]'); if (ru) { filterRuta(ru.dataset.ruta); return; }
    const ok = t.closest('[data-dx-ok]'); if (ok) { const l = diario(); const x = l.find(i => i.id === +ok.dataset.dxOk); if (x) { x.r = Date.now(); B.store.set('diario-oracion', l); B.toast('🙌 ¡Gloria a Dios!'); B.selectTab('mas'); } return; }
    const del = t.closest('[data-dx-del]'); if (del) { B.store.set('diario-oracion', diario().filter(i => i.id !== +del.dataset.dxDel)); B.selectTab('mas'); return; }
    const x = t.closest('[data-x]'); if (!x) return;
    const a = x.dataset.x;
    if (a === 'racha') openRacha();
    else if (a === 'devocional') openDevocional();
    else if (a === 'dev-listen' && state.dev) B.speak(`${state.dev.v.text}. ${state.dev.v.ref}. ${state.dev.r} ${state.dev.o}`, 'devocional');
    else if (a === 'dev-share' && state.dev) { const d = state.dev; const txt = `📖 Devocional de hoy\n\n“${d.v.text}” ${d.v.ref}\n\n${d.r}\n\n🙏 ${d.o}\n\nOrbe Biblia: ${B.PLAY}`; B.NATIVE ? B.N.share(txt) : window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }
    else if (a === 'dev-leido') { B.store.set('dev-' + todayKey(), 1); B.closeSheet(); B.toast('🙌 ¡Devocional de hoy completado!'); }
    else if (a === 'memo') openMemo(B.store.get('memo-' + semana(), {}).facil ? (B.store.get('memo-' + semana(), {}).medio ? 'dificil' : 'medio') : 'facil');
    else if (a === 'fiesta-oracion' && state.fiesta) B.openSheet(`${state.fiesta.x.e} ${state.fiesta.x.t}`, 'Oración', `<div class="prayer">${B.esc(state.fiesta.x.oracion)}</div><div class="prayer-acts"><button class="btn" data-x="fiesta-escuchar">🔊 Escuchar</button></div>`);
    else if (a === 'fiesta-escuchar' && state.fiesta) B.speak(state.fiesta.x.oracion, 'oracion');
    else if (a === 'fiesta-tarjeta' && state.fiesta) { state.tj = null; openTarjeta(state.fiesta.x.tarjeta); }
    else if (a === 'pt-done') { const p = B.store.get('plan-tema', null); if (p) { const d = Math.max(0, Math.floor((Date.now() - p.start) / DAY)); p.done = [...new Set([...(p.done || []), d])]; B.store.set('plan-tema', p); B.toast('🙌 ¡Lectura completada!'); B.renderPlanes(); } }
    else if (a === 'pt-stop') { B.store.set('plan-tema', null); B.renderPlanes(); }
    else if (a === 'racha-compartir') { const st = streak(); B.N && B.NATIVE ? B.N.share(`🔥 Llevo ${st} días seguidos leyendo la Biblia con Orbe Biblia. ¿Te unes? ${B.PLAY}`) : B.toast(`🔥 ${st} días`); }
    else if (a === 'gm-share' && state.gm) makeCard(state.gm).then(cv => shareCanvas(cv, `${state.gm.title} “${state.gm.text}” ${state.gm.ref}`));
    else if (a === 'gm-otra') { B.store.set('saludo-' + todayKey(), B.store.get('saludo-' + todayKey(), dayNum()) + 1); hoy(); }
    else if (a === 'od-listen') { const o = (state.od && state.od.o) || D.oraciones[isMorning() ? 'manana' : 'noche'][dayNum() % D.oraciones[isMorning() ? 'manana' : 'noche'].length]; B.speak(o[1], 'oracion'); }
    else if (a === 'od-share') { const o = (state.od && state.od.o) || D.oraciones[isMorning() ? 'manana' : 'noche'][dayNum() % D.oraciones[isMorning() ? 'manana' : 'noche'].length]; if (B.NATIVE) B.N.share(`🙏 ${o[0]}\n\n${o[1]}\n\nOrbe Biblia: ${B.PLAY}`); }
    else if (a === 'od-aviso') { B.closeSheet(); B.selectTab('mas'); setTimeout(() => { const s = document.querySelector('[data-x="aviso-manana"]'); if (s) s.scrollIntoView({ block: 'center' }); }, 300); }
    else if (a === 'trivia') openTrivia();
    else if (a === 'tv-next') triviaNext();
    else if (a === 'tv-retar') { const d = B.store.get('trivia-' + todayKey(), { ok: 0, res: [] }); const txt = `🧠 Trivia bíblica de hoy: ${d.ok}/5 ${d.res.map(r => r ? '🟩' : '🟥').join('')}\n¿Puedes superarme? Juega gratis en Orbe Biblia: ${B.PLAY}`; B.NATIVE ? B.N.share(txt) : window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }
    else if (a === 'mapa') openMapa();
    else if (a === 'mapa-cerrar') closeMapa();
    else if (a === 'tj-verso' && state.tj) openTarjeta(state.tj.k, state.tj.vi + 1, FONDOS.indexOf(state.tj.bg), B.$('#tj-para').value.trim());
    else if (a === 'tj-fondo' && state.tj) openTarjeta(state.tj.k, state.tj.vi, FONDOS.indexOf(state.tj.bg) + 1, B.$('#tj-para').value.trim());
    else if (a === 'tj-share' && state.tj) {
      const t = D.tarjetas.find(z => z.k === state.tj.k), v = t.v[state.tj.vi], para = B.$('#tj-para').value.trim();
      makeCard({ bg: state.tj.bg, title: t.t, para, text: v[1], ref: v[0] }).then(cv => shareCanvas(cv, `${t.t} “${v[1]}” ${v[0]}`));
    }
    else if (a === 'dx-add') {
      const txt = B.$('#dx-text').value.trim(); if (!txt) return;
      const l = diario(); l.unshift({ id: Date.now(), t: txt, d: Date.now(), r: 0 }); B.store.set('diario-oracion', l);
      B.toast('🙏 Petición guardada'); B.selectTab('mas');
    }
    else if (a.startsWith('aviso-')) { const on = x.getAttribute('aria-checked') !== 'true'; x.setAttribute('aria-checked', String(on)); savePrayer(a.slice(6), on); }
  }
  function onChange(e) {
    const k = e.target.dataset && e.target.dataset.oraHora;
    if (k) { const tg = document.querySelector(`[data-x="aviso-${k}"]`); if (tg) { tg.setAttribute('aria-checked', 'true'); savePrayer(k, true); } }
  }
  function back() {
    if (!B.$('#mapa').hidden) { if (B.sheetOpen()) { B.closeSheet(); return true; } closeMapa(); return true; }
    return false;
  }

  async function init(api) {
    B = api;
    const [sentimientos, oraciones, saludos, tarjetas, trivia, lugares, devocional, planesTema, memorizar, fechas] = await Promise.all(
      ['sentimientos', 'oraciones-dia', 'saludos', 'tarjetas', 'trivia', 'lugares', 'devocional', 'planes-tema', 'memorizar', 'fechas'].map(n => B.getJSON(`data/${n}.json`)));
    D = { sentimientos, oraciones, saludos, tarjetas, trivia, lugares, devocional, planesTema, memorizar, fechas };
    visit();
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    B.$('#racha').onclick = openRacha;
  }

  window.OrbeExtras = { init, hoy, mas, act, back, openOracionDia, openMapa, openTrivia, openTarjeta, openFeel, makeCard, streak, planesTema,
    openDevocional, openMemo, fiesta };
})();
