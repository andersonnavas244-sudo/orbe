/*
 * Capturas de Orbe Biblia para Google Play (teléfono 1080x1920).
 * Requiere el servidor de vista previa "orbe-raiz" (puerto 5170) y puppeteer-core.
 *   node play-store/capturas_biblia.js <ruta a node_modules con puppeteer-core> [url]
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const URL = process.argv[3] || 'http://localhost:5170/OrbeBiblia/app/src/main/assets/www/index.html?calidad=fija';
const OUT = path.join(__dirname, 'biblia', 'capturas');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--lang=es-CO'] });
  const p = await b.newPage();
  await p.emulateTimezone('America/Bogota');
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('biblia.hl', JSON.stringify({ 'PSA.23.1': 'oro', 'PSA.23.4': 'azul' }));
    localStorage.setItem('biblia.favs', JSON.stringify({ 'PSA.23.1': { ref: 'Salmos 23:1', text: 'Salmo de David. JEHOVÁ es mi pastor; nada me faltará.', t: Date.now() } }));
    localStorage.setItem('biblia.ultimo', JSON.stringify({ code: 'PSA', c: 23 }));
    const v = []; for (let i = 11; i >= 1; i--) { const d = new Date(Date.now() - i * 864e5); v.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }
    localStorage.setItem('biblia.visitas', JSON.stringify(v));
    localStorage.setItem('biblia.plan', JSON.stringify({ id: 'anio', start: Date.now() - 41 * 864e5, done: Array.from({ length: 40 }, (_, i) => i) }));
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(9000);
  const js = (fn, ...a) => p.evaluate(fn, ...a);
  const shot = async name => { await wait(1000); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };

  const scrollHoy = y => js(y => { const v = document.querySelector('#v-hoy'); v.scrollTop = y; v.dispatchEvent(new Event('scroll')); }, y);
  const close = () => js(() => { const c = document.querySelector('[data-act="sheet-close"]'); if (c) c.click(); });
  await shot('telefono-1-hoy.png');
  await scrollHoy(430);
  await shot('telefono-2-versiculo.png');
  await scrollHoy(0);
  await js(() => window.OrbeExtras.openFeel('ansioso')); await wait(900);
  await shot('telefono-3-sentimientos.png');
  await close(); await wait(400);
  await js(() => window.OrbeExtras.openTarjeta('cumple', 0, 0, 'María')); await wait(3500);
  await shot('telefono-4-tarjetas.png');
  await close(); await wait(400);
  await js(() => window.OrbeExtras.openMapa()); await wait(9000);
  await js(() => document.querySelector('[data-ruta="pablo2"]').click()); await wait(4000);
  await shot('telefono-5-lugares-3d.png');
  await js(() => window.orbeBack()); await wait(800);
  await js(() => window.__orbeDebug.openOracion(1)); await wait(900);
  await shot('telefono-6-oraciones.png');
  await close(); await wait(400);
  await js(() => window.OrbeExtras.openTrivia()); await wait(900);
  await shot('telefono-7-trivia.png');
  await close(); await wait(400);
  await js(() => window.__orbeDebug.openReader('JOH', 1)); await wait(1500);
  await shot('telefono-8-lectura.png');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
