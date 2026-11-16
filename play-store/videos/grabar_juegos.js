/*
 * Graba clips en movimiento de Juegos de Colombia (tejo, billar, parqués, dominó y el menú) para el video de 2 minutos.
 * Reloj virtual: cada cuadro avanza el juego exactamente 1/30 s (OJ.avanzar) y también los setTimeout de la interfaz,
 * así el clip sale fluido a 30 fps aunque el navegador sin GPU tarde en dibujar cada imagen.
 *   node play-store/videos/grabar_juegos.js <node_modules con puppeteer-core> [sesión] [dpr]
 * Guarda JPG (360x640 x dpr) en play-store/videos/cache/juegos-clips/<clip>/.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const ONLY = process.argv[3] && process.argv[3] !== 'todas' ? process.argv[3].split(',') : null;
const DPR = +(process.argv[4] || 3);
const WWW = 'file:///' + path.resolve(__dirname, '..', '..', 'OrbeJuegos', 'app', 'src', 'main', 'assets', 'www', 'index.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'cache', 'juegos-clips');
const FPS = 30;

const PREFS = { v: 2, tejo: { modo: 'ia', dif: 1, meta: 27, nombre: 'Carlos', num: 10 },
  billar: { modo: 'bola8', rival: 'local', dif: 1, meta: 10 }, parques: { modo: 'demo', n: 4, dif: 1 }, domino: { modo: 'parejas', dif: 1, meta: 100 } };

// Brazo hacia atrás (~1 s) y lanzamiento del tejo
const lanzarTejo = (lx, ly) => async (p, f) => {
  if (f >= 6 && f < 36) await p.evaluate(k => { const s = OJ.juego.st; s.arr = true; s.aim = 0; s.pot = 0.6 * Math.min(1, k / 26); }, f - 6);
  if (f === 36) await p.evaluate((x, y) => { OJ.juego.st.arr = false; OJ.juego.probar(x, y); }, lx, ly);
};

// Tiro de billar que mete una bola: bola fantasma hacia la tronera más fácil con el camino despejado
const tiroBillar = async p => p.evaluate(() => {
  const g = OJ.juego, b = g.fis.b, c = b[0], HX = 0.71, HZ = 1.42, BR = 0.0305;
  const TRON = [[-HX, -HZ], [HX, -HZ], [-HX - 0.02, 0], [HX + 0.02, 0], [-HX, HZ], [HX, HZ]];
  const libre = (x0, z0, x1, z1, skip) => b.every((o, i) => {
    if (!o.on || skip.includes(i)) return true;
    const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((o.x - x0) * dx + (o.z - z0) * dz) / L2));
    return Math.hypot(x0 + dx * t - o.x, z0 + dz * t - o.z) > 2.15 * BR;
  });
  let best = null;
  for (let i = 1; i < b.length; i++) {
    const o = b[i]; if (!o.on || i === 8) continue;
    TRON.forEach(pk => {
      let dx = pk[0] - o.x, dz = pk[1] - o.z; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
      const gx = o.x - dx * 2 * BR, gz = o.z - dz * 2 * BR; let ax = gx - c.x, az = gz - c.z; const al = Math.hypot(ax, az); ax /= al; az /= al;
      const corte = ax * dx + az * dz; if (corte < 0.75) return;
      if (!libre(c.x, c.z, gx, gz, [0, i]) || !libre(o.x, o.z, pk[0], pk[1], [0, i])) return;
      const score = corte * 2 - (al + dl) * 0.6;
      if (!best || score > best.score) best = { score, ang: Math.atan2(gx - c.x, -(gz - c.z)), pot: Math.min(0.85, 0.42 + (al + dl) * 0.12), i };
    });
  }
  return best;
});

const SESIONES = {
  menu: { q: '', clips: [{ name: 'menu', secs: 4 }] },
  tejo1: { q: 'juego=tejo', clips: [{ name: 'tejo-mecha', secs: 6.5, act: lanzarTejo(0.225, 0) }] },
  tejo2: { q: 'juego=tejo', clips: [{ name: 'tejo-bocin', secs: 6.5, act: lanzarTejo(0, 0) }] },
  tejo3: { q: 'juego=tejo', clips: [{ name: 'tejo-cerca', secs: 6, act: lanzarTejo(0.02, 0.25) }] },
  billar: { q: 'juego=billar', clips: [
    { name: 'billar-saque', secs: 6, pre: p => p.evaluate(() => { OJ.juego.st.vista = 'arriba'; }),
      act: async (p, f) => { if (f === 10) await p.evaluate(() => { const c = OJ.juego.fis.b[0]; OJ.juego.probar(Math.atan2(0.012 - c.x, 0.71 + c.z), 0.96, 0, 0.2); }); } },
    { name: 'billar-tiro', secs: 6.5, quieto: true, reintentos: 3,
      pre: async (p, ctx) => { ctx.tiro = await tiroBillar(p); console.log('  tiro', JSON.stringify(ctx.tiro)); ctx.on0 = await p.evaluate(() => OJ.juego.fis.b.filter(o => o.on).length); await p.evaluate(() => { OJ.juego.st.vista = 'taco'; }); },
      act: async (p, f, ctx) => {
        if (!ctx.tiro) return;
        if (f < 40) await p.evaluate((t, k) => { const s = OJ.juego.st; s.ang = t.ang; s.pot = Math.min(t.pot, t.pot * k / 30); }, ctx.tiro, f);
        if (f === 40) await p.evaluate(t => OJ.juego.probar(t.ang, t.pot, 0, -0.1), ctx.tiro);
      },
      ok: async (p, ctx) => (await p.evaluate(() => OJ.juego.fis.b.filter(o => o.on).length)) < ctx.on0 && (await p.evaluate(() => OJ.juego.fis.b[0].on)) },
  ] },
  // se adelanta la partida (sin grabar) hasta que haya fichas en el tablero, y se graba desde ahí
  parques: { q: 'juego=parques&modo=demo', clips: [{ name: 'parques', secs: 10, pre: p => p.evaluate(() => {
    OJ.juego.avisos = true;
    const fuera = () => OJ.juego.P.reduce((s, j) => s + j.filter(x => x >= 0).length, 0);
    for (let i = 0; i < 60 * 90 && fuera() < 5; i++) { window.__vtStep(1000 / 60); OJ.juego.update(1 / 60); }
    for (let i = 0; i < 60 * 1.5; i++) { window.__vtStep(1000 / 60); OJ.juego.update(1 / 60); }
  }) }] },
  domino: { q: 'juego=domino&demo=1&modo=parejas', clips: [{ name: 'domino', secs: 9, pre: p => p.evaluate(() => { OJ.juego.avisos = true; }) }] },
};

async function sesion(b, key, S) {
  const p = await b.newPage();
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(prefs => {
    localStorage.setItem('juegos.prefs', prefs);
    localStorage.setItem('juegos.parques.ayuda2', '1'); localStorage.setItem('juegos.domino.ayuda2', '1');
    const pn = performance.now.bind(performance), dn = Date.now, rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window);
    let frozen = false, vt = 0, t0 = 0, d0 = 0, id = 1e7; const q = new Map();
    window.__vtFreeze = () => { t0 = pn(); d0 = dn(); vt = 0; frozen = true; };
    window.__vtStep = ms => { vt += ms; for (const [i, o] of [...q]) if (o.due <= vt) { q.delete(i); try { if (typeof o.cb === 'function') o.cb(...o.a); } catch (e) { console.error(e); } } };
    window.setTimeout = (cb, ms, ...a) => { if (!frozen) return rST(cb, ms, ...a); const i = ++id; q.set(i, { due: vt + (+ms || 0), cb, a }); return i; };
    window.clearTimeout = i => { if (q.has(i)) q.delete(i); else rCT(i); };
    performance.now = () => frozen ? t0 + vt : pn();
    Date.now = () => frozen ? d0 + vt : dn();
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.tuto{display:none!important}'; document.head.appendChild(s); });
  }, JSON.stringify(PREFS));
  p.on('pageerror', e => console.log('  [error página]', e.message));
  const cdp = await p.target().createCDPSession();
  await cdp.send('Animation.enable');
  await p.goto(WWW + '?captura=1&dpr=' + DPR + (S.q ? '&' + S.q : ''), { waitUntil: 'load' });
  await p.waitForFunction(() => window.__listo, { timeout: 300000 });
  await new Promise(r => setTimeout(r, 2500));
  await p.evaluate(() => { OJ.mudo = true; document.querySelectorAll('.velo .btn').forEach(x => x.click()); });
  await new Promise(r => setTimeout(r, 800));
  await p.evaluate(() => { document.querySelectorAll('.velo .btn').forEach(x => x.click()); OJ.pausado = true; window.__vtFreeze(); });
  const paso = () => p.evaluate(dt => { window.__vtStep(dt * 1000); OJ.avanzar(dt); }, 1 / FPS);
  const ctx = {};
  // asentar la escena (cámara que llega, fichas que se reparten...)
  for (let i = 0; i < 20; i++) await paso();
  for (const C of S.clips) {
    if (ONLY && !ONLY.includes(key) && !ONLY.includes(C.name)) continue;
    for (let intento = 0; intento <= (C.reintentos || 0); intento++) {
      if (C.quieto) {   // espera a que todo quede quieto y sea turno de apuntar
        for (let i = 0; i < 900; i++) { if (await p.evaluate(() => OJ.juego.st.fase === 'apunta')) break; await paso(); }
        for (let i = 0; i < 10; i++) await paso();
      }
      const dir = path.join(OUT, C.name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      if (C.pre) await C.pre(p, ctx);
      const n = Math.round(C.secs * FPS), tA = Date.now();
      let rate = 0.05;
      await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
      for (let f = 0; f < n; f++) {
        const t1 = Date.now();
        if (C.act) await C.act(p, f, ctx);
        await paso();
        await p.screenshot({ path: path.join(dir, String(f).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
        const real = (Date.now() - t1) / 1000;
        rate = rate * 0.8 + 0.2 * Math.min(1, (1 / FPS) / Math.max(0.02, real));   // las transiciones CSS siguen el reloj virtual
        if (f % 5 === 0) await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
        if (f % 45 === 0) console.log(`  ${C.name}: ${f}/${n} (${((Date.now() - tA) / 1000).toFixed(0)} s)`);
      }
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      const ok = C.ok ? await C.ok(p, ctx) : true;
      console.log(`  -> ${C.name}: ${n} cuadros en ${((Date.now() - tA) / 1000).toFixed(0)} s${C.ok ? (ok ? ' · entró una bola' : ' · no entró, se repite') : ''}`);
      if (ok) break;
    }
  }
  await p.close();
}

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 1800000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--lang=es-CO', '--autoplay-policy=no-user-gesture-required'] });
  for (const [key, S] of Object.entries(SESIONES)) {
    if (ONLY && !ONLY.includes(key) && !S.clips.some(c => ONLY.includes(c.name))) continue;
    console.log('sesión', key);
    await sesion(b, key, S);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
