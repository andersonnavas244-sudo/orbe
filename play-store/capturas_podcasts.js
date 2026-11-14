/*
 * Capturas de Orbe Podcasts para Google Play (teléfono 1080x1920), con datos en vivo.
 * Requiere el servidor de vista previa orbe-raiz (puerto 5170) y puppeteer-core:
 *   node play-store/capturas_podcasts.js <node_modules con puppeteer-core> [carpeta de salida]
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const OUT = process.argv[3] || path.join(__dirname, 'podcasts', 'capturas');
const URL = 'http://localhost:5170/OrbePodcasts/app/src/main/assets/www/index.html?calidad=fija';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--lang=es-CO']
  });
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await p.emulateTimezone('America/Bogota');
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('pod.cc', JSON.stringify('co')); } catch (e) { /* */ } });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(9000);
  const js = (fn, ...a) => p.evaluate(fn, ...a);
  const shot = async name => { await wait(1200); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };
  const click = sel => js(s => document.querySelector(s).click(), sel);
  const imgs = () => js(() => Promise.all([...document.querySelectorAll('#sheet-body img')].slice(0, 12).map(i => i.complete ? 1 : new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 25000); }))));

  await shot('telefono-1-mapa.png');
  await click('[data-tab="explorar"]');
  await p.waitForFunction(() => document.querySelector('#sheet-body .big-tile'), { timeout: 60000 }); await imgs(); await wait(2500);
  await shot('telefono-2-explorar.png');
  // Ficha de un podcast popular
  await js(() => document.querySelector('#sheet-body .big-tile').click());
  await p.waitForFunction(() => document.querySelector('#pc-eps .ep'), { timeout: 180000 }); await imgs(); await wait(2500);
  await shot('telefono-3-podcast.png');
  // Reproducir el último episodio y abrir el reproductor
  await click('#pc-follow'); await wait(800);
  await js(() => document.querySelector('#pc-eps [data-play]').click()); await wait(4000);
  await js(() => { const a = document.querySelector('#mini-tx'); if (a) a.click(); }); await wait(3000);
  await shot('telefono-4-reproductor.png');
  // El top de un país
  await js(() => window.__orbeDebug && 0);
  await click('#sheet-close'); await wait(800);
  await click('#btn-country'); await wait(1200);
  await js(() => { const b = document.querySelector('[data-cc="mx"]'); if (b) b.click(); });
  await p.waitForFunction(() => document.querySelector('#sheet-body .pod-row'), { timeout: 60000 }); await imgs(); await wait(3500);
  await shot('telefono-5-pais.png');
  await click('[data-tab="biblioteca"]'); await wait(2500);
  await p.waitForFunction(() => !document.querySelector('#lib-new .spinner'), { timeout: 90000 }).catch(() => {}); await imgs(); await wait(2000);
  await shot('telefono-6-biblioteca.png');
  await click('[data-tab="buscar"]'); await wait(1200);
  await p.type('#q', 'historia', { delay: 60 });
  await wait(4000); await imgs(); await wait(1500);
  await js(() => document.activeElement && document.activeElement.blur());
  await shot('telefono-7-buscar.png');
  console.log(errors.length ? 'ERRORES: ' + errors.join(' | ') : 'sin errores');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
