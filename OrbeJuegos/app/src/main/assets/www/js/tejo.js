/*
 * Tejo 3D — el tejo colombiano en una cancha al aire libre: pista de tierra, cajón amarillo con greda,
 * bocín y mechas que explotan, kiosco con público y la bandera.
 * Puntos: mano 1 · mecha 3 · embocinada 6 · moñona 9.
 * Cada ronda cada equipo lanza 2 tejos; si nadie revienta mecha ni emboca, la mano (el tejo más cerca del bocín) vale 1.
 */
(function () {
  'use strict';
  const { V, std, tex, planks, noise, mesh, sprite, clamp } = OJ;
  const TILT = 0.78, CT = Math.cos(TILT), ST = Math.sin(TILT);
  const G = 9.8, ELEV = 36 * Math.PI / 180, S_MIN = 6.7, S_MAX = 9.8, DTV = 1 / 120;
  const P0 = V(0, 1.05, 6.75);              // de dónde sale el tejo (la mano del jugador)
  const CAM_Y = 1.9, CAM_Z = 12.3, MECHA_R = 0.25, POR_RONDA = 2;
  const EQ = [{ c: '#1e56c9', hex: 0x1e56c9 }, { c: '#d0202f', hex: 0xd0202f }];
  const SWAY = [0.011, 0.019, 0.028], IA_ANG = [0.034, 0.02, 0.011], IA_VEL = [0.34, 0.2, 0.1], GUIA = [1, 0.62, 0.36];

  /* Trayectoria completa de un lanzamiento (la misma para la guía, la máquina y el tiro real) */
  function tray(phi, s) {
    const ch = Math.cos(ELEV) * s, vx = Math.sin(phi) * ch, vz = -Math.cos(phi) * ch; let vy = Math.sin(ELEV) * s;
    let x = P0.x, y = P0.y, z = P0.z; const pts = [x, y, z]; let fin = null;
    for (let i = 0; i < 420 && !fin; i++) {
      vy -= G * DTV; x += vx * DTV; y += vy * DTV; z += vz * DTV;
      const Y = y - 0.95, ly = Y * CT - z * ST, lz = Y * ST + z * CT, ax = Math.abs(x), ay = Math.abs(ly);
      if (lz <= 0.2 && lz > -0.3 && ax < 1.16 && ay < 1.16 && (ax > 0.99 || ay > 0.99)) fin = { tipo: 'tabla' };
      else if (lz <= 0.03 && lz > -0.3 && ax <= 0.99 && ay <= 0.99) fin = { tipo: 'greda', lx: x, ly };
      else if (z <= -0.86 && y < 2.9 && ax < 1.25) fin = { tipo: 'tabla' };
      else if (y <= 0.04) fin = { tipo: 'piso' };
      else if (z <= -3.2) fin = { tipo: 'pared' };
      pts.push(x, y, z);
    }
    return { pts, fin: fin || { tipo: 'piso' }, vx, vy, vz };
  }
  /* Velocidad necesaria para caer en un punto de la greda (coordenadas de la cancha) */
  function apuntarA(lx, ly) {
    const ty = 0.95 + ly * CT, tz = -ly * ST, dx = lx - P0.x, dz = P0.z - tz, D = Math.hypot(dx, dz), h = ty - P0.y;
    const den = 2 * Math.cos(ELEV) ** 2 * (D * Math.tan(ELEV) - h);
    return { phi: Math.atan2(dx, dz), s: Math.sqrt(G * D * D / den) };
  }

  /* ---------- geometría hecha por código: mallas suaves, cuerpos torneados y piezas unidas ---------- */
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  const M = (p, r, s) => new THREE.Matrix4().compose(V(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0)),
    s == null ? V(1, 1, 1) : (s.length ? V(s[0], s[1], s[2]) : V(s, s, s)));
  const esf = (rx, ry, rz, a, b) => new THREE.SphereGeometry(1, a || 12, b || 8).scale(rx, ry, rz);
  /* Malla de (nu+1)×(nv+1) puntos dados por fn(u, v, o): o[0..2] posición, o[3] y o[4] coordenadas de textura (v, u) */
  function malla(nu, nv, fn, cerrar, inv) {
    const n = (nu + 1) * (nv + 1), P = new Float32Array(n * 3), U = new Float32Array(n * 2), I = [], o = [0, 0, 0, 0, 0];
    for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) {
      o[3] = j / nv; o[4] = i / nu; fn(i / nu, j / nv, o);
      P[k * 3] = o[0]; P[k * 3 + 1] = o[1]; P[k * 3 + 2] = o[2]; U[k * 2] = o[4]; U[k * 2 + 1] = o[3];
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (inv) I.push(a, d, b, a, c, d); else I.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    if (cerrar) coser(g, nu, nv);
    return g;
  }
  function coser(g, nu, nv) {   // iguala las normales de la costura para que no se note
    const N = g.attributes.normal;
    for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu, x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); }
  }
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  /* Cuerpo torneado: anillos [y, radioX, radioZ, centroZ, centroX] unidos con curvas suaves. El frente mira a −z. */
  function loft(an, seg, sub) {
    an = an.map(a => [a[0], a[1], a[2] == null ? a[1] : a[2], a[3] || 0, a[4] || 0]);
    seg = seg || 14; sub = sub || 3;
    const n = an.length - 1, yA = an[0][0], yB = an[n][0];
    const fn = (u, v, o) => {
      const f = Math.min(v * n, n - 1e-6), k = Math.floor(f), t = f - k, A = an[Math.max(k - 1, 0)], B = an[k], C = an[k + 1], D = an[Math.min(k + 2, n)];
      const q = i => cr(A[i], B[i], C[i], D[i], t), th = u * Math.PI * 2, y = q(0);
      o[0] = Math.sin(th) * Math.max(q(1), 1e-4) + q(4); o[1] = y; o[2] = -Math.cos(th) * Math.max(q(2), 1e-4) + q(3);
      o[3] = (y - yA) / (yB - yA); o[4] = 1 - u;
    };
    let g = malla(seg, n * sub, fn, true, false);
    if (g.attributes.normal.getZ(Math.floor(n * sub / 2) * (seg + 1)) > 0) { g.dispose(); g = malla(seg, n * sub, fn, true, true); }
    return g;
  }
  /* Une piezas [geometría, color, matriz] en una sola geometría con color por vértice (una sola llamada de dibujo) */
  function unir(partes) {
    let nv = 0, ni = 0;
    partes.forEach(p => { const g = p[0]; if (p[2]) g.applyMatrix4(p[2]); nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3), I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let vo = 0, io = 0;
    partes.forEach(p => {
      const g = p[0], n = g.attributes.position.count;
      P.set(g.attributes.position.array, vo * 3); N.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, vo * 2);
      if (p[1] == null && g.attributes.color) C.set(g.attributes.color.array, vo * 3);
      else { const c = lin(p[1] == null ? 0xffffff : p[1]); for (let i = 0; i < n; i++) { C[(vo + i) * 3] = c.r; C[(vo + i) * 3 + 1] = c.g; C[(vo + i) * 3 + 2] = c.b; } }
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) I[io++] = a[i] + vo; } else for (let i = 0; i < n; i++) I[io++] = vo + i;
      vo += n; g.dispose();
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setIndex(new THREE.BufferAttribute(I, 1));
    return g;
  }

  /* ---------- piezas del cuerpo humano (se comparten entre el jugador y el público) ---------- */
  const PIEL = 0xb47a52, PELO = 0x241710, JEAN = 0x2c4672, GORRA = 0x111216, TENIS = 0x1d1d22, SUELA = 0xf1efe8;
  const L1 = 0.29, L2 = 0.26, LM = 0.44, LP = 0.43;     // brazo, antebrazo, muslo y pierna
  const torsoL = () => loft([[-0.15, .180, .118, .006], [-0.06, .178, .116, .008], [0.04, .162, .103, .010], [0.16, .170, .108, .012], [0.28, .186, .116, .018], [0.36, .192, .112, .022],
    [0.415, .176, .098, .018], [0.447, .118, .076, .012], [0.468, .068, .062, .006], [0.48, .058, .056, .004]], 24, 3);
  const pelvisL = () => loft([[-.2, .001], [-.185, .08, .07], [-.13, .146, .1, .008], [-.07, .158, .106, .012], [0, .148, .097, .008], [.07, .128, .084, .006]], 18, 3);
  const musloL = () => loft([[.03, .001], [0, .082, .086], [-.07, .098, .102], [-.2, .092, .096], [-.36, .079, .081], [-.44, .072, .074], [-.468, .001]], 14, 3);
  const piernaL = () => loft([[.03, .001], [0, .07, .072], [-.1, .071, .075], [-.24, .066, .069], [-.38, .062, .064], [-.435, .064, .066], [-.44, .03]], 12, 3);
  const anteL = () => loft([[.028, .001], [.008, .038], [-.04, .046, .043], [-.12, .042, .038], [-.22, .032, .028], [-.26, .029, .025], [-.275, .001]], 12, 3);
  const zapatoL = () => unir([[esf(.056, .05, .13, 12, 8), TENIS, M([0, -.04, -.055])], [esf(.054, .05, .075, 10, 6), TENIS, M([0, -.03, .03])],
    [esf(.059, .02, .15, 14, 6), SUELA, M([0, -.068, -.045])], [esf(.045, .026, .05, 8, 5), SUELA, M([0, -.052, -.15])], [esf(.03, .012, .05, 8, 5), SUELA, M([0, .002, -.09])]]);
  /* Brazo de arriba: manga corta con puño de dos colores y la piel hasta el codo */
  const brazoSupL = c => unir([
    [loft([[.05, .001], [.043, .034], [.01, .06, .058], [-.06, .064, .062], [-.13, .062, .06], [-.165, .061, .059]], 14, 3), c[0]],
    [loft([[-.165, .062, .06], [-.18, .062, .06]], 14, 1), c[1]], [loft([[-.18, .0625, .0605], [-.195, .062, .06], [-.197, .04]], 14, 1), c[2]],
    [loft([[-.15, .03], [-.17, .05], [-.24, .047], [-.285, .043], [-.305, .04], [-.318, .001]], 12, 2), PIEL]]);
  /* Mano con dedos: muñeca en el origen, dedos hacia +z, palma hacia +y. lado −1 = derecha */
  function manoL(lado) {
    const p = [[esf(.04, .017, .05, 10, 8), PIEL, M([0, 0, .045])]];
    for (let k = 0; k < 4; k++) {
      const x = (k - 1.5) * .019, c = Math.abs(k - 1.5) * .005;
      p.push([esf(.0098, .0098, .026, 6, 5), PIEL, M([x, .006, .105 - c], [-.45, 0, 0])], [esf(.0092, .0092, .022, 6, 5), PIEL, M([x, .028, .134 - c], [-1.15, 0, 0])]);
    }
    p.push([esf(.012, .011, .03, 6, 5), PIEL, M([lado * .045, .012, .055], [-.3, lado * .7, 0])]);
    return unir(p);
  }
  /* Cabeza con cuello, orejas, pelo y gorra (centro de la cabeza en el origen, la cara mira a −z) */
  function cabezaL(gorra, pelo) {
    const p = [[loft([[-.21, .052], [-.15, .05, .052], [-.07, .046, .05], [-.02, .046, .05]], 12, 2), PIEL], [esf(.088, .112, .1, 20, 14), PIEL],
      [esf(.013, .028, .017, 8, 6), PIEL, M([.089, -.012, .006])], [esf(.013, .028, .017, 8, 6), PIEL, M([-.089, -.012, .006])], [esf(.015, .022, .02, 8, 6), PIEL, M([0, -.012, -.1])],
      [esf(.011, .008, .006, 6, 4), PELO, M([.033, .012, -.091])], [esf(.011, .008, .006, 6, 4), PELO, M([-.033, .012, -.091])],
      [new THREE.SphereGeometry(1, 18, 10, Math.PI / 2 - 1.9, 3.8, 0.3, 1.5).scale(.092, .114, .104), pelo, M([0, -.002, .004])],
      [new THREE.SphereGeometry(1, 16, 5, 0, Math.PI * 2, 0, 0.8).scale(.091, .1145, .102), pelo, M([0, 0, .002])]];
    if (gorra != null) p.push([new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(.097, .1, .108), gorra, M([0, .022, .002], [.1, 0, 0])],
      [new THREE.CylinderGeometry(1, 1, .012, 16, 1, false, Math.PI / 2, Math.PI).scale(.085, 1, .1), gorra, M([0, .032, -.08], [-.1, 0, 0])], [esf(.012, .006, .012, 6, 4), gorra, M([0, .123, .014])]);
    return unir(p);
  }

  OJ.Tejo = function (opt) {
    opt = Object.assign({ modo: 'ia', dif: 1, meta: 27, demo: false }, opt);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.05, 240);
    const game = { scene, cam, exposure: 1.0, nombre: 'tejo' };
    const nombres = opt.modo === 'ia' ? ['Tú', 'Máquina'] : ['Azules', 'Rojos'];
    const esIA = t => opt.demo || (opt.modo === 'ia' && t === 1);
    const rnd = OJ.rnd, extra = [];
    const colM = std({ vertexColors: true, roughness: .8 }), vegM = std({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });

    /* ---------------- paisaje ---------------- */
    OJ.semilla(7);
    scene.background = tex(8, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d69d6'); gr.addColorStop(.2, '#5fa9ee'); gr.addColorStop(.36, '#cfe9ff'); gr.addColorStop(1, '#cfe9ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    scene.fog = new THREE.Fog(0xc4e2f6, 50, 190);
    OJ.entorno(scene, '#3b86e2', '#b9a37c', [{ p: [-18, 30, 22], w: 20, h: 20, c: 0xfff1d6, f: 5 }]);
    const pastoG = new THREE.PlaneGeometry(300, 300, 40, 40);
    { const p = pastoG.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), k = .84 + .2 * Math.sin(x * .11 + 1.3) * Math.sin(y * .13) + .1 * Math.sin(x * .37 + y * .29); c[i * 3] = k * 1.03; c[i * 3 + 1] = k; c[i * 3 + 2] = k * .88; }
      pastoG.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const pasto = mesh(scene, pastoG, std({ vertexColors: true, roughness: 1, map: tex(512, 512, (g, w, h) => {
      noise('#4c9438', ['#5aa844', '#418531', '#67b24e', '#3c7c2e'], 6000, 3.4)(g, w, h);
      for (let k = 0; k < 2600; k++) { const x = rnd() * w, y = rnd() * h; g.strokeStyle = ['rgba(125,190,90,.5)', 'rgba(40,105,40,.5)', 'rgba(150,170,80,.35)'][k % 3]; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 5, y - 3 - rnd() * 6); g.stroke(); }
    }, 60, 60) }), V(0, -0.01, -60), false);
    pasto.rotation.x = -Math.PI / 2; pasto.receiveShadow = true;
    const tierraT = (rx, ry) => tex(512, 1024, (g, w, h) => {
      noise('#ad6c3c', ['rgba(120,70,35,.35)', 'rgba(205,150,100,.3)', 'rgba(90,55,30,.3)', 'rgba(170,110,66,.4)'], 10000, 5)(g, w, h);
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(70,40,18,.3)'); gr.addColorStop(.25, 'rgba(225,180,130,.14)'); gr.addColorStop(.75, 'rgba(225,180,130,.14)'); gr.addColorStop(1, 'rgba(70,40,18,.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 46; k++) { g.save(); g.translate(w * (.2 + rnd() * .6), rnd() * h); g.rotate((rnd() - .5) * .5); g.fillStyle = 'rgba(80,45,22,.2)'; g.beginPath(); g.ellipse(0, 0, 13, 30, 0, 0, 6.3); g.fill(); g.restore(); }
    }, rx, ry);
    const tierraM = std({ map: tierraT(1, 3), roughness: 1 });
    const pista = mesh(scene, new THREE.PlaneGeometry(3.0, 14), tierraM, V(0, 0.004, 4.4), false); pista.rotation.x = -Math.PI / 2; pista.receiveShadow = true;
    const patio = mesh(scene, new THREE.PlaneGeometry(11, 7), std({ map: tierraT(3, 1), roughness: 1, color: 0xf0e2d0 }), V(0, 0.002, -1.1), false); patio.rotation.x = -Math.PI / 2; patio.receiveShadow = true;
    [-1.62, 1.62].forEach(x => mesh(scene, OJ.cajaRedonda(0.16, 0.08, 11, 0.03, 2), std({ color: 0xd8d2c4, roughness: .9 }), V(x, 0.03, 6.2)));
    { const p = []; for (let i = 0; i < 30; i++) { const r = 0.02 + rnd() * 0.03; p.push([esf(r, r * .7, r * 1.2, 7, 5), [0x8a6a4a, 0x9c8468, 0x6f5238][i % 3], M([(rnd() - .5) * 2.6, 0.012, 1.5 + rnd() * 8])]); } mesh(scene, unir(p), colM); }
    // montañas en capas (se aclaran con la distancia), nubes con volumen
    [[-140, 30, '#4f8fa8', '#7fb3c6', 1.7], [-108, 20, '#3f8a66', '#6aa88a', 4.1], [-82, 11, '#3f8f45', '#5fa652', 0.6]].forEach(m => {
      const g = malla(140, 1, (u, v, o) => { o[0] = (u - .5) * 230; o[2] = m[0]; o[1] = -1 + v * m[1] * (.5 + .27 * Math.sin(u * 11 + m[4]) + .15 * Math.sin(u * 27 + m[4] * 2.3) + .07 * Math.sin(u * 63 + m[4] * 5)); });
      const c = new Float32Array(g.attributes.position.count * 3), a = lin(m[2]), b = lin(m[3]);
      for (let i = 0; i < c.length / 3; i++) { const q = i > 140 ? b : a; c[i * 3] = q.r; c[i * 3 + 1] = q.g; c[i * 3 + 2] = q.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); mesh(scene, g, new THREE.MeshBasicMaterial({ vertexColors: true }), null, false);
    });
    const nubeT = [0, 1, 2].map(() => tex(256, 128, (g, w, h) => {
      for (let k = 0; k < 12; k++) { const x = w * (.18 + rnd() * .64), y = h * (.52 + rnd() * .2) - Math.sin(x / w * Math.PI) * h * .14, r = h * (.16 + rnd() * .2), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.6, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
      g.globalCompositeOperation = 'source-atop'; const s = g.createLinearGradient(0, h * .35, 0, h * .9); s.addColorStop(0, 'rgba(140,165,205,0)'); s.addColorStop(1, 'rgba(115,145,195,.65)'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    }));
    const nubes = []; for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: nubeT[i % 3], transparent: true, depthWrite: false, fog: false, opacity: .96 })), a = 30 + rnd() * 22;
      s.position.set(-95 + i * 24 + rnd() * 9, 13 + rnd() * 22 + (i % 2) * 9, -165 - rnd() * 20); s.scale.set(a, a * .5, 1); scene.add(s); nubes.push(s);
    }
    // árboles y palmas: una sola pieza con color por vértice
    const veg = [];
    function copa(x, y, z, r, c0, c1) {
      const g = new THREE.SphereGeometry(r, 16, 11), p = g.attributes.position, col = new Float32Array(p.count * 3), a = lin(c0), b = lin(c1);
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i) / r, vy = p.getY(i) / r, vz = p.getZ(i) / r, k = 1 + 0.17 * Math.sin(vx * 5.1 + x) * Math.sin(vy * 4.3 + z) + 0.1 * Math.sin(vz * 6.7 + vx * 3);
        p.setXYZ(i, vx * k * r, vy * k * r * .85, vz * k * r); const t = clamp(.45 + vy * .5 + (k - 1) * 1.6, 0, 1);
        col[i * 3] = a.r + (b.r - a.r) * t; col[i * 3 + 1] = a.g + (b.g - a.g) * t; col[i * 3 + 2] = a.b + (b.b - a.b) * t;
      }
      g.computeVertexNormals(); coser(g, 16, 11); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); veg.push([g, null, M([x, y, z])]);
    }
    function arbol(x, z, s) {
      veg.push([loft([[0, .2 * s], [.25 * s, .14 * s], [1.3 * s, .11 * s, null, 0, .05 * s], [2.5 * s, .08 * s, null, 0, .02 * s]], 8, 2), 0x5d4127, M([x, 0, z])]);
      const tono = [['#1f5a26', '#4d9a3c'], ['#27682a', '#62ad48'], ['#1b5022', '#44903a']];
      for (let k = 0; k < 6; k++) { const a = k * 1.05 + x, d = k ? (.55 + rnd() * .3) * s : 0, t = tono[k % 3]; copa(x + Math.cos(a) * d, (2.5 + (k ? rnd() * .7 : .75)) * s, z + Math.sin(a) * d, (k ? .72 + rnd() * .3 : 1.0) * s, t[0], t[1]); }
    }
    function palma(x, z, s) {
      veg.push([loft([[0, .15 * s], [1.4 * s, .11 * s, null, 0, .1 * s], [3 * s, .09 * s, null, 0, .32 * s], [4.5 * s, .075 * s, null, 0, .7 * s]], 8, 3), 0x8a6f4d, M([x, 0, z])]);
      const L = 2.3 * s;
      for (let k = 0; k < 10; k++) {
        const cae = .55 + (k % 3) * .22, g = malla(2, 7, (u, v, o) => { const w = .3 * s * Math.pow(Math.sin(Math.PI * (.06 + .94 * v)), .7); o[0] = (u - .5) * 2 * w; o[2] = -v * L * (1 - .22 * v); o[1] = .3 * L * v - cae * L * v * v - Math.abs(u - .5) * w * .7; });
        veg.push([g, ['#3a8a33', '#4c9c3c', '#2f7a2c'][k % 3], M([x + .7 * s, 4.5 * s, z], [0, k * Math.PI / 5 + .3, 0])]);
      }
      veg.push([esf(.2 * s, .2 * s, .2 * s, 8, 6), 0x5a4a2a, M([x + .7 * s, 4.42 * s, z])]);
    }
    [[-3.7, -7, .95], [-5.4, -10.5, 1.2], [-2.7, -14, 1.1], [-7.2, -17, 1.4], [3.3, -6.6, .95], [4.9, -10, 1.2], [2.8, -14.5, 1.1], [6.8, -16, 1.4], [-4.6, -25, 1.5], [5.2, -26, 1.6], [.4, -29, 1.5], [9.5, -31, 1.7], [-10, -31, 1.7], [-12, -20, 1.5], [12, -21, 1.5]].forEach(a => arbol(a[0], a[1], a[2]));
    [[4.3, -8, .72], [-2.3, -9.5, .78], [7.6, -12.5, .95], [-6.2, -13.5, .9], [1.9, -19, 1.05]].forEach(a => palma(a[0], a[1], a[2]));
    mesh(scene, unir(veg), vegM);
    // malla detrás de la cancha
    const mallaT = tex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(190,200,205,.95)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); }, 80, 5);
    mesh(scene, new THREE.PlaneGeometry(26, 1.4), new THREE.MeshBasicMaterial({ map: mallaT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), V(0, 0.7, -4.5), false);
    { const p = []; for (let x = -12; x <= 12; x += 3) p.push([new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), 0x2f6b4a, M([x, 0.75, -4.5])]); mesh(scene, unir(p), colM); }
    // bandera
    mesh(scene, new THREE.CylinderGeometry(0.028, 0.04, 3.5, 10), std({ color: 0xc9cfd4, metalness: .9, roughness: .3 }), V(1.9, 1.75, -2.4));
    mesh(scene, esf(.05, .05, .05, 10, 8), std({ color: 0xe8c040, metalness: 1, roughness: .25 }), V(1.9, 3.52, -2.4));
    const BW = 1.2, banG = malla(20, 8, (u, v, o) => { o[0] = u * BW; o[1] = (v - .5) * .78; o[2] = 0; });
    const bandera = mesh(scene, banG, std({ side: THREE.DoubleSide, roughness: .85, map: tex(128, 128, (g, w, h) => {
      g.fillStyle = '#fcd116'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#003893'; g.fillRect(0, h / 2, w, h / 4); g.fillStyle = '#ce1126'; g.fillRect(0, h * .75, w, h / 4);
      for (let k = 0; k < 9; k++) { g.fillStyle = 'rgba(0,0,0,' + (k % 2 ? .07 : .0) + ')'; g.fillRect(k * w / 9, 0, w / 18, h); }
    }) }), V(1.93, 3.04, -2.4));
    const banBase = banG.attributes.position.array.slice();
    // kiosco de teja de barro con público
    const madera = std({ map: tex(256, 256, planks('#8a5a34', '#77492a', 'rgba(0,0,0,.4)', 6)), roughness: .85 });
    const kio = new THREE.Group(); kio.position.set(-2.0, 0, -2.3); kio.rotation.y = -0.25; scene.add(kio);
    [[-1.0, -1.9], [-1.0, 1.9], [0.95, -1.9], [0.95, 1.9]].forEach(p => mesh(kio, new THREE.CylinderGeometry(0.06, 0.07, p[0] < 0 ? 2.85 : 2.45, 8), madera, V(p[0], p[0] < 0 ? 1.425 : 1.225, p[1])));
    const techo = new THREE.Group(); techo.position.set(-0.02, 2.7, 0); techo.rotation.z = -0.2; kio.add(techo);
    mesh(techo, new THREE.BoxGeometry(2.5, 0.05, 4.5), madera, V(0, -0.03, 0));
    mesh(techo, malla(5, 92, (u, v, o) => { o[0] = (u - .5) * 2.62; o[2] = (v - .5) * 4.6; o[1] = Math.abs(Math.sin(v * 23 * Math.PI)) * .055; }), std({ roughness: .78, side: THREE.DoubleSide, map: tex(128, 64, (g, w, h) => {
      for (let y = 0; y < h; y++) { const k = Math.sin(Math.PI * y / h), c = Math.round(120 + 75 * k); g.fillStyle = 'rgb(' + c + ',' + Math.round(c * .43) + ',' + Math.round(c * .22) + ')'; g.fillRect(0, y, w, 1); }
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(40,12,0,.55)'); gr.addColorStop(.12, 'rgba(40,12,0,0)'); gr.addColorStop(.8, 'rgba(255,190,140,.0)'); gr.addColorStop(1, 'rgba(255,190,140,.22)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 70; k++) { g.fillStyle = 'rgba(50,20,5,' + (rnd() * .25).toFixed(2) + ')'; g.fillRect(rnd() * w, rnd() * h, 5, 2); }
    }, 7, 23) }));
    mesh(kio, new THREE.BoxGeometry(0.42, 0.06, 3.7), madera, V(-0.33, 0.42, 0));
    [-1.6, 0, 1.6].forEach(z => mesh(kio, new THREE.BoxGeometry(0.36, 0.4, 0.07), madera, V(-0.33, 0.2, z)));
    const publico = [[0xc62828, GORRA, PELO, JEAN], [0x2456b8, null, 0x2a1a10, 0x3a3f4a], [0xf2f2f2, 0xf4f4f4, PELO, JEAN], [0xf2b705, null, 0x0e0c0b, 0x4a5d7a]].map((q, i) => {
      const g = new THREE.Group(); g.position.set(-0.33, 0, -1.28 + i * 0.85); g.rotation.y = -Math.PI / 2; kio.add(g);
      const p = [[torsoL(), q[0], M([0, .69, .02], [-.05, 0, 0], .93)], [cabezaL(q[1], q[2]), null, M([0, 1.25, 0], null, .93)], [pelvisL(), q[3], M([0, .65, .03])]];
      [-1, 1].forEach(s => p.push([musloL(), q[3], M([s * .095, .55, 0], [1.5, 0, 0])], [piernaL(), q[3], M([s * .1, .52, -.43], [-.08, 0, 0])], [zapatoL(), null, M([s * .1, .09, -.4])]));
      mesh(g, unir(p), colM);
      const bg = unir([[brazoSupL([q[0], q[0], q[0]]), null], [anteL(), PIEL, M([0, -.29, 0], [.5, 0, 0])], [manoL(-1), null, M([0, -.518, -.125], [2.07, 0, 0])]]);
      g.userData.b = [-1, 1].map(s => { const b = mesh(g, bg, colM, V(s * .177, 1.036, .01)); b.rotation.set(.35, 0, s * .1); return b; });
      return g;
    });

    /* ---------------- luz ---------------- */
    scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x8a7448, 0.42));
    const sun = new THREE.DirectionalLight(0xfff1d2, 1.3); sun.position.set(-6, 11, 11); sun.target.position.set(0, 0, 3); scene.add(sun.target); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; scene.add(sun);
    const boom = new THREE.PointLight(0xff8a2a, 0, 6); scene.add(boom);

    /* ---------------- cancha: cajón amarillo con greda ---------------- */
    const woodY = std({ map: tex(512, 512, planks('#f4a81c', '#e99512', 'rgba(110,55,0,.45)', 8)), roughness: .7 });
    const cancha = new THREE.Group(); cancha.position.set(0, 0.95, 0); cancha.rotation.x = -TILT; scene.add(cancha);
    const crat = []; for (let k = 0; k < 30; k++) crat.push([rnd(), rnd(), 16 + rnd() * 30]);
    const pintaGreda = relieve => (g, w, h) => {
      if (relieve) { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let k = 0; k < 9000; k++) { const c = 100 + Math.floor(rnd() * 56); g.fillStyle = 'rgb(' + c + ',' + c + ',' + c + ')'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, 6.3); g.fill(); } }
      else noise('#6b4527', ['rgba(50,32,18,.35)', 'rgba(150,110,75,.25)', 'rgba(85,58,36,.4)', 'rgba(120,84,52,.3)'], 12000, 5)(g, w, h);
      crat.forEach(c => {
        const x = c[0] * w, y = c[1] * h, r = c[2] * w / 1024, gr = g.createRadialGradient(x, y, 0, x, y, r);
        if (relieve) { gr.addColorStop(0, '#161616'); gr.addColorStop(.6, '#585858'); gr.addColorStop(.86, '#b4b4b4'); gr.addColorStop(1, 'rgba(128,128,128,0)'); }
        else { gr.addColorStop(0, 'rgba(28,17,9,.72)'); gr.addColorStop(.7, 'rgba(45,28,15,.32)'); gr.addColorStop(.88, 'rgba(170,125,85,.25)'); gr.addColorStop(1, 'rgba(35,22,12,0)'); }
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
      });
    };
    const gredaB = tex(512, 512, pintaGreda(true)); extra.push(gredaB);
    mesh(cancha, new THREE.BoxGeometry(2, 2, 0.2), std({ map: tex(1024, 1024, pintaGreda(false)), bumpMap: gredaB, bumpScale: 0.03, roughness: .86 }), V(0, 0, -0.1));
    [[0, 1.075, 2.3, 0.15], [0, -1.075, 2.3, 0.15], [1.075, 0, 0.15, 2.0], [-1.075, 0, 0.15, 2.0]].forEach(a => mesh(cancha, new THREE.BoxGeometry(a[2], a[3], 0.36), woodY, V(a[0], a[1], 0.02)));
    const lado = new THREE.Shape(); lado.moveTo(1.0, 0); lado.lineTo(1.0, 0.36); lado.lineTo(-0.9, 2.05); lado.lineTo(-0.9, 0); lado.lineTo(1.0, 0);
    const ladoG = new THREE.ExtrudeGeometry(lado, { depth: 0.07, bevelEnabled: false });
    [-1.15, 1.22].forEach(x => { const m = mesh(scene, ladoG, woodY, V(x, 0, 0)); m.rotation.y = -Math.PI / 2; });
    mesh(scene, new THREE.BoxGeometry(2.44, 2.9, 0.1), woodY, V(0, 1.45, -0.98));
    mesh(scene, new THREE.BoxGeometry(2.44, 0.3, 0.1), woodY, V(0, 0.15, 1.0));
    mesh(scene, new THREE.PlaneGeometry(2.44, 1.15), new THREE.MeshStandardMaterial({ roughness: .7, map: tex(1024, 480, (g, w, h) => {
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#f4a81c' : '#ea9713'; g.fillRect(i * w / 6, 0, w / 6, h); g.fillStyle = 'rgba(110,55,0,.45)'; g.fillRect(i * w / 6, 0, 5, h); }
      for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(60,30,5,' + (rnd() * .12).toFixed(3) + ')'; g.fillRect(rnd() * w, rnd() * h, 2, 20 + rnd() * 90); }
      g.fillStyle = '#d0202f'; g.font = '800 380px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opt.demo ? '27' : String(opt.meta), w / 2, h / 2 + 28);
      for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(95,60,30,' + (0.3 + rnd() * .4).toFixed(2) + ')'; g.beginPath(); g.arc(rnd() * w, h * (.55 + rnd() * .45), 3 + rnd() * 10, 0, 6.3); g.fill(); }
    }) }), V(0, 2.3, -0.925), false);
    const acero = std({ color: 0xd4d9df, metalness: 1, roughness: .24 });
    mesh(cancha, new THREE.TorusGeometry(0.22, 0.035, 16, 48), acero, V(0, 0, 0.015));
    mesh(cancha, new THREE.CircleGeometry(0.19, 32), std({ color: 0x2a1c10, roughness: 1 }), V(0, 0, 0.003), false);
    // huellas que dejan los tejos en la greda
    const huellaM = std({ transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: tex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(22,13,7,.85)'); gr.addColorStop(.42, 'rgba(34,21,11,.7)'); gr.addColorStop(.6, 'rgba(60,38,21,.3)'); gr.addColorStop(.74, 'rgba(176,130,90,.4)'); gr.addColorStop(1, 'rgba(120,85,55,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }) }), huellaG = new THREE.PlaneGeometry(0.42, 0.42), huellas = []; let huellaI = 0;
    extra.push(huellaM.map, huellaM, huellaG);

    /* mechas: sobres triangulares con pólvora sobre el borde del bocín */
    const triG = (s, d) => { const sh = new THREE.Shape(); sh.moveTo(0, 0.17 * s); sh.lineTo(-0.1 * s, -0.04 * s); sh.lineTo(0.1 * s, -0.04 * s); sh.lineTo(0, 0.17 * s); return new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); };
    const gBig = triG(1, 0.012), gSmall = triG(0.5, 0.002), mW = std({ color: 0xfdfaf0, roughness: .9 }), mR = std({ color: 0xd8343f, roughness: .7 });
    const mechas = [Math.PI / 2, 0, Math.PI, -Math.PI / 2].map(a => {
      const g = new THREE.Group(); g.position.set(Math.cos(a) * MECHA_R, Math.sin(a) * MECHA_R, 0.03); g.rotation.z = a - Math.PI / 2;
      const inner = new THREE.Group(); inner.rotation.x = 0.9; g.add(inner);
      mesh(inner, gBig, mW); mesh(inner, gSmall, mR, V(0, 0.02, 0.0112), false); mesh(inner, gSmall, mR, V(0, 0.02, -0.0012), false);
      cancha.add(g);
      return { g, x: Math.cos(a) * MECHA_R, y: Math.sin(a) * MECHA_R, viva: true };
    });
    const aro = (r0, r1, c, z) => mesh(cancha, new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), V(0, 0, z), false);
    const aroMano = aro(0.15, 0.19, 0xffe14d, 0.07), aroCae = aro(0.1, 0.135, 0xffffff, 0.045), aroBoc = aro(0.2, 0.27, 0x9fe1ff, 0.04), aroOnda = aro(0.13, 0.17, 0xfff0c8, 0.05);

    /* ---------------- jugador (de espaldas, camiseta de Colombia) ---------------- */
    function camisaT(u) {
      return tex(1024, 1024, (g, w, h) => {
        g.fillStyle = u[0]; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 26; k++) { const x = rnd() * w, a = .03 + rnd() * .05, gr = g.createLinearGradient(x - 40, 0, x + 40, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 40, h * (.3 + rnd() * .3), 80, h * .7); }
        for (let k = 0; k < 6000; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.035)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
        [.25, .75].forEach(x => { g.fillStyle = u[1]; g.fillRect(w * x - 13, h * .27, 18, h); g.fillStyle = u[2]; g.fillRect(w * x + 5, h * .27, 8, h); });
        g.fillStyle = u[1]; g.fillRect(0, 0, w, h * .036); g.fillStyle = u[2]; g.fillRect(0, h * .036, w, h * .012);
        g.fillStyle = u[1]; g.fillRect(0, h * .976, w, h * .024);
        g.save(); g.translate(w / 2, 0); g.scale(.65, 1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = u[3];
        g.font = '800 98px "Baloo 2", "Arial Black", sans-serif'; g.fillText('COLOMBIA', 0, h * .25);
        g.font = '800 400px "Baloo 2", "Arial Black", sans-serif'; g.fillText(u[4], 0, h * .52);
        g.restore();
      });
    }
    const UNI = [(opt.modo === 'ia' || opt.demo) ? ['#f5cc10', '#0c3b93', '#cf142b', '#0c3b93', '10'] : ['#1a49b0', '#f5cc10', '#cf142b', '#ffffff', '10'], ['#cf142b', '#f5cc10', '#0c3b93', '#fff3c4', '7']]
      .map(u => { const o = { t: camisaT(u), b: brazoSupL([u[0], u[1], u[2]]) }; extra.push(o.t, o.b); return o; });
    const JX = -0.42, JZ = 7.42, SUELTA = 0.2;
    const camisaM = std({ map: UNI[0].t, roughness: .84 });
    const pelvis = new THREE.Group(); pelvis.position.set(JX, 1.03, JZ); scene.add(pelvis); mesh(pelvis, unir([[pelvisL(), JEAN]]), colM);
    const torso = new THREE.Group(); torso.position.y = 0.04; pelvis.add(torso); mesh(torso, torsoL(), camisaM);
    const cabeza = mesh(torso, cabezaL(GORRA, PELO), colM, V(0, 0.6, 0));
    const anteG = unir([[anteL(), PIEL]]), musloG = unir([[musloL(), JEAN]]), piernaG = unir([[piernaL(), JEAN]]), zapatoG = zapatoL();
    const pieza = g => mesh(scene, g, colM);
    const bD = { sup: pieza(UNI[0].b), inf: pieza(anteG), mano: pieza(manoL(-1)), h: V(.19, .372, .012), polo: V(.5, -.3, .8), w: V(JX + .3, 1.0, JZ - .3) };
    const bI = { sup: pieza(UNI[0].b), inf: pieza(anteG), mano: pieza(manoL(1)), h: V(-.19, .372, .012), polo: V(-.5, -.3, .8), w: V(JX - .26, .93, JZ - .05) };
    const pD = { sup: pieza(musloG), inf: pieza(piernaG), pie: pieza(zapatoG), h: V(.092, -.1, 0), polo: V(.14, 0, -1), t: V() };
    const pI = { sup: pieza(musloG), inf: pieza(piernaG), pie: pieza(zapatoG), h: V(-.092, -.1, 0), polo: V(-.14, 0, -1), t: V() };
    function vestir(k) { camisaM.map = UNI[k].t; bD.sup.geometry = bI.sup.geometry = UNI[k].b; }
    const _d = V(), _p = V(), _e = V(), _x = V(), _y = V(), _h = V(), _w = V(), _m = new THREE.Matrix4(), ABAJO = V(0, -1, 0), EJEX = V(1, 0, 0);
    /* Cinemática inversa de dos huesos: dobla el codo (o la rodilla) hacia «polo». Deja en T el punto alcanzado y en _x la dirección del segundo hueso */
    function dosHuesos(A, T, l1, l2, m) {
      _d.subVectors(T, A); const D = _d.length() || 1e-4, dist = clamp(D, Math.abs(l1 - l2) + .02, l1 + l2 - .004); _d.multiplyScalar(1 / D);
      const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      _p.copy(m.polo).addScaledVector(_d, -m.polo.dot(_d)).normalize();
      _e.copy(A).addScaledVector(_d, a).addScaledVector(_p, h); T.copy(A).addScaledVector(_d, dist);
      m.sup.position.copy(A); m.sup.quaternion.setFromUnitVectors(ABAJO, _x.subVectors(_e, A).normalize());
      m.inf.position.copy(_e); m.inf.quaternion.setFromUnitVectors(ABAJO, _x.subVectors(T, _e).normalize());
    }
    function brazo(m, dt, vel, wd) {   // lleva la muñeca hacia wd (o la deja donde está) y acomoda la mano con la palma hacia el balanceo
      if (wd) m.w.lerp(wd, 1 - Math.exp(-dt * vel));
      _h.copy(m.h).applyMatrix4(torso.matrixWorld); dosHuesos(_h, m.w, L1, L2, m);
      _y.crossVectors(EJEX, _x); if (_y.lengthSq() < 1e-4) _y.set(0, 0, -1); _y.normalize(); _p.crossVectors(_y, _x).normalize();
      m.mano.quaternion.setFromRotationMatrix(_m.makeBasis(_p, _y, _x)); m.mano.position.copy(m.w);
    }
    function pierna(m, cabeceo, giro) {
      _h.copy(m.h).applyMatrix4(pelvis.matrixWorld); dosHuesos(_h, m.t, LM, LP, m);
      m.pie.position.copy(m.t); m.pie.rotation.set(cabeceo, giro, 0);
    }
    const pose = { lean: -.07, twist: 0, crouch: 0, dz: 0, paso: 0 }, wIni = V(), wRel = V(P0.x - .03, P0.y - .02, P0.z + .085), desfase = V();
    let tl = 9, suelto = true;
    /* Postura del jugador: p = cuánto echa el brazo atrás (0..1), aim = hacia dónde apunta */
    function animarJugador(dt, p, aim) {
      const lanza = tl < SUELTA, sigue = !lanza && tl < .62, vuelve = !lanza && !sigue && tl < 1.25, resp = Math.sin(st.tt * 1.7);
      let lean = -.07 - .13 * p, twist = -.4 * p - aim * .08, crouch = .045 * p, dz = .05 * p, paso = 0, vel = 10;
      if (lanza) { lean = -.36; twist = .34; crouch = .075; dz = -.16; paso = 1; vel = 22; }
      else if (sigue) { lean = -.3; twist = .44; crouch = .04; dz = -.18; paso = 1; vel = 12; }
      else if (vuelve) { lean = -.07; twist = 0; crouch = 0; dz = 0; vel = 6; }
      const k = 1 - Math.exp(-dt * vel);
      pose.lean += (lean - pose.lean) * k; pose.twist += (twist - pose.twist) * k; pose.crouch += (crouch - pose.crouch) * k; pose.dz += (dz - pose.dz) * k;
      pose.paso = paso > pose.paso ? Math.min(paso, pose.paso + dt / .2) : Math.max(paso, pose.paso - dt / .38);
      const levanta = Math.sin(Math.PI * pose.paso);
      pelvis.position.set(JX + Math.sin(st.tt * .8) * .006, 1.03 - pose.crouch + levanta * .012, JZ + pose.dz); pelvis.rotation.set(pose.lean * .35, pose.twist * .35, 0);
      torso.rotation.set(pose.lean * .65 + resp * .008, pose.twist * .65, 0); torso.scale.set(1 + resp * .005, 1 + resp * .004, 1 + resp * .014);
      cabeza.rotation.set(-pose.lean * .7, -pose.twist * .8, 0);
      pelvis.updateMatrixWorld(true);
      // brazo que lanza
      _h.copy(bD.h).applyMatrix4(torso.matrixWorld);
      if (lanza) {
        const e = Math.pow(tl / SUELTA, 1.5), a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e;
        bD.w.set(a * wIni.x + b * (_h.x + .06) + c * wRel.x, a * wIni.y + b * (_h.y - .54) + c * wRel.y, a * wIni.z + b * (_h.z + .05) + c * wRel.z);
        brazo(bD, dt, 0, null);
      } else {
        if (sigue) _w.set(_h.x + .1, _h.y + .04, _h.z - .5);
        else if (enMano && st.fase === 'apunta') {
          const e = p * p * (3 - 2 * p), an = .576 - 1.5 * e, r = .477 + .076 * e;
          _w.set(_h.x + .1 - .05 * e - aim * .05, _h.y - r * Math.cos(an) + resp * .005, _h.z - r * Math.sin(an));
        } else _w.set(_h.x + .05, _h.y - .53, _h.z - .06);
        brazo(bD, dt, sigue ? 16 : (p > 0 ? 22 : 9), _w);
      }
      if (enMano && (st.fase === 'apunta' || (st.fase === 'vuelo' && !suelto))) {
        enMano.position.copy(bD.w).addScaledVector(_x, .075).addScaledVector(_y, .036); enMano.quaternion.copy(bD.mano.quaternion); enMano.scale.setScalar(.62);
      }
      // brazo libre: hace contrapeso
      _h.copy(bI.h).applyMatrix4(torso.matrixWorld); const ade = lanza || sigue ? .3 : -.27 * p;
      _w.set(_h.x - .05 - .03 * p, _h.y - .5 + .1 * p + (lanza || sigue ? .05 : 0) + resp * .004, _h.z - .05 + ade);
      brazo(bI, dt, 10, _w);
      // piernas: el pie izquierdo da el paso y el derecho levanta el talón
      pI.t.set(JX - .115, .085 + levanta * .07, JZ - .03 - .4 * pose.paso); pierna(pI, levanta * .28, .14);
      pD.t.set(JX + .115, .085 + .05 * pose.paso, JZ + .07); pierna(pD, -.5 * pose.paso, -.2);
    }

    /* ---------------- guía, efectos y tejos ---------------- */
    const NG = 26, guiaG = new THREE.SphereGeometry(0.03, 8, 8);
    const guia = []; for (let i = 0; i < NG; i++) { const m = mesh(scene, guiaG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, toneMapped: false }), null, false); m.visible = false; guia.push(m); }
    const estela = []; for (let i = 0; i < 12; i++) { const m = mesh(scene, guiaG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 * (1 - i / 12), toneMapped: false }), null, false); m.visible = false; m.scale.setScalar(1.3 * (1 - i / 14)); estela.push(m); }
    const hist = [];
    const chispas = new OJ.Chispas(scene, 170, 0xffb040, 0.1), nucleo = new OJ.Chispas(scene, 70, 0xfff6d0, 0.07), brasas = new OJ.Chispas(scene, 50, 0xff6a1e, 0.06);
    const terrones = new OJ.Chispas(scene, 70, 0x5a3a20, 0.085); terrones.mat.blending = THREE.NormalBlending;
    const humo = []; for (let i = 0; i < 22; i++) { const s = sprite(scene, i % 3 ? 0xcfa878 : 0xb5aa9e, V(0, -5, 0), 0.3, 0, false); s.userData.v = V(0, 0, 0); humo.push(s); }
    const fuego = [sprite(scene, 0xff6a10, V(0, -5, 0), 1.5, 0, true), sprite(scene, 0xffc060, V(0, -5, 0), 0.8, 0, true), sprite(scene, 0xffffff, V(0, -5, 0), 0.3, 0, true)];
    let humoV = 0, humoK = 1, fuegoV = 0, boomI = 0, shake = 0, manoV = 0, bocV = 0, ondaV = 0, salto = 0, foco = 0, lentoT = 0;
    const nrm = V(0, ST, CT), focoP = V();
    function polvareda(p, fuerza) {
      humo.forEach(s => { s.position.copy(p).add(V((Math.random() - .5) * .3 * fuerza, Math.random() * .15, (Math.random() - .5) * .2)); s.userData.v.set((Math.random() - .5) * 1.1 * fuerza, (.4 + Math.random() * .9) * fuerza, .2 + Math.random() * .6 * fuerza); s.scale.setScalar(.16 * fuerza); });
      humoV = 1; humoK = fuerza;
    }
    /* El tejo cae en la greda: deja la huella y salta tierra */
    function impacto(lx, ly, wp) {
      const k = huellaI % 12; let m = huellas[k];
      if (!m) { m = huellas[k] = mesh(cancha, huellaG, huellaM, null, false); m.receiveShadow = true; }
      m.position.set(lx, ly, 0.003 + k * 0.0003); m.rotation.z = Math.random() * 6.3; m.scale.setScalar(.85 + Math.random() * .3); huellaI++;
      terrones.explotar(wp, nrm.clone().multiplyScalar(1.3), .3, 1.5, .7);
    }
    /* Cámara lenta con acercamiento al punto de la jugada */
    function enfocar(p, seg) { focoP.copy(p); foco = seg; lentoT = 0.5; }
    const tejoG = new THREE.CylinderGeometry(0.108, 0.125, 0.06, 36), tejoM = std({ color: 0xc3c8ce, metalness: .9, roughness: .3 }), capG = new THREE.CircleGeometry(0.066, 24);
    function nuevoTejo(eq) {
      const g = new THREE.Group(); mesh(g, tejoG, tejoM);
      const capM = new THREE.MeshStandardMaterial({ color: EQ[eq].hex, roughness: .4, metalness: .3 });
      mesh(g, capG, capM, V(0, 0.0312, 0), false).rotation.x = -Math.PI / 2; mesh(g, capG, capM, V(0, -0.0312, 0), false).rotation.x = Math.PI / 2;
      g.userData.eq = eq; scene.add(g); return g;
    }
    let enMano = null; const tejos = [];

    /* ---------------- estado ---------------- */
    const st = { pts: [0, 0], ronda: 1, inicia: 0, turno: 0, tiros: [0, 0], puntuo: false, fase: 'apunta', t: 0, fn: null, iaT: 1.2,
      arr: false, sx: 0, sy: 0, pot: 0, aim: 0, tt: 0, vuelo: null, vi: 0, cae: null, fin: false };
    game.st = st;
    let aprendido = OJ.store.get('tejo.tiros', 0);

    /* ---------------- marcador (como en la tele) y ayuda ---------------- */
    let hud = null; const R = {};
    if (!opt.demo) {
      hud = OJ.el('div', 'hud tejo-hud', `
        <div class="tj-top">
          <div class="marc"><div class="marc-l" data-r="l"><i class="band"></i><b data-r="s0">0</b></div><div class="marc-c"><span>♛</span><b>${opt.meta}</b></div><div class="marc-r" data-r="r"><b data-r="s1">0</b><i class="band"></i></div></div>
          <div class="marc-n"><button class="ic" data-a="pausa" aria-label="Menú">☰</button><span data-r="n0">${nombres[0]}</span><span class="marc-ronda" data-r="ronda"></span><span data-r="n1">${nombres[1]}</span><span class="tejos-rest" data-r="rest"></span></div>
          <div class="turno tj-turno" data-r="turno"></div>
        </div>
        <div class="tuto oculto" data-r="tuto"><div class="tuto-mano">👆</div><div class="tuto-t"><b>1.</b> Pon el dedo en la pantalla<br><b>2.</b> Arrástralo hacia abajo<br><b>3.</b> Suéltalo para lanzar el tejo</div></div>
        <div class="hud-bot">
          <div class="lbl"><span>Fuerza</span><span>Mano 1 · Mecha 3 · Embocinada 6 · Moñona 9</span></div>
          <div class="bar"><i data-r="bar"></i><em>bocín</em></div>
          <div class="ayuda" data-r="ayuda"></div>
        </div>`);
      OJ.ui.appendChild(hud);
      hud.querySelectorAll('[data-r]').forEach(e => { R[e.dataset.r] = e; });
      hud.querySelector('[data-a="pausa"]').onclick = () => OJ.app.pausa(game);
    }
    const humano = () => st.fase === 'apunta' && !esIA(st.turno) && !st.fin;
    function pintar() {
      if (!hud) return;
      R.s0.textContent = st.pts[0]; R.s1.textContent = st.pts[1]; R.ronda.textContent = 'Ronda ' + st.ronda;
      R.l.classList.toggle('on', st.turno === 0 && !st.fin); R.r.classList.toggle('on', st.turno === 1 && !st.fin);
      const quedan = POR_RONDA - st.tiros[st.turno];
      R.turno.textContent = st.fin ? '' : (esIA(st.turno) ? 'Lanza la máquina…' : (opt.modo === 'ia' ? 'Te toca lanzar' : 'Lanzan los ' + nombres[st.turno]));
      R.turno.style.background = EQ[st.turno].c;
      R.rest.style.color = st.turno ? '#ff8f98' : '#8fb8ff';
      R.rest.innerHTML = st.fin ? '' : Array.from({ length: POR_RONDA }, (_, i) => `<i class="${i < quedan ? 'q' : ''}"></i>`).join('');
      R.ayuda.textContent = humano() ? 'Arrastra hacia abajo y suelta' : '';
      R.ayuda.classList.toggle('late', humano());
      R.tuto.classList.toggle('oculto', !(humano() && aprendido < 4));
    }
    function sumar(eq, n) {
      st.pts[eq] += n; st.puntuo = true; salto = 1;
      if (hud) { const p = eq ? R.s1 : R.s0; p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube'); }
    }

    /* ---------------- flujo ---------------- */
    function espera(seg, fn) { st.fase = 'espera'; st.t = seg; st.fn = fn; }
    function tomarTejo() {
      vestir(st.turno); enMano = nuevoTejo(st.turno); enMano.position.copy(P0);
      st.fase = 'apunta'; st.arr = false; st.pot = 0; st.aim = 0; st.iaT = opt.demo ? 1.0 : 1.3; if (hud) R.bar.style.width = '0%';
      pintar();
    }
    function nuevaRonda() {
      tejos.forEach(t => { cancha.remove(t); scene.remove(t); }); tejos.length = 0;
      mechas.forEach(m => { m.viva = true; m.g.visible = true; });
      st.tiros = [0, 0]; st.puntuo = false; st.turno = st.inicia; manoV = 0;
      tomarTejo();
    }
    function lanzar(phi, s) {
      st.vuelo = tray(phi, s); st.vi = 0; st.fase = 'vuelo'; hist.length = 0; tl = 0; suelto = false; wIni.copy(bD.w);
      guia.forEach(m => { m.visible = false; }); aroCae.material.opacity = 0;
      if (!opt.demo) OJ.snd.silbido();
      if (hud) { R.ayuda.textContent = ''; R.ayuda.classList.remove('late'); R.tuto.classList.add('oculto'); }
    }
    function lanzarIA() {
      const d = opt.demo ? 1 : opt.dif, vivas = mechas.filter(m => m.viva); let tx = 0, ty = 0;
      if (vivas.length && Math.random() < 0.75) { const m = vivas[Math.floor(Math.random() * vivas.length)]; tx = m.x * 0.9; ty = m.y * 0.9; }
      const a = apuntarA(tx, ty);
      lanzar(a.phi + OJ.gauss() * IA_ANG[d], a.s + OJ.gauss() * IA_VEL[d]);
    }
    function explotar(m, fuerte) {
      const p = V(0, 0, 0); m.g.getWorldPosition(p); m.viva = false; m.g.visible = false;
      chispas.explotar(p, nrm.clone().multiplyScalar(1.8), 1.2, fuerte ? 5.4 : 4.3, 1.2); nucleo.explotar(p, nrm.clone().multiplyScalar(1.2), .4, 2.2, .7);
      brasas.explotar(p, nrm.clone().multiplyScalar(2.6), .3, 1.6, 1.8); terrones.explotar(p, nrm.clone().multiplyScalar(2.2), .8, fuerte ? 3.8 : 3, 1.1);
      polvareda(p, fuerte ? 2.6 : 2);
      fuego.forEach(s => s.position.copy(p).addScaledVector(nrm, 0.08));
      aroOnda.position.set(m.x, m.y, 0.05); ondaV = 1;
      fuegoV = 1; boom.position.copy(p).addScaledVector(nrm, 0.4); boomI = fuerte ? 9 : 6.5; shake = fuerte ? 0.14 : 0.09; enfocar(p, fuerte ? 1.6 : 1.3);
      if (!opt.demo) { OJ.snd.mecha(); OJ.vib(fuerte ? 180 : 110); OJ.destello('#ffd9a0', fuerte ? .6 : .42); }
    }
    function aterrizar() {
      const f = st.vuelo.fin, eq = st.turno, t = enMano; enMano = null;
      estela.forEach(m => { m.visible = false; });
      if (f.tipo !== 'greda') {
        const n = st.vuelo.pts.length, p = V(st.vuelo.pts[n - 3], st.vuelo.pts[n - 2], st.vuelo.pts[n - 1]);
        st.cae = { t, v: f.tipo === 'piso' ? V(st.vuelo.vx * .25, 0.9, st.vuelo.vz * .25) : V(st.vuelo.vx * .2 + (Math.random() - .5), 1.6, 1.3 + Math.random()) };
        t.position.copy(p); if (f.tipo === 'piso') polvareda(p, 0.8);
        if (!opt.demo) { f.tipo === 'piso' ? OJ.snd.greda() : OJ.snd.tabla(); OJ.gran(f.tipo === 'tabla' ? '¡Tabla!' : f.tipo === 'piso' ? 'Corto' : 'Largo', f.tipo === 'piso' ? 'Faltó fuerza: jala más abajo' : f.tipo === 'pared' ? 'Mucha fuerza: jala menos' : 'No cayó en la greda', '#ffffff', 1500); }
        st.fase = 'cae'; st.t = 1.3; st.fn = () => despues(eq);
        return;
      }
      let lx = f.lx, ly = f.ly;
      const d = Math.hypot(lx, ly); let mi = -1, md = 9;
      mechas.forEach((m, i) => { if (!m.viva) return; const dd = Math.hypot(lx - m.x, ly - m.y); if (dd < md) { md = dd; mi = i; } });
      const toca = md < 0.155; let tipo = 'mano';
      if (toca && d < 0.15) tipo = 'monona'; else if (d < 0.095) tipo = 'embocinada'; else if (toca) tipo = 'mecha';
      if (tipo === 'monona') { lx *= 0.35; ly *= 0.35; }
      const dl = Math.hypot(lx, ly);
      cancha.add(t); t.position.set(lx, ly, dl > 0.1 && dl < 0.36 ? 0.06 : 0.022);   // sobre el aro del bocín queda montado
      t.rotation.set(Math.PI / 2 + (Math.random() - .5) * .3, 0, (Math.random() - .5) * .3);
      t.userData.d = dl; tejos.push(t);
      const wp = V(0, 0, 0); t.getWorldPosition(wp); impacto(lx, ly, wp);
      if (tipo === 'mano' || tipo === 'embocinada') polvareda(wp, 1);
      if (!opt.demo) { OJ.snd.greda(); OJ.vib(25); }
      if (tipo === 'mecha') { explotar(mechas[mi], false); sumar(eq, 3); if (!opt.demo) OJ.gran('¡Mecha!', '+3 puntos', '#ffe14d'); }
      else if (tipo === 'embocinada') { bocV = 1; shake = 0.04; enfocar(wp, 1.2); sumar(eq, 6); if (!opt.demo) { OJ.snd.metal(); OJ.snd.punto(); OJ.vib(80); OJ.gran('¡Embocinada!', '+6 puntos', '#9fe1ff'); } }
      else if (tipo === 'monona') { explotar(mechas[mi], true); bocV = 1; sumar(eq, 9); if (!opt.demo) { OJ.snd.metal(); OJ.gran('¡Moñona!', '+9 puntos', '#ff9a6a', 2100); } }
      else if (!opt.demo && d < 0.3) OJ.snd.metal();
      pintar();
      espera(tipo === 'mano' ? 0.9 : 1.9, () => despues(eq));
    }
    function despues(eq) {
      st.tiros[eq]++;
      if (st.pts[eq] >= opt.meta) return terminar(eq);
      if (st.tiros[0] + st.tiros[1] >= POR_RONDA * 2) return finRonda();
      st.turno = 1 - eq; tomarTejo();
    }
    function finRonda() {
      const sigue = () => { st.inicia = 1 - st.inicia; st.ronda++; nuevaRonda(); };
      if (st.puntuo || !tejos.length) return espera(0.5, sigue);
      const m = tejos.reduce((a, b) => (a.userData.d <= b.userData.d ? a : b)), eq = m.userData.eq;
      aroMano.position.set(m.position.x, m.position.y, 0.09); manoV = 1;
      sumar(eq, 1); st.puntuo = false; st.turno = eq; pintar();
      if (!opt.demo) { OJ.snd.punto(); OJ.gran('Mano', '+1 para ' + nombres[eq] + ': quedó más cerca del bocín', eq ? '#ff9aa2' : '#9cc4ff', 1900); }
      espera(2.1, () => (st.pts[eq] >= opt.meta ? terminar(eq) : sigue()));
    }
    function terminar(eq) {
      st.fin = true; st.fase = 'fin'; pintar();
      if (opt.demo) return;
      const gano = opt.modo !== 'ia' || eq === 0;
      gano ? OJ.snd.gana() : OJ.snd.pierde();
      OJ.app.final({ juego: 'tejo', gano: opt.modo === 'ia' ? eq === 0 : null, titulo: opt.modo === 'ia' ? (eq === 0 ? '¡Ganaste!' : 'Ganó la máquina') : '¡Ganaron los ' + nombres[eq] + '!',
        marcador: [[nombres[0], st.pts[0]], [nombres[1], st.pts[1]]], opt });
    }

    /* ---------------- entrada ---------------- */
    function valores() {
      const sw = (opt.modo === 'ia' ? SWAY[opt.dif] : SWAY[1]);
      const phi = st.aim * 0.24 + Math.sin(st.tt * 2.3) * sw + Math.sin(st.tt * 3.7 + 1) * sw * .5;
      const pot = clamp(st.pot + Math.sin(st.tt * 1.9 + 2) * sw * 1.2, 0, 1);
      return { phi, s: S_MIN + pot * (S_MAX - S_MIN), pot };
    }
    game.input = {
      down(x, y) { if (!humano()) return; st.arr = true; st.sx = x; st.sy = y; st.pot = 0; st.aim = 0; if (hud) R.tuto.classList.add('oculto'); },
      move(x, y) { if (!st.arr) return; st.pot = clamp((y - st.sy) / (OJ.H * 0.27), 0, 1); st.aim = clamp(-(x - st.sx) / (OJ.W * 0.42), -1, 1); },
      up() {
        if (!st.arr) return; st.arr = false;
        if (st.pot < 0.08) { st.pot = 0; guia.forEach(m => { m.visible = false; }); aroCae.material.opacity = 0; if (hud) R.bar.style.width = '0%'; pintar(); return; }
        aprendido++; OJ.store.set('tejo.tiros', aprendido);
        const v = valores(), e = 0.004 * ((opt.modo === 'ia' ? opt.dif : 1) + 1); lanzar(v.phi + OJ.gauss() * e, v.s + OJ.gauss() * e * 8);
      }
    };
    /* Para pruebas automáticas: lanza hacia un punto de la greda */
    game.probar = (lx, ly) => { const a = apuntarA(lx, ly); lanzar(a.phi, a.s); };

    /* ---------------- bucle ---------------- */
    const CAM0 = V(0.45, CAM_Y, CAM_Z), LOOK0 = V(0, 0.32, 0), CAM1 = V(0.3, 2.35, 8.4), LOOK1 = V(0, 1.0, 0);
    const camP = CAM0.clone(), camL = LOOK0.clone(), camPD = V(), camLD = V(); let camT = 0;
    game.resize = (w, h) => { cam.fov = clamp(2 * Math.atan(5.2 / (2 * CAM_Z * (w / h))) * 180 / Math.PI, 32, 58); };
    game.update = function (dt) {
      const real = dt;
      if (lentoT > 0) { lentoT -= real; dt *= lentoT > .15 ? .22 : 1 - .78 * Math.max(lentoT, 0) / .15; }   // cámara lenta en la jugada
      st.tt += dt; camT += real; tl += dt;
      let potVis = st.arr ? st.pot : 0, vu = 0;
      if (st.fase === 'apunta') {
        if (esIA(st.turno)) { st.iaT -= dt; potVis = clamp(1 - st.iaT / 0.9, 0, 1) * 0.85; if (st.iaT <= 0) lanzarIA(); }
        if (st.arr) {
          const v = valores(), tr = tray(v.phi, v.s), n = tr.pts.length / 3, frac = opt.modo === 'ia' ? GUIA[opt.dif] : GUIA[1];
          for (let i = 0; i < NG; i++) {
            const k = Math.floor((i + 1) / NG * (n - 1) * frac), m = guia[i];
            m.visible = true; m.position.set(tr.pts[k * 3], tr.pts[k * 3 + 1], tr.pts[k * 3 + 2]); m.material.opacity = 0.9 * (1 - i / NG * 0.5); m.scale.setScalar(0.5 + 0.8 * i / NG);
          }
          if (frac >= 1 && tr.fin.tipo === 'greda') { aroCae.position.set(tr.fin.lx, tr.fin.ly, 0.045); aroCae.material.opacity = 0.9; } else aroCae.material.opacity = 0;
          if (hud) { R.bar.style.width = Math.round(v.pot * 100) + '%'; R.ayuda.textContent = st.pot < 0.08 ? 'Sigue arrastrando hacia abajo' : 'Suelta para lanzar · muévelo a los lados para apuntar'; }
        }
      }
      if (st.fase === 'vuelo' && tl >= SUELTA) {       // el brazo ya soltó el tejo: vuela
        if (!enMano) enMano = nuevoTejo(st.turno);
        if (!suelto) { suelto = true; desfase.copy(enMano.position).sub(P0); enMano.rotation.set(0.3, 0, 0.25); }
        const n = st.vuelo.pts.length / 3;
        st.vi += dt / DTV;
        const i = Math.min(Math.floor(st.vi), n - 1), p = st.vuelo.pts, k = Math.max(0, 1 - (tl - SUELTA) / 0.1);
        enMano.position.set(p[i * 3] + desfase.x * k, p[i * 3 + 1] + desfase.y * k, p[i * 3 + 2] + desfase.z * k); enMano.rotation.x -= dt * 9; enMano.scale.setScalar(Math.min(1, .62 + (tl - SUELTA) * 1.6));
        hist.unshift(enMano.position.clone()); if (hist.length > 12) hist.pop();
        estela.forEach((m, k) => { if (hist[k]) { m.visible = true; m.position.copy(hist[k]); } });
        vu = clamp(st.vi / (n - 1), 0, 1);
        if (st.vi >= n - 1) aterrizar();
      } else if (st.fase === 'cae') {
        const c = st.cae;
        if (c) {
          c.v.y -= G * dt; c.t.position.addScaledVector(c.v, dt); c.t.rotation.x += dt * 7; c.t.rotation.z += dt * 3;
          if (c.t.position.y < 0.035) { c.t.position.y = 0.035; c.v.set(c.v.x * .5, Math.abs(c.v.y) * .25, c.v.z * .5); if (c.v.length() < .4) { c.t.rotation.set(0, 0, 0); c.v.set(0, 0, 0); } }
        }
        st.t -= dt; if (st.t <= 0) { if (c) { scene.remove(c.t); st.cae = null; } const f = st.fn; st.fn = null; f(); }
      } else if (st.fase === 'espera') { st.t -= dt; if (st.t <= 0) { const f = st.fn; st.fn = null; f(); } }
      animarJugador(dt, st.fase === 'apunta' ? potVis : 0, st.aim);
      // bandera, nubes y público
      const pa = banG.attributes.position.array;
      for (let i = 0; i < pa.length; i += 3) { const x = banBase[i], u = x / BW; pa[i + 2] = (Math.sin(x * 5.2 - st.tt * 5.4) * 0.085 + Math.sin(x * 9 - st.tt * 7.5 + banBase[i + 1] * 3) * 0.03) * u; pa[i + 1] = banBase[i + 1] + Math.sin(x * 3.1 - st.tt * 4) * 0.03 * u - u * u * 0.05; pa[i] = x - u * u * 0.06; }
      banG.attributes.position.needsUpdate = true; banG.computeVertexNormals(); bandera.rotation.y = Math.sin(st.tt * 0.7) * 0.1;
      nubes.forEach(s => { s.position.x += dt * 0.35; if (s.position.x > 125) s.position.x = -125; });
      if (salto > 0) {
        salto = Math.max(0, salto - dt / 1.7); const k = Math.min(1, salto * 3) * Math.min(1, (1 - salto) * 8);
        publico.forEach((g, i) => { g.position.y = Math.max(0, Math.sin((1 - salto) * 13 + i * 1.7)) * 0.09 * k; g.userData.b.forEach((b, j) => { b.rotation.x = .35 + k * (2.4 + Math.sin(st.tt * 13 + i * 2 + j) * .25); }); });
      }
      // efectos
      chispas.update(dt); nucleo.update(dt); brasas.update(dt); terrones.update(dt);
      if (humoV > 0) { humoV -= dt / 1.9; humo.forEach(s => { s.position.addScaledVector(s.userData.v, dt); s.userData.v.y -= dt * 0.6; s.scale.multiplyScalar(1 + dt * 1.6); s.material.opacity = 0.5 * Math.max(humoV, 0); }); }
      if (fuegoV > 0) { fuegoV -= dt / 0.45; const k = Math.max(fuegoV, 0); fuego[0].material.opacity = .8 * k; fuego[1].material.opacity = .9 * k; fuego[2].material.opacity = k; fuego.forEach((s, i) => s.scale.setScalar([1.5, .8, .3][i] * (1.7 - k * .7))); }
      if (manoV > 0) { manoV -= dt / 2.2; aroMano.material.opacity = Math.max(0, manoV) * (0.6 + 0.4 * Math.sin(st.tt * 14)); aroMano.scale.setScalar(1 + (1 - manoV) * .5); } else aroMano.material.opacity = 0;
      if (bocV > 0) { bocV -= dt / 0.9; aroBoc.scale.setScalar(1 + (1 - bocV) * 2.6); aroBoc.material.opacity = .9 * Math.max(bocV, 0); }
      if (ondaV > 0) { ondaV -= dt / 0.5; aroOnda.scale.setScalar(1 + (1 - ondaV) * 7); aroOnda.material.opacity = .85 * Math.max(ondaV, 0) * Math.max(ondaV, 0); }
      boomI *= Math.pow(0.02, dt); boom.intensity = boomI; shake *= Math.pow(0.008, dt);
      // cámara: acompaña el vuelo, se acerca a la jugada y regresa suave
      let kc = 2.6;
      if (foco > 0) { foco -= real; camPD.set(focoP.x * .6 + .3, focoP.y + 1.25, focoP.z + 5.4); camLD.set(focoP.x * .7, focoP.y + .12, focoP.z); kc = 6; }
      else if (st.fase === 'vuelo') { const e = vu * vu * (3 - 2 * vu); camPD.lerpVectors(CAM0, CAM1, e); camLD.lerpVectors(LOOK0, LOOK1, e); kc = 7; }
      else if (st.fase === 'cae' || st.fase === 'espera') { camPD.copy(CAM1); camLD.copy(LOOK1); kc = 4; }
      else { camPD.copy(CAM0); camLD.copy(LOOK0); if (opt.demo) camPD.x += Math.sin(camT * 0.22) * 0.5; }
      const kk = 1 - Math.exp(-real * kc); camP.lerp(camPD, kk); camL.lerp(camLD, kk);
      cam.position.set(camP.x + (Math.random() - .5) * shake, camP.y + (Math.random() - .5) * shake, camP.z); cam.lookAt(camL);
    };
    game.dispose = function () { if (hud) hud.remove(); if (OJ.input === game.input) OJ.input = null; OJ.liberar(scene); extra.forEach(o => o.dispose()); };
    game.reiniciar = () => OJ.app.jugar('tejo', opt);

    if (!opt.demo) OJ.input = game.input;
    nuevaRonda();
    return game;
  };
  OJ.Tejo.tray = tray; OJ.Tejo.apuntarA = apuntarA;
})();
