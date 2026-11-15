/*
 * Capturas reales de Juegos de Colombia para Google Play (teléfono 1080x1920) y miniaturas del menú.
 * Abre el juego directamente desde los archivos (no hace falta servidor) con Chrome + puppeteer-core.
 *   node play-store/capturas_juegos.js <carpeta node_modules con puppeteer-core> [paso]
 * paso: todo (por defecto) | miniaturas | tejo | billar | menu
 * ("todo" hace primero las miniaturas, para que el menú salga con ellas).
 *
 * Genera:
 *   play-store/juegos/capturas/telefono-1..8-*.png               1080x1920
 *   OrbeJuegos/app/src/main/assets/www/img/tejo.jpg, billar.jpg  miniaturas 400x400 del menú (sin marcador)
 * Usa los ganchos de prueba del juego: OJ.avanzar(seg), OJ.juego.probar(...) y OJ.juego.st.vista.
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
const BILLAR_GIRO = +(process.env.GIRO || 0.3), BILLAR_MINI = (process.env.MINI || '40,218,250').split(',').map(Number);

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
      if (s) localStorage.setItem('juegos.stats', JSON.stringify(s));
    }, stats || null);
    await p.goto(BASE + '?captura=1&dpr=3' + q, { waitUntil: 'load', timeout: 300000 });
    await p.waitForFunction(() => window.__listo, { timeout: 300000 });
    await wait(1200);
    return p;
  };
  const js = (p, fn, ...a) => p.evaluate(fn, ...a);
  const shot = async (p, name) => { await wait(300); await p.screenshot({ path: path.join(OUT, name) }); console.log('  ->', name); };
  // Miniatura cuadrada 400x400 sin el marcador (se oculta la interfaz); x, y, lado en px de CSS
  const mini = async (p, name, x, y, lado) => {
    await js(p, () => ['ui', 'gran', 'destello'].forEach(id => { document.getElementById(id).style.visibility = 'hidden'; }));
    await wait(200);
    await p.screenshot({ path: path.join(WWW, 'img', name), type: 'jpeg', quality: 90, clip: { x, y, width: lado, height: lado, scale: 400 / (lado * 3) } });
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

  /* ---------- miniaturas del menú ---------- */
  if (hacer('miniaturas')) {
    // Tejo: la mecha estallando junto al bocín
    let p = await abrir('&juego=tejo&modo=2j&meta=27');
    await js(p, () => { OJ.avanzar(0.5); OJ.juego.probar(0.225, 0); });
    await explosion(p);
    await mini(p, 'tejo.jpg', 70, 190, 220);
    await p.close();
    // Billar: las tres bolas sobre el paño, vista del taco
    p = await abrir('&juego=billar&modo=tres&rival=2j');
    await vista(p, 'taco'); await js(p, g => { OJ.juego.st.ang += g; OJ.avanzar(2); }, BILLAR_GIRO);
    // la foto del menú va sin la línea de puntos que ayuda a apuntar
    await js(p, () => { OJ.pausado = true; const g = OJ.juego; g.scene.traverse(o => { if (o.isPoints) o.visible = false; }); OJ.R.render(g.scene, g.cam); });
    await mini(p, 'billar.jpg', BILLAR_MINI[0], BILLAR_MINI[1], BILLAR_MINI[2]);
    await p.close();
  }

  /* ---------- menú ---------- */
  if (hacer('menu')) {
    const p = await abrir('', { tejo: { g: 12, p: 5 }, billar: { g: 8, p: 3 } });
    await js(p, () => OJ.avanzar(3));
    await shot(p, 'telefono-1-menu.png');
    await p.close();
  }

  /* ---------- tejo ---------- */
  if (hacer('tejo')) {
    let p = await abrir('&juego=tejo&modo=ia&dif=1&meta=27');
    await js(p, () => OJ.avanzar(0.5));
    // apuntando con el dedo: arrastre real hacia atrás
    await p.mouse.move(180, 400); await p.mouse.down(); await p.mouse.move(172, 520, { steps: 8 }); await wait(300);
    await js(p, () => OJ.avanzar(0.1));
    await shot(p, 'telefono-2-tejo-apunta.png');
    await p.mouse.up();
    await js(p, () => OJ.avanzar(4));
    // turno de la máquina y luego otra vez el jugador: ¡Mecha!
    for (let k = 0; k < 6; k++) { const t = await hastaApunta(p); if (t === 0) break; await js(p, () => OJ.avanzar(4)); }
    await js(p, () => OJ.juego.probar(0.225, 0));
    await explosion(p);
    await shot(p, 'telefono-3-tejo-mecha.png');
    await p.close();
    // ¡Moñona! (revienta la mecha y queda en el bocín)
    p = await abrir('&juego=tejo&modo=2j&meta=27');
    await js(p, () => { OJ.avanzar(0.5); OJ.juego.probar(0.12, 0); });
    await explosion(p);
    await shot(p, 'telefono-4-tejo-monona.png');
    await p.close();
  }

  /* ---------- billar ---------- */
  if (hacer('billar')) {
    // tres bandas, vista del taco
    let p = await abrir('&juego=billar&modo=tres&rival=2j&meta=20');
    await vista(p, 'taco'); await js(p, g => { OJ.juego.st.ang += g; OJ.avanzar(2); }, BILLAR_GIRO);
    await shot(p, 'telefono-5-billar-taco.png');
    // efecto: dónde le pega el taco a la bola
    await js(p, () => { const st = OJ.juego.st; st.lado = -0.55; st.alto = 0.35; document.querySelector('[data-a="efecto"]').click(); OJ.avanzar(0.2); });
    await shot(p, 'telefono-7-billar-efecto.png');
    await p.close();
    // carambola libre contra El Profe, vista de la mesa
    p = await abrir('&juego=billar&modo=libre&rival=ia&dif=1&meta=10');
    await vista(p, 'mesa'); await js(p, () => { OJ.juego.st.ang -= 0.1; OJ.avanzar(2); });
    await shot(p, 'telefono-6-billar-mesa.png');
    await p.close();
  }

  /* ---------- final de partida ---------- */
  if (hacer('tejo') || hacer('final')) {
    const p = await abrir('&juego=tejo&modo=ia&dif=1&meta=9');
    await js(p, () => { OJ.avanzar(0.5); OJ.juego.probar(0.12, 0); OJ.avanzar(2.5); });
    await wait(2200);
    await js(p, () => OJ.avanzar(0.3));
    await shot(p, 'telefono-8-final.png');
    await p.close();
  }
  console.log('listo');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
