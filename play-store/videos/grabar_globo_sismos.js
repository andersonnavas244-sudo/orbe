/*
 * Graba el globo 3D REAL de Orbe Sismos girando, cuadro por cuadro (30 fps), para el video publicitario.
 * Usa un reloj virtual: cada cuadro avanza exactamente 1/30 s, así las ondas de los sismos laten suaves
 * aunque el navegador sin GPU tarde en dibujar cada imagen.
 *   node play-store/videos/grabar_globo_sismos.js <node_modules con puppeteer-core> [toma]
 * Guarda JPG 720x1280 (se amplían en el video) en play-store/videos/cache/sismos/clips/<toma>/.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const ONLY = process.argv[3];
const URL = 'http://localhost:5170/OrbeSismos/app/src/main/assets/www/index.html?calidad=fija&captura=1';
const OUT = path.join(__dirname, 'cache', 'sismos', 'clips');
const FPS = 15;   // se graba a 15 cuadros por segundo y el video intercala cuadros a 30
const wait = ms => new Promise(r => setTimeout(r, ms));
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

// Tomas de cámara: duración (s), si se ve la interfaz y la trayectoria (t de 0 a 1)
const TOMAS = {
  // Desde el espacio profundo hasta Colombia, girando el planeta
  llegada: { secs: 9, ui: false, pov: t => { const e = ease(t); return { lat: lerp(18, 4.7, e), lng: lerp(40, -74, e), altitude: lerp(6.5, 1.35, e) }; } },
  // Vuelo por el Cinturón de Fuego del Pacífico: Japón → Alaska → América
  cinturon: { secs: 10, ui: false, pov: t => ({ lat: 22 + 18 * Math.sin(t * Math.PI), lng: lerp(150, 285, t) > 180 ? lerp(150, 285, t) - 360 : lerp(150, 285, t), altitude: 1.75 + 0.25 * Math.cos(t * Math.PI * 2) }) },
  // La app tal cual (con su interfaz), girando despacio sobre América
  app: { secs: 8, ui: true, pov: t => ({ lat: lerp(12, 0, t), lng: lerp(-118, -62, t), altitude: 2.05 }) },
  // Órbita lenta y lejana para el cierre
  cierre: { secs: 13, ui: false, pov: t => ({ lat: 6, lng: lerp(-40, -110, t), altitude: lerp(2.9, 2.4, t) }) }
};

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 1800000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--lang=es-CO'] });
  const p = await b.newPage();
  await p.emulateTimezone('America/Bogota');
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('sismos.me', JSON.stringify({ name: 'Bogotá', cc: 'CO', lat: 4.711, lon: -74.072 }));
    // Reloj virtual (se congela cuando empieza la grabación)
    const pn = performance.now.bind(performance), dn = Date.now;
    let frozen = false, vt = 0, t0 = 0, d0 = 0;
    window.__vtFreeze = () => { t0 = pn(); d0 = dn(); vt = 0; frozen = true; };
    window.__vtStep = ms => { vt += ms; };
    performance.now = () => frozen ? t0 + vt : pn();
    Date.now = () => frozen ? d0 + vt : dn();
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(() => cb(performance.now()));
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash') && window.__orbeGlobe, { timeout: 300000 });
  // Sismos de los últimos 30 días: el planeta lleno de luces
  await p.evaluate(() => document.querySelector('[data-range="month"]').click());
  await p.evaluate(() => { const v = document.querySelector('[data-layer="volcanes"]'); if (v && v.getAttribute('aria-selected') !== 'false') v.click(); });
  await wait(9000);
  await p.evaluate(() => { const c = window.__orbeGlobe.controls(); c.autoRotate = false; c.enableDamping = false; });
  await p.evaluate(() => window.__vtFreeze());
  for (const [name, tm] of Object.entries(TOMAS)) {
    if (ONLY && ONLY !== name) continue;
    const dir = path.join(OUT, name);
    fs.mkdirSync(dir, { recursive: true });
    await p.evaluate(ui => {
      let st = document.getElementById('cine');
      if (!st) { st = document.createElement('style'); st.id = 'cine'; document.head.appendChild(st); }
      st.textContent = ui ? '' : 'body > *:not(#globe) { visibility: hidden !important; }';
    }, tm.ui);
    const n = Math.round(tm.secs * FPS);
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const pov = tm.pov(i / (n - 1));
      await p.evaluate((pv, FPSV) => new Promise(res => {
        window.__vtStep(1000 / FPSV);
        window.__orbeGlobe.pointOfView(pv, 0);
        requestAnimationFrame(() => requestAnimationFrame(res));
      }), pov, FPS);
      await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
      if (i % 60 === 0) console.log(`  ${name}: ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    console.log(`  -> ${name}: ${n} cuadros`);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
