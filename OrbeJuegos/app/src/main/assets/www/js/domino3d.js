/*
 * Dominó 3D — SOLO la parte visual (mesa, fichas y animaciones). Las reglas y los turnos van en otro archivo.
 * Juego de doble seis (28 fichas). Una ficha es [a, b] con a <= b.
 * La mesa se ve desde arriba: rivales arriba (filas de fichas de espaldas), la cadena en el centro, el pozo a la derecha
 * y la mano del jugador abajo, sobre una repisa de madera oscura.
 *
 * Uso:   const v = OJ.Domino3D({ jugadores: 2 | 4 });  OJ.setGame(v);
 *   Asientos: jugador 0 abajo (el del celular). Las filas rivales van arriba (y 27 %) dejando libre la derecha para el panel de puntos:
 *   con 2 jugadores el 1 va centrado en x 41 % (entre 8 % y 74 %); con 4: rival 1 en x 63 %, rival 2 en x 38,5 % y rival 3 en x 14 %.
 *   v.mano(lista, jugables)        muestra abajo las fichas del jugador 0; jugables = índices que se pueden poner (se levantan y brillan;
 *                                  las demás quedan en gris). Si jugables está vacío no se agrisa ninguna.
 *   v.rivales([n1, n2, n3])        cuántas fichas tiene cada rival (se ven de espaldas); con 2 jugadores solo n1
 *   v.poner(ficha, lado, j, cb)    el jugador j pone la ficha en el extremo 'izq' o 'der' de la mesa (la primera va al centro); luego cb()
 *                                  Si j es 0, llama a poner() ANTES de volver a llamar a mano().
 *   v.extremos()                   → { izq: número, der: número } o null si la mesa está vacía
 *   v.robar(j, cb)                 una ficha se desliza del pozo al jugador j
 *   v.pozo(n)                      cuántas fichas quedan en el pozo
 *   v.marcarExtremos(si)           muestra los dos sitios donde se puede poner (cuando hay que elegir lado)
 *   v.fichaManoEn(x, y)            índice de la ficha de la mano bajo el dedo, o -1
 *   v.ladoEn(x, y)                 'izq' | 'der' | null según el sitio marcado que tocó el dedo
 *   v.reiniciar()                  limpia la mesa para otra mano
 *   v.celebrar()                   confeti
 *   v.ocupado()                    true mientras hay una animación en curso
 *
 * Opcionales (nuevos; no hace falta usarlos):
 *   v.marcarExtremos(si, ficha)    con la ficha elegida el sitio marcado toma su forma (un doble va atravesado)
 *   v.rivales(ns, listas)          listas = [[fichas del rival 1], ...] las muestra boca arriba (para el final de la mano)
 *   v.turno(j)                     ilumina el asiento de quien juega (j = -1 o null lo apaga)
 *   v.ultima(j)                    aviso rojo que late en el asiento de j (le queda una sola ficha)
 *   v.temblar(fuerza)              sacude la mesa (tranca); fuerza 1 por defecto
 *   v.zona(x0, y0, x1, y1)         cambia el rectángulo de la pantalla (fracciones 0..1) donde debe caber la cadena
 * Todas las animaciones avanzan solo con update(dt).
 */
(function () {
  'use strict';
  const { V, std, tex, clamp } = OJ;
  const PUNTOS = { 0: [], 1: [[.5, .5]], 2: [[.27, .26], [.73, .74]], 3: [[.26, .25], [.5, .5], [.74, .75]], 4: [[.27, .26], [.73, .26], [.27, .74], [.73, .74]], 5: [[.27, .25], [.73, .25], [.5, .5], [.27, .75], [.73, .75]], 6: [[.27, .23], [.73, .23], [.27, .5], [.73, .5], [.27, .77], [.73, .77]] };
  const SEP = 0.06, GROS = 0.3, RADIO = 0.07;                 // separación entre fichas, grosor y radio del canto (la ficha mide 1 x 2)
  const FOV = 30, DIST = 10 / Math.tan(FOV * Math.PI / 360);  // a esa distancia la pantalla abarca 20 unidades de alto
  const INCL = 0.13;                                          // inclinación de la cámara (rad): casi cenital, lo justo para ver el canto
  const T_VUELO = 0.4, T_REBOTE = 0.15, REPISA = 0.5;         // la repisa de la mano sobresale 0.5 del paño
  const EJE_Y = V(0, 1, 0), DOS_PI = Math.PI * 2;
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const disco = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, DOS_PI); g.fill(); };
  const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* Caja de cantos redondeados nítidos (4 tramos por canto) con las 6 caras separadas; las caras de arriba y abajo
     llevan la textura proyectada plana para que no se deforme en el canto. */
  function cajaSuave(w, h, d, r) {
    const g = new THREE.BoxGeometry(w, h, d, 5, 5, 5), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const H = [w / 2, h / 2, d / 2], k = 0.586 * r, v = [0, 0, 0];
    const linea = (x, hh) => { const a = Math.abs(x) / hh, s = x < 0 ? -1 : 1; return a > 0.9 ? x : s * (hh - (a > 0.5 ? k : r)); };
    for (let i = 0; i < P.count; i++) {
      v[0] = linea(P.getX(i), H[0]); v[1] = linea(P.getY(i), H[1]); v[2] = linea(P.getZ(i), H[2]);
      const c = v.map((x, e) => clamp(x, -(H[e] - r), H[e] - r)); let n = [v[0] - c[0], v[1] - c[1], v[2] - c[2]];
      let l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-9) { n = [N.getX(i), N.getY(i), N.getZ(i)]; l = 1; }
      n = n.map(x => x / l); N.setXYZ(i, n[0], n[1], n[2]); P.setXYZ(i, c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r);
      if (i >= 72 && i < 144) U.setXY(i, P.getX(i) / w + 0.5, i < 108 ? 0.5 - P.getZ(i) / d : 0.5 + P.getZ(i) / d);
    }
    return g;
  }

  /* ---------------- texturas ---------------- */
  function punto(g, x, y, r) {            // punto negro hundido: filo claro, borde en sombra y fondo más oscuro hacia la orilla
    g.fillStyle = 'rgba(255,255,255,.9)'; disco(g, x, y, r + 2.8);
    g.fillStyle = 'rgba(60,44,22,.7)'; disco(g, x, y, r + 1.3);
    const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r); gr.addColorStop(0, '#111113'); gr.addColorStop(0.6, '#060607'); gr.addColorStop(1, '#000000');
    g.fillStyle = gr; disco(g, x, y, r);
  }
  const pintaCara = (a, b) => (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#fcf7ea'); gr.addColorStop(0.5, '#f7f0df'); gr.addColorStop(1, '#f0e7d1');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 30; k++) {        // veta fina del marfil
      const x = OJ.rnd() * w; g.strokeStyle = 'rgba(150,116,66,' + (0.02 + OJ.rnd() * 0.035).toFixed(3) + ')'; g.lineWidth = 0.6 + OJ.rnd() * 1.6;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (OJ.rnd() - .5) * 28, h * .33, x + (OJ.rnd() - .5) * 28, h * .66, x + (OJ.rnd() - .5) * 18, h); g.stroke();
    }
    for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(120,90,46,0.02)'; g.lineWidth = 6 + i * 5; g.strokeRect(0, 0, w, h); }   // la orilla un poco más oscura
    const y = h / 2;                      // ranura central
    g.fillStyle = 'rgba(255,255,255,.8)'; rr(g, w * .12 - 2, y - 6, w * .76 + 4, 12, 6); g.fill();
    const gl = g.createLinearGradient(0, y - 4, 0, y + 4); gl.addColorStop(0, '#050403'); gl.addColorStop(0.5, '#1c1814'); gl.addColorStop(1, '#050403');
    g.fillStyle = gl; rr(g, w * .12, y - 3.6, w * .76, 7.2, 3.6); g.fill();
    g.fillStyle = 'rgba(40,26,6,.55)'; disco(g, w / 2, y, w * .058 + 2.6);         // remache dorado
    const go = g.createRadialGradient(w / 2, y, 0, w / 2, y, w * .058); go.addColorStop(0, '#fff7cf'); go.addColorStop(0.32, '#f3c95f'); go.addColorStop(0.78, '#bd8620'); go.addColorStop(1, '#6b470b');
    g.fillStyle = go; disco(g, w / 2, y, w * .058);
    [[a, 0], [b, h / 2]].forEach(p => PUNTOS[p[0]].forEach(q => punto(g, q[0] * w, p[1] + q[1] * h / 2, w * 0.088)));
  };
  const pintaDorso = (g, w, h) => {       // dorso propio: paño vino con filete dorado y un sol de ocho puntas
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, h * .62); gr.addColorStop(0, '#8c1c2e'); gr.addColorStop(1, '#4a0914');
    g.fillStyle = gr; rr(g, 11, 11, w - 22, h - 22, 22); g.fill();
    g.save(); rr(g, 11, 11, w - 22, h - 22, 22); g.clip(); g.strokeStyle = 'rgba(255,214,130,.11)'; g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i, 0); g.lineTo(i - h, h); g.stroke(); }
    g.restore();
    g.strokeStyle = '#e6bb52'; g.lineWidth = 5; rr(g, 25, 25, w - 50, h - 50, 14); g.stroke();
    g.strokeStyle = 'rgba(230,187,82,.65)'; g.lineWidth = 2; rr(g, 35, 35, w - 70, h - 70, 9); g.stroke();
    const cx = w / 2, cy = h / 2, sol = g.createRadialGradient(cx, cy, 4, cx, cy, 62); sol.addColorStop(0, '#fff0b0'); sol.addColorStop(0.6, '#e9bd50'); sol.addColorStop(1, '#b07a1c');
    g.fillStyle = sol; g.beginPath();
    for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8, r = i % 2 ? 27 : (i % 4 ? 46 : 62); g.lineTo(cx + Math.sin(an) * r, cy - Math.cos(an) * r); }
    g.closePath(); g.fill();
    g.fillStyle = '#5a0c18'; disco(g, cx, cy, 19); g.fillStyle = '#f0c85c'; disco(g, cx, cy, 9);
    [cy - 150, cy + 150].forEach(yy => { g.fillStyle = '#e6bb52'; g.beginPath(); g.moveTo(cx, yy - 20); g.lineTo(cx + 13, yy); g.lineTo(cx, yy + 20); g.lineTo(cx - 13, yy); g.closePath(); g.fill(); });
  };
  const pintaPano = (g, w, h) => {        // paño: fieltro verde con mota fina y pelusa
    g.fillStyle = '#16663f'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 22; k++) {
      const x = OJ.rnd() * w, y = OJ.rnd() * h, r = 50 + OJ.rnd() * 110, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, k % 2 ? 'rgba(255,255,255,.012)' : 'rgba(0,20,8,.02)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 15000; k++) { g.fillStyle = k % 2 ? 'rgba(235,255,240,.05)' : 'rgba(0,16,6,.085)'; g.fillRect(OJ.rnd() * w, OJ.rnd() * h, 1 + OJ.rnd() * 1.3, 1 + OJ.rnd() * 1.3); }
    g.lineWidth = 1;
    for (let k = 0; k < 2400; k++) { const x = OJ.rnd() * w, y = OJ.rnd() * h, an = OJ.rnd() * 6.3, l = 3 + OJ.rnd() * 6; g.strokeStyle = k % 3 ? 'rgba(210,255,225,.04)' : 'rgba(0,14,6,.06)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke(); }
  };
  const pintaMadera = (g, w, h) => {      // nogal oscuro barnizado
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c190d'); gr.addColorStop(0.5, '#1f1108'); gr.addColorStop(1, '#2a180c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 420; k++) { g.fillStyle = k % 3 ? 'rgba(8,3,0,' + (0.05 + OJ.rnd() * 0.16).toFixed(3) + ')' : 'rgba(205,135,70,' + (0.02 + OJ.rnd() * 0.06).toFixed(3) + ')'; g.fillRect(OJ.rnd() * w - 60, OJ.rnd() * h, 50 + OJ.rnd() * 320, 1 + OJ.rnd() * 2.6); }
  };

  OJ.Domino3D = function (opt) {
    opt = Object.assign({ jugadores: 2 }, opt);
    const NJ = opt.jugadores === 4 ? 4 : 2;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, (OJ.W || 9) / (OJ.H || 16), 6, 90);
    const view = { scene, cam, exposure: 1.1, nombre: 'domino' };
    scene.add(cam); OJ.semilla(47);
    scene.background = new THREE.Color(0x040b07);
    const camBase = V(0, Math.cos(INCL) * DIST, Math.sin(INCL) * DIST);
    const propios = [], guarda = o => { propios.push(o); return o; };       // lo que hay que soltar a mano al salir
    /* fracciones de la pantalla donde va cada cosa */
    const F = { rivY: 0.274, zx0: 0.04, zy0: 0.325, zx1: 0.96, zy1: 0.70, zx1Pozo: 0.88, repisa: 0.72, baranda: 0.115, manoY0: 0.742, manoY1: 0.858, mano2Y0: 0.735, mano2Y1: 0.897, pozoX: 0.94, pozoY: 0.5, rivX0: NJ === 2 ? 0.08 : 0.03, rivX1: 0.74 };
    const L = { zona: { x0: -4, x1: 4, x1p: 3, z0: -3, z1: 3, cx: 0 }, escMax: 1, mano: {}, riv: [], pozo: V(0, 0, 0), pozoEsc: 0.6, visW: 11, zArr: -10, zAb: 10 };

    /* ---------------- luz y ambiente ---------------- */
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x1a2a20, 0.5));
    const lamp = new THREE.DirectionalLight(0xffebc8, 1.15); lamp.position.set(-17, 27, -13); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048);
    Object.assign(lamp.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 6, far: 66 }); lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.015; scene.add(lamp);
    OJ.entorno(scene, '#4a3d2e', '#0a0f0c', [{ p: [-5, 44, -8], w: 30, h: 30, c: 0xfff0d6, f: 4.5 }, { p: [34, 14, 22], w: 22, h: 14, c: 0xc4d8ff, f: 1.1 }, { p: [-34, 12, 10], w: 18, h: 12, c: 0xffd9a0, f: 0.9 }]);

    /* ---------------- mesa: paño con viñeta, baranda arriba y repisa abajo ---------------- */
    const panoT = tex(512, 512, pintaPano, 4, 4);
    const panoG = new THREE.PlaneGeometry(1, 1, 40, 40).rotateX(-Math.PI / 2);
    {
      const p = panoG.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {   // luz de lámpara: claro y cálido al centro, oscuro hacia las orillas
        const r = Math.hypot(p.getX(i) * 2.25, (p.getZ(i) + 0.01) * 2.25), f = 1.02 - 0.74 * suave(0.12, 1.05, r);
        c[i * 3] = f * 1.0; c[i * 3 + 1] = f * 0.99; c[i * 3 + 2] = f * 0.9;
      }
      panoG.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    const pano = new THREE.Mesh(panoG, std({ map: panoT, roughness: 1, metalness: 0, envMapIntensity: 0.12, vertexColors: true })); pano.receiveShadow = true; scene.add(pano);
    const maderaT = tex(512, 512, pintaMadera, 8, 2.4);
    const maderaM = std({ map: maderaT, roughness: 0.5, metalness: 0, envMapIntensity: 0.16 });
    const tablaG = cajaSuave(48, REPISA, 12, 0.16);
    const repisa = new THREE.Mesh(tablaG, maderaM); repisa.castShadow = true; repisa.receiveShadow = true; scene.add(repisa);
    const baranda = new THREE.Mesh(tablaG, maderaM); baranda.castShadow = true; baranda.receiveShadow = true; scene.add(baranda);
    const oroM = std({ color: 0xe0ad4a, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
    const fileteG = new THREE.BoxGeometry(48, 0.04, 0.09);
    const filete1 = new THREE.Mesh(fileteG, oroM), filete2 = new THREE.Mesh(fileteG, oroM); scene.add(filete1); scene.add(filete2);
    /* sombra pegada al paño junto a la repisa y la baranda (da relieve aunque el celular apague las sombras) */
    const bordeT = tex(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.72)'); gr.addColorStop(0.35, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const GQ = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const bordeM = new THREE.MeshBasicMaterial({ map: bordeT, transparent: true, depthWrite: false });
    const sombraAb = new THREE.Mesh(GQ, bordeM), sombraArr = new THREE.Mesh(GQ, bordeM); scene.add(sombraAb); scene.add(sombraArr);

    /* ---------------- fichas ---------------- */
    const G = cajaSuave(1, GROS, 2, RADIO);
    const GP = new THREE.PlaneGeometry(1.6, 256 / 208 * 2).rotateX(-Math.PI / 2);         // plano de halos y sombras: la ficha ocupa el centro
    const marfil = std({ color: 0xf1e9d5, roughness: 0.4, metalness: 0, envMapIntensity: 0.4 });
    const marfilG = guarda(std({ color: 0x6a6865, roughness: 0.7, metalness: 0, envMapIntensity: 0.1 }));
    const dorsoT = tex(256, 512, pintaDorso), dorsoM = std({ map: dorsoT, roughness: 0.45, metalness: 0, envMapIntensity: 0.14 });
    const matsDorso = [marfil, marfil, marfil, dorsoM, marfil, marfil];
    const caras = {}, matsN = {}, matsG = {};
    function mats(f, gris) {              // un material por cara de ficha, en caché (y su versión gris para las que no se pueden jugar)
      const k = f[0] + '-' + f[1];
      if (!caras[k]) { caras[k] = guarda(tex(256, 512, pintaCara(f[0], f[1]))); matsN[k] = [marfil, marfil, guarda(std({ map: caras[k], roughness: 0.5, metalness: 0, envMapIntensity: 0.1 })), dorsoM, marfil, marfil]; }
      if (gris && !matsG[k]) matsG[k] = [marfilG, marfilG, guarda(std({ map: caras[k], color: 0x6f6d6a, roughness: 0.7, metalness: 0, envMapIntensity: 0.05 })), dorsoM, marfilG, marfilG];
      return gris ? matsG[k] : matsN[k];
    }
    const sombraT = tex(128, 256, (g, w, h) => { g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 20; g.fillStyle = 'rgba(0,0,0,.8)'; rr(g, 27, 27, w - 54, h - 54, 10); g.fill(); });
    const aroT = tex(128, 256, (g, w, h) => {
      g.shadowColor = '#fff'; g.shadowBlur = 13; g.strokeStyle = '#fff'; g.lineWidth = 5; rr(g, 24, 24, w - 48, h - 48, 9); g.stroke(); g.stroke();
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, 24, 24, w - 48, h - 48, 9); g.fill();
      g.shadowBlur = 6; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 17, 0, DOS_PI); g.stroke();
    });
    const luzT = tex(128, 256, (g, w, h) => { g.shadowColor = '#fff'; g.shadowBlur = 18; g.fillStyle = '#fff'; rr(g, 30, 30, w - 60, h - 60, 12); g.fill(); });
    const sombraM = new THREE.MeshBasicMaterial({ map: sombraT, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
    const brillo = (t, color, op) => new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity: op, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const brilloManoM = guarda(brillo(aroT, 0xffc84a, 0.8));
    [panoG, tablaG, fileteG, GQ, G, GP, marfil, dorsoT, dorsoM, sombraT, aroT, luzT, sombraM, bordeM, maderaM, oroM].forEach(guarda);
    /* ficha tumbada: eje largo en z local, mitad "a" hacia -z y "b" hacia +z, cara hacia +y; bocaAbajo = con el dorso a la vista */
    function nuevaFicha(f, bocaAbajo) {
      const m = new THREE.Mesh(G, f ? mats(f, false) : matsDorso); m.castShadow = true; m.receiveShadow = true;
      m.userData = { f: f || null, obj: V(0, 0, 0), esc: 1, espera: 0, jug: false, brillo: null };
      const s = new THREE.Mesh(GP, sombraM); s.position.y = (bocaAbajo ? 1 : -1) * (GROS / 2 - 0.007); m.add(s); m.userData.sombra = s;
      if (bocaAbajo) m.rotation.z = Math.PI;
      scene.add(m); return m;
    }
    const quitar = m => { if (m.parent) m.parent.remove(m); };

    /* ---------------- cámara y reparto de la pantalla ---------------- */
    const _d = V(0, 0, 0);
    function aMesa(fx, fy, y, out) {      // punto del mundo (a la altura y) que se ve en esa fracción de la pantalla
      _d.set(fx * 2 - 1, 1 - fy * 2, 0.5).unproject(cam).sub(cam.position).normalize();
      return out.copy(cam.position).addScaledVector(_d, (y - cam.position.y) / _d.y);
    }
    const P = (fx, fy, y) => aMesa(fx, fy, y || 0, V(0, 0, 0));
    function distribuir() {
      cam.aspect = (OJ.W || 360) / (OJ.H || 640); cam.updateProjectionMatrix();
      cam.position.copy(camBase); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
      const e0 = P(0, 0), e1 = P(1, 0), e2 = P(0, 1), e3 = P(1, 1), mx = Math.max(Math.abs(e0.x), Math.abs(e1.x), Math.abs(e2.x), Math.abs(e3.x));
      L.visW = P(1, 0.5).x - P(0, 0.5).x; L.zArr = e0.z; L.zAb = e2.z;
      pano.scale.set(mx * 2.5, 1, (e2.z - e0.z) * 1.25); pano.position.set(0, 0, (e0.z + e2.z) / 2); panoT.repeat.set(pano.scale.x / 3.1, pano.scale.z / 3.1);
      const zr = P(0.5, F.repisa, REPISA).z, zb = P(0.5, F.baranda, REPISA).z;
      repisa.position.set(0, REPISA / 2, zr + 6); baranda.position.set(0, REPISA / 2, zb - 6);
      filete1.position.set(0, REPISA + 0.012, zr + 0.3); filete2.position.set(0, REPISA + 0.012, zb - 0.3);
      sombraAb.scale.set(mx * 2.5, 1, -1.1); sombraAb.position.set(0, 0.01, zr - 0.5); sombraArr.scale.set(mx * 2.5, 1, 1.5); sombraArr.position.set(0, 0.01, zb + 0.7);
      // zona de la cadena: el mayor rectángulo recto dentro del trapecio que se ve
      const a = P(F.zx0, F.zy0), b = P(F.zx1, F.zy0), c = P(F.zx0, F.zy1), d = P(F.zx1, F.zy1), bp = P(F.zx1Pozo, F.zy0), dp = P(F.zx1Pozo, F.zy1), Z = L.zona;
      Z.x0 = Math.max(a.x, c.x); Z.x1 = Math.min(b.x, d.x); Z.x1p = Math.min(Z.x1, bp.x, dp.x); Z.z0 = a.z; Z.z1 = c.z; Z.cx = (Z.x0 + Z.x1) / 2;
      L.escMax = clamp((Z.x1 - Z.x0) / 10, 0.55, 0.95);
      // mano
      const M = L.mano, yM = REPISA;
      M.z0 = P(0.5, F.manoY0, yM).z; M.z1 = P(0.5, F.manoY1, yM).z; M.z0b = P(0.5, F.mano2Y0, yM).z; M.z1b = P(0.5, F.mano2Y1, yM).z;
      M.ancho = (P(1, F.manoY0, yM).x - P(0, F.manoY0, yM).x) * 0.95;
      // rivales
      const wr = P(1, F.rivY).x - P(0, F.rivY).x, zR = P(0.5, F.rivY).z;
      const nr = NJ - 1, hueco = 0.025, cada = (F.rivX1 - F.rivX0 - hueco * (nr - 1)) / nr;        // las filas rivales dejan libre la derecha (panel de puntos)
      L.riv = []; for (let r = 0; r < nr; r++) { const k = nr - 1 - r; L.riv.push({ x: (F.rivX0 + cada / 2 + k * (cada + hueco) - 0.5) * wr, z: zR, ancho: cada * wr, max: NJ === 2 ? 0.58 : 0.5, min: NJ === 2 ? 0.42 : 0.46 }); }
      // pozo
      aMesa(F.pozoX, F.pozoY, 0, L.pozo); L.pozoEsc = Math.min(0.66, L.visW * 0.058);
      if (!cadena.length) elegirLargo();
    }

    /* ---------------- cadena sobre la mesa ----------------
       Se arma en unidades de ficha (1 x 2) dentro de un grupo que se achica y se centra solo para caber en su zona
       (equivale a alejar la cámara). La fila central va de -XI a XD; la punta derecha dobla hacia abajo y la izquierda hacia arriba,
       así nunca se cruzan. Cada vuelta es una ficha en vertical pegada a la última mitad de la fila, y la fila siguiente arranca
       al otro extremo de esa ficha, alineada con su borde: el paso entre filas es siempre 3 + 2·SEP (queda una ficha de aire entre filas,
       así ni los dobles de dos filas vecinas se tocan) y ninguna ficha puede montarse sobre otra. */
    const cadenaG = new THREE.Group(); scene.add(cadenaG);
    let cadena = [], ext = null, anims = [], tt = 0, XD = 8.25, XI = 6.2, pozoN = 0;
    const cur = { izq: null, der: null }, TZ = { izq: -1, der: 1 };
    let gS = 1, gX = 0, gZ = 0, oS = 1, oX = 0, oZ = 0, salto = true;
    function elegirLargo() {             // largo de las filas: el que deja caber 4 filas en la zona; nunca menos de 6 fichas acostadas (7 en pantallas 9:16)
      const Z = L.zona, obj = opt.largo || clamp((Z.x1p - Z.x0) / (Z.z1 - Z.z0) * (3 * (3 + 2 * SEP) + 2.8) - 0.2, 12.3, 24);
      const n = Math.max(NJ === 4 && !opt.largo ? 6 : 2, Math.floor((obj - 2 + SEP + 0.03) / (2 + SEP))), nd = Math.ceil(n / 2);       // con 4 jugadores la cadena crece más: filas más largas
      XD = 1 + nd * (2 + SEP) + 0.001; XI = 1 + (n - nd) * (2 + SEP) + 0.001;
    }
    /* Dónde iría la próxima ficha en ese extremo (no cambia nada). Devuelve el centro (x, z), el eje largo (ox, oz) apuntando de la mitad
       que empata hacia la libre, las medias medidas (hx, hz) y el cursor siguiente. */
    function calc(lado, doble) {
      const c = cur[lado], g = SEP, tz = TZ[lado];
      if (c.esq) {                         // viene de la ficha de la esquina: arranca la fila nueva hacia rx
        const px = c.x, pz = c.z + c.dz * (g + 0.5), rx = c.esq;
        return { x: px + rx * 0.5, z: pz, ox: rx, oz: 0, hx: 1, hz: 0.5, sig: { x: px + rx * 1.5, z: pz, dx: rx, dz: 0, esq: 0 } };
      }
      // Sigue derecho mientras quepa en la fila: las fichas acostadas en la dirección de la fila y los dobles atravesados y centrados.
      // La fila siempre termina en una ficha acostada (de ella cuelga la esquina): un doble va atravesado solo si después de él cabe
      // otra ficha acostada; si no, el propio doble se acuesta como última ficha de la fila o, si ya no cabe, hace de esquina.
      const pos = c.x * c.dx, lim = c.dx > 0 ? XD : XI, cabe = pos + g + 2 <= lim;
      if (doble && pos + g + 1 + g + 2 <= lim) return { x: c.x + c.dx * (g + 0.5), z: c.z, ox: 0, oz: 1, hx: 0.5, hz: 1, sig: { x: c.x + c.dx * (g + 1), z: c.z, dx: c.dx, dz: 0, esq: 0 } };
      if (cabe) return { x: c.x + c.dx * (g + 1), z: c.z, ox: c.dx, oz: 0, hx: 1, hz: 0.5, sig: { x: c.x + c.dx * (g + 2), z: c.z, dx: c.dx, dz: 0, esq: 0 } };
      const px = c.x - c.dx * 0.5;         // esquina en «L»: la ficha cuelga (o sube) pegada a la última mitad de la fila
      return { x: px, z: c.z + tz * (1.5 + g), ox: 0, oz: tz, hx: 0.5, hz: 1, sig: { x: px, z: c.z + tz * (2.5 + g), dx: 0, dz: tz, esq: -c.dx } };
    }
    function encuadrar() {                // escala y posición que debe tomar el grupo para que quepa la cadena (y el sitio siguiente de cada punta)
      let x0 = -1, x1 = 1, z0 = -1, z1 = 1;
      const mete = c => { x0 = Math.min(x0, c.x - c.hx); x1 = Math.max(x1, c.x + c.hx); z0 = Math.min(z0, c.z - c.hz); z1 = Math.max(z1, c.z + c.hz); };
      cadena.forEach(mete);
      if (ext) { mete(calc('izq', false)); mete(calc('der', false)); }
      const mg = 0.14, bw = x1 - x0 + mg * 2, bh = z1 - z0 + mg * 2, Z = L.zona, zx1 = pozoN > 0 ? Z.x1p : Z.x1;
      oS = Math.min(L.escMax, (zx1 - Z.x0) / bw, (Z.z1 - Z.z0) / bh);
      const cx = clamp(Z.cx, Z.x0 + oS * bw / 2, Math.max(Z.x0 + oS * bw / 2, zx1 - oS * bw / 2));
      oX = cx - oS * (x0 + x1) / 2; oZ = (Z.z0 + Z.z1) / 2 - oS * (z0 + z1) / 2;
    }
    view.extremos = () => (ext ? { izq: ext.izq, der: ext.der } : null);
    view.ocupado = () => anims.length > 0;
    view.reiniciar = function () {
      anims.forEach(a => quitar(a.m)); anims = [];
      cadenaG.add(aro); cadenaG.add(luz); aro.visible = luz.visible = false;
      cadena.forEach(c => quitar(c.m)); cadena = []; ext = null; cur.izq = cur.der = null;
      marcas.forEach(m => { m.visible = false; });
      elegirLargo(); encuadrar(); salto = true;
    };

    /* ---------------- mano del jugador ---------------- */
    let manoMs = [], manoL = [], jug = [], llegada = null;
    function ordenarMano() {
      const n = manoMs.length; if (!n) return;
      const M = L.mano, dos = n > 7, porFila = dos ? Math.ceil(n / 2) : n;
      const largo = dos ? (M.z1b - M.z0b - 0.14) / 2 : M.z1 - M.z0;
      const esc = Math.min(largo / 2, M.ancho / Math.max(porFila, dos ? 5 : 6) * 0.9), paso = Math.min(M.ancho / porFila, esc * 1.14);
      manoMs.forEach((m, i) => {
        const fila = dos && i >= porFila ? 1 : 0, k = fila ? i - porFila : i, nf = fila ? n - porFila : porFila, sube = jug.indexOf(i) >= 0, u = m.userData;
        const z = dos ? (fila ? M.z1b - esc : M.z0b + esc) : (M.z0 + M.z1) / 2;
        u.obj.set((k - (nf - 1) / 2) * paso, REPISA + GROS / 2 * esc + 0.13 * esc + (sube ? 0.1 : 0), z - (sube ? esc * 0.17 : 0));
        u.esc = esc; u.jug = sube; m.material = mats(u.f, jug.length > 0 && !sube);
        if (sube && !u.brillo) { u.brillo = new THREE.Mesh(GP, brilloManoM); u.brillo.position.y = -GROS / 2 - 0.02; u.brillo.scale.set(1.06, 1, 1.04); m.add(u.brillo); }
        if (u.brillo) u.brillo.visible = sube;
      });
    }
    view.mano = function (lista, jugables) {
      const viejas = manoMs; manoMs = []; manoL = lista.map(f => [f[0], f[1]]); jug = (jugables || []).slice();
      const nuevas = [];
      manoL.forEach(f => {
        const k = viejas.findIndex(m => m && m.userData.f[0] === f[0] && m.userData.f[1] === f[1]); let m;
        if (k >= 0) { m = viejas[k]; viejas[k] = null; } else { m = nuevaFicha(f); m.rotation.x = 0.1; nuevas.push(m); }
        manoMs.push(m);
      });
      viejas.forEach(m => { if (m) quitar(m); });
      ordenarMano();
      const todas = nuevas.length === manoMs.length;          // reparto: suben desde abajo una tras otra; la robada llega desde donde aterrizó
      nuevas.forEach(m => {
        const u = m.userData, i = manoMs.indexOf(m);
        if (llegada && !todas) { m.position.copy(llegada); m.scale.setScalar(u.esc * 0.75); }
        else { m.position.set(u.obj.x, u.obj.y, u.obj.z + 3.2); m.scale.setScalar(u.esc); u.espera = todas ? i * 0.045 : 0; }
      });
      llegada = null;
    };

    /* ---------------- rivales y pozo ---------------- */
    const riv = [[], [], []], pozoMs = [];
    function filaRival(r, n) {           // ancho de ficha y paso; si son muchas se achican y luego se solapan como un abanico de cartas
      const R = L.riv[r], esc = clamp(R.ancho / Math.max(n, 1) * 0.86, R.min, R.max), paso = n > 1 ? Math.min(esc / 0.86, (R.ancho - esc) / (n - 1)) : 0;
      return { x: R.x, z: R.z, paso, esc, monta: paso < esc * 1.01 };
    }
    function ordenarRival(r) {
      const ms = riv[r], n = ms.length; if (!n || !L.riv[r]) return; const Fi = filaRival(r, n);
      ms.forEach((m, i) => { m.userData.obj.set(Fi.x + (i - (n - 1) / 2) * Fi.paso, (0.5 + (Fi.monta ? i * 0.1 : 0)) * GROS * Fi.esc, Fi.z); m.userData.esc = Fi.esc; });
    }
    function ajustarRival(r, n, lista) {
      const ms = riv[r];
      if (lista) { while (ms.length) quitar(ms.pop()); lista.forEach(f => ms.push(nuevaFicha(f))); ordenarRival(r); ms.forEach(m => { m.position.copy(m.userData.obj); m.scale.setScalar(m.userData.esc * 0.5); }); return; }
      if (ms.length && ms[0].userData.f) while (ms.length) quitar(ms.pop());          // estaban boca arriba: se vuelven a tapar
      const antes = ms.length;
      while (ms.length > n) quitar(ms.pop());
      while (ms.length < n) ms.push(nuevaFicha(null, true));
      ordenarRival(r);
      for (let i = antes; i < n; i++) { const m = ms[i]; m.position.copy(m.userData.obj); m.scale.setScalar(m.userData.esc * (antes ? 0.4 : 1)); }
    }
    view.rivales = function (ns, listas) {
      for (let r = 0; r < 3; r++) { const li = listas && listas[r]; ajustarRival(r, r < NJ - 1 ? (li ? li.length : Math.max(0, ns[r] | 0)) : 0, r < NJ - 1 ? li : null); }
    };
    const pozoSitio = i => ({ fila: [0, -1, 1][i % 3], niv: Math.floor(i / 3) });      // tres montoncitos: centro, arriba y abajo
    function colocarPozo() {
      const e = L.pozoEsc;
      pozoMs.forEach((m, i) => { const k = pozoSitio(i); m.scale.setScalar(e); m.position.set(L.pozo.x - k.niv * 0.02 * e, (k.niv + 0.5) * GROS * e, L.pozo.z + k.fila * 2.16 * e - k.niv * 0.05 * e); });
    }
    view.pozo = function (n) {
      n = Math.max(0, n | 0); const cambia = (pozoN > 0) !== (n > 0); pozoN = n; const vis = Math.min(n, 15);
      while (pozoMs.length > vis) quitar(pozoMs.pop());
      while (pozoMs.length < vis) pozoMs.push(nuevaFicha(null, true));
      colocarPozo(); if (cambia) encuadrar();
    };
    function asiento(j, out) {            // punto del mundo desde donde sale (o a donde llega) una ficha del jugador j
      if (j === 0 || !L.riv[j - 1]) return out.set(0, REPISA + 0.3, (L.mano.z0 + L.mano.z1) / 2);
      return out.set(L.riv[j - 1].x, 0.2, L.riv[j - 1].z);
    }

    /* ---------------- poner y robar ---------------- */
    const qFin = a => new THREE.Quaternion().setFromAxisAngle(EJE_Y, a);
    view.poner = function (f, lado, j, cb) {
      const doble = f[0] === f[1]; let s, ang;
      if (!ext) {
        const h = doble ? 0.5 : 1; s = { x: 0, z: 0, hx: h, hz: doble ? 1 : 0.5 }; ang = doble ? 0 : Math.PI / 2;
        cur.der = { x: h, z: 0, dx: 1, dz: 0, esq: 0 }; cur.izq = { x: -h, z: 0, dx: -1, dz: 0, esq: 0 };
        ext = { izq: f[0], der: f[1] };
      } else {
        if (lado !== 'izq') lado = 'der';
        s = calc(lado, doble); const toca = ext[lado];
        ang = doble || f[0] === toca ? Math.atan2(s.ox, s.oz) : Math.atan2(-s.ox, -s.oz);
        ext[lado] = f[0] === toca ? f[1] : f[0]; cur[lado] = s.sig;
      }
      let m = null;
      if (j === 0) {
        const i = manoL.findIndex(x => x[0] === f[0] && x[1] === f[1]);
        if (i >= 0) { m = manoMs[i]; manoMs.splice(i, 1); manoL.splice(i, 1); jug = []; if (m.userData.brillo) m.userData.brillo.visible = false; m.material = mats(f, false); ordenarMano(); }
      }
      if (!m) {
        m = nuevaFicha(f); const ms = riv[j - 1], v = ms && ms.length ? ms.splice(Math.floor(ms.length / 2), 1)[0] : null;
        if (v) { m.position.copy(v.position); m.scale.copy(v.scale); quitar(v); ordenarRival(j - 1); }
        else { asiento(j, m.position); m.scale.setScalar(j === 0 ? 1 : filaRival(j - 1, 7).esc); }
        m.rotation.z = Math.PI;             // sale de espaldas y se voltea en el aire
      }
      m.userData.sombra.visible = false;
      cadena.push({ m, f: [f[0], f[1]], ang, x: s.x, z: s.z, hx: s.hx, hz: s.hz }); marcas.forEach(k => { k.visible = false; });
      encuadrar();
      anims.push({ tipo: 0, m, t: 0, p0: m.position.clone(), q0: m.quaternion.clone(), q1: qFin(ang), e0: m.scale.x, lx: s.x, lz: s.z, giro: (cadena.length % 2 ? 1 : -1) * Math.PI, toco: false, cb });
    };
    view.robar = function (j, cb) {
      const m = nuevaFicha(null, true), e = L.pozoEsc; m.userData.sombra.visible = false;
      { const k = pozoSitio(pozoMs.length); m.position.set(L.pozo.x, (k.niv + 0.5) * GROS * e, L.pozo.z + k.fila * 2.16 * e); } m.scale.setScalar(e);
      const p1 = asiento(j, V(0, 0, 0)), r = j - 1; let e1 = e;
      if (j === 0) { e1 = manoMs.length ? manoMs[0].userData.esc : 1; p1.x = Math.min(L.mano.ancho / 2 - 0.6, (manoMs.length ? manoMs[manoMs.length - 1].userData.obj.x : 0) + e1 * 1.1); }
      else if (L.riv[r]) { const Fi = filaRival(r, riv[r].length + 1); e1 = Fi.esc; p1.x += (riv[r].length / 2) * Fi.paso; p1.y = GROS / 2 * e1; }
      anims.push({ tipo: 1, m, t: 0, p0: m.position.clone(), p1, e0: e, e1, j, cb });
    };

    /* ---------------- sitios marcados, destello y toques ---------------- */
    const marcas = ['izq', 'der'].map(l => { const m = new THREE.Mesh(GP, guarda(brillo(aroT, 0xffd640, 0.9))); m.visible = false; m.userData.l = l; m.renderOrder = 2; cadenaG.add(m); return m; });
    view.marcarExtremos = function (si, ficha) {
      const doble = !!ficha && ficha[0] === ficha[1];
      marcas.forEach(m => { m.visible = !!si && !!ext; if (m.visible) { const s = calc(m.userData.l, doble); m.position.set(s.x, 0.03, s.z); m.rotation.y = Math.atan2(s.ox, s.oz); } });
    };
    const aro = new THREE.Mesh(GP, guarda(brillo(aroT, 0xffc23a, 0))), luz = new THREE.Mesh(GP, guarda(brillo(luzT, 0xfff4d8, 0)));
    aro.visible = luz.visible = false; aro.renderOrder = 2; luz.renderOrder = 3; cadenaG.add(aro); cadenaG.add(luz);
    let aroT0 = 9;
    function destellar(m) { m.add(aro); m.add(luz); aro.position.set(0, -GROS / 2 + 0.012, 0); luz.position.set(0, GROS / 2 + 0.012, 0); aro.visible = luz.visible = true; aroT0 = 0; }
    const pt = V(0, 0, 0);
    view.fichaManoEn = function (x, y) {
      if (!manoMs.length) return -1; aMesa(x / OJ.W, y / OJ.H, REPISA + 0.2, pt);
      let mejor = -1, md = 1e9;
      manoMs.forEach((m, i) => { const u = m.userData, dx = Math.abs(pt.x - u.obj.x), dz = Math.abs(pt.z - u.obj.z); if (dx <= u.esc * 0.6 && dz <= u.esc * 1.12 && dx + dz < md) { md = dx + dz; mejor = i; } });
      return mejor;
    };
    view.ladoEn = function (x, y) {
      if (!marcas[0].visible) return null; aMesa(x / OJ.W, y / OJ.H, 0, pt);
      const d = marcas.map(m => Math.hypot(m.position.x * gS + gX - pt.x, m.position.z * gS + gZ - pt.z)), i = d[0] <= d[1] ? 0 : 1;
      return d[i] < Math.max(1.7 * gS, 1.35) ? marcas[i].userData.l : null;
    };

    /* ---------------- luces de asiento, temblor y confeti ---------------- */
    const focos = []; for (let j = 0; j < NJ; j++) { const m = new THREE.Mesh(GQ, guarda(brillo(OJ.dotTex, j ? 0xffd27a : 0xffc860, 0))); m.visible = false; m.renderOrder = 1; scene.add(m); focos.push(m); }
    const alerta = new THREE.Mesh(GQ, guarda(brillo(OJ.dotTex, 0xff4a2a, 0))); alerta.visible = false; alerta.renderOrder = 1; scene.add(alerta);
    let turnoJ = -1, alertaT = 9, tiembla = 0, tiemblaF = 1;
    function ponerFoco(m, j) {
      if (j === 0) { m.position.set(0, REPISA + 0.02, (L.mano.z0 + L.mano.z1) / 2); m.scale.set(L.visW * 1.25, 1, (L.mano.z1 - L.mano.z0) * 2.3); }
      else if (L.riv[j - 1]) { const R = L.riv[j - 1]; m.position.set(R.x, 0.02, R.z); m.scale.set(R.ancho * 1.25 + 1.2, 1, 3.4); }
    }
    view.turno = function (j) { turnoJ = j == null ? -1 : j; };
    view.ultima = function (j) { if (j >= 0 && j < NJ) { ponerFoco(alerta, j); alertaT = 0; } };
    view.temblar = function (fuerza) { tiembla = 0.5; tiemblaF = fuerza || 1; };
    view.zona = function (x0, y0, x1, y1) { F.zx0 = x0; F.zy0 = y0; F.zx1 = x1; F.zy1 = y1; F.zx1Pozo = Math.min(F.zx1Pozo, x1); distribuir(); encuadrar(); };
    const NC = 160, cPos = new Float32Array(NC * 3), cCol = new Float32Array(NC * 3), cVel = new Float32Array(NC * 3), cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    const cMat = new THREE.PointsMaterial({ size: 0.36, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false });
    const cPts = new THREE.Points(cGeo, cMat); cPts.frustumCulled = false; cPts.visible = false; cPts.renderOrder = 5; scene.add(cPts);
    const chispas = [0xffd34d, 0xffffff].map(c => new OJ.Chispas(scene, 60, c, 0.5));
    const PAPEL = [[1, .82, .1], [.1, .3, .95], [.92, .12, .16], [1, 1, 1], [.2, .85, .45], [1, .5, .1]];
    let cVida = 0;
    view.celebrar = function () {
      const alto = L.zAb - L.zArr;
      for (let i = 0; i < NC; i++) {
        const c = PAPEL[i % PAPEL.length]; cCol[i * 3] = c[0]; cCol[i * 3 + 1] = c[1]; cCol[i * 3 + 2] = c[2];
        cPos[i * 3] = (Math.random() - 0.5) * L.visW * 1.1; cPos[i * 3 + 1] = 2 + Math.random() * 5; cPos[i * 3 + 2] = L.zArr - 0.5 - Math.random() * alto * 0.9;
        cVel[i * 3] = (Math.random() - 0.5) * 2.4; cVel[i * 3 + 1] = Math.random() * 6.3; cVel[i * 3 + 2] = 7 + Math.random() * 6;
      }
      cGeo.attributes.color.needsUpdate = true; cVida = 3.4; cPts.visible = true;
      chispas.forEach((c, i) => c.explotar(V(gX, 1, (L.zona.z0 + L.zona.z1) / 2), V(0, 5, 0), 2, 6 + i * 3, 1.6));
    };

    /* ---------------- bucle ---------------- */
    const tmp = V(0, 0, 0), qT = new THREE.Quaternion();
    view.resize = function () {
      distribuir(); ordenarMano(); manoMs.forEach(m => { m.position.copy(m.userData.obj); m.scale.setScalar(m.userData.esc); });
      riv.forEach((ms, r) => { ordenarRival(r); ms.forEach(m => { m.position.copy(m.userData.obj); m.scale.setScalar(m.userData.esc); }); });
      colocarPozo(); encuadrar(); salto = true; focos.forEach(ponerFoco);
    };
    view.update = function (dt) {
      tt += dt;
      const k = salto ? 1 : 1 - Math.exp(-dt * 4.2); salto = false;
      gS += (oS - gS) * k; gX += (oX - gX) * k; gZ += (oZ - gZ) * k; cadenaG.scale.setScalar(gS); cadenaG.position.set(gX, 0, gZ);
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i], m = a.m; a.t += dt;
        if (a.tipo === 0) {               // ficha que va a la mesa: vuela girando, cae y rebota
          const u = Math.min(a.t / T_VUELO, 1), e = 1 - Math.pow(1 - u, 2.4);
          tmp.set(a.lx * gS + gX, GROS / 2 * gS, a.lz * gS + gZ);
          m.position.lerpVectors(a.p0, tmp, e); m.position.y += 4 * u * (1 - u) * 1.3;
          m.scale.setScalar(a.e0 + (gS - a.e0) * e);
          m.quaternion.copy(a.q0).slerp(a.q1, e); if (u < 1) m.quaternion.premultiply(qT.setFromAxisAngle(EJE_Y, (1 - e) * a.giro));
          if (u >= 1) {
            if (!a.toco) { a.toco = true; m.userData.sombra.visible = true; destellar(m); OJ.snd.ficha(); OJ.vib(18); }
            const r = (a.t - T_VUELO) / T_REBOTE;
            if (r < 1) { m.position.y += Math.sin(r * Math.PI) * 0.2 * gS; m.rotation.z += Math.sin(r * Math.PI) * 0.05 * (a.giro > 0 ? 1 : -1); }
            else { cadenaG.add(m); m.position.set(a.lx, GROS / 2, a.lz); m.quaternion.copy(a.q1); m.scale.setScalar(1); anims.splice(i, 1); if (a.cb) a.cb(); }
          }
        } else {                          // ficha robada: se desliza de espaldas desde el pozo
          const u = Math.min(a.t / 0.36, 1), e = u * u * (3 - 2 * u);
          m.position.lerpVectors(a.p0, a.p1, e); m.position.y += Math.sin(u * Math.PI) * 0.5; m.scale.setScalar(a.e0 + (a.e1 - a.e0) * e); m.rotation.y = Math.sin(u * Math.PI) * 0.35;
          if (u >= 1) {
            anims.splice(i, 1); OJ.snd.toque();
            if (a.j === 0) { llegada = a.p1.clone(); quitar(m); }
            else if (riv[a.j - 1] && a.j < NJ) { m.rotation.y = 0; m.userData.sombra.visible = true; riv[a.j - 1].push(m); ordenarRival(a.j - 1); }
            else quitar(m);
            if (a.cb) a.cb();
          }
        }
      }
      const km = 1 - Math.exp(-dt * 13);
      for (let i = 0; i < manoMs.length; i++) {
        const m = manoMs[i], u = m.userData; if (u.espera > 0) { u.espera -= dt; continue; }
        m.position.lerp(u.obj, km); m.scale.setScalar(m.scale.x + (u.esc - m.scale.x) * km);
      }
      for (let r = 0; r < 3; r++) for (let i = 0; i < riv[r].length; i++) { const m = riv[r][i], u = m.userData; m.position.lerp(u.obj, km); m.scale.setScalar(m.scale.x + (u.esc - m.scale.x) * km); }
      const late = 0.5 + 0.5 * Math.sin(tt * 6);
      brilloManoM.opacity = 0.6 + 0.3 * late;
      marcas.forEach(m => { if (m.visible) { m.material.opacity = 0.55 + 0.45 * late; const s = 1 + 0.05 * late; m.scale.set(s, 1, s); } });
      if (aro.visible) {                  // destello al caer y luego un filo dorado que deja ver cuál fue la última ficha
        aroT0 += dt; const u = Math.min(aroT0 / 0.45, 1);
        aro.material.opacity = 1 - 0.55 * u; const s = 1.22 - 0.2 * u; aro.scale.set(s, 1, 1 + (s - 1) * 0.6);
        luz.material.opacity = 0.75 * Math.max(0, 1 - aroT0 / 0.3); luz.visible = luz.material.opacity > 0.01;
      }
      for (let j = 0; j < focos.length; j++) {
        const m = focos[j], o = j === turnoJ ? (j ? 0.2 : 0.22) + 0.04 * Math.sin(tt * 3) : 0;
        if (o > 0 && !m.visible) ponerFoco(m, j);
        m.material.opacity += (o - m.material.opacity) * (1 - Math.exp(-dt * 7)); m.visible = m.material.opacity > 0.01;
      }
      if (alertaT < 1.6) { alertaT += dt; alerta.material.opacity = Math.max(0, 0.75 * Math.abs(Math.sin(alertaT * 6.3)) * (1 - alertaT / 1.6)); alerta.visible = alertaT < 1.6; }
      if (cVida > 0) {
        cVida -= dt;
        for (let i = 0; i < NC; i++) { cPos[i * 3] += (cVel[i * 3] + Math.sin(tt * 5 + cVel[i * 3 + 1]) * 1.6) * dt; cPos[i * 3 + 2] += cVel[i * 3 + 2] * dt; }
        cGeo.attributes.position.needsUpdate = true; cMat.opacity = clamp(cVida * 1.5, 0, 1); if (cVida <= 0) cPts.visible = false;
      }
      chispas.forEach(c => c.update(dt));
      if (tiembla > 0) {
        tiembla -= dt; const f = Math.max(0, tiembla / 0.5) * 0.16 * tiemblaF;
        cam.position.set(camBase.x + Math.sin(tt * 71) * f, camBase.y, camBase.z + Math.cos(tt * 53) * f);
        if (tiembla <= 0) cam.position.copy(camBase);
      }
    };
    view.dispose = function () { OJ.liberar(scene); propios.forEach(o => { if (o && o.dispose) o.dispose(); }); };
    /* para pruebas: cajas 2D de la cadena en pantalla (px), zona y escala */
    view._prueba = function () {
      const pr = (x, z) => { tmp.set(x * oS + oX, 0, z * oS + oZ).project(cam); return [(tmp.x + 1) / 2 * OJ.W, (1 - tmp.y) / 2 * OJ.H]; };
      return { esc: oS, XD, XI, n: cadena.length, fichas: cadena.map(c => ({ f: c.f, x: c.x, z: c.z, ang: c.ang })), cajas: cadena.map(c => [c.x - c.hx, c.z - c.hz, c.x + c.hx, c.z + c.hz]), px: cadena.map(c => pr(c.x - c.hx, c.z - c.hz).concat(pr(c.x + c.hx, c.z + c.hz))) };
    };

    distribuir(); encuadrar(); focos.forEach(ponerFoco);
    return view;
  };
})();
