/*
 * Capturas extra de Orbe Sismos para el video publicitario (sección Prepárate y guías).
 *   node play-store/videos/capturas_video_sismos.js <node_modules con puppeteer-core> [url]
 * Guarda en play-store/sismos/capturas-video/ (1080x1920).
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const URL = process.argv[3] || 'http://localhost:5170/OrbeSismos/app/src/main/assets/www/index.html?calidad=fija';
const OUT = path.join(__dirname, '..', 'sismos', 'capturas-video');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--lang=es-CO'] });
  const p = await b.newPage();
  await p.emulateTimezone('America/Bogota');
  await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('sismos.me', JSON.stringify({ name: 'Bogotá', cc: 'CO', lat: 4.711, lon: -74.072 }));
    localStorage.setItem('sismos.plan', JSON.stringify({ encuentro: 'Parque principal', contacto2: 'Tía Ana (Cali)' }));
    localStorage.setItem('sismos.mochila', JSON.stringify({ 'Agua (4 litros por persona al día)': true, 'Linterna y pilas': true, 'Botiquín de primeros auxilios': true, 'Silbato': true, 'Dinero en efectivo': true }));
    const d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    localStorage.setItem('sismos.mochilaExp', JSON.stringify({ 'Agua (4 litros por persona al día)': d(9), 'Linterna y pilas': d(120) }));
    localStorage.setItem('sismos.test', JSON.stringify({ a: [true, true, true, true, true, false, true, false, true, true] }));
  });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 });
  await wait(4000);
  const js = (f, ...a) => p.evaluate(f, ...a);
  const shot = async n => { await wait(900); await p.screenshot({ path: path.join(OUT, n) }); console.log('  ->', n); };
  const open = async html => { await js(h => { document.querySelector('#sheet-body').insertAdjacentHTML('beforeend', h); document.querySelector('#sheet-body').lastElementChild.click(); }, html); await wait(700); };

  await js(() => document.querySelector('[data-tab="seguridad"]').click()); await wait(1200);
  await js(() => document.querySelector('#sheet-body').scrollTop = 560); await shot('video-preparate.png');
  await open('<button data-g="test"></button>'); await shot('video-test.png');
  await open('<button data-g="mochila"></button>'); await shot('video-mochila.png');
  await open('<button data-guia="auxilios"></button>'); await shot('video-auxilios.png');
  await open('<button data-g="apagon"></button>'); await shot('video-apagon.png');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
