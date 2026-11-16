/*
 * Parqués 3D — SOLO la parte visual (tablero, fichas, dados y animaciones). Las reglas y los turnos van en otro archivo.
 *
 * Tablero tipo cruz sobre una cuadrícula de 19 x 19: pista de 68 casillas (índices 0..67, en sentido contrario al reloj;
 * en el tablero se ven numeradas del 1 al 68), 4 jugadores (0 amarillo abajo, 1 azul derecha, 2 rojo arriba, 3 verde izquierda),
 * 4 fichas cada uno, llegada de 7 casillas + cielo, y una casa/cárcel redonda en cada esquina.
 *
 * Uso:   const v = OJ.Parques3D({ jugadores: 4 });  OJ.setGame(v);
 *   v.SALIDA[j]  casilla de salida de cada jugador      v.FIN[j]  última casilla de pista antes de su llegada
 *   v.SEGUROS    casillas seguras (salidas, finales y la 12.ª de cada brazo)
 *   "donde" = { t: 'carcel' } | { t: 'pista', i: 0..67 } | { t: 'llegada', k: 0..7 }   (k = 7 es el cielo)
 *   v.colocar(j, f, donde)                 pone la ficha f (0..3) del jugador j sin animación
 *   v.mover(j, f, [donde, donde...], cb)   la ficha salta casilla por casilla por esa lista y al final llama cb()
 *   v.capturar(j, f, cb)                   la ficha vuela a su cárcel (se la comieron)
 *   v.dados(a, b, cb)                      lanza los dos dados en 3D y quedan mostrando a y b; luego cb()
 *   v.resaltar([{ j, f }, ...])            hace brincar y brillar las fichas que se pueden mover ([] para quitar)
 *   v.fichaEn(x, y)                        ficha bajo el dedo (coordenadas de pantalla) → { j, f } o null
 *   v.dadosEn(x, y)                        true si el dedo tocó la zona de los dados
 *   v.enfocar(j)                           gira la cámara para que el jugador j quede abajo
 *   v.celebrar(j)                          confeti con el color del jugador
 *   v.ocupado()                            true mientras hay una animación en curso
 *   v.dondeEsta(j, f)                      el "donde" actual de esa ficha
 *
 * Opcionales (no hace falta usarlos; no cambian nada de lo anterior):
 *   v.turno(j)                             enciende un anillo que gira en la casa del jugador que tiene el turno (-1 o nada: lo apaga)
 *   v.marcarCasillas([donde, ...], j)      marca en el tablero a dónde puede llegar una ficha del jugador j, hasta 8 ([] las quita;
 *                                          también se quitan solas cuando empieza un mover o con resaltar([]))
 *   v.premio(j, n, donde)                  texto 3D que sube y se desvanece: «+n» si n es número, o el texto tal cual.
 *                                          Sale sobre "donde" (opcional); si no se da, sobre la última casilla a la que llegó j
 *
 * Todas las animaciones avanzan solo con update(dt).
 */
(function () {
  'use strict';
  const { V, std, tex, mesh, clamp } = OJ;
  const TAU = Math.PI * 2;
  const COL = ['#f4c20d', '#1e6fe0', '#e53935', '#1faa59'];
  /* pinturas del tablero (laca viva), su tono oscuro y su tono pastel; y el plástico de las fichas */
  const PINT = ['#ffc800', '#1463ea', '#e8261e', '#10a94c'], OSC = ['#a66f00', '#0a3590', '#8c120e', '#086a2e'], LUZ = ['#ffeaa0', '#b4d0ff', '#ffbdb6', '#aeeac4'];
  const FICHA = [0xffbf00, 0x0b56e8, 0xe21812, 0x079a3e];
  const TINTA = '#2a1b10';
  /* pista: 68 casillas [col, fila] */
  const PISTA = [];
  (function () {
    const add = (c, r) => PISTA.push([c, r]);
    for (let r = 18; r >= 11; r--) add(10, r);
    for (let c = 11; c <= 18; c++) add(c, 10);
    add(18, 9);
    for (let c = 18; c >= 11; c--) add(c, 8);
    for (let r = 7; r >= 0; r--) add(10, r);
    add(9, 0);
    for (let r = 0; r <= 7; r++) add(8, r);
    for (let c = 7; c >= 0; c--) add(c, 8);
    add(0, 9);
    for (let c = 0; c <= 7; c++) add(c, 10);
    for (let r = 11; r <= 18; r++) add(8, r);
    add(9, 18);
  })();
  const FIN = [67, 16, 33, 50], SALIDA = FIN.map(e => (e + 5) % 68), SEGUROS = [].concat(SALIDA, FIN, FIN.map(e => (e + 12) % 68));
  const LLEGADA = [k => [9, 17 - k], k => [17 - k, 9], k => [9, 1 + k], k => [1 + k, 9]];
  const CARCEL = [[14.5, 14.5], [14.5, 3.5], [3.5, 3.5], [3.5, 14.5]];
  const FUERA = [[0, 1], [1, 0], [0, -1], [-1, 0]];      // hacia dónde mira el triángulo de cada color en el centro (x, z)
  const PUESTO = 1.3;                                     // separación de los 4 puestos de cada casa
  const wx = c => c - 9, wz = r => r - 9;

  /* ---------- ayudas de dibujo ---------- */
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mz = (a, b, t) => { const x = rgb(a), y = rgb(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
  const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const estrella = (g, cx, cy, R, r2) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * (r2 || .45) : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); };
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  const plano = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);
  const suave = u => u * u * (3 - 2 * u);
  const FUENTE = "'Baloo 2', 'Arial Rounded MT Bold', Arial, sans-serif";

  /* vetas de madera que empatan por los cuatro lados */
  function vetas(g, w, h, y0, y1, n, osc, cla) {
    for (let k = 0; k < n; k++) {
      const yb = y0 + OJ.rnd() * (y1 - y0), amp = 1 + OJ.rnd() * 7, f = 1 + (OJ.rnd() * 3 | 0), fa = OJ.rnd() * TAU, clara = OJ.rnd() < .35;
      g.strokeStyle = 'rgba(' + (clara ? cla : osc) + ',' + (clara ? .05 + OJ.rnd() * .13 : .08 + OJ.rnd() * .3).toFixed(3) + ')';
      g.lineWidth = .6 + OJ.rnd() * 2.6; g.beginPath();
      for (let x = 0; x <= w; x += 16) { const y = clamp(yb + Math.sin(x / w * TAU * f + fa) * amp, y0 + 1, y1 - 1); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  }

  /* ---------- el tablero, pintado a 2048 px ---------- */
  function pintarTablero(g, W) {
    const S = W / 19, lw = Math.max(3, W / 480);
    g.fillStyle = '#f8f0dc'; g.fillRect(0, 0, W, W);
    /* casas / cárceles */
    CARCEL.forEach((c, j) => {
      const cx = (c[0] + .5) * S, cy = (c[1] + .5) * S, x0 = cx - 4 * S, y0 = cy - 4 * S, w = 8 * S, R = 3.3 * S;
      g.fillStyle = mz('#f8f0dc', LUZ[j], .85); g.fillRect(x0, y0, w, w);
      g.strokeStyle = PINT[j]; g.lineWidth = S * .1; rrect(g, x0 + S * .3, y0 + S * .3, w - S * .6, w - S * .6, S * .6); g.stroke();
      g.strokeStyle = OSC[j]; g.lineWidth = S * .028; rrect(g, x0 + S * .47, y0 + S * .47, w - S * .94, w - S * .94, S * .46); g.stroke();
      for (let b = 0; b < 4; b++) {
        const ex = b % 2 ? x0 + w - S * 1.02 : x0 + S * 1.02, ey = b < 2 ? y0 + S * 1.02 : y0 + w - S * 1.02;
        g.fillStyle = PINT[j]; estrella(g, ex, ey, S * .36); g.fill(); g.strokeStyle = OSC[j]; g.lineWidth = S * .03; g.stroke();
      }
      g.fillStyle = 'rgba(40,20,5,.28)'; circ(g, cx + S * .06, cy + S * .08, R + S * .16); g.fill();
      g.fillStyle = OSC[j]; circ(g, cx, cy, R + S * .1); g.fill();
      const gr = g.createRadialGradient(cx - R * .35, cy - R * .4, R * .08, cx, cy, R * 1.02);
      gr.addColorStop(0, mz(PINT[j], '#ffffff', .1)); gr.addColorStop(.5, PINT[j]); gr.addColorStop(1, mz(PINT[j], OSC[j], .45));
      g.fillStyle = gr; circ(g, cx, cy, R); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = S * .06; circ(g, cx, cy, R - S * .25); g.stroke();
      for (let n = 0; n < 4; n++) {
        const px = cx + (n % 2 ? 1 : -1) * PUESTO * S, py = cy + (n < 2 ? -1 : 1) * PUESTO * S, r = .8 * S;
        g.fillStyle = OSC[j]; circ(g, px, py, r + S * .08); g.fill();
        const g2 = g.createRadialGradient(px + r * .15, py + r * .25, r * .15, px, py, r);
        g2.addColorStop(0, '#ffffff'); g2.addColorStop(.7, mz('#ffffff', LUZ[j], .55)); g2.addColorStop(1, mz(LUZ[j], PINT[j], .35));
        g.fillStyle = g2; circ(g, px, py, r); g.fill();
        g.strokeStyle = mz(PINT[j], '#ffffff', .25); g.lineWidth = S * .05; circ(g, px, py, r * .58); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,.94)'; estrella(g, cx, cy, S * .5); g.fill();
    });
    /* pista */
    PISTA.forEach((p, i) => {
      const js = SALIDA.indexOf(i), jf = FIN.indexOf(i), seg = SEGUROS.indexOf(i) >= 0;
      g.fillStyle = js >= 0 ? PINT[js] : seg && jf < 0 ? '#e3ddcd' : '#fffdf6'; g.fillRect(p[0] * S, p[1] * S, S, S);
      if (seg) { g.lineWidth = S * .075; g.strokeStyle = js >= 0 ? '#ffffff' : jf >= 0 ? PINT[jf] : '#6d675b'; circ(g, (p[0] + .5) * S, (p[1] + .5) * S, S * .37); g.stroke(); }
    });
    /* pasillos de llegada, con flechitas hacia el centro */
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let j = 0; j < 4; j++) for (let k = 0; k < 7; k++) {
      const p = LLEGADA[j](k), x = (p[0] + .5) * S, y = (p[1] + .5) * S, dx = -FUERA[j][0], dy = -FUERA[j][1];
      g.fillStyle = PINT[j]; g.fillRect(p[0] * S, p[1] * S, S, S);
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = S * .09; g.beginPath();
      g.moveTo(x - dx * S * .1 - dy * S * .22, y - dy * S * .1 + dx * S * .22); g.lineTo(x + dx * S * .14, y + dy * S * .14); g.lineTo(x - dx * S * .1 + dy * S * .22, y - dy * S * .1 - dx * S * .22); g.stroke();
    }
    g.lineCap = 'butt'; g.lineJoin = 'miter';
    /* centro: cuatro triángulos y la meta */
    const cx = 9.5 * S, q = 1.5 * S, pts = [[cx - q, cx + q], [cx + q, cx + q], [cx + q, cx - q], [cx - q, cx - q]];
    for (let j = 0; j < 4; j++) {
      const a = pts[j], b = pts[(j + 1) % 4], gr = g.createLinearGradient((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, cx, cx);
      gr.addColorStop(0, mz(PINT[j], OSC[j], .2)); gr.addColorStop(.45, PINT[j]); gr.addColorStop(1, mz(PINT[j], '#ffffff', .4));
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cx); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
    }
    /* líneas nítidas */
    g.strokeStyle = TINTA; g.lineWidth = lw;
    PISTA.forEach(p => g.strokeRect(p[0] * S, p[1] * S, S, S));
    for (let j = 0; j < 4; j++) for (let k = 0; k < 7; k++) { const p = LLEGADA[j](k); g.strokeRect(p[0] * S, p[1] * S, S, S); }
    g.strokeRect(cx - q, cx - q, 2 * q, 2 * q);
    g.beginPath(); g.moveTo(cx - q, cx - q); g.lineTo(cx + q, cx + q); g.moveTo(cx + q, cx - q); g.lineTo(cx - q, cx + q); g.stroke();
    g.fillStyle = '#fff6d8'; circ(g, cx, cx, S * .66); g.fill(); g.stroke();
    g.strokeStyle = '#c8920a'; g.lineWidth = S * .05; circ(g, cx, cx, S * .56); g.stroke();
    g.strokeStyle = TINTA; g.lineWidth = lw * 2.5; g.strokeRect(lw * 1.25, lw * 1.25, W - lw * 2.5, W - lw * 2.5);
    /* grano muy fino para que no parezca un plano perfecto */
    for (let k = 0; k < 14000; k++) { g.fillStyle = OJ.rnd() < .5 ? 'rgba(60,40,10,' + (OJ.rnd() * .05).toFixed(3) + ')' : 'rgba(255,255,255,' + (OJ.rnd() * .06).toFixed(3) + ')'; g.fillRect(OJ.rnd() * W, OJ.rnd() * W, 1 + OJ.rnd() * 2, 1 + OJ.rnd() * 2); }
  }

  OJ.Parques3D = function (opt) {
    opt = Object.assign({ jugadores: 4 }, opt);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 12, 320);
    const view = { scene, cam, exposure: 1.0, nombre: 'parques', PISTA, SALIDA, FIN, SEGUROS, COLORES: COL };
    const extras = [];                    // texturas que OJ.liberar no conoce (relieves)
    OJ.semilla(31);
    const rnd = OJ.rnd, LIN = FICHA.map(lin), BLANCO = lin(0xffffff), ORO = lin(0xffc93c);
    const Y0 = -0.55, B = 10.45;          // altura de la mesa y medio lado del marco
    const TW = 10.4, TD = 5.0, RW = 0.36, DZ = B + 0.3 + TD / 2, DS = 1.9, YF = Y0 + 0.07;      // bandeja de los dados

    /* ---------------- mesa y ambiente ---------------- */
    scene.background = new THREE.Color(0x070504);
    OJ.entorno(scene, '#4a423b', '#0b0907', [
      { p: [0, 34, 0], w: 13, h: 13, c: 0xfff0dc, f: 5 },
      { p: [-30, 15, 12], w: 16, h: 22, c: 0xfff4e6, f: 3.2 },
      { p: [30, 13, -10], w: 12, h: 20, c: 0xcfe2ff, f: 2.2 },
      { p: [8, 11, 32], w: 22, h: 12, c: 0xffe6c8, f: 1.8 },
      { p: [-10, 12, -32], w: 24, h: 10, c: 0xffffff, f: 2.2 }
    ]);
    const mesaT = tex(2048, 2048, (g, w, h) => {
      const n = 6, ph = h / n, tonos = ['#3b2215', '#452819', '#352011', '#402517', '#4a2b1b', '#341d11'];
      for (let i = 0; i < n; i++) {
        g.fillStyle = tonos[i]; g.fillRect(0, i * ph, w, ph);
        vetas(g, w, h, i * ph, (i + 1) * ph, 50, '18,8,3', '170,110,60');
        const xj = rnd() * w; g.fillStyle = 'rgba(8,4,2,.8)'; g.fillRect(xj, i * ph, 3, ph);
        g.fillStyle = 'rgba(6,3,1,.9)'; g.fillRect(0, (i + 1) * ph - 3, w, 3); g.fillStyle = 'rgba(255,215,160,.07)'; g.fillRect(0, i * ph, w, 2);
      }
    }, 6, 6);
    mesh(scene, plano(110, 110), std({ map: mesaT, roughness: .5, metalness: 0, envMapIntensity: .4 }), V(0, Y0, 0), false).receiveShadow = true;
    const vinT = tex(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.27, 'rgba(0,0,0,0)'); gr.addColorStop(.55, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,.95)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    mesh(scene, plano(110, 110), new THREE.MeshBasicMaterial({ map: vinT, transparent: true, depthWrite: false }), V(0, Y0 + 0.006, 0), false);
    scene.add(new THREE.HemisphereLight(0xfff2e0, 0x40302a, 0.16));
    const lamp = new THREE.SpotLight(0xffe8cc, 0.8, 0, 0.66, 0.45, 0);        // lámpara cálida colgada sobre la mesa (la única con sombras)
    lamp.position.set(-6, 34, 6); lamp.target.position.set(0, 0, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 14; lamp.shadow.camera.far = 56; lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02;
    scene.add(lamp); scene.add(lamp.target);

    /* ---------------- tablero ---------------- */
    /* Tablero en 4K (4096 px) si el celular lo aguanta; si no, 2K. Acabado laqueado con un leve reflejo */
    const T4 = OJ.R.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
    const tabM = std({ map: tex(T4, T4, pintarTablero), roughness: .36, metalness: 0, envMapIntensity: .5, toneMapped: false });
    mesh(scene, plano(19, 19), tabM, V(0, 0, 0), false).receiveShadow = true;
    /* marco de madera barnizada: cuatro listones a inglete con el canto biselado */
    const maderaT = tex(1024, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7c3c17'); gr.addColorStop(.5, '#904a1e'); gr.addColorStop(1, '#7c3c17'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      vetas(g, w, h, 0, h, 90, '45,16,4', '235,160,95');
    }, 1 / 9, 1 / 1.9);
    const maderaM = std({ map: maderaT, roughness: .26, metalness: 0, envMapIntensity: 1 });
    const liston = new THREE.Shape(); liston.moveTo(-B, -B); liston.lineTo(B, -B); liston.lineTo(9.5, -9.5); liston.lineTo(-9.5, -9.5); liston.closePath();
    const listonG = new THREE.ExtrudeGeometry(liston, { depth: 0.61, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelOffset: -0.12, bevelSegments: 3 }).rotateX(-Math.PI / 2);
    for (let k = 0; k < 4; k++) mesh(scene, listonG, maderaM, V(0, Y0 + 0.12, 0)).rotation.y = k * Math.PI / 2;
    /* números de las casillas: calcomanías que giran con la cámara para leerse siempre derechas */
    const numT = tex(T4 / 2, T4 / 2, (g, w) => {
      const s = w / 9; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 ' + Math.round(s * .6) + 'px ' + FUENTE; g.lineJoin = 'round';
      for (let i = 0; i < 68; i++) {
        const x = (i % 9 + .5) * s, y = (Math.floor(i / 9) + .5) * s + s * .05, blanca = SALIDA.indexOf(i) >= 0;
        if (blanca) { g.lineWidth = s * .09; g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeText(String(i + 1), x, y); }
        g.fillStyle = blanca ? '#ffffff' : TINTA; g.fillText(String(i + 1), x, y);
      }
    });
    const numG = new THREE.BufferGeometry(), numP = new Float32Array(68 * 12), numUV = new Float32Array(68 * 8), numN = new Float32Array(68 * 12), numI = [];
    for (let i = 0; i < 68; i++) {
      const u0 = (i % 9) / 9, v1 = 1 - Math.floor(i / 9) / 9, u1 = u0 + 1 / 9, v0 = v1 - 1 / 9;
      numUV.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8); for (let k = 0; k < 4; k++) numN[i * 12 + k * 3 + 1] = 1;
      numI.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    numG.setAttribute('position', new THREE.BufferAttribute(numP, 3)); numG.setAttribute('uv', new THREE.BufferAttribute(numUV, 2)); numG.setAttribute('normal', new THREE.BufferAttribute(numN, 3)); numG.setIndex(numI);
    const numeros = mesh(scene, numG, std({ map: numT, transparent: true, depthWrite: false, toneMapped: false, roughness: .5, envMapIntensity: .3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), V(0, 0.006, 0), false);
    numeros.receiveShadow = true; numeros.frustumCulled = false;
    let numAz = 99;
    function girarNumeros(a) {
      if (Math.abs(a - numAz) < 1e-4) return; numAz = a;
      const h = 0.33, rx = Math.cos(a) * h, rz = -Math.sin(a) * h, ux = -Math.sin(a) * h, uz = -Math.cos(a) * h, Q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 68; i++) for (let k = 0; k < 4; k++) { const o = i * 12 + k * 3; numP[o] = wx(PISTA[i][0]) + Q[k][0] * rx + Q[k][1] * ux; numP[o + 1] = 0; numP[o + 2] = wz(PISTA[i][1]) + Q[k][0] * rz + Q[k][1] * uz; }
      numG.attributes.position.needsUpdate = true;
    }
    /* la meta: estrella dorada en relieve y su resplandor */
    const oroM = std({ color: lin(0xf0b93a), metalness: 1, roughness: .3, envMapIntensity: 1.3 });
    const estS = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .22 : .5; if (i) estS.lineTo(Math.cos(a) * r, Math.sin(a) * r); else estS.moveTo(Math.cos(a) * r, Math.sin(a) * r); } estS.closePath();
    const meta = mesh(scene, new THREE.ExtrudeGeometry(estS, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelOffset: -0.07, bevelSegments: 2 }).rotateX(-Math.PI / 2), oroM, V(0, 0.07, 0));
    const metaLuz = mesh(scene, plano(4.4, 4.4), new THREE.MeshBasicMaterial({ map: OJ.dotTex, color: lin(0xffe28a), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), V(0, 0.3, 0), false);
    /* aro en relieve de cada casa (plástico del color) */
    /* Fichas de plástico laqueado: capa transparente brillante encima del color (como fichas nuevas) */
    const laca = (c, hl) => new THREE.MeshPhysicalMaterial({ color: c, emissive: hl ? c : 0x000000, emissiveIntensity: hl ? .2 : 0, roughness: .28, metalness: 0, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1 });
    const fichaM = LIN.map(c => laca(c, false));
    const fichaHL = LIN.map(c => laca(c, true));
    const aroCasaG = new THREE.TorusGeometry(3.36, 0.075, 8, 72).rotateX(Math.PI / 2);
    CARCEL.forEach((c, j) => { const m = mesh(scene, aroCasaG, fichaM[j], V(wx(c[0]), 0.02, wz(c[1]))); m.scale.y = 0.7; });
    /* anillo de turno: rayitas blancas que giran alrededor de la casa */
    const turnoT = tex(512, 512, (g, w) => {
      g.translate(w / 2, w / 2); g.lineCap = 'round';
      for (let k = 0; k < 20; k++) { g.rotate(TAU / 20); g.strokeStyle = 'rgba(30,15,0,.55)'; g.lineWidth = 21; g.beginPath(); g.arc(0, 0, w * .44, 0, TAU / 46); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.stroke(); }
    });
    const halos = CARCEL.map(c => mesh(scene, plano(8.6, 8.6), new THREE.MeshBasicMaterial({ map: turnoT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), V(wx(c[0]), 0.02, wz(c[1])), false));
    halos.forEach(h => { h.visible = false; });
    let turnoJ = -1;
    view.turno = function (j) { turnoJ = j == null ? -1 : j; };

    /* ---------------- fichas ---------------- */
    const perfil = [[0, 0], [.40, 0], [.435, .02], [.445, .06], [.435, .11], [.40, .14], [.355, .155], [.33, .19], [.305, .25], [.265, .40], [.215, .58], [.18, .74], [.17, .82], [.185, .86], [.24, .885], [.262, .915], [.24, .945], [.185, .965], [.16, .985]];
    for (let a = -0.95; a < 1.5; a += 0.27) perfil.push([Math.cos(a) * .3, 1.23 + Math.sin(a) * .3]);
    perfil.push([0, 1.53]);
    const fichaG = new THREE.LatheGeometry(perfil.map(a => new THREE.Vector2(a[0], a[1])), 48);
    const somT = tex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, w * .12, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(20,8,0,.5)'); gr.addColorStop(.45, 'rgba(20,8,0,.26)'); gr.addColorStop(.8, 'rgba(20,8,0,.05)'); gr.addColorStop(1, 'rgba(20,8,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const somG = plano(1.36, 1.36), somM = new THREE.MeshBasicMaterial({ map: somT, transparent: true, depthWrite: false });
    const aroT = tex(128, 128, (g, w) => {
      const c = w / 2; let gr = g.createRadialGradient(c, c, w * .2, c, c, c); gr.addColorStop(0, 'rgba(30,12,0,.0)'); gr.addColorStop(.5, 'rgba(30,12,0,.5)'); gr.addColorStop(1, 'rgba(30,12,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
      g.strokeStyle = '#ffffff'; g.lineWidth = w * .085; circ(g, c, c, w * .335); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = w * .15; g.stroke();
    });
    const aroG = plano(2.3, 2.3), aroM = new THREE.MeshBasicMaterial({ map: aroT, color: lin(0xfff3b0), transparent: true, depthWrite: false, toneMapped: false });
    const fichas = [];
    function pos(j, d, out) {
      if (d.t === 'llegada' && d.k >= 7) return out.set(FUERA[j][0] * 1.08, 0, FUERA[j][1] * 1.08);
      const c = d.t === 'pista' ? PISTA[d.i] : d.t === 'llegada' ? LLEGADA[j](d.k) : CARCEL[j];
      return out.set(wx(c[0]), 0, wz(c[1]));
    }
    const clave = (j, d) => (d.t === 'pista' ? 'p' + d.i : d.t === 'llegada' ? 'l' + j + '_' + Math.min(d.k, 7) : 'c' + j);
    for (let j = 0; j < 4; j++) for (let f = 0; f < 4; f++) {
      const vis = opt.jugadores === 4 || (opt.jugadores === 3 && j < 3) || (opt.jugadores === 2 && (j === 0 || j === 2));
      const m = mesh(scene, fichaG, fichaM[j]), som = mesh(scene, somG, somM, V(0, 0.012, 0), false), aro = mesh(scene, aroG, aroM, V(0, 0.016, 0), false);
      m.visible = som.visible = vis; aro.visible = false;
      fichas.push({ j, f, m, som, aro, vis, donde: { t: 'carcel' }, obj: V(0, 0, 0), esc: 1, s: 1, golpe: 0, anim: null, hl: false });
    }
    const F = (j, f) => fichas[j * 4 + f], tmp = V(0, 0, 0), tmp2 = V(0, 0, 0);
    const ultimo = CARCEL.map(c => V(wx(c[0]), 0, wz(c[1])));
    /* barrera: dos fichas iguales lado a lado, unidas por un óvalo dorado */
    const barT = tex(256, 128, (g, w, h) => {
      rrect(g, 14, 14, w - 28, h - 28, (h - 28) / 2); g.fillStyle = 'rgba(255,205,60,.26)'; g.fill();
      g.strokeStyle = 'rgba(40,20,0,.6)'; g.lineWidth = 15; g.stroke(); g.strokeStyle = '#ffcc33'; g.lineWidth = 9; g.stroke();
    });
    const barG = plano(1.5, 0.86), barM = new THREE.MeshBasicMaterial({ map: barT, transparent: true, depthWrite: false });
    const barreras = []; for (let k = 0; k < 8; k++) { const b = mesh(scene, barG, barM, V(0, 0.01, 0), false); b.visible = false; barreras.push(b); }
    const DESP = { 1: [[0, 0]], 2: [[-0.29, 0], [0.29, 0]], 3: [[-0.29, 0.21], [0.29, 0.21], [0, -0.27]], 4: [[-0.28, -0.27], [0.28, -0.27], [-0.28, 0.27], [0.28, 0.27]] }, ESC = [1, 1.08, 0.8, 0.72, 0.66, 0.5];
    let az = 0, azObj = 0, primer = true;
    function ordenar() {      // reparte las fichas que comparten casilla, sin montarse
      const g = {}, ca = Math.cos(azObj), sa = Math.sin(azObj); let nb = 0;
      fichas.forEach(o => { if (!o.vis || (o.anim && o.anim.tipo === 'saltos')) return; const k = clave(o.j, o.donde); (g[k] = g[k] || []).push(o); });
      Object.keys(g).forEach(k => {
        const l = g[k], d0 = l[0].donde, n = l.length;
        if (d0.t === 'carcel') { l.forEach(o => { pos(o.j, o.donde, o.obj); o.obj.x += (o.f % 2 ? 1 : -1) * PUESTO; o.obj.z += (o.f < 2 ? -1 : 1) * PUESTO; o.esc = 1.22; }); return; }
        if (d0.t === 'llegada' && d0.k >= 7) {       // en el cielo: en fila dentro del triángulo de su color
          const u = FUERA[l[0].j]; l.sort((a, b) => a.f - b.f);
          l.forEach((o, i) => { const s = (i - (n - 1) / 2) * 0.5; o.obj.set(u[0] * 1.08 - u[1] * s, 0, u[1] * 1.08 + u[0] * s); o.esc = 0.58; }); return;
        }
        const cnt = {}; l.forEach(o => { cnt[o.j] = (cnt[o.j] || 0) + 1; });
        l.sort((a, b) => (cnt[b.j] - cnt[a.j]) || (a.j - b.j) || (a.f - b.f));        // las parejas del mismo color quedan juntas
        l.forEach((o, i) => {
          let a, b; if (n <= 4) { a = DESP[n][i][0]; b = DESP[n][i][1]; } else { const an = i / n * TAU; a = Math.cos(an) * 0.34; b = Math.sin(an) * 0.34; }
          pos(o.j, o.donde, o.obj); o.obj.x += a * ca + b * sa; o.obj.z += -a * sa + b * ca; o.esc = ESC[Math.min(n, 5)];
        });
        if (d0.t === 'pista' && n <= 4) [[0, 1], [2, 3]].forEach(par => {
          if (n <= par[1] || (par[0] && n < 4) || l[par[0]].j !== l[par[1]].j || nb >= barreras.length) return;
          const bq = barreras[nb++]; bq.position.set((l[par[0]].obj.x + l[par[1]].obj.x) / 2, 0.01, (l[par[0]].obj.z + l[par[1]].obj.z) / 2); bq.rotation.y = azObj; bq.scale.setScalar(ESC[n] / 0.8); bq.visible = true;
        });
      });
      for (; nb < barreras.length; nb++) barreras[nb].visible = false;
    }
    const asentar = () => fichas.forEach(x => { if (!x.anim) { x.m.position.copy(x.obj); x.s = x.esc; x.golpe = 0; x.m.scale.setScalar(x.esc); x.m.rotation.set(0, 0, 0); } });
    view.colocar = function (j, f, d) { const o = F(j, f); o.donde = d; o.anim = null; ordenar(); asentar(); };
    function tramo(a) { const d = a.de.distanceTo(a.pts[a.k]); a.dur = clamp(0.14 + d * 0.03, 0.165, 0.62); a.alt = clamp(0.5 + d * 0.25, 0.75, 4.2); }
    view.mover = function (j, f, pasos, cb) {
      const o = F(j, f); if (!pasos || !pasos.length) { if (cb) cb(); return; }
      marcar(null);
      const a = { tipo: 'saltos', pts: pasos.map(d => pos(j, d, V(0, 0, 0))), k: 0, t: 0, de: o.m.position.clone(), fin: pasos[pasos.length - 1], cb, dur: 0.17, alt: 0.8 };
      a.de.y = 0; tramo(a); o.m.rotation.set(0, 0, 0); o.anim = a; ordenar();
    };
    view.capturar = function (j, f, cb) {
      const o = F(j, f), de = o.m.position.clone(); de.y = 0;
      o.donde = { t: 'carcel' }; o.anim = { tipo: 'vuelo', t: 0, de, a: de, cb }; ordenar(); o.anim.a = o.obj.clone();
      for (let k = 0; k < 16; k++) { const an = k / 16 * TAU, v = 2 + Math.random() * 3; chispa(de.x, 0.5, de.z, Math.cos(an) * v, 2 + Math.random() * 3, Math.sin(an) * v, k % 2 ? LIN[j] : BLANCO, 0.6); }
      acercar(de, 1); OJ.snd.come(); OJ.vib(60);
    };
    view.resaltar = function (l) { fichas.forEach(o => { o.hl = false; }); (l || []).forEach(x => { F(x.j, x.f).hl = true; }); if (!l || !l.length) marcar(null); };
    view.dondeEsta = (j, f) => F(j, f).donde;

    /* marcas de destino (opcional) */
    const marT = tex(128, 128, (g, w) => {
      const c = w / 2; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = w * .16; circ(g, c, c, w * .33); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = w * .1; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.55)'; circ(g, c, c, w * .17); g.fill(); g.fillStyle = '#ffffff'; circ(g, c, c, w * .12); g.fill();
    });
    const marM = new THREE.MeshBasicMaterial({ map: marT, transparent: true, depthWrite: false, toneMapped: false }), marG = plano(1.05, 1.05);
    const marcas = []; for (let k = 0; k < 8; k++) { const m = mesh(scene, marG, marM, V(0, 0.02, 0), false); m.visible = false; marcas.push(m); }
    function marcar(l, j) {
      marcas.forEach((m, k) => { const d = l && l[k]; m.visible = !!d; if (d) { pos(j, d, m.position); m.position.y = 0.02; } });
      if (l && l.length) marM.color.copy(lin(PINT[j]));
    }
    view.marcarCasillas = function (l, j) { marcar(l && l.length ? l : null, j || 0); };

    /* ---------------- chispas, confeti y letreros ---------------- */
    const NP = 200, pP = new Float32Array(NP * 3), pC = new Float32Array(NP * 4), pV = new Float32Array(NP * 3), pL = new Float32Array(NP), pD = new Float32Array(NP);
    const pG = new THREE.BufferGeometry(); pG.setAttribute('position', new THREE.BufferAttribute(pP, 3)); pG.setAttribute('color', new THREE.BufferAttribute(pC, 4));
    const polvo = new THREE.Points(pG, new THREE.PointsMaterial({ size: 1.9, map: OJ.dotTex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false })); polvo.frustumCulled = false; scene.add(polvo);
    let pK = 0, pVivo = false;
    function chispa(x, y, z, vx, vy, vz, c, dur) {
      const i = pK; pK = (pK + 1) % NP; pP[i * 3] = x; pP[i * 3 + 1] = y; pP[i * 3 + 2] = z; pV[i * 3] = vx; pV[i * 3 + 1] = vy; pV[i * 3 + 2] = vz;
      pC[i * 4] = c.r; pC[i * 4 + 1] = c.g; pC[i * 4 + 2] = c.b; pC[i * 4 + 3] = 1; pL[i] = 1; pD[i] = dur; pVivo = true;
    }
    const NC = 170, conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.48, 0.27), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), NC);
    conf.castShadow = true; conf.frustumCulled = false; conf.visible = false; scene.add(conf);
    const cP = [], dummy = new THREE.Object3D(); dummy.scale.setScalar(0); dummy.updateMatrix();
    for (let i = 0; i < NC; i++) { cP.push({ p: V(0, 0, 0), v: V(0, 0, 0), e: new THREE.Euler(), w: V(0, 0, 0), on: 0, t: 0, s: 1 }); conf.setMatrixAt(i, dummy.matrix); conf.setColorAt(i, BLANCO); }
    let cK = 0;
    function confeti(p, n, cols, vmin, vmax, arriba, vida) {
      for (let k = 0; k < n; k++) {
        const i = cK, c = cP[i], a = Math.random() * TAU, el = 0.35 + Math.random() * 1.1, v = vmin + Math.random() * (vmax - vmin); cK = (cK + 1) % NC;
        c.p.copy(p); c.v.set(Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v + arriba, Math.sin(a) * Math.cos(el) * v);
        c.e.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU); c.w.set((Math.random() - .5) * 16, (Math.random() - .5) * 16, (Math.random() - .5) * 16);
        c.on = 1; c.t = vida * (0.8 + Math.random() * 0.4); c.s = 0.75 + Math.random() * 0.6; conf.setColorAt(i, cols[Math.floor(Math.random() * cols.length)]);
      }
      conf.instanceColor.needsUpdate = true; conf.visible = true;
    }
    const letreros = [0, 1, 2].map(() => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 128; const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); s.visible = false; s.renderOrder = 10; scene.add(s);
      return { s, cv, t, vida: 0, p: V(0, 0, 0) };
    });
    let nLet = 0;
    view.premio = function (j, n, donde) {
      const L = letreros[nLet++ % 3], g = L.cv.getContext('2d'), txt = typeof n === 'number' ? '+' + n : String(n); let px = 96;
      g.clearRect(0, 0, 320, 128); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.font = '800 ' + px + 'px ' + FUENTE;
      while (g.measureText(txt).width > 280 && px > 30) { px -= 6; g.font = '800 ' + px + 'px ' + FUENTE; }
      g.lineWidth = 18; g.strokeStyle = 'rgba(25,12,4,.92)'; g.strokeText(txt, 160, 70); g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.strokeText(txt, 160, 70); g.fillStyle = PINT[j] || '#ffc510'; g.fillText(txt, 160, 70);
      L.t.needsUpdate = true; if (donde) pos(j, donde, L.p); else L.p.copy(ultimo[j] || ultimo[0]); L.vida = 1; L.s.visible = true;
    };

    /* ---------------- dados y su bandeja ---------------- */
    const pivote = new THREE.Group(); scene.add(pivote);       // gira con la cámara: los dados quedan siempre abajo
    const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false); return s; };
    const borde = rr(TW, TD, 0.85); borde.holes.push(rr(TW - 2 * RW, TD - 2 * RW, 0.85 - RW));
    mesh(pivote, new THREE.ExtrudeGeometry(borde, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelOffset: -0.09, bevelSegments: 3, curveSegments: 10 }).rotateX(-Math.PI / 2), maderaM, V(0, Y0 + 0.09, DZ));
    const fieltroT = tex(256, 256, (g, w) => {
      g.fillStyle = '#0c5b37'; g.fillRect(0, 0, w, w);
      for (let k = 0; k < 5000; k++) { g.fillStyle = rnd() < .5 ? 'rgba(0,25,10,' + (rnd() * .3).toFixed(2) + ')' : 'rgba(120,220,150,' + (rnd() * .13).toFixed(2) + ')'; g.fillRect(rnd() * w, rnd() * w, 1 + rnd() * 2, 1); }
    }, 0.5, 0.5);
    mesh(pivote, new THREE.ShapeGeometry(rr(TW - 2 * RW + 0.1, TD - 2 * RW + 0.1, 0.55), 10).rotateX(-Math.PI / 2), std({ map: fieltroT, roughness: 1, metalness: 0, envMapIntensity: .25 }), V(0, YF, DZ), false).receiveShadow = true;
    const PUNTOS = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.26, .26], [.5, .5], [.74, .74]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.29, .25], [.71, .25], [.29, .5], [.71, .5], [.29, .75], [.71, .75]] };
    const caraT = n => tex(512, 512, (g, w) => {
      const f = g.createRadialGradient(w / 2, w / 2, w * .2, w / 2, w / 2, w * .75); f.addColorStop(0, '#fffaf0'); f.addColorStop(1, '#efe6d2'); g.fillStyle = f; g.fillRect(0, 0, w, w);
      PUNTOS[n].forEach(p => {
        const x = p[0] * w, y = p[1] * w, r = w * (n === 1 ? .15 : .1), gr = g.createRadialGradient(x, y + r * .25, r * .1, x, y, r);
        gr.addColorStop(0, n === 1 ? '#e22a20' : '#1d1d23'); gr.addColorStop(1, n === 1 ? '#8e0c08' : '#050507'); g.fillStyle = gr; circ(g, x, y, r); g.fill();
      });
    });
    const caraB = n => { const t = tex(128, 128, (g, w) => {        // relieve: los puntos van hundidos
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, w);
      PUNTOS[n].forEach(p => { const x = p[0] * w, y = p[1] * w, r = w * (n === 1 ? .15 : .1) * 1.12, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#000000'); gr.addColorStop(.7, '#3a3a3a'); gr.addColorStop(1, '#ffffff'); g.fillStyle = gr; circ(g, x, y, r); g.fill(); });
    }); extras.push(t); return t; };
    const dadoM = [3, 4, 1, 6, 2, 5].map(n => std({ map: caraT(n), bumpMap: caraB(n), bumpScale: 0.035, roughness: .2, metalness: 0, envMapIntensity: .9 }));
    const dadoG = OJ.cajaRedonda(DS, DS, DS, DS * 0.17, 6), EJEY = V(0, 1, 0);
    const QX = a => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a), QZ = a => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a);
    const QCARA = { 1: QX(0), 6: QX(Math.PI), 2: QX(-Math.PI / 2), 5: QX(Math.PI / 2), 3: QZ(Math.PI / 2), 4: QZ(-Math.PI / 2) };
    const ZMIN = DZ - (TD / 2 - RW - DS / 2 - 0.1), XMAX = TW / 2 - RW - DS / 2 - 0.1, GR = 110;
    const dados = [0, 1].map(i => {
      const m = mesh(pivote, dadoG, dadoM, V(i ? 1.85 : -1.85, YF + DS / 2, DZ + (i ? 0.3 : 0.05)));
      const som = mesh(pivote, somG, new THREE.MeshBasicMaterial({ map: somT, transparent: true, depthWrite: false }), V(0, YF + 0.012, DZ), false);
      const d = { m, som, q1: new THREE.Quaternion(), eje: V(1, 0, 0), eje2: V(0, 1, 0), fx: m.position.x, fz: m.position.z, dx: 0, dz: 1, ts: [0, 0, 0, 0, 0], hs: [0, 0, 0, 0], L: [0, 0, 0, 0, 0], A: [0, 0, 0, 0, 0], T: 1, fi: 0, t: 0 };
      d.q1.setFromAxisAngle(EJEY, i ? 0.35 : -0.2).multiply(QCARA[i ? 5 : 6]); m.quaternion.copy(d.q1); som.position.set(d.fx, YF + 0.012, d.fz); som.scale.setScalar(2.1);
      return d;
    });
    let tiro = null;
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), mt = new THREE.Matrix4();
    const nudo = (d, arr, t) => {           // valor que falta (distancia o giro) en el instante t: tramos rectos y un frenado final
      const ts = d.ts; if (t >= ts[4]) { const w = Math.min(1, (t - ts[4]) / (d.T - ts[4])); return arr[4] * (1 - w) * (1 - w); }
      let k = 0; while (k < 3 && t >= ts[k + 1]) k++;
      return arr[k] + (arr[k + 1] - arr[k]) * (t - ts[k]) / (ts[k + 1] - ts[k]);
    };
    function ponerDado(d, t) {
      const ts = d.ts, tc = Math.min(t, d.T), L = nudo(d, d.L, tc), A = nudo(d, d.A, tc);
      let x = d.fx - d.dx * L, z = d.fz - d.dz * L, h = 0;
      if (z < ZMIN) z = 2 * ZMIN - z; if (x > XMAX) x = 2 * XMAX - x; else if (x < -XMAX) x = -2 * XMAX - x;      // rebota en el borde de la bandeja
      if (tc < ts[1]) h = d.hs[0] * (1 - Math.pow(Math.max(tc, 0) / ts[1], 2));
      else if (tc < ts[4]) { let k = 1; while (k < 3 && tc >= ts[k + 1]) k++; const s = (tc - ts[k]) / (ts[k + 1] - ts[k]); h = d.hs[k] * 4 * s * (1 - s); }
      const fi = d.fi * Math.pow(Math.max(0, 1 - tc / ts[3]), 1.5);
      qa.setFromAxisAngle(d.eje, -A); qb.setFromAxisAngle(d.eje2, fi); d.m.quaternion.copy(qa).multiply(qb).multiply(d.q1);
      mt.makeRotationFromQuaternion(d.m.quaternion); const e = mt.elements, ext = (DS / 2 - DS * 0.17) * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) + DS * 0.17;
      d.m.position.set(x, YF + ext + h, z);
      d.som.position.set(x, YF + 0.012, z); d.som.scale.setScalar(2.1 + h * 0.3); d.som.material.opacity = 1 / (1 + h * 0.9);
    }
    view.dados = function (a, b, cb) {
      [a, b].forEach((v, i) => {
        const d = dados[i], s = i ? 1 : -1;
        d.q1.setFromAxisAngle(EJEY, Math.floor(Math.random() * 4) * Math.PI / 2 + (Math.random() - .5) * 0.5).multiply(QCARA[v] || QCARA[1]);
        d.fx = s * (1.75 + Math.random() * 0.4); d.fz = DZ + 0.02 + Math.random() * 0.4;
        const dx = -s * (0.08 + Math.random() * 0.2), n = Math.hypot(dx, 1); d.dx = dx / n; d.dz = 1 / n;
        d.eje.set(d.dz, 0, -d.dx); d.eje2.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
        const h0 = 4.2 + Math.random() * 0.8, h1 = 1.25 + Math.random() * 0.5, h2 = h1 * 0.34, h3 = h2 * 0.3, k = 0.94 + Math.random() * 0.12;
        const tA = Math.sqrt(2 * h0 / GR), d1 = 2 * Math.sqrt(2 * h1 / GR), d2 = 2 * Math.sqrt(2 * h2 / GR), d3 = 2 * Math.sqrt(2 * h3 / GR);
        d.ts = [0, tA, tA + d1, tA + d1 + d2, tA + d1 + d2 + d3]; d.T = d.ts[4] + 0.36; d.hs = [h0, h1, h2, h3];
        d.L = [6.6 * k, 3.0 * k, 1.3 * k, 0.72 * k, 0.5 * k]; d.A = [10.4 * k, 6.2 * k, 2.6 * k, 1.05, 0.55]; d.fi = (4 + Math.random() * 3) * (Math.random() < .5 ? 1 : -1); d.t = -i * 0.07;
      });
      tiro = { cb, son: 0 }; OJ.snd.dado();
    };
    view.ocupado = () => !!tiro || fichas.some(o => o.anim);

    /* ---------------- toques ---------------- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), planoD = new THREE.Plane(V(0, 1, 0), -(Y0 + 0.5));
    const aPantalla = (x, y, z, out) => { out.set(x, y, z).project(cam); out.x = (out.x + 1) / 2 * OJ.W; out.y = (1 - out.y) / 2 * OJ.H; return out; };
    view.fichaEn = function (x, y) {
      cam.updateMatrixWorld();
      const o0 = aPantalla(0, 0, 0, tmp).clone(), pxU = aPantalla(Math.cos(az), 0, -Math.sin(az), tmp).distanceTo(o0), lim = Math.max(24, pxU * 1.05);
      let mejor = null, md = 1e9;
      fichas.forEach(o => {
        if (!o.vis) return;
        const p = o.m.position, a = aPantalla(p.x, p.y + 0.15, p.z, tmp), ax = a.x, ay = a.y, b = aPantalla(p.x, p.y + 1.3 * o.s, p.z, tmp2);
        const vx = b.x - ax, vy = b.y - ay, u = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
        let d = Math.hypot(x - ax - vx * u, y - ay - vy * u); if (d > lim * (o.hl ? 1.35 : 1)) return;
        if (o.hl) d -= 1e4;                                  // si hay varias cerca, prefiere la que se puede mover
        if (d < md) { md = d; mejor = o; }
      });
      return mejor ? { j: mejor.j, f: mejor.f } : null;
    };
    view.dadosEn = function (x, y) {
      cam.updateMatrixWorld(); pivote.updateMatrixWorld(); ndc.set(x / OJ.W * 2 - 1, -(y / OJ.H * 2 - 1)); ray.setFromCamera(ndc, cam);
      const p = ray.ray.intersectPlane(planoD, tmp); if (!p) return false;
      pivote.worldToLocal(p); return Math.abs(p.x) < TW / 2 + 0.9 && Math.abs(p.z - DZ) < TD / 2 + 0.9;
    };

    /* ---------------- cámara y festejo ---------------- */
    view.enfocar = function (j) { azObj = j * Math.PI / 2; while (azObj - az > Math.PI) azObj -= 2 * Math.PI; while (az - azObj > Math.PI) azObj += 2 * Math.PI; ordenar(); };
    const EL = 1.12, SE = Math.sin(EL), CE = Math.cos(EL), BANDA = [0.2, 0.852];        // la interfaz tapa arriba y abajo de esa franja
    let fitW = 0, fitH = 0, distBase = 80, tzBase = 2.3;
    function encuadrar() {                 // acerca la cámara todo lo que se pueda con el tablero y la bandeja dentro de la franja libre
      fitW = OJ.W; fitH = OJ.H; const asp = fitW / fitH, th = Math.tan(cam.fov * Math.PI / 360), hiMax = 1 - 2 * BANDA[0], loMin = 1 - 2 * BANDA[1], zb = DZ + TD / 2;
      const P = [[-B, .3, -B], [B, .3, -B], [-B, .3, B], [B, .3, B], [0, 1.5, -9], [-TW / 2, Y0 + .5, zb], [TW / 2, Y0 + .5, zb], [0, Y0, zb + .1]], r = [0, 0, 0];
      const medir = (dist, tz) => {
        r[0] = 0; r[1] = 9; r[2] = -9;
        P.forEach(p => { const dy = p[1] - SE * dist, dz = p[2] - tz - CE * dist, zc = -(dy * SE + dz * CE), ny = (dy * CE - dz * SE) / (zc * th); r[0] = Math.max(r[0], Math.abs(p[0]) / (zc * th * asp)); r[1] = Math.min(r[1], ny); r[2] = Math.max(r[2], ny); });
      };
      let lo = 20, hi = 300, tz = 2;
      for (let n = 0; n < 26; n++) {
        const dist = (lo + hi) / 2; let a = -14, b = 18;
        for (let k = 0; k < 22; k++) { tz = (a + b) / 2; medir(dist, tz); if ((r[1] + r[2]) / 2 < (hiMax + loMin) / 2) a = tz; else b = tz; }
        if (r[0] <= 0.972 && r[2] - r[1] <= hiMax - loMin) hi = dist; else lo = dist;
      }
      distBase = hi; let a = -14, b = 18; for (let k = 0; k < 22; k++) { tz = (a + b) / 2; medir(hi, tz); if ((r[1] + r[2]) / 2 < (hiMax + loMin) / 2) a = tz; else b = tz; } tzBase = tz;
    }
    view.resize = () => { encuadrar(); };
    let zoomT = -1, zoomF = 0; const zoomP = V(0, 0, 0);
    function acercar(p, f) { zoomP.copy(p); zoomF = f; zoomT = 0; }
    let festejo = null, cielo = 0, tt = 0;
    view.celebrar = function (j) { festejo = { j, t: 0, n: 0 }; cielo = 1; };
    function alCielo(j, p) {
      cielo = 1; confeti(tmp.set(p.x, 0.6, p.z), 22, [LIN[j], LIN[j], ORO, BLANCO], 2.5, 6.5, 4, 2.4);
      for (let k = 0; k < 26; k++) { const an = Math.random() * TAU, v = 1.5 + Math.random() * 4; chispa(p.x, 0.8, p.z, Math.cos(an) * v, 2.5 + Math.random() * 4.5, Math.sin(an) * v, k % 3 ? ORO : BLANCO, 0.7 + Math.random() * 0.5); }
      acercar(tmp.set(0, 0, 0), 0.8);
    }

    /* ---------------- bucle ---------------- */
    view.update = function (dt) {
      tt += dt;
      const pulso = 0.5 + 0.5 * Math.sin(tt * 7);
      fichaHL.forEach(m => { m.emissiveIntensity = 0.12 + 0.2 * pulso; });
      aroM.opacity = 0.75 + 0.25 * pulso;
      fichas.forEach(o => {
        const m = o.m, a = o.anim; let aplasta = 1;
        if (a && a.tipo === 'saltos') {
          a.t += dt / a.dur;
          if (a.t >= 1) {
            a.de.copy(a.pts[a.k]); a.k++; a.t = 0; OJ.snd.ficha();
            if (a.k >= a.pts.length) {
              o.donde = a.fin; o.anim = null; o.golpe = 1; ordenar(); m.position.copy(a.de); ultimo[o.j].copy(a.de);
              if (a.fin.t === 'llegada' && a.fin.k >= 7) alCielo(o.j, a.de);
              if (a.cb) a.cb(); return;
            }
            tramo(a);
          }
          const u = a.t; m.position.lerpVectors(a.de, a.pts[a.k], u); m.position.y = a.alt * 4 * u * (1 - u);
          o.s += (1.1 - o.s) * 0.25; aplasta = 0.9 + 0.2 * Math.sin(u * Math.PI);
        } else if (a && a.tipo === 'vuelo') {
          a.t += dt / 0.72; const u = Math.min(a.t, 1);
          m.position.lerpVectors(a.de, a.a, suave(u)); m.position.y = Math.sin(u * Math.PI) * 5.2; m.rotation.set(u * TAU * 1.5, 0, u * TAU * 2);
          o.s += (o.esc * 1.1 - o.s) * 0.2;
          for (let k = 0; k < 3; k++) chispa(m.position.x + (Math.random() - .5) * .5, m.position.y + 0.6, m.position.z + (Math.random() - .5) * .5, (Math.random() - .5) * 1.2, Math.random() * 1.2, (Math.random() - .5) * 1.2, k ? LIN[o.j] : BLANCO, 0.55);
          if (u >= 1) {
            m.rotation.set(0, 0, 0); o.anim = null; o.golpe = 1;
            for (let k = 0; k < 10; k++) { const an = k / 10 * TAU; chispa(a.a.x, 0.2, a.a.z, Math.cos(an) * 2.2, 1 + Math.random(), Math.sin(an) * 2.2, k % 2 ? LIN[o.j] : BLANCO, 0.45); }
            if (a.cb) a.cb();
          }
        } else {
          tmp.copy(o.obj); if (o.hl) tmp.y = Math.abs(Math.sin(tt * 5.2 + o.f * 0.9)) * 0.42;
          m.position.lerp(tmp, 1 - Math.exp(-dt * 14)); o.s += (o.esc * (o.hl ? 1.1 : 1) - o.s) * (1 - Math.exp(-dt * 13));
          o.golpe *= Math.exp(-dt * 11); aplasta = 1 - 0.2 * o.golpe;
        }
        const mat = o.hl ? fichaHL[o.j] : fichaM[o.j]; if (m.material !== mat) m.material = mat;
        m.scale.set(o.s * (2 - aplasta > 1.12 ? 1.12 : 2 - aplasta), o.s * aplasta, o.s * (2 - aplasta > 1.12 ? 1.12 : 2 - aplasta));
        const alto = m.position.y; o.som.position.set(m.position.x, 0.012, m.position.z); o.som.scale.setScalar(o.s * (1 + alto * 0.12) / (1 + alto * 0.5) + 0.0001); o.som.visible = o.vis && alto < 3;
        o.aro.visible = o.hl && !a; if (o.aro.visible) { o.aro.position.set(o.obj.x, 0.016, o.obj.z); o.aro.scale.setScalar(o.esc * (0.92 + 0.16 * pulso)); }
      });
      if (tiro) {
        let fin = true;
        dados.forEach(d => { d.t += dt; ponerDado(d, Math.max(d.t, 0)); if (d.t < d.T) fin = false; });
        if (tiro.son < 1 && dados[0].t >= dados[0].ts[1]) { tiro.son = 1; OJ.snd.dado(); }
        if (fin) { const cb = tiro.cb; tiro = null; OJ.vib(20); if (cb) cb(); }
      }
      /* chispas */
      if (pVivo) {
        pVivo = false;
        for (let i = 0; i < NP; i++) { if (pL[i] <= 0) continue; pL[i] -= dt / pD[i]; pV[i * 3 + 1] -= 5 * dt; pP[i * 3] += pV[i * 3] * dt; pP[i * 3 + 1] += pV[i * 3 + 1] * dt; pP[i * 3 + 2] += pV[i * 3 + 2] * dt; pC[i * 4 + 3] = Math.max(0, pL[i]); if (pL[i] > 0) pVivo = true; }
        pG.attributes.position.needsUpdate = true; pG.attributes.color.needsUpdate = true;
      }
      /* confeti: papelitos que caen girando y quedan un rato sobre el tablero */
      if (festejo) {
        festejo.t += dt;
        while (festejo && festejo.n < 3 && festejo.t >= festejo.n * 0.38) {
          const j = festejo.j, k = festejo.n++, cols = [LIN[j], LIN[j], LIN[j], BLANCO, ORO];
          confeti(tmp.set(k === 1 ? -5 : k === 2 ? 5 : 0, 1.2, k ? 2 : 0), k ? 50 : 70, cols, 4, 12, 7, 7);
          for (let q = 0; q < 30; q++) { const an = Math.random() * TAU, v = 2 + Math.random() * 6; chispa(tmp.x, 1.5, tmp.z, Math.cos(an) * v, 4 + Math.random() * 7, Math.sin(an) * v, q % 2 ? ORO : BLANCO, 0.9 + Math.random() * 0.6); }
          if (festejo.n >= 3) festejo = null;
        }
      }
      if (conf.visible) {
        let vivos = 0;
        for (let i = 0; i < NC; i++) {
          const c = cP[i]; if (!c.on) continue; vivos++; c.t -= dt;
          if (c.on === 1) {
            c.v.y = Math.max(c.v.y - 13 * dt, -4.2); const fr = Math.exp(-dt * 1.5); c.v.x *= fr; c.v.z *= fr; c.p.addScaledVector(c.v, dt);
            c.e.x += c.w.x * dt; c.e.y += c.w.y * dt; c.e.z += c.w.z * dt;
            const ax = Math.abs(c.p.x), az2 = Math.abs(c.p.z), suelo = ax < 9.5 && az2 < 9.5 ? 0.03 : ax < B && az2 < B ? 0.33 : Y0 + 0.03;
            if (c.v.y < 0 && c.p.y <= suelo) { c.p.y = suelo + i * 0.0002; c.on = 2; c.e.set(-Math.PI / 2, 0, c.e.z); }
          }
          let s = c.t < 0.5 ? Math.max(0, c.t / 0.5) * c.s : c.s; if (c.t <= 0) { c.on = 0; s = 0; }
          dummy.position.copy(c.p); dummy.rotation.copy(c.e); dummy.scale.setScalar(s); dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
        }
        conf.instanceMatrix.needsUpdate = true; if (!vivos) conf.visible = false;
      }
      letreros.forEach(L => {
        if (L.vida <= 0) return; L.vida -= dt / 1.4; const u = 1 - Math.max(L.vida, 0), e = Math.min(1, u / 0.15);
        L.s.position.set(L.p.x, 2 + u * 2.4, L.p.z); L.s.scale.set(5 * (0.6 + 0.4 * suave(e)), 2 * (0.6 + 0.4 * suave(e)), 1); L.s.material.opacity = u > 0.65 ? Math.max(0, (1 - u) / 0.35) : 1;
        if (L.vida <= 0) L.s.visible = false;
      });
      /* meta, turno y marcas */
      if (cielo > 0) cielo -= dt / 2.2;
      const c1 = Math.max(0, cielo); metaLuz.material.opacity = 0.16 + 0.07 * Math.sin(tt * 2.2) + c1 * 0.6; metaLuz.scale.setScalar(1 + c1 * 0.9); meta.rotation.y += dt * (0.35 + c1 * 5);
      halos.forEach((h, k) => { const mm = h.material, ob = k === turnoJ ? 0.9 : 0; mm.opacity += (ob - mm.opacity) * (1 - Math.exp(-dt * 6)); h.visible = mm.opacity > 0.01; if (h.visible) h.rotation.y -= dt * 0.7; });
      marcas.forEach((m, k) => { if (m.visible) m.scale.setScalar(0.9 + 0.14 * Math.sin(tt * 6 + k)); });
      /* cámara: alta, casi cenital; el tablero llena el ancho y los dados quedan debajo, dentro de la franja libre */
      if (OJ.W !== fitW || OJ.H !== fitH) encuadrar();
      az += (azObj - az) * (primer ? 1 : 1 - Math.exp(-dt * 4)); primer = false;
      let zoom = 0;
      if (zoomT >= 0) { zoomT += dt; const u = zoomT / 1.5; if (u >= 1) zoomT = -1; else zoom = zoomF * suave(Math.min(u / 0.2, 1)) * (1 - suave(clamp((u - 0.5) / 0.5, 0, 1))); }
      const giro = Math.abs(Math.cos(az)) + Math.abs(Math.sin(az)) - 1, dist = distBase * (1 + giro * 0.6) * (1 - 0.055 * zoom);
      const sa = Math.sin(az), ca = Math.cos(az), cx = sa * tzBase + (zoomP.x - sa * tzBase) * 0.14 * zoom, cz = ca * tzBase + (zoomP.z - ca * tzBase) * 0.14 * zoom;
      cam.position.set(cx + sa * CE * dist, SE * dist, cz + ca * CE * dist); cam.lookAt(cx, 0, cz);
      pivote.rotation.y = az; pivote.position.set(sa * giro * 11, 0, ca * giro * 11); girarNumeros(az);      // mientras gira, la bandeja se aparta para no cruzarse con la esquina del marco
    };

    view.dispose = function () { extras.forEach(t => t.dispose()); if (lamp.shadow.map) lamp.shadow.map.dispose(); conf.dispose(); OJ.liberar(scene); };
    ordenar(); asentar();
    return view;
  };
})();
