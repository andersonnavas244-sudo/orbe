/*
 * Capturas de Orbe Espacio para Google Play (teléfono 1080x1920), con datos en vivo.
 * Requiere el servidor de vista previa orbeespacio-web (puerto 5210) y puppeteer-core:
 *   node play-store/capturas_espacio.js <ruta a node_modules con puppeteer-core> [url]
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const URL = process.argv[3] || 'http://localhost:5210/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'espacio', 'capturas');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--lang=es-CO']
  });
  const p = await browser.newPage();
  await p.emulateTimezone('America/Santiago');
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('espacio.me', JSON.stringify({ lat: -33.45, lng: -70.66, name: 'Santiago de Chile' }));
      localStorage.setItem('espacio.settings', JSON.stringify({ quality: 'high', clouds: true, labels: true }));
    } catch (e) { /* */ }
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(9000);
  const js = (fn, ...a) => p.evaluate(fn, ...a);
  const shot = async name => { await wait(900); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };
  const click = sel => js(s => document.querySelector(s).click(), sel);

  await shot('telefono-1-mapa.png');
  await click('#iss-card'); await wait(4000);
  await p.waitForFunction(() => document.querySelector('#sheet').classList.contains('open') && document.querySelector('#t-alt') && document.querySelector('#t-alt').textContent !== '—', { timeout: 60000 });
  await wait(3000);
  await shot('telefono-2-estacion.png');
  await click('[data-tab="pasos"]'); await wait(2500);
  await js(() => { const b = document.querySelector('#sheet-body'); if (b) b.scrollTop = 250; }); await wait(800);
  await shot('telefono-3-pasos.png');
  await js(() => { const b = document.querySelector('.pass.vis') || document.querySelector('.pass'); if (b) b.click(); }); await wait(1500);
  await shot('telefono-4-cielo.png');
  await click('[data-tab="lanz"]'); await wait(5000);
  // espera a que carguen las fotos de los cohetes
  await js(() => Promise.all([...document.querySelectorAll('.launch .img')].slice(0, 3).map(el => new Promise(res => {
    const m = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage); if (!m) return res();
    const i = new Image(); i.onload = i.onerror = res; i.src = m[1]; setTimeout(res, 20000);
  }))));
  await wait(4000);
  await shot('telefono-5-lanzamientos.png');
  await click('[data-tab="astro"]'); await wait(5000);
  await js(() => Promise.all([...document.querySelectorAll('.astro .ph')].slice(0, 4).map(el => new Promise(res => {
    const m = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage); if (!m) return res();
    const i = new Image(); i.onload = i.onerror = res; i.src = m[1]; setTimeout(res, 20000);
  }))));
  await js(() => { const b = document.querySelector('#sheet-body'); if (b) b.scrollTop = 150; }); await wait(2500);
  await shot('telefono-6-astronautas.png');
  await click('[data-tab="sats"]'); await wait(1500);
  await js(() => { const b = document.querySelector('#sheet-body'); if (b) b.scrollTop = 420; });
  await shot('telefono-7-satelites.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
