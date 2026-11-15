/*
 * Capturas reales de Juegos de Colombia para Google Play (teléfono 1080x1920) y miniaturas del menú.
 * Abre el juego directamente desde los archivos (no hace falta servidor) con Chrome + puppeteer-core.
 *   node play-store/capturas_juegos.js <carpeta node_modules con puppeteer-core> [paso]
 * paso: todo (por defecto) | miniaturas | menu | tejo | billar | parques | domino
 * ("todo" hace primero las miniaturas, para que el menú salga con ellas).
 *
 * Genera:
 *   play-store/juegos/capturas/telefono-1..8-*.png    1080x1920
 *   OrbeJuegos/app/src/main/assets/www/img/{tejo,billar,parques,domino}.jpg   miniaturas 600x600 del menú (sin marcador)
 * Usa los ganchos de prueba de los juegos: OJ.avanzar(seg), OJ.juego.probar(...), OJ.juego.st, y en parqués
 * OJ.juego.poner/forzar/tirar/tocarFicha, en dominó OJ.juego.tocarFicha/tocarLado.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join(process.argv[2] || '.', 'puppeteer-core'));
const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'OrbeJuegos', 'app', 'src', 'main', 'assets', 'www');
const BASE = 'file:///' + path.join(WWW, 'index.html').replace(/\\/g, '/');
const OUT = path.join(__dirname, 'juegos', 'capturas');
const PASO = process.argv[3] || 'todo';
const hacer = p => PASO === 'todo' || PASO === p;
const wait = ms => new Promise(r => setTimeout(r, ms));
const BILLAR_GIRO = +(process.env.GIRO || 0.3), BILLAR_MINI = (process.env.MINI || '55,165,250').split(',').map(Number);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 900000,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--lang=es-CO'] });

  // Abre el juego en un teléfono de 360x640 (x3 = 1080x1920), sin sonido y con marcadores de ejemplo
  const abrir = async (q, stats) => {
    const p = await b.newPage();
    p.on('pageerror', e => console.log('  ERROR', e.message));
    await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await p.evaluateOnNewDocument(s => {
      localStorage.clear();
      localStorage.setItem('juegos.cfg', JSON.stringify({ sonido: false, vibrar: true }));
      ['parques.ayuda2', 'domino.ayuda2'].forEach(k => localStorage.setItem('juegos.' + k, '1')); localStorage.setItem('juegos.tejo.tiros', '9');
      if (s) localStorage.setItem('juegos.stats', JSON.stringify(s));
    }, stats || null);
    await p.goto(BASE + '?captura=1&dpr=3' + q, { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__listo, { timeout: 300000 });
    await wait(1200);
    return p;
  };
  const js = (p, fn, ...a) => p.evaluate(fn, ...a);
  const shot = async (p, name) => { await wait(300); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };
  // Miniatura cuadrada 600x600 sin el marcador (se oculta la interfaz); x, y, lado en px de CSS
  const mini = async (p, name, x, y, lado) => {
    await js(p, () => ['ui', 'gran', 'destello'].forEach(id => { document.getElementById(id).style.visibility = 'hidden'; }));
    await wait(200);
    await p.screenshot({ path: path.join(WWW, 'img', name), type: 'jpeg', quality: 90, clip: { x, y, width: lado, height: lado, scale: 600 / (lado * 3) } });
    await js(p, () => ['ui', 'gran', 'destello'].forEach(id => { document.getElementById(id).style.visibility = ''; }));
    console.log('  -> www/img/' + name);
  };
  // Billar: cambia la cámara con el botón (así la etiqueta "Vista: …" queda bien)
  const vista = async (p, v) => { for (let i = 0; i < 3; i++) { const cur = await js(p, () => OJ.juego.st.vista); if (cur === v) break; await js(p, () => document.querySelector('[data-a="vista"]').click()); } await js(p, () => OJ.avanzar(2)); };
  // Explosiones: congela el juego y espera a que se apague el destello blanco de la pantalla
  const explosion = async p => {
    await js(p, () => { const g = OJ.juego; for (let i = 0; i < 400 && g.st.fase === 'vuelo'; i++) g.update(1 / 60); OJ.avanzar(0.2); OJ.pausado = true; });
    await wait(550);
    // el letrero (¡Mecha!, ¡Moñona!) a tamaño completo, aunque Chrome sin pantalla no corra su animación
    await js(p, () => { const e = document.getElementById('gran'); e.style.transition = 'none'; e.style.opacity = 1; e.style.transform = 'none'; });
  };
  // Tejo: espera a que le toque lanzar a alguien (sin reloj)
  const hastaApunta = p => js(p, () => { const g = OJ.juego; for (let i = 0; i < 60 && g.st.fase !== 'apunta'; i++) OJ.avanzar(0.25); return g.st.turno; });

  // Parqués: una partida a mitad de camino (fichas en la pista, una llegando y otra en el cielo)
  const parquesArmado = p => js(p, () => {
    OJ.pausado = true; const g = OJ.juego;
    [[0, 0, 6], [0, 1, 30], [0, 2, 66], [1, 0, 12], [1, 1, 50], [2, 0, 22], [2, 1, 71], [3, 0, 27], [3, 1, 3], [3, 2, 3]].forEach(a => g.poner(a[0], a[1], a[2]));
    g.forzar = [[4, 6]]; g.tirar(); OJ.avanzar(1.6);
  });
  // Dominó: juega solo hasta que haya varias fichas en la mesa y te toque a ti
  const dominoArmado = (p, fichas) => js(p, n => {
    OJ.pausado = true; const g = OJ.juego, st = g.st;
    for (let i = 0; i < 60 * 120; i++) {
      const enMesa = 28 - g.manos.reduce((s, m) => s + m.length, 0) - g.quedanPozo();
      if (st.turno === 0 && st.fase === 'elegir' && st.jug.length && g.vista.extremos() && enMesa >= n) break;
      if (st.turno === 0 && st.fase === 'elegir') { g.tocarFicha(st.jug[0]); if (st.fase === 'lado') g.tocarLado('der'); }
      else if (st.turno === 0 && st.fase === 'robar') g.robar(); else if (st.turno === 0 && st.fase === 'pasar') g.pasar();
      g.update(1 / 60);
    }
    OJ.avanzar(0.6);
  }, fichas);

  /* ---------- miniaturas del menú ---------- */
  if (hacer('miniaturas')) {
    // Tejo: la mecha estallando junto al bocín
    let p = await abrir('&juego=tejo&modo=2j&meta=27');
    await js(p, () => { OJ.avanzar(0.5); OJ.juego.probar(0.225, 0); });
    await explosion(p);
    await mini(p, 'tejo.jpg', 70, 190, 220);
    await p.close();
    // Billar: el triángulo de pool sobre el paño, vista de la mesa
    p = await abrir('&juego=billar&modo=bola8&rival=2j');
    await vista(p, 'mesa'); await js(p, () => OJ.avanzar(1));
    await js(p, () => { OJ.pausado = true; const g = OJ.juego; g.scene.traverse(o => { if (o.isPoints) o.visible = false; }); OJ.R.render(g.scene, g.cam); });
    await mini(p, 'billar.jpg', BILLAR_MINI[0], BILLAR_MINI[1], BILLAR_MINI[2]);
    await p.close();
    // Parqués: el tablero con fichas en juego
    p = await abrir('&juego=parques&modo=ia&n=4');
    await parquesArmado(p);
    await mini(p, 'parques.jpg', 30, 140, 300);
    await p.close();
    // Dominó: la mesa con la cadena de fichas
    p = await abrir('&juego=domino&modo=1v1&dif=1');
    await dominoArmado(p, 9);
    await mini(p, 'domino.jpg', 20, 170, 320);
    await p.close();
  }

  /* ---------- menú ---------- */
  if (hacer('menu')) {
    const p = await abrir('', { tejo: { g: 12, p: 5 }, billar: { g: 8, p: 3 }, parques: { g: 4, p: 2 }, domino: { g: 6, p: 4 } });
    await js(p, () => OJ.avanzar(3));
    await shot(p, 'telefono-1-menu.png');
    await p.close();
  }

  /* ---------- tejo ---------- */
  if (hacer('tejo')) {
    const p = await abrir('&juego=tejo&modo=2j&meta=27');
    await js(p, () => { OJ.avanzar(0.5); OJ.juego.probar(0.225, 0); });
    await explosion(p);
    await shot(p, 'telefono-2-tejo-mecha.png');
    await p.close();
  }

  /* ---------- billar ---------- */
  if (hacer('billar')) {
    // bola 8 contra El Profe, vista de la mesa
    let p = await abrir('&juego=billar&modo=bola8&rival=ia&dif=1');
    await vista(p, 'mesa'); await js(p, () => OJ.avanzar(2));
    await shot(p, 'telefono-3-billar-bola8.png');
    await p.close();
    // tres bandas, vista del taco
    p = await abrir('&juego=billar&modo=tres&rival=2j&meta=20');
    await vista(p, 'taco'); await js(p, g => { OJ.juego.st.ang += g; OJ.avanzar(2); }, BILLAR_GIRO);
    await shot(p, 'telefono-4-billar-taco.png');
    await p.close();
  }

  /* ---------- parqués ---------- */
  if (hacer('parques')) {
    let p = await abrir('&juego=parques&modo=ia&n=4&dif=1');
    await parquesArmado(p);
    await shot(p, 'telefono-5-parques-dados.png');
    // ¡se la come! la ficha amarilla avanza 4 y cae sobre la verde
    await js(p, () => { const g = OJ.juego; g.tocarFicha(0); if (g.st.sel) g.elegir(0); for (let i = 0; i < 90 && !document.getElementById('gran').classList.contains('on'); i++) g.update(1 / 60); OJ.avanzar(0.5); });
    await js(p, () => { const e = document.getElementById('gran'); e.style.transition = 'none'; e.style.opacity = 1; e.style.transform = 'none'; });
    await shot(p, 'telefono-6-parques-come.png');
    await p.close();
  }

  /* ---------- dominó ---------- */
  if (hacer('domino')) {
    let p = await abrir('&juego=domino&modo=parejas&dif=1&meta=100');
    await dominoArmado(p, 7);
    await js(p, () => { OJ.globo(document.querySelector('.dm-av[data-j="2"]'), '¡Dale, compañero!'); });
    await shot(p, 'telefono-7-domino-parejas.png');
    await p.close();
    p = await abrir('&juego=domino&modo=1v1&dif=1&meta=50');
    await dominoArmado(p, 6);
    await js(p, () => { OJ.globo(document.querySelector('.dm-av[data-j="1"]'), '🔥'); });
    await shot(p, 'telefono-8-domino-mano.png');
    await p.close();
  }
  console.log('listo');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
