/*
 * Prueba visual del motor Tierra Ultra HD en las cinco apps (teléfono 1080x1920).
 * Requiere el servidor de vista previa orbe-raiz (puerto 5170) y puppeteer-core:
 *   node tools-diseno/tierra-hd/probar.js <node_modules con puppeteer-core> <carpeta de salida> [app…]
 * Por cada app guarda: lado de día, línea del atardecer y la pantalla tal como abre.
 */
const path = require('path');
const puppeteer = require(path.join(process.argv[2], 'puppeteer-core'));
const OUT = process.argv[3];
const ONLY = process.argv.slice(4);
const BASE = process.env.BASE || 'http://localhost:5170/';   // servidor de vista previa "orbe-raiz" (sirve todo el repositorio)
const APPS = { radio: 'RadioOrbe', tv: 'OrbeTV', sismos: 'OrbeSismos', espacio: 'OrbeEspacio', clima: 'OrbeClima' };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio', '--lang=es-CO']
  });
  for (const [name, dir] of Object.entries(APPS)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    p.on('console', m => { if (m.type() === 'error' && !/403|404|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await p.goto(`${BASE}${dir}/app/src/main/assets/www/index.html?calidad=fija`, { waitUntil: 'load' });
    await p.waitForFunction(() => !document.querySelector('#splash'), { timeout: 300000 }).catch(() => {});
    await wait(9000);
    await p.screenshot({ path: path.join(OUT, `hd-${name}-inicio.png`) });
    const info = await p.evaluate(() => {
      const T = window.TierraHD; if (!T || !T.globe) return null;
      const sun = T.sunPosition(new Date());
      T.globe.controls().autoRotate = false;
      T.globe.pointOfView({ lat: 12, lng: sun[0] + 18, altitude: 1.75 });
      return { sun, earth: !!T.earth, clouds: !!T.cloudMesh, level: T.level, normal: T.earth && T.earth.uniforms.hasNormal.value, spec: T.earth && T.earth.uniforms.hasSpec.value };
    });
    await wait(5000);
    await p.screenshot({ path: path.join(OUT, `hd-${name}-dia.png`) });
    if (info) await p.evaluate(s => window.TierraHD.globe.pointOfView({ lat: 25, lng: s[0] + 82, altitude: 1.1 }), info.sun);
    await wait(5000);
    await p.screenshot({ path: path.join(OUT, `hd-${name}-atardecer.png`) });
    console.log(name, JSON.stringify(info), errors.length ? 'ERRORES: ' + errors.join(' | ') : 'sin errores');
    await p.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
