/*
 * Capturas de Orbe Sismos para Google Play (teléfono 1080x1920), con datos en vivo.
 * Requiere el servidor de vista previa orbesismos-web (puerto 5200) y puppeteer-core:
 *   node play-store/capturas_sismos.js <ruta a node_modules con puppeteer-core> [url]
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const URL = process.argv[3] || 'http://localhost:5200/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'sismos', 'capturas');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--lang=es-CO']
  });
  const p = await browser.newPage();
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('sismos.me', JSON.stringify({ lat: 4.711, lon: -74.072, name: 'Bogotá', cc: 'CO' }));
      localStorage.setItem('sismos.alerts', JSON.stringify({ minMag: 4.5, radius: 300, world: true, tsunami: true, watch: true }));
    } catch (e) { /* */ }
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(6000);
  const js = (fn, ...a) => p.evaluate(fn, ...a);
  const shot = async name => { await wait(700); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };
  const click = sel => js(s => document.querySelector(s).click(), sel);

  await shot('telefono-1-mapa.png');
  await click('[data-tab="sismos"]'); await wait(1200);
  await shot('telefono-2-recientes.png');
  await click('#sheet-tabs [data-tab="zona"]'); await wait(800);
  await click('#sheet-body .q'); await wait(3000);
  await shot('telefono-3-detalle.png');
  await click('[data-tab="seguridad"]'); await wait(1200);
  await shot('telefono-4-seguridad.png');
  await click('#btn-alerts'); await wait(1200);
  await shot('telefono-5-alarmas.png');
  await click('[data-tab="sismos"]'); await wait(800);
  await click('#sheet-tabs [data-tab="hist"]'); await wait(1200);
  await shot('telefono-6-historicos.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
