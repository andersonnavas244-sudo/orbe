/*
 * Capturas de las maquetas 3D de los juegos criollos (tejo, bolo, billar).
 *   node ideas/juegos-criollos/capturar.js <ruta a node_modules con puppeteer-core> [juegos...]
 */
const path = require('path');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const juegos = process.argv.slice(3).length ? process.argv.slice(3) : ['tejo', 'bolo', 'billar'];
const URL = 'file:///' + path.join(__dirname, 'maqueta.html').replace(/\\/g, '/');

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 600000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  for (const j of juegos) {
    const p = await b.newPage();
    p.on('pageerror', e => console.log('  error', j, e.message));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await p.goto(URL + '?juego=' + j, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.__listo, { timeout: 300000 });
    await new Promise(r => setTimeout(r, 800));
    await p.screenshot({ path: path.join(__dirname, 'captura-' + j + '.png') });
    console.log('  ->', j);
    await p.close();
  }
  await b.close();
})();
