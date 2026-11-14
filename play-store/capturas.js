/*
 * Capturas de pantalla para Google Play (teléfono 1080x1920 y TV 1920x1080) de Orbe Radio y Orbe TV.
 * Requiere los servidores de vista previa en marcha (orbe-web y orbetv-web) y puppeteer-core:
 *   node play-store/capturas.js <ruta a node_modules con puppeteer-core> [urlRadio] [urlTv]
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));

const RADIO = process.argv[3] || 'http://localhost:5180/';
const TV = process.argv[4] || 'http://localhost:5190/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = __dirname;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function open(browser, url, phone, settings) {
  const page = await browser.newPage();
  if (phone) await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  else await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(s => {
    try { localStorage.setItem('orbe.settings', JSON.stringify(s)); localStorage.removeItem('orbe.startup'); } catch (e) { /* */ }
  }, settings);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(3500);
  return page;
}
async function shot(page, file) {
  // esperar a que carguen los logos visibles
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.logo img')].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
  await wait(400);
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.screenshot({ path: dest });
  console.log('  ->', file);
}
const js = (page, fn, ...a) => page.evaluate(fn, ...a);

async function search(page, q) {
  await js(page, q => { const i = document.querySelector('#q'); i.value = q; i.dispatchEvent(new Event('input')); i.blur(); }, q);
  await wait(1500);
}
async function closeSheet(page) { await js(page, () => document.querySelector('#sheet-close').click()); await wait(600); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio',
      '--autoplay-policy=no-user-gesture-required', '--lang=es-CO']
  });
  const base = { texture: 'day', clouds: true, borders: true, rotate: false, quality: 'high' };

  // ---------------- Orbe Radio: teléfono (6) ----------------
  console.log('Orbe Radio – teléfono');
  let p = await open(browser, RADIO, true, base);
  await shot(p, 'radio/capturas/telefono-1-globo.png');
  await js(p, () => [...document.querySelectorAll('.chip')].find(c => /Latina/.test(c.textContent)).click());
  await wait(1500);
  await search(p, 'salsa');
  await shot(p, 'radio/capturas/telefono-2-busqueda.png');
  await js(p, () => document.querySelector('#sheet-body .st').click());
  await wait(2500);
  await closeSheet(p);
  await js(p, () => document.querySelector('#p-more').click());
  await wait(1200);
  await shot(p, 'radio/capturas/telefono-3-opciones.png');
  await closeSheet(p);
  await js(p, () => { const i = document.querySelector('#q'); i.value = ''; i.dispatchEvent(new Event('input')); document.querySelector('.chip[data-genre="all"]').click(); });
  await wait(1200);
  await js(p, () => document.querySelector('#btn-countries').click());
  await wait(1500);
  await shot(p, 'radio/capturas/telefono-4-paises.png');
  await js(p, () => document.querySelector('.country[data-cc="CO"]').click());
  await wait(3500);
  await shot(p, 'radio/capturas/telefono-5-colombia.png');
  await closeSheet(p);
  await js(p, () => document.querySelector('#btn-layers').click());
  await wait(1500);
  await shot(p, 'radio/capturas/telefono-6-capas.png');
  await p.close();

  // ---------------- Orbe Radio: TV ----------------
  console.log('Orbe Radio – TV');
  p = await open(browser, RADIO + '?tv=1', false, base);
  await shot(p, 'radio/capturas/tv-1-menu.png');
  await js(p, () => document.querySelector('#btn-globe').click());
  await wait(800);
  for (let i = 0; i < 2; i++) { await p.keyboard.press('ArrowLeft'); await wait(300); }
  await wait(1500);
  await shot(p, 'radio/capturas/tv-2-explorar.png');
  await p.keyboard.press('Enter');
  await wait(2500);
  await shot(p, 'radio/capturas/tv-3-emisoras.png');
  await p.close();

  // ---------------- Orbe TV: teléfono (6) ----------------
  console.log('Orbe TV – teléfono');
  p = await open(browser, TV, true, base);
  await shot(p, 'tv/capturas/telefono-1-globo.png');
  await search(p, 'noticias');
  await shot(p, 'tv/capturas/telefono-2-busqueda.png');
  await closeSheet(p);
  await search(p, 'colombia');
  await js(p, () => { const r = [...document.querySelectorAll('#sheet-body .st')]; (r.find(x => /Canal TRO/.test(x.textContent)) || r[0]).click(); });
  await wait(25000);
  const playing = await js(p, () => { const v = document.querySelector('#vo-video'); return v.videoWidth > 0; });
  await js(p, () => document.querySelector('#vo-close').click());
  await wait(800);
  await closeSheet(p);
  if (playing) console.log('  (video cargado)');
  await js(p, () => { const i = document.querySelector('#q'); i.value = ''; i.dispatchEvent(new Event('input')); });
  await wait(800);
  await js(p, () => [...document.querySelectorAll('.chip')].find(c => /Deportes/.test(c.textContent)).click());
  await wait(1800);
  await shot(p, 'tv/capturas/telefono-3-deportes.png');
  await js(p, () => document.querySelector('.chip[data-genre="all"]').click());
  await wait(1000);
  await js(p, () => document.querySelector('#p-more').click());
  await wait(1200);
  await shot(p, 'tv/capturas/telefono-4-opciones.png');
  await closeSheet(p);
  await js(p, () => document.querySelector('#btn-countries').click());
  await wait(1500);
  await shot(p, 'tv/capturas/telefono-5-paises.png');
  await js(p, () => document.querySelector('.country[data-cc="CO"]').click());
  await wait(3500);
  await shot(p, 'tv/capturas/telefono-6-colombia.png');
  await p.close();

  // ---------------- Orbe TV: TV ----------------
  console.log('Orbe TV – TV');
  p = await open(browser, TV + '?tv=1', false, base);
  await shot(p, 'tv/capturas/tv-1-menu.png');
  await js(p, () => document.querySelector('#btn-globe').click());
  await wait(800);
  for (let i = 0; i < 2; i++) { await p.keyboard.press('ArrowLeft'); await wait(300); }
  await wait(1500);
  await shot(p, 'tv/capturas/tv-2-explorar.png');
  await p.keyboard.press('Enter');
  await wait(2500);
  await shot(p, 'tv/capturas/tv-3-canales.png');
  await p.close();

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
