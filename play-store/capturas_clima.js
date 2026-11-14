/*
 * Capturas de Orbe Clima para Google Play (teléfono 1080x1920), con datos en vivo.
 * Requiere el servidor de vista previa orbeclima-web (puerto 5220) y puppeteer-core.
 * El mapa mundial se lee de data/grid-prueba.json (cópialo de OrbeClima/tools/cache/grid.json
 * después de correr build-grid.js) para que todas las capturas usen la misma rejilla de NOAA.
 *   node play-store/capturas_clima.js <ruta a node_modules con puppeteer-core> [url]
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const URL = process.argv[3] || 'http://localhost:5220/?mirror=data/grid-prueba.json';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'clima', 'capturas');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--lang=es-CO']
  });
  const p = await browser.newPage();
  await p.emulateTimezone('America/Bogota');
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('clima.me', JSON.stringify({ lat: 4.711, lng: -74.072, name: 'Bogotá' }));
      localStorage.setItem('clima.places', JSON.stringify([{ lat: 6.244, lng: -75.581, name: 'Medellín' }, { lat: 25.774, lng: -80.194, name: 'Miami' }]));
      localStorage.setItem('clima.layer', JSON.stringify('viento'));
      localStorage.setItem('clima.settings', JSON.stringify({ quality: 'high', particles: true }));
    } catch (e) { /* */ }
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(12000);
  const js = (fn, ...a) => p.evaluate(fn, ...a);
  const shot = async name => { await wait(1200); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };
  const click = sel => js(s => document.querySelector(s).click(), sel);
  const layer = async id => { await click(`[data-layer="${id}"]`); await wait(6000); };

  await shot('telefono-1-viento.png');
  await layer('lluvia');
  await shot('telefono-2-lluvia.png');
  await layer('humedad');
  await shot('telefono-3-humedad.png');
  await click('#now-card'); await wait(3000);
  await p.waitForFunction(() => document.querySelector('#fc-body') && !document.querySelector('#fc-body .spinner'), { timeout: 120000 }); await wait(1500);
  await shot('telefono-4-mi-clima.png');
  await js(() => { const b = document.querySelector('#sheet-body'); if (b) b.scrollTop = 640; }); await wait(800);
  await shot('telefono-5-pronostico.png');
  await click('[data-tab="huracanes"]'); await wait(5000);
  await js(() => { const b = [...document.querySelectorAll('[data-st]')].sort((a, c) => (+c.querySelector('.w b').textContent) - (+a.querySelector('.w b').textContent))[0]; if (b) b.click(); });
  await wait(2000);
  await click('#st-map'); await layer('viento'); await wait(9000);
  await shot('telefono-6-huracan.png');
  await click('[data-tab="alertas"]'); await wait(3000);
  await p.waitForFunction(() => !document.querySelector('#al-now .spinner'), { timeout: 120000 }); await wait(1500);
  await shot('telefono-7-alertas.png');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
