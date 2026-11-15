/*
 * Graba la portada REAL de Orbe Biblia (Jesús sosteniendo el planeta 3D que gira) cuadro por cuadro, para el video.
 * Reloj virtual: cada cuadro avanza 1/15 s, así el planeta gira suave aunque el navegador sin GPU sea lento.
 *   node play-store/videos/grabar_hero_biblia.js <node_modules con puppeteer-core>
 * Guarda JPG 720x1280 en play-store/videos/cache/biblia/clips/jesus/.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const URL = 'http://localhost:5170/OrbeBiblia/app/src/main/assets/www/index.html?calidad=fija';
const OUT = path.join(__dirname, 'cache', 'biblia', 'clips', 'jesus');
const FPS = 15, SECS = 9;
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 1800000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--lang=es-CO'] });
  const p = await b.newPage();
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    const pn = performance.now.bind(performance), dn = Date.now;
    let frozen = false, vt = 0, t0 = 0, d0 = 0;
    window.__vtFreeze = () => { t0 = pn(); d0 = dn(); vt = 0; frozen = true; };
    window.__vtStep = ms => { vt += ms; };
    performance.now = () => frozen ? t0 + vt : pn();
    Date.now = () => frozen ? d0 + vt : dn();
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash') && window.__orbeDebug && window.__orbeDebug.globe, { timeout: 300000 });
  await wait(9000);
  // solo la portada: sin cabecera, sin versículo, sin pestañas
  await p.addStyleTag({ content: 'body > *:not(#hero):not(#dust) { visibility: hidden !important; } #halo { animation: none !important; }' });
  await p.evaluate(() => { const c = window.__orbeDebug.globe.controls(); c.autoRotate = true; c.autoRotateSpeed = 5; window.__vtFreeze(); });
  const n = FPS * SECS;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await p.evaluate(fps => new Promise(res => { window.__vtStep(1000 / fps); requestAnimationFrame(() => requestAnimationFrame(res)); }), FPS);
    await p.screenshot({ path: path.join(OUT, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    if (i % 30 === 0) console.log(`  ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  console.log(`  -> ${n} cuadros`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
