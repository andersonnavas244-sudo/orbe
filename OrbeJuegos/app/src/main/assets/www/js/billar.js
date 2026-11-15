/*
 * Billar 3D — cuatro juegos en la misma mesa:
 *  · Bola 8 (pool): metes tus 7 bolas (lisas o rayadas) y al final la negra.
 *  · Bola 9 (pool): siempre le pegas primero a la bola de número más bajo; gana quien meta la 9.
 *  · Carambola libre: tu bola debe tocar las otras dos.
 *  · Tres bandas: carambola tocando 3 bandas o más antes de la segunda bola.
 * La física es 2D sobre el paño, con paso fijo, y es la misma para el tiro real y para lo que "piensa" la máquina.
 */
(function () {
  'use strict';
  const { V, std, tex, planks, noise, mesh, clamp } = OJ;
  const HX = 0.71, HZ = 1.42, BR = 0.0305, LX = HX - BR, LZ = HZ - BR, Y = 0.8, DT = 1 / 240, D2 = 4 * BR * BR;
  const V_MIN = 0.45, V_MAX = 5.4, vel = pot => V_MIN + Math.pow(pot, 1.25) * (V_MAX - V_MIN);
  const TRON = [[-HX, -HZ], [HX, -HZ], [-HX - 0.02, 0], [HX + 0.02, 0], [-HX, HZ], [HX, HZ]], CAP2 = 0.068 * 0.068, BOCA2 = 0.108 * 0.108;
  const COL = ['#f7f5ee', '#f2c21a', '#1d4fb8', '#d61f2c', '#6a2c91', '#f07a1a', '#1f8a4c', '#7a1f1f', '#161616'];

  /* ============================ física ============================ */
  function ev0() { return { bandas: 0, bolas: [], antes2: 0, cerca: 9, primera: -1, metidas: [] }; }
  function Fis(n, pool) { this.n = n; this.pool = pool; this.b = []; for (let i = 0; i < n; i++) this.b.push({ x: 0, z: 0, vx: 0, vz: 0, s: 0, f: 0, on: true }); this.cue = 0; this.ev = ev0(); }
  Fis.prototype.copiar = function (o) {
    for (let i = 0; i < this.n; i++) { const a = this.b[i], c = o.b[i]; a.x = c.x; a.z = c.z; a.vx = c.vx; a.vz = c.vz; a.s = c.s; a.f = c.f; a.on = c.on; }
    this.cue = o.cue;
  };
  Fis.prototype.tirar = function (i, ang, v, lado, alto) { const b = this.b[i]; b.vx = Math.sin(ang) * v; b.vz = -Math.cos(ang) * v; b.s = lado; b.f = alto; this.cue = i; this.ev = ev0(); };
  Fis.prototype.banda = function (b, nx, nz, cb) {      // n apunta hacia dentro de la mesa
    const vn = -(b.vx * nx + b.vz * nz), tx = nz, tz = -nx, vt = (b.vx * tx + b.vz * tz) * 0.93 + b.s * 0.3 * vn; b.s *= 0.5;
    const out = vn * 0.84; b.vx = nx * out + tx * vt; b.vz = nz * out + tz * vt;
    if (b === this.b[this.cue]) this.ev.bandas++;
    if (cb) cb('banda', vn);
  };
  Fis.prototype.paso = function (cb) {
    const bs = this.b, n = this.n, e = this.ev; let mov = false;
    for (let i = 0; i < n; i++) {
      const b = bs[i]; if (!b.on) continue;
      const v = Math.hypot(b.vx, b.vz);
      if (!(v >= 1e-5)) { b.vx = b.vz = 0; continue; }         // también corta valores inválidos
      mov = true;
      const nv = v - (0.2 + 0.1 * v) * DT;
      if (nv < 0.012) { b.vx = b.vz = 0; continue; }
      const k = nv / v; b.vx *= k; b.vz *= k; b.x += b.vx * DT; b.z += b.vz * DT;
      if (this.pool) {
        let boca = false;
        for (let p = 0; p < 6; p++) { const dx = b.x - TRON[p][0], dz = b.z - TRON[p][1], d2 = dx * dx + dz * dz; if (d2 < CAP2) { b.on = false; break; } if (d2 < BOCA2) boca = true; }
        if (b.on && boca && (Math.abs(b.x) > LX + 0.03 || Math.abs(b.z) > LZ + 0.03)) b.on = false;
        if (!b.on) { b.vx = b.vz = 0; e.metidas.push(i); if (cb) cb('tronera', v); continue; }
        if (boca) continue;
      }
      if (b.x > LX && b.vx > 0) { b.x = LX; this.banda(b, -1, 0, cb); } else if (b.x < -LX && b.vx < 0) { b.x = -LX; this.banda(b, 1, 0, cb); }
      if (b.z > LZ && b.vz > 0) { b.z = LZ; this.banda(b, 0, -1, cb); } else if (b.z < -LZ && b.vz < 0) { b.z = -LZ; this.banda(b, 0, 1, cb); }
    }
    for (let i = 0; i < n; i++) {
      const a = bs[i]; if (!a.on) continue;
      const am = a.vx !== 0 || a.vz !== 0;
      for (let j = i + 1; j < n; j++) {
        const c = bs[j]; if (!c.on || (!am && c.vx === 0 && c.vz === 0)) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= D2 || d2 < 1e-12) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, vn = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz, ov = (2 * BR - d) / 2;
        a.x -= nx * ov; a.z -= nz * ov; c.x += nx * ov; c.z += nz * ov;
        if (vn <= 0) continue;
        const q = (i === this.cue || j === this.cue) ? bs[this.cue] : null; let ux = 0, uz = 0;
        if (q && q.f) { const sp = Math.hypot(q.vx, q.vz); if (sp > 1e-6) { ux = q.vx / sp; uz = q.vz / sp; } }
        const J = vn * 0.975; a.vx -= J * nx; a.vz -= J * nz; c.vx += J * nx; c.vz += J * nz;
        if (q) {
          if (q.f) { const k = q.f * 0.5 * vn; q.vx += ux * k; q.vz += uz * k; q.f = 0; }   // efecto alto (corrido) o bajo (retroceso)
          const o = i === this.cue ? j : i;
          if (e.primera < 0) e.primera = o;
          if (e.bolas.indexOf(o) < 0) { e.bolas.push(o); if (e.bolas.length === 2) e.antes2 = e.bandas; }
        }
        if (cb) cb('bola', vn);
      }
    }
    if (!this.pool && e.bolas.length === 1) {
      const q = bs[this.cue], o = bs[3 - this.cue - e.bolas[0]], dd = Math.hypot(q.x - o.x, q.z - o.z) - 2 * BR;
      if (dd < e.cerca) e.cerca = dd;
    }
    return mov;
  };
  Fis.prototype.simular = function (max) { let k = 0; while (k < max && this.paso()) k++; return this.ev; };
  /* Acomoda las bolas para empezar */
  Fis.prototype.armar = function (modo) {
    const b = this.b; b.forEach(x => { x.vx = x.vz = x.s = x.f = 0; x.on = true; });
    if (!this.pool) { [[0.18, 0.71], [0, 0.71], [0, -0.71]].forEach((p, i) => { b[i].x = p[0]; b[i].z = p[1]; }); return; }
    b[0].x = 0; b[0].z = 0.71;
    const paso = 2 * BR * 1.012, fila = paso * 0.866, mezcla = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    let orden, filas;
    if (modo === 'bola9') { const r = mezcla([2, 3, 4, 5, 6, 7, 8]); orden = [1, r[0], r[1], r[2], 9, r[3], r[4], r[5], r[6]]; filas = [1, 2, 3, 2, 1]; }
    else {      // triángulo: la 8 en el centro y en las esquinas de atrás una lisa y una rayada
      const li = mezcla([1, 2, 3, 4, 5, 6, 7]), ra = mezcla([9, 10, 11, 12, 13, 14, 15]), e1 = li.pop(), e2 = ra.pop(), r = mezcla(li.concat(ra));
      orden = []; for (let k = 0; k < 15; k++) orden.push(k === 4 ? 8 : k === 10 ? e1 : k === 14 ? e2 : r.pop());
      filas = [1, 2, 3, 4, 5];
    }
    let k = 0;
    filas.forEach((nf, f) => { for (let i = 0; i < nf; i++) { const o = b[orden[k++]]; o.x = (i - (nf - 1) / 2) * paso; o.z = -0.71 - f * fila; } });
  };
  OJ.BillarFis = Fis;

  /* La máquina, en carambola: prueba tiros al azar en una copia de la mesa y se queda con el mejor */
  const IA_N = [[10, 45, 170], [12, 45, 170]], IA_ERR = [[0.03, 0.01, 0.004], [0.012, 0.006, 0.003]], IA_POOL = [0.022, 0.009, 0.003];
  function candidato(fis, sim, cue, tres) {
    const c = fis.b[cue]; let ang;
    if (Math.random() < 0.72) {
      const o = fis.b[[0, 1, 2].filter(i => i !== cue)[Math.random() < .5 ? 0 : 1]], d = Math.hypot(o.x - c.x, o.z - c.z);
      ang = Math.atan2(o.x - c.x, -(o.z - c.z)) + (Math.random() * 2 - 1) * Math.asin(Math.min(1, 2 * BR / d)) * 0.97;
    } else ang = Math.random() * 6.2832;
    const pot = 0.25 + Math.random() * 0.7, lado = (Math.random() * 2 - 1) * 0.8, alto = (Math.random() * 2 - 1) * 0.6;
    sim.copiar(fis); sim.tirar(cue, ang, vel(pot), lado, alto);
    const e = sim.simular(4000), ok = e.bolas.length === 2 && (!tres || e.antes2 >= 3);
    const sc = ok ? 1000 - Math.abs(pot - 0.5) * 60 : e.bolas.length === 2 ? 500 + e.antes2 * 50 : e.bolas.length === 1 ? 300 - e.cerca * 150 + (tres ? Math.min(e.bandas, 3) * 20 : 0) : 0;
    return { sc, ang, pot, lado, alto };
  }

  /* ============================ juego ============================ */
  OJ.Billar = function (opt) {
    opt = Object.assign({ modo: 'bola8', rival: 'ia', dif: 1, meta: 10 }, opt);
    const pool = opt.modo === 'bola8' || opt.modo === 'bola9', b9 = opt.modo === 'bola9', tres = opt.modo === 'tres';
    const NB = pool ? (b9 ? 10 : 16) : 3;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(56, 1, 0.03, 60);
    const game = { scene, cam, exposure: 1.15, nombre: 'billar' };
    const nombres = opt.rival === 'ia' ? ['Tú', 'El Profe'] : (pool ? ['Jugador 1', 'Jugador 2'] : ['Blanca', 'Amarilla']);
    const esIA = t => opt.rival === 'ia' && t === 1;
    const fis = new Fis(NB, pool), sim = new Fis(NB, pool); fis.armar(opt.modo);
    game.fis = fis;
    const TITULO = { bola8: 'Bola 8', bola9: 'Bola 9', libre: 'Carambola libre', tres: 'Tres bandas' }[opt.modo];

    /* ---------------- escena: salón de billar, mesa con troneras de verdad, bolas brillantes y taco ---------------- */
    OJ.semilla(23);
    const rnd = OJ.rnd, PI = Math.PI, V2 = (x, y) => new THREE.Vector2(x, y), basico = o => new THREE.MeshBasicMaterial(o);
    const CW = 0.05, RW = 0.13, IX = HX + CW, IZ = HZ + CW, OX = IX + RW, OZ = IZ + RW;      // ancho de la banda y de la baranda: la nariz de la banda queda justo en ±HX y ±HZ
    const ALTO = 0.046, NARIZ = 0.037, HOYO = 0.072, CORTE = 0.094;                           // alturas sobre el paño y radios de la tronera (hueco y recorte de la baranda)
    const extras = [];                                                                        // texturas que OJ.liberar no alcanza a ver
    scene.background = new THREE.Color(0x060509);
    /* reflejos de estudio: cuatro paneles de luz arriba (ninguno justo encima, para que el barniz no encandile visto desde arriba) y el salón tibio alrededor */
    OJ.entorno(scene, '#2a211a', pool ? '#07170f' : '#08121f', [
      { p: [-2, 10, -3.4], w: 1.5, h: 2.1, c: 0xfff0d4, f: 16 }, { p: [2, 10, -3.4], w: 1.5, h: 2.1, c: 0xfff0d4, f: 16 }, { p: [-2, 10, 3.4], w: 1.5, h: 2.1, c: 0xfff0d4, f: 16 }, { p: [2, 10, 3.4], w: 1.5, h: 2.1, c: 0xfff0d4, f: 16 },
      { p: [-10, 3.5, 0], w: 7, h: 4, c: 0xffd9b0, f: 0.9 }, { p: [10, 3.5, 0], w: 7, h: 4, c: 0xffd9b0, f: 0.9 }, { p: [0, 3, -10], w: 6, h: 2.4, c: 0xff5fb0, f: 1.3 }, { p: [0, 4, 10], w: 8, h: 4, c: 0xfff0e0, f: 0.7 }]);

    /* salón: parqué, tapete bajo la mesa y paredes. La luz va pintada en las texturas, así no le cuesta nada al celular */
    const pisoG = new THREE.PlaneGeometry(18, 18, 24, 24).rotateX(-PI / 2);
    {
      const p = pisoG.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) * 1.15, z = p.getZ(i) * 0.85, k = 0.08 + 0.76 * Math.exp(-(x * x + z * z) / 9); col[i * 3] = k; col[i * 3 + 1] = k * 0.92; col[i * 3 + 2] = k * 0.82; }
      pisoG.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    mesh(scene, pisoG, basico({ vertexColors: true, map: tex(512, 512, (g, w) => {
      const c = w / 4, pl = c / 4, tonos = ['#5a3722', '#4e2f1c', '#633e27', '#482a18', '#553321'];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
        const hor = (i + j) % 2 === 0, x = i * c + (hor ? 0 : k * pl), y = j * c + (hor ? k * pl : 0), pw = hor ? c : pl, ph = hor ? pl : c;
        g.fillStyle = tonos[Math.floor(rnd() * tonos.length)]; g.fillRect(x, y, pw, ph);
        for (let q = 0; q < 14; q++) { g.fillStyle = 'rgba(' + (rnd() < .5 ? '20,8,2' : '176,116,64') + ',' + (0.04 + rnd() * 0.09).toFixed(3) + ')'; const t = rnd() * (pl - 2); if (hor) g.fillRect(x, y + t, pw, 1 + rnd()); else g.fillRect(x + t, y, 1 + rnd(), ph); }
        g.strokeStyle = 'rgba(8,3,1,.8)'; g.lineWidth = 1.5; g.strokeRect(x + .75, y + .75, pw - 1.5, ph - 1.5);
      }
    }, 12, 12) }), V(0, 0, 0), false);
    const AW = 2.3, AL = 4.0;
    mesh(scene, new THREE.PlaneGeometry(AW, AL).rotateX(-PI / 2), basico({ map: tex(1024, 2048, (g, w, h) => {
      g.setTransform(w / AW, 0, 0, h / AL, w / 2, h / 2);        // se dibuja en metros
      const marco = (m, color) => { g.fillStyle = color; g.fillRect(-AW / 2 + m, -AL / 2 + m, AW - 2 * m, AL - 2 * m); };
      const rombo = (x, z, r, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(x - r, z); g.lineTo(x, z - r); g.lineTo(x + r, z); g.lineTo(x, z + r); g.closePath(); g.fill(); };
      marco(0, '#120a0c'); marco(0.022, '#b98c3e'); marco(0.036, '#141f38'); marco(0.156, '#b98c3e'); marco(0.168, '#33101a'); marco(0.2, '#9a7330'); marco(0.207, '#561726');
      const cen = 0.096, nx = Math.round((AW - 2 * cen) / 0.115), nz = Math.round((AL - 2 * cen) / 0.115);      // cenefa de rombos dorados
      for (let k = 0; k <= nz; k++) [-1, 1].forEach(s => { const z = -AL / 2 + cen + k * (AL - 2 * cen) / nz, x = s * (AW / 2 - cen); rombo(x, z, 0.04, '#c79a48'); rombo(x, z, 0.024, '#141f38'); rombo(x, z, 0.011, '#e3c078'); });
      for (let k = 1; k < nx; k++) [-1, 1].forEach(s => { const x = -AW / 2 + cen + k * (AW - 2 * cen) / nx, z = s * (AL / 2 - cen); rombo(x, z, 0.04, '#c79a48'); rombo(x, z, 0.024, '#141f38'); rombo(x, z, 0.011, '#e3c078'); });
      g.save(); g.beginPath(); g.rect(-AW / 2 + 0.207, -AL / 2 + 0.207, AW - 0.414, AL - 0.414); g.clip();      // campo: enrejado fino con florecitas
      g.strokeStyle = 'rgba(222,176,98,.13)'; g.lineWidth = 0.006;
      for (let k = -24; k <= 24; k++) { g.beginPath(); g.moveTo(k * 0.2 - 3, -3); g.lineTo(k * 0.2 + 3, 3); g.moveTo(k * 0.2 + 3, -3); g.lineTo(k * 0.2 - 3, 3); g.stroke(); }
      for (let a = -24; a <= 24; a++) for (let b = -24; b <= 24; b++) { const x = (a + b) * 0.1, z = (a - b) * 0.1; if (Math.abs(x) < AW / 2 && Math.abs(z) < AL / 2) { rombo(x, z, 0.022, 'rgba(222,176,98,.3)'); rombo(x, z, 0.009, '#561726'); } }
      g.restore(); g.setTransform(1, 0, 0, 1, 0, 0);
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, h * 0.6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.62)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);      // la luz se apaga hacia las puntas
      g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 80; g.fillStyle = '#000';                                      // sombra de la mesa sobre el tapete
      for (let k = 0; k < 2; k++) g.fillRect(w / 2 - (OX - 0.03) * w / AW, h / 2 - (OZ - 0.03) * h / AL, 2 * (OX - 0.03) * w / AW, 2 * (OZ - 0.03) * h / AL);
    }) }), V(0, 0.004, 0), false);
    const paredM = basico({ map: tex(512, 512, (g, w, h) => {
      g.fillStyle = '#1b2f27'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(214,170,96,.16)'; g.fillRect(x + 15, 0, 2, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 8, h); }
      const y0 = h * 0.66; g.fillStyle = '#3c2012'; g.fillRect(0, y0, w, h - y0);                                     // zócalo de madera
      for (let x = 0; x < w; x += 128) { g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 4; g.strokeRect(x + 14, y0 + 22, 100, h - y0 - 44); g.strokeStyle = 'rgba(255,190,120,.14)'; g.lineWidth = 2; g.strokeRect(x + 18, y0 + 26, 92, h - y0 - 52); }
      g.fillStyle = '#5e3620'; g.fillRect(0, y0, w, 9); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, y0 + 9, w, 4);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.86)'); gr.addColorStop(0.45, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,.62)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, 6, 1) }), paredG = new THREE.PlaneGeometry(9.6, 3.4);
    mesh(scene, paredG, paredM, V(0, 1.7, -3.6), false); mesh(scene, paredG, paredM, V(0, 1.7, 6), false).rotation.y = PI;
    mesh(scene, paredG, paredM, V(-4.8, 1.7, 1.2), false).rotation.y = PI / 2; mesh(scene, paredG, paredM, V(4.8, 1.7, 1.2), false).rotation.y = -PI / 2;
    const neon = mesh(scene, new THREE.PlaneGeometry(2.6, 0.65), basico({ transparent: true, toneMapped: false, map: tex(1024, 256, (g, w, h) => {
      g.font = '800 140px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3fa4'; g.shadowBlur = 50; g.fillStyle = '#ffd6ee';
      for (let i = 0; i < 4; i++) g.fillText('Billar Colombia', w / 2, h / 2 + 8);
    }) }), V(0, 2.15, -3.56), false);
    neon.scale.setScalar(1.1);
    [[-3.1, -3.5], [3.1, -3.5], [-4.7, 0], [4.7, 0], [-4.7, 3.4], [4.7, 3.4]].forEach(p => { OJ.sprite(scene, 0xffb45e, V(p[0], 2.2, p[1]), 1.5, 0.5, true); OJ.sprite(scene, 0xfff0d0, V(p[0], 2.2, p[1]), 0.3, 0.9, true); });      // apliques de pared

    /* paño: tela fina que se repite; encima va un velo con la luz de la lámpara (claro al centro) y la sombra de las bandas */
    const feltC = pool ? '#17834c' : '#1f63b8';
    const panoT = tex(512, 512, (g, w, h) => {
      const c = new THREE.Color(feltC), id = g.createImageData(w, h), d = id.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4, n = (0.93 + rnd() * 0.14 + (((x + y * 3) & 7) < 4 ? 0.025 : -0.025)) * 255;
        d[k] = c.r * n; d[k + 1] = c.g * n; d[k + 2] = c.b * n; d[k + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      for (let i = 0; i < 2400; i++) { const x = rnd() * w, y = rnd() * h, l = 3 + rnd() * 7, a = 0.5 + rnd() * 0.5; g.strokeStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,20,.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }, 1 / 0.36, 1 / 0.36);
    const BX = 0.82, BZ = 1.56;      // la pizarra sigue por debajo de las barandas
    const luzT = tex(512, 1024, (g, w, h) => {
      g.fillStyle = '#868686'; g.fillRect(0, 0, w, h);
      g.setTransform(w / (2 * BX), 0, 0, h / (2 * BZ), w / 2, h / 2);        // se dibuja en metros
      const halo = (x, z, r, c0, c1, c2) => { const gr = g.createRadialGradient(x, z, 0, x, z, r); gr.addColorStop(0, c0); gr.addColorStop(0.55, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(x - r, z - r, 2 * r, 2 * r); };
      g.globalCompositeOperation = 'lighter';
      [-0.8, 0, 0.8].forEach(z => halo(0, z, 1.1, 'rgba(255,255,255,.36)', 'rgba(255,255,255,.15)', 'rgba(255,255,255,0)'));
      for (let i = 0; i < 26; i++) halo((rnd() * 2 - 1) * HX, (rnd() * 2 - 1) * HZ, 0.12 + rnd() * 0.3, 'rgba(255,255,255,.035)', 'rgba(255,255,255,.015)', 'rgba(255,255,255,0)');      // el paño nunca es parejo del todo
      g.globalCompositeOperation = 'source-over';
      const S = 0.07, sombra = (x0, z0, x1, z1, rx, rz, rw, rh) => { const gr = g.createLinearGradient(x0, z0, x1, z1); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.3, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(rx, rz, rw, rh); };
      sombra(-HX, 0, -HX + S, 0, -HX, -HZ, S, 2 * HZ); sombra(HX, 0, HX - S, 0, HX - S, -HZ, S, 2 * HZ); sombra(0, -HZ, 0, -HZ + S, -HX, -HZ, 2 * HX, S); sombra(0, HZ, 0, HZ - S, -HX, HZ - S, 2 * HX, S);
      if (pool) TRON.forEach(p => halo(p[0], p[1], 0.17, 'rgba(0,0,0,.55)', 'rgba(0,0,0,.22)', 'rgba(0,0,0,0)'));
      g.fillStyle = 'rgba(255,255,255,.22)'; (pool ? [[0, 0.71], [0, -0.71]] : [[0, 0.71], [0.18, 0.71], [-0.18, 0.71], [0, 0], [0, -0.71]]).forEach(p => { g.beginPath(); g.arc(p[0], p[1], 0.008, 0, 6.3); g.fill(); });      // moscas del paño
      g.setTransform(1, 0, 0, 1, 0, 0);
      const id = g.getImageData(0, 0, w, h), d = id.data;      // lo claro deja ver el paño, lo oscuro lo apaga
      for (let k = 0; k < d.length; k += 4) { d[k + 3] = 255 - d[k]; d[k] = d[k + 1] = d[k + 2] = 0; }
      g.putImageData(id, 0, 0);
    });
    const velo = mesh(scene, new THREE.PlaneGeometry(2 * BX, 2 * BZ).rotateX(-PI / 2), basico({ map: luzT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), V(0, Y + 0.0006, 0), false);
    velo.renderOrder = 0.5;
    const cama = new THREE.Shape([V2(-BX, -BZ), V2(BX, -BZ), V2(BX, BZ), V2(-BX, BZ)]);
    if (pool) TRON.forEach(p => { const c = []; for (let k = 0; k < 40; k++) c.push(V2(p[0] + HOYO * Math.cos(k / 40 * 2 * PI), -p[1] + HOYO * Math.sin(k / 40 * 2 * PI))); cama.holes.push(new THREE.Path(c)); });
    const panoM = std({ map: panoT, roughness: 1, metalness: 0, envMapIntensity: 0.2 });
    const pano = new THREE.Mesh(new THREE.ShapeGeometry(cama).rotateX(-PI / 2).translate(0, Y, 0), panoM); pano.receiveShadow = true; scene.add(pano);

    /* bandas: caucho forrado con su chaflán; en pool se abren en cada tronera exactamente donde la física deja pasar la bola */
    const cP = [], cN = [], cU = [];
    function cara(c, pts) {      // polígono en abanico, con la normal hacia fuera
      for (let k = 1; k < pts.length - 1; k++) {
        const a = pts[0]; let b = pts[k], d = pts[k + 1];
        let nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (nx * (a[0] - c[0]) + ny * (a[1] - c[1]) + nz * (a[2] - c[2]) < 0) { const t = b; b = d; d = t; nx = -nx; ny = -ny; nz = -nz; }
        [a, b, d].forEach(p => { cP.push(p[0], p[1], p[2]); cN.push(nx, ny, nz); cU.push(p[0] + p[1], p[2] + p[1]); });
      }
    }
    function banda3d(n0, n1, b0, b1) {      // n: puntas de la nariz · b: puntas de atrás, contra la baranda (x, z)
      const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const P = [[n0, b0], [n1, b1]].map(e => { const n = e[0], b = e[1], u = mix(n, b, 0.1), s = mix(n, b, 0.42); return { n: [n[0], Y + NARIZ, n[1]], t: [b[0], Y + ALTO, b[1]], u: [u[0], Y + NARIZ - 0.011, u[1]], s: [s[0], Y, s[1]], f: [b[0], Y, b[1]] }; });
      const c = [(n0[0] + n1[0] + b0[0] + b1[0]) / 4, Y + 0.02, (n0[1] + n1[1] + b0[1] + b1[1]) / 4];
      cara(c, [P[0].n, P[1].n, P[1].t, P[0].t]); cara(c, [P[0].u, P[1].u, P[1].n, P[0].n]); cara(c, [P[0].s, P[1].s, P[1].u, P[0].u]);
      P.forEach(p => cara(c, [p.t, p.f, p.s, p.u, p.n]));
    }
    const kE = Math.sqrt(CORTE * CORTE - CW * CW), kM = Math.sqrt(CORTE * CORTE - 0.03 * 0.03);      // dónde corta el recorte de la tronera el borde de la baranda (esquina y medio)
    [-1, 1].forEach(s => {
      if (pool) {
        banda3d([-(HX - 0.104), s * HZ], [HX - 0.104, s * HZ], [-(HX - kE), s * IZ], [HX - kE, s * IZ]);
        [-1, 1].forEach(q => banda3d([s * HX, q * 0.098], [s * HX, q * (HZ - 0.104)], [s * IX, q * kM], [s * IX, q * (HZ - kE)]));
      } else { banda3d([-HX, s * HZ], [HX, s * HZ], [-IX, s * IZ], [IX, s * IZ]); banda3d([s * HX, -HZ], [s * HX, HZ], [s * IX, -IZ], [s * IX, IZ]); }
    });
    const bandaG = new THREE.BufferGeometry();
    bandaG.setAttribute('position', new THREE.Float32BufferAttribute(cP, 3)); bandaG.setAttribute('normal', new THREE.Float32BufferAttribute(cN, 3)); bandaG.setAttribute('uv', new THREE.Float32BufferAttribute(cU, 2));
    const bandaM = panoM.clone(); bandaM.color.setScalar(0.6);
    mesh(scene, bandaG, bandaM);

    /* baranda de madera barnizada: cuatro piezas a inglete (la veta corre a lo largo de cada una), recortadas en las troneras */
    const maderaT = tex(1024, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6c2d14'); gr.addColorStop(0.5, '#59220f'); gr.addColorStop(1, '#692a12'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 280; k++) {
        const y0 = rnd() * h, amp = 1 + rnd() * 7, n = 1 + Math.floor(rnd() * 3), ph = rnd() * 6.28, osc = rnd() < 0.62;
        g.strokeStyle = 'rgba(' + (osc ? '30,7,2' : '222,134,72') + ',' + (0.05 + rnd() * (osc ? 0.22 : 0.1)).toFixed(3) + ')'; g.lineWidth = 0.6 + rnd() * 2.2; g.beginPath();
        for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + amp * Math.sin(x / w * 2 * PI * n + ph));
        g.stroke();
      }
      for (let k = 0; k < 900; k++) { g.fillStyle = 'rgba(20,5,0,' + (rnd() * 0.13).toFixed(3) + ')'; g.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 30, 1); }
    }, 1, 1);
    const maderaM = std({ map: maderaT, roughness: 0.24, metalness: 0, envMapIntensity: 0.4 });
    function baranda(Ha, Hb, medio, aXZ, aAB, corre) {      // contorno en (a hacia fuera, b a lo largo)
      const ia = Ha + CW, ib = Hb + CW, oa = ia + RW, ob = ib + RW, rr = 0.075, P = [];
      const arco = (ca, cb, r, t0, t1, n) => { for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n; P.push([ca + r * Math.cos(t), cb + r * Math.sin(t)]); } };
      if (pool) {
        const t = Math.atan2(kE, CW);
        arco(Ha, -Hb, CORTE, -PI / 4, t, 12);
        if (medio) { const tm = Math.atan2(kM, 0.03); arco(Ha + 0.02, 0, CORTE, -tm, tm, 16); }
        arco(Ha, Hb, CORTE, -t, PI / 4, 12);
      } else P.push([ia, -ib], [ia, ib]);
      arco(oa - rr, ob - rr, rr, PI / 4, 0, 5); arco(oa - rr, -ob + rr, rr, 0, -PI / 4, 5);
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(P.map(p => { const q = aXZ(p[0], p[1]); return V2(q[0], q[1]); })), { depth: 0.07, steps: 1, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelOffset: -0.005, bevelSegments: 2 });
      g.rotateX(PI / 2);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { const q = aAB(p.getX(i), p.getZ(i)); uv.setXY(i, q[1] / 1.3 + corre, (q[0] - ia - p.getY(i)) / 0.36 + 0.06); }
      const m = mesh(scene, g, maderaM, V(0, Y + ALTO - 0.005, 0)); m.castShadow = false;
    }
    [1, -1].forEach(s => {
      baranda(HX, HZ, pool, (a, b) => [s * a, b], (x, z) => [Math.abs(x), z], 0.2 + 0.23 * s);
      baranda(HZ, HX, false, (a, b) => [b, s * a], (x, z) => [Math.abs(z), x], 0.6 + 0.17 * s);
    });
    /* rombos de nácar */
    const dP = [], dN = [], nacar = (x, z, lx, lz) => { const y = Y + ALTO + 0.0008; dP.push(x - lx, y, z, x, y, z + lz, x + lx, y, z, x - lx, y, z, x + lx, y, z, x, y, z - lz); for (let k = 0; k < 6; k++) dN.push(0, 1, 0); };
    for (let k = 1; k <= 7; k++) [-1, 1].forEach(s => { if (!(pool && k === 4)) nacar(s * (IX + RW / 2), -HZ + k * HZ / 4, 0.0085, 0.017); });
    for (let k = 1; k <= 3; k++) [-1, 1].forEach(s => nacar(-HX + k * HX / 2, s * (IZ + RW / 2), 0.017, 0.0085));
    const nacarG = new THREE.BufferGeometry(); nacarG.setAttribute('position', new THREE.Float32BufferAttribute(dP, 3)); nacarG.setAttribute('normal', new THREE.Float32BufferAttribute(dN, 3));
    mesh(scene, nacarG, std({ color: 0xe9e4d6, emissive: 0x3a362e, roughness: 0.18, metalness: 0.2, envMapIntensity: 1.4 }), null, false);

    /* troneras: hueco hondo y oscuro, forro de cuero alrededor de la boca y un aro de latón sobre la madera */
    const laton = std({ color: 0xc99a44, metalness: 1, roughness: 0.3, envMapIntensity: 1.15 });
    if (pool) {
      const hoyoG = new THREE.LatheGeometry([V2(0.001, -0.17), V2(HOYO * 0.86, -0.17), V2(HOYO, 0.0005)], 36);
      const hoyoM = basico({ side: THREE.DoubleSide, map: tex(8, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a322b'); gr.addColorStop(0.1, '#19130f'); gr.addColorStop(0.32, '#050403'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) });
      const forroM = std({ color: 0x100d0b, roughness: 0.5, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.7 });
      const forroP = [V2(HOYO, -0.012), V2(HOYO, ALTO + 0.0015), V2(HOYO + 0.0035, ALTO + 0.0055), V2(CORTE - 0.002, ALTO + 0.0055), V2(CORTE + 0.003, ALTO + 0.0008)];
      const aroP = [V2(CORTE + 0.003, ALTO + 0.0004), V2(CORTE + 0.0055, ALTO + 0.0038), V2(CORTE + 0.014, ALTO + 0.0038), V2(CORTE + 0.0165, ALTO + 0.0004)];
      TRON.forEach(p => {
        const esq = p[1] !== 0, dir = Math.atan2(Math.sign(p[1]), Math.sign(p[0])), med = esq ? PI / 4 + Math.atan2(kE, CW) : Math.atan2(kM, 0.03), pos = V(p[0], Y, p[1]);
        mesh(scene, hoyoG, hoyoM, pos, false);
        mesh(scene, new THREE.LatheGeometry(forroP, 30, PI / 2 - dir - med, 2 * med), forroM, pos, false).receiveShadow = true;
        mesh(scene, new THREE.LatheGeometry(aroP, 30, PI / 2 - dir - med + 0.13, 2 * med - 0.26), laton, pos, false);
      });
    }
    /* cuerpo y patas */
    const cuerpoM = std({ map: maderaT, color: 0x8c8c8c, roughness: 0.42, metalness: 0, envMapIntensity: 0.3 });
    [-1, 1].forEach(s => {      // faldón hueco: por dentro quedan los huecos de las troneras
      mesh(scene, new THREE.BoxGeometry(0.04, 0.25, (OZ - 0.03) * 2), cuerpoM, V(s * (OX - 0.05), Y - 0.155, 0), false); mesh(scene, new THREE.BoxGeometry((OX - 0.07) * 2, 0.25, 0.04), cuerpoM, V(0, Y - 0.155, s * (OZ - 0.05)), false);
    });
    mesh(scene, new THREE.PlaneGeometry((OX - 0.07) * 2, (OZ - 0.07) * 2).rotateX(-PI / 2), basico({ color: 0x000000 }), V(0, Y - 0.2, 0), false);
    const pataG = new THREE.CylinderGeometry(0.085, 0.06, Y - 0.28, 20), pieG = new THREE.CylinderGeometry(0.075, 0.085, 0.04, 20);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => { mesh(scene, pataG, cuerpoM, V(q[0] * (OX - 0.2), (Y - 0.28) / 2, q[1] * (OZ - 0.28)), false); mesh(scene, pieG, laton, V(q[0] * (OX - 0.2), 0.02, q[1] * (OZ - 0.28)), false); });

    /* lámpara de tres pantallas (se esconde cuando la cámara mira desde arriba) y luces */
    const lampara = new THREE.Group(); scene.add(lampara);
    mesh(lampara, new THREE.CylinderGeometry(0.014, 0.014, 2.2, 10).rotateX(PI / 2), laton, V(0, 2.12, 0), false);
    const pantG = new THREE.CylinderGeometry(0.07, 0.27, 0.2, 28, 1, true), pantM = std({ color: 0x0c4a2d, roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.9 });
    const focoG = new THREE.CircleGeometry(0.25, 28).rotateX(PI / 2), focoM = basico({ color: 0xfff0cc, toneMapped: false }), cuelgaG = new THREE.CylinderGeometry(0.006, 0.006, 1.3, 6);
    [-0.8, 0, 0.8].forEach(z => { mesh(lampara, pantG, pantM, V(0, 1.97, z), false); mesh(lampara, focoG, focoM, V(0, 1.888, z), false); OJ.sprite(lampara, 0xffdf9e, V(0, 1.87, z), 1.2, 0.3, true); });
    [-0.95, 0.95].forEach(z => mesh(lampara, cuelgaG, laton, V(0, 2.77, z), false));
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x20160f, 0.3));
    const sol = new THREE.DirectionalLight(0xfff1d8, 0.72); sol.position.set(-0.45, Y + 3.6, -1.0); sol.target.position.set(0, Y, 0); scene.add(sol.target);
    sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.camera.up.set(0, 0, -1);      // una sola luz con sombras, encuadrada justo en la mesa
    Object.assign(sol.shadow.camera, { left: -1.15, right: 1.15, top: 1.95, bottom: -1.95, near: 1.5, far: 5.5 }); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.003; scene.add(sol);

    /* bolas: textura nítida (el redondel del número se corrige para que salga redondo sobre la esfera), barniz brillante y sombra de contacto */
    function bolaTex(i) {
      return tex(512, 256, (g, w, h) => {
        const RAD = h / PI, MARFIL = '#f6f1e2';
        const disco = (u, a, color) => { g.fillStyle = color; g.beginPath(); for (let k = 0; k < 56; k++) { const t = k / 56 * 2 * PI; g.lineTo(u * w + Math.atan2(Math.sin(a) * Math.cos(t), Math.cos(a)) * RAD, h / 2 - Math.asin(Math.sin(a) * Math.sin(t)) * RAD); } g.closePath(); g.fill(); };
        const puntos = color => { [0, 0.25, 0.5, 0.75, 1].forEach(u => disco(u, 0.13, color)); g.fillStyle = color; g.fillRect(0, 0, w, 0.13 * RAD); g.fillRect(0, h - 0.13 * RAD, w, 0.13 * RAD); };      // seis puntitos para que se note el giro
        if (!pool) { g.fillStyle = [MARFIL, '#f2c21a', '#cf1f2b'][i]; g.fillRect(0, 0, w, h); puntos(i === 2 ? '#ffffff' : '#c2261e'); return; }
        if (i === 0) { g.fillStyle = MARFIL; g.fillRect(0, 0, w, h); puntos('#d61f2c'); return; }
        const c = COL[i > 8 ? i - 8 : i];
        if (i > 8) { g.fillStyle = MARFIL; g.fillRect(0, 0, w, h); g.fillStyle = c; g.fillRect(0, h * 0.305, w, h * 0.39); } else { g.fillStyle = c; g.fillRect(0, 0, w, h); }
        [0.25, 0.75].forEach(u => {
          disco(u, 0.41, '#fbf8ee');
          g.fillStyle = '#141414'; g.font = '900 ' + (i > 9 ? 37 : 47) + 'px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i), u * w, h / 2 + 3);
          if (i === 6 || i === 9) g.fillRect(u * w - 11, h / 2 + 20, 22, 3.5);
        });
      });
    }
    const bG = new THREE.SphereGeometry(BR, 36, 24), BRILLO = 1.5;
    const bolas = fis.b.map((_, i) => { const m = mesh(scene, bG, std({ map: bolaTex(i), roughness: 0.07, metalness: 0, envMapIntensity: BRILLO })); m.receiveShadow = false; return m; });
    const prev = fis.b.map(() => ({ x: 0, z: 0 })), qTmp = new THREE.Quaternion(), ejeTmp = V(0, 0, 0), ejeY = V(0, 1, 0), ejeZ = V(0, 0, 1);
    const est = fis.b.map(() => ({ c: 0, t: 0, x: 0, z: 0, tx: 0, tz: 0 }));      // c: 0 en la mesa · 1 cayendo a la tronera · 2 guardada · 3 volviendo a la mesa
    const sPos = new Float32Array(NB * 12), sUv = new Float32Array(NB * 8), sIdx = [], sG = new THREE.BufferGeometry();
    for (let i = 0; i < NB; i++) { sUv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8); sIdx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3); }
    sG.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sG.setAttribute('uv', new THREE.BufferAttribute(sUv, 2)); sG.setIndex(sIdx);
    const sombras = new THREE.Mesh(sG, basico({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, map: tex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(0.5, 'rgba(0,0,0,.52)'); gr.addColorStop(0.72, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }) }));
    sombras.frustumCulled = false; sombras.renderOrder = 1; scene.add(sombras);
    function sombra(i, x, z, k) {      // manchita oscura bajo la bola, un pelo corrida hacia donde cae la luz
      const r = BR * 1.75 * k, y = Y + 0.0012, o = i * 12; x += 0.004; z += 0.007;
      sPos[o] = x - r; sPos[o + 1] = y; sPos[o + 2] = z - r; sPos[o + 3] = x + r; sPos[o + 4] = y; sPos[o + 5] = z - r; sPos[o + 6] = x - r; sPos[o + 7] = y; sPos[o + 8] = z + r; sPos[o + 9] = x + r; sPos[o + 10] = y; sPos[o + 11] = z + r;
    }
    function colocar() {
      bolas.forEach((m, i) => {
        const b = fis.b[i]; m.position.set(b.x, Y + BR, b.z); m.visible = b.on; prev[i].x = b.x; prev[i].z = b.z; sombra(i, b.x, b.z, b.on ? 1 : 0);
        ejeTmp.set((Math.random() - 0.5) * 0.5, 1, 0.2 + Math.random() * 0.4).normalize(); m.quaternion.setFromUnitVectors(ejeZ, ejeTmp);      // el número queda mirando hacia arriba
        qTmp.setFromAxisAngle(ejeTmp, (Math.random() - 0.5) * 0.9); m.quaternion.premultiply(qTmp);
      });
      sG.attributes.position.needsUpdate = true;
    }
    let evVisto = null, nVisto = 0;
    function caer(i) {      // la bola entró: busca su tronera y arranca la caída
      const e = est[i], m = bolas[i]; if (e.c === 1) return;
      let bd = 1e9; TRON.forEach(p => { const d = Math.hypot(p[0] - m.position.x, p[1] - m.position.z); if (d < bd) { bd = d; e.tx = p[0] + Math.sign(p[0]) * 0.008; e.tz = p[1] + Math.sign(p[1]) * 0.008; } });
      e.c = 1; e.t = 0; e.x = m.position.x; e.z = m.position.z; m.visible = true; m.scale.setScalar(1);
    }
    function gira(m, dx, dz) { const d = Math.hypot(dx, dz); if (d > 1e-6 && d < 0.3) { ejeTmp.set(dz / d, 0, -dx / d); qTmp.setFromAxisAngle(ejeTmp, d / BR); m.quaternion.premultiply(qTmp).normalize(); return true; } return false; }
    function rodar(dt) {
      if (fis.ev !== evVisto) { evVisto = fis.ev; nVisto = 0; }
      while (nVisto < evVisto.metidas.length) caer(evVisto.metidas[nVisto++]);
      for (let i = 0; i < NB; i++) {
        const b = fis.b[i], m = bolas[i], e = est[i];
        if (e.c === 1) {      // rueda hasta la boca, se hunde en el hueco y se pierde en lo oscuro
          e.t += dt;
          const k = 1 - Math.pow(1 - Math.min(1, e.t / 0.15), 2), x = e.x + (e.tx - e.x) * k, z = e.z + (e.tz - e.z) * k, baja = 5.5 * Math.pow(Math.max(0, e.t - 0.05), 2);
          gira(m, x - m.position.x, z - m.position.z);
          m.position.set(x, Y + BR - baja, z); m.scale.setScalar(1 - 0.2 * Math.min(1, baja / 0.12));
          m.material.color.setScalar(1 - 0.92 * Math.min(1, baja / 0.1)); m.material.envMapIntensity = BRILLO * (1 - Math.min(1, baja / 0.08));
          sombra(i, x, z, Math.max(0, 1 - baja / 0.03));
          if (baja > 0.16) { e.c = 2; m.visible = false; m.scale.setScalar(1); m.material.color.setScalar(1); m.material.envMapIntensity = BRILLO; }
          continue;
        }
        if (e.c === 2) { if (!b.on) continue; e.c = 3; e.t = 0; m.visible = true; prev[i].x = b.x; prev[i].z = b.z; }      // la devolvieron a la mesa
        let k = 1;
        if (e.c === 3) { e.t += dt; const u = Math.min(1, e.t / 0.25); k = u * (2 - u); m.scale.setScalar(k); if (u >= 1) e.c = 0; }
        if (!b.on) { if (m.visible) { m.visible = false; sombra(i, 0, 0, 0); } continue; }
        if (gira(m, b.x - prev[i].x, b.z - prev[i].z) && b.s) { qTmp.setFromAxisAngle(ejeY, -b.s * 14 * dt); m.quaternion.premultiply(qTmp); }      // el efecto de lado también se ve
        m.position.set(b.x, Y + BR, b.z); prev[i].x = b.x; prev[i].z = b.z; sombra(i, b.x, b.z, k);
      }
      sG.attributes.position.needsUpdate = true;
    }

    /* guía de puntería: cintas blancas del mismo grosor en pantalla (se ensanchan con la distancia) y el aro de la bola fantasma */
    function cintas(opacidad) {
      const N = 80, pos = new Float32Array(N * 12), idx = [], geo = new THREE.BufferGeometry();
      for (let q = 0; q < N; q++) idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 2, q * 4 + 1, q * 4 + 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, basico({ color: 0xffffff, transparent: true, opacity: opacidad, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
      return { mesh: m, geo, pos, n: 0, N };
    }
    const gA = cintas(0.97), gB = cintas(0.6), YG = Y + 0.0028;
    let mpp = 0.005;      // metros que mide un pixel a un metro de la cámara (lo actualiza la cámara)
    function cuad(o, x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3) {
      if (o.n >= o.N) return; const p = o.pos, k = o.n++ * 12;
      p[k] = x0; p[k + 1] = y0; p[k + 2] = z0; p[k + 3] = x1; p[k + 4] = y1; p[k + 5] = z1; p[k + 6] = x2; p[k + 7] = y2; p[k + 8] = z2; p[k + 9] = x3; p[k + 10] = y3; p[k + 11] = z3;
    }
    function medio(x, z, ox, oz, px) {      // medio ancho en metros para que la cinta mida px pixeles ahí, mire como mire la cámara
      const vx = x - cam.position.x, vy = YG - cam.position.y, vz = z - cam.position.z, d = Math.hypot(vx, vy, vz), c = (ox * vx + oz * vz) / d;
      return d * mpp * px * 0.5 / Math.sqrt(Math.max(0.05, 1 - c * c));
    }
    function linea(o, x0, z0, x1, z1, px) {
      const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-4) return;
      const ox = -(z1 - z0) / L, oz = (x1 - x0) / L, h0 = medio(x0, z0, ox, oz, px), h1 = medio(x1, z1, ox, oz, px);
      cuad(o, x0 - ox * h0, YG, z0 - oz * h0, x0 + ox * h0, YG, z0 + oz * h0, x1 - ox * h1, YG, z1 - oz * h1, x1 + ox * h1, YG, z1 + oz * h1);
    }
    function aro(o, x, z, px) {      // contorno de la bola fantasma, siempre de frente a la cámara
      const e = cam.matrixWorld.elements, y = Y + BR, h = cam.position.distanceTo(ejeTmp.set(x, y, z)) * mpp * px * 0.5, r0 = BR - h, r1 = BR + h, N = 40;
      let c0 = 1, s0 = 0;
      for (let k = 1; k <= N; k++) {
        const a = k / N * 2 * PI, c1 = Math.cos(a), s1 = Math.sin(a), ax = e[0] * c0 + e[4] * s0, ay = e[1] * c0 + e[5] * s0, az = e[2] * c0 + e[6] * s0, bx = e[0] * c1 + e[4] * s1, by = e[1] * c1 + e[5] * s1, bz = e[2] * c1 + e[6] * s1;
        cuad(o, x + ax * r0, y + ay * r0, z + az * r0, x + ax * r1, y + ay * r1, z + az * r1, x + bx * r0, y + by * r0, z + bz * r0, x + bx * r1, y + by * r1, z + bz * r1);
        c0 = c1; s0 = s1;
      }
    }
    const hasta = (x, z, dx, dz) => Math.min(dx > 1e-9 ? (HX - x) / dx : dx < -1e-9 ? (-HX - x) / dx : 9, dz > 1e-9 ? (HZ - z) / dz : dz < -1e-9 ? (-HZ - z) / dz : 9);      // cuánto falta para la banda

    /* taco: una sola pieza torneada con su textura (suela azul, casquillo, arce, virola, puntas, agarre de lino y tope) */
    const LT = 1.46;
    const tacoG = new THREE.LatheGeometry([[0.0002, 0], [0.0052, 0.0008], [0.0061, 0.0035], [0.0063, 0.011], [0.0066, 0.034], [0.0086, 0.4], [0.0102, 0.739], [0.0107, 0.741], [0.0107, 0.767], [0.0104, 0.769], [0.0138, 1.33], [0.0147, 1.42], [0.0145, 1.45], [0.012, LT], [0.0002, LT]].map(p => V2(p[0], p[1])), 18);
    { const p = tacoG.attributes.position, uv = tacoG.attributes.uv; for (let i = 0; i < p.count; i++) uv.setY(i, 1 - p.getY(i) / LT); }
    const tacoM = std({ roughness: 0.3, metalness: 0, envMapIntensity: 0.8, side: THREE.DoubleSide, transparent: true, map: tex(64, 2048, (g, w, h) => {
      const m = h / LT, tramo = (a, b, color) => { g.fillStyle = color; g.fillRect(0, a * m, w, (b - a) * m + 1); };
      tramo(0, 0.74, '#ecd6aa');
      for (let i = 0; i < 170; i++) { g.fillStyle = 'rgba(' + (rnd() < .6 ? '150,104,48' : '255,246,218') + ',' + (0.05 + rnd() * 0.1).toFixed(3) + ')'; g.fillRect(rnd() * w, (0.03 + rnd() * 0.7) * m, 1, 20 + rnd() * 170); }
      tramo(0, 0.011, '#2a66d6'); tramo(0.011, 0.034, '#f7f3e8'); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0.011 * m - 1, w, 2); g.fillRect(0, 0.034 * m - 1, w, 2);
      tramo(0.74, 0.769, '#d3d6dc'); g.fillStyle = '#6b6f76'; g.fillRect(0, 0.74 * m, w, 4); g.fillRect(0, 0.7545 * m - 1.5, w, 3); g.fillRect(0, 0.769 * m - 3, w, 4); g.fillStyle = '#ffffff'; g.fillRect(0, 0.746 * m, w, 3); g.fillRect(0, 0.76 * m, w, 3);
      tramo(0.769, 1.06, '#3a160a');
      for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(' + (rnd() < .5 ? '10,2,0' : '150,70,30') + ',' + (0.08 + rnd() * 0.14).toFixed(3) + ')'; g.fillRect(rnd() * w, (0.77 + rnd() * 0.29) * m, 1, 20 + rnd() * 120); }
      for (let k = 0; k < 4; k++) { const cx = (k + 0.5) * w / 4; [['#1d7a52', 0.105], ['#ecd6aa', 0.078]].forEach(q => { g.fillStyle = q[0]; g.beginPath(); g.moveTo(cx, 0.8 * m); g.lineTo(cx + w * q[1], 1.06 * m); g.lineTo(cx - w * q[1], 1.06 * m); g.closePath(); g.fill(); }); }      // puntas de arce
      tramo(1.06, 1.068, '#d2aa52'); tramo(1.068, 1.33, '#15120f');
      for (let y = 1.068 * m; y < 1.33 * m; y += 3) { g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(0, y, w, 1); }      // agarre de lino
      tramo(1.33, 1.338, '#d2aa52'); tramo(1.338, 1.42, '#3a160a'); tramo(1.36, 1.367, '#f1ead8'); tramo(1.392, 1.399, '#f1ead8'); tramo(1.42, LT, '#0b0b0b');
    }) });
    const taco = new THREE.Mesh(tacoG, tacoM); taco.castShadow = true; taco.renderOrder = 3; scene.add(taco);
    const ejeTaco = V(0, 0, 0), tk = { x: 0, z: 0, ang: 0, pot: 0, lado: 0, alto: 0, el: 0.09, ok: false };

    /* ---------------- estado ---------------- */
    const VISTAS = ['arriba', 'mesa', 'taco'], VISTA_N = { mesa: 'Vista: mesa', arriba: 'Vista: arriba', taco: 'Vista: taco' };
    const st = { pts: [0, 0], turno: 0, entrada: 1, fase: 'apunta', ang: 0, pot: 0, lado: 0, alto: 0, vista: OJ.store.get('billar.vista', 'arriba'), acc: 0, t: 0, fn: null, tiro: 0,
      arr: false, lx: 0, la: null, ia: null, fin: false, sonT: 0, rodT: 0, grupo: [null, null], saque: true, menor: 1, puede8: false };
    game.st = st;
    const cueI = () => (pool ? 0 : st.turno);
    const GUIA_N = opt.rival === 'ia' ? [3, 1, 0][opt.dif] : 1;
    const tipo = i => (i < 8 ? 'lisas' : 'rayadas');
    const quedan = g => { let k = 0; for (let i = 1; i < NB; i++) if (i !== 8 && fis.b[i].on && tipo(i) === g) k++; return k; };
    const metidasDe = t => (st.grupo[t] ? 7 - quedan(st.grupo[t]) : 0);

    /* ---------------- marcador y controles ---------------- */
    const hud = OJ.el('div', 'hud bil-hud', `
      <div class="hud-top">
        <div class="row"><button class="ic" data-a="pausa" aria-label="Menú">☰</button><span class="brand">Billar 3D</span><span class="sub">${TITULO}${pool ? '' : ' · a ' + opt.meta}</span></div>
        <div class="row teams"><div class="pill" data-r="p0">${pool ? '' : '<i class="bolita b0"></i>'}${nombres[0]} <b></b></div><span class="meta" data-r="ent"></span><div class="pill" data-r="p1">${pool ? '' : '<i class="bolita b1"></i>'}${nombres[1]} <b></b></div></div>
        <div class="turno" data-r="turno"></div>
        <div class="chips"><span data-r="cb"></span>${tres ? '<span data-r="cn">Bandas 0/3</span>' : ''}</div>
      </div>
      <div class="pot" data-r="pot"><div class="pot-track" data-r="track"><div class="pot-fill" data-r="fill"></div><div class="pot-knob" data-r="knob">JALA</div></div><div class="pot-l">Fuerza</div></div>
      <div class="bil-ayuda" data-r="ayuda"></div>
      <div class="hud-bot bil">
        <button class="efecto" data-a="efecto" aria-label="Efecto"><i data-r="dot"></i></button>
        <button class="fino" data-a="izq" aria-label="Girar un poco a la izquierda">◀</button>
        <button class="fino" data-a="der" aria-label="Girar un poco a la derecha">▶</button>
        <button class="vista" data-a="vista" data-r="vista"></button>
      </div>`);
    OJ.ui.appendChild(hud);
    const R = {}; hud.querySelectorAll('[data-r]').forEach(e => { R[e.dataset.r] = e; });
    const humano = () => st.fase === 'apunta' && !esIA(st.turno) && !st.fin;
    const GN = { lisas: 'lisas (1 a 7)', rayadas: 'rayadas (9 a 15)' };
    function pintar() {
      [R.p0, R.p1].forEach((p, i) => { p.querySelector('b').textContent = pool ? (b9 ? '' : metidasDe(i) + '/7') : st.pts[i]; const on = st.turno === i && !st.fin; p.classList.toggle('on', on); p.style.background = on ? (i ? '#b58a00' : '#13a37a') : ''; });
      R.ent.textContent = pool ? '' : 'Entrada ' + st.entrada;
      const quien = opt.rival === 'ia' ? 'Te toca tacar' : 'Taca: ' + nombres[st.turno];
      R.turno.textContent = st.fin ? '' : st.fase === 'pensando' || st.fase === 'iaApunta' ? 'El Profe está pensando…' : esIA(st.turno) ? 'Juega El Profe' : quien;
      R.vista.textContent = VISTA_N[st.vista];
      R.pot.classList.toggle('off', !humano());
      hud.querySelectorAll('.bil button').forEach(b => { if (b.dataset.a !== 'vista') b.style.opacity = humano() ? 1 : .3; });
      R.ayuda.textContent = humano() && st.tiro === 0 ? 'Desliza el dedo en la mesa para apuntar · jala la barra verde para tacar' : '';
      R.dot.style.left = (50 + st.lado * 34) + '%'; R.dot.style.top = (50 - st.alto * 34) + '%';
      chips();
    }
    function chips() {
      const e = fis.ev;
      if (pool) {
        const g = st.grupo[st.turno];
        R.cb.textContent = b9 ? 'Pégale primero a la bola ' + st.menor : !g ? 'Mesa abierta: mete cualquiera menos la 8' : st.puede8 ? 'Ya puedes meter la negra (8)' : 'Tus bolas: ' + GN[g];
        R.cb.classList.toggle('ok', !!st.puede8 && !b9); return;
      }
      R.cb.textContent = 'Bolas ' + e.bolas.length + '/2'; R.cb.classList.toggle('ok', e.bolas.length === 2);
      if (tres) { const n = e.bolas.length === 2 ? e.antes2 : e.bandas; R.cn.textContent = 'Bandas ' + n + '/3'; R.cn.classList.toggle('ok', n >= 3); }
    }
    function sumaPill(i) { const p = i ? R.p1 : R.p0; p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube'); }

    let potArr = false;
    const potDe = y => { const r = R.track.getBoundingClientRect(); return clamp((y - r.top) / r.height, 0, 1); };
    const potPinta = () => { R.fill.style.height = (st.pot * 100) + '%'; R.knob.style.top = (st.pot * 100) + '%'; R.knob.textContent = st.pot > 0.02 ? Math.round(st.pot * 100) + '%' : 'JALA'; };
    R.pot.addEventListener('pointerdown', e => { if (!humano()) return; potArr = true; try { R.pot.setPointerCapture(e.pointerId); } catch (x) { /* */ } OJ.audio(); st.pot = potDe(e.clientY); potPinta(); });
    R.pot.addEventListener('pointermove', e => { if (!potArr) return; st.pot = potDe(e.clientY); potPinta(); });
    const potFin = () => { if (!potArr) return; potArr = false; if (st.pot > 0.05 && humano()) golpear(); else { st.pot = 0; potPinta(); } };
    R.pot.addEventListener('pointerup', potFin); R.pot.addEventListener('pointercancel', potFin);

    let rep = 0;
    const fino = s => { if (humano()) st.ang += s * 0.0035; };
    hud.querySelectorAll('button[data-a]').forEach(b => {
      const a = b.dataset.a;
      if (a === 'izq' || a === 'der') {
        const s = a === 'izq' ? -1 : 1;
        b.addEventListener('pointerdown', () => { fino(s); clearInterval(rep); rep = setInterval(() => fino(s * 2), 60); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearInterval(rep)));
      } else b.onclick = () => {
        if (a === 'pausa') OJ.app.pausa(game);
        else if (a === 'vista') { st.vista = VISTAS[(VISTAS.indexOf(st.vista) + 1) % 3]; OJ.store.set('billar.vista', st.vista); OJ.snd.toque(); pintar(); }
        else if (a === 'efecto' && humano()) abrirEfecto();
      };
    });
    function abrirEfecto() {
      const v = OJ.el('div', 'velo centro', `<div class="sheet centro-t"><h2>Efecto</h2><p>Mueve el punto rojo: es donde el taco le pega a tu bola.<br>Arriba corre, abajo retrocede y a los lados cambia el rebote en las bandas.</p>
        <div class="efecto-g"><i></i></div><button class="btn gris" data-x="centro">Al centro</button><button class="btn verde" data-x="ok">Listo</button></div>`);
      OJ.ui.appendChild(v);
      const g = v.querySelector('.efecto-g'), d = g.querySelector('i');
      const pon = () => { d.style.left = (50 + st.lado * 38) + '%'; d.style.top = (50 - st.alto * 38) + '%'; pintar(); };
      const mueve = e => { const r = g.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * 2 - 1, y = -((e.clientY - r.top) / r.height * 2 - 1); const l = Math.hypot(x, y) / 0.8; if (l > 1) { x /= l; y /= l; } st.lado = clamp(x / 0.8, -1, 1); st.alto = clamp(y / 0.8, -1, 1); pon(); };
      let ar = false;
      g.addEventListener('pointerdown', e => { ar = true; try { g.setPointerCapture(e.pointerId); } catch (x) { /* */ } mueve(e); });
      g.addEventListener('pointermove', e => { if (ar) mueve(e); });
      g.addEventListener('pointerup', () => { ar = false; });
      v.querySelector('[data-x="centro"]').onclick = () => { st.lado = st.alto = 0; pon(); };
      v.querySelector('[data-x="ok"]').onclick = () => v.remove();
      pon();
    }

    /* ---------------- guía ---------------- */
    function trazar(ang, nb) {
      const ci = cueI(), c = fis.b[ci]; let x = c.x, z = c.z, dx = Math.sin(ang), dz = -Math.cos(ang); const pts = [[x, z]]; let bola = null;
      for (let k = 0; k <= nb; k++) {
        let tb = 1e9, bi = -1;
        for (let i = 0; i < NB; i++) {
          if (i === ci || !fis.b[i].on) continue;
          const o = fis.b[i], ox = o.x - x, oz = o.z - z, proj = ox * dx + oz * dz; if (proj <= 0) continue;
          const perp2 = ox * ox + oz * oz - proj * proj; if (perp2 >= D2) continue;
          const t = proj - Math.sqrt(D2 - perp2); if (t > 1e-4 && t < tb) { tb = t; bi = i; }
        }
        const tx = dx > 1e-9 ? (LX - x) / dx : dx < -1e-9 ? (-LX - x) / dx : 1e9, tz = dz > 1e-9 ? (LZ - z) / dz : dz < -1e-9 ? (-LZ - z) / dz : 1e9, tc = Math.min(tx, tz);
        if (tb < tc) { x += dx * tb; z += dz * tb; pts.push([x, z]); bola = { i: bi, gx: x, gz: z, dx, dz }; break; }
        x += dx * tc; z += dz * tc; pts.push([x, z]); if (tx < tz) dx = -dx; else dz = -dz;
      }
      return { pts, bola };
    }
    function pintarGuia() {
      const ver = st.fase === 'apunta' || st.fase === 'iaApunta' || st.fase === 'pensando';
      gA.mesh.visible = gB.mesh.visible = ver;
      if (!ver) return;
      gA.n = gB.n = 0;
      const tr = trazar(st.ang, st.fase === 'apunta' ? (pool ? 0 : GUIA_N) : 0), np = tr.pts.length;
      for (let k = 0; k < np - 1; k++) {      // de la blanca al punto de contacto (y, en carambola, los rebotes que deja ver la dificultad)
        const x0 = tr.pts[k][0], z0 = tr.pts[k][1], x1 = tr.pts[k + 1][0], z1 = tr.pts[k + 1][1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-5) continue;
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, a = k ? 0 : Math.min(L, BR + 0.012), b = k === np - 2 ? Math.max(a, L - BR) : L;
        linea(k ? gB : gA, x0 + ux * a, z0 + uz * a, x0 + ux * b, z0 + uz * b, 1.8);
      }
      aro(gA, tr.pts[np - 1][0], tr.pts[np - 1][1], 1.6);
      if (tr.bola) {
        const b = tr.bola, o = fis.b[b.i]; let nx = o.x - b.gx, nz = o.z - b.gz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        const largo = pool ? [1.1, 0.6, 0.3][opt.rival === 'ia' ? opt.dif : 1] : 0.34;      // en pool la línea muestra hacia dónde sale la bola
        const l1 = Math.min(largo, hasta(o.x, o.z, nx, nz)), ini = BR + 0.008;
        if (l1 > ini + 0.01) linea(gA, o.x + nx * ini, o.z + nz * ini, o.x + nx * l1, o.z + nz * l1, 1.8);
        const dn = b.dx * nx + b.dz * nz, tx = b.dx - dn * nx, tz = b.dz - dn * nz, tl = Math.hypot(tx, tz);
        if (tl > 0.05) { const l2 = Math.min(0.26, hasta(b.gx, b.gz, tx / tl, tz / tl)); if (l2 > ini + 0.01) linea(gB, b.gx + tx / tl * ini, b.gz + tz / tl * ini, b.gx + tx / tl * l2, b.gz + tz / tl * l2, 1.5); }      // desvío de la blanca
      }
      [gA, gB].forEach(o => { o.geo.setDrawRange(0, o.n * 6); o.geo.attributes.position.needsUpdate = true; });
    }

    /* ---------------- flujo ---------------- */
    function espera(seg, fn) { st.fase = 'espera'; st.t = seg; st.fn = fn; }
    function apuntarInicial() {
      const ci = cueI(), c = fis.b[ci]; let best = -1, bd = 9;
      if (pool && b9) best = st.menor;
      else for (let i = 0; i < NB; i++) {
        if (i === ci || !fis.b[i].on) continue;
        if (pool && !st.saque) { const g = st.grupo[st.turno]; if (st.puede8 ? i !== 8 : (i === 8 || (g && tipo(i) !== g))) continue; }
        const d = Math.hypot(fis.b[i].x - c.x, fis.b[i].z - c.z); if (d < bd) { bd = d; best = i; }
      }
      if (!pool && st.tiro === 0) best = 2;
      const o = fis.b[best < 0 ? (ci ? 0 : 1) : best];
      st.ang = Math.atan2(o.x - c.x, -(o.z - c.z));
    }
    function turnoNuevo() {
      st.pot = 0; potPinta(); fis.cue = cueI(); fis.ev = ev0();
      if (pool) { st.menor = 1; while (st.menor < NB - 1 && !fis.b[st.menor].on) st.menor++; const g = st.grupo[st.turno]; st.puede8 = !b9 && !!g && quedan(g) === 0; }
      apuntarInicial();
      if (esIA(st.turno)) { st.lado = st.alto = 0; st.fase = 'pensando'; st.ia = pool ? { n: 0, lista: listaPool(), mejor: null, sc: -1 } : { n: 0, max: IA_N[tres ? 1 : 0][opt.dif], mejor: null, sc: -1 }; }
      else st.fase = 'apunta';
      pintar();
    }
    function golpear() { st.fase = 'golpe'; st.t = 0; pintar(); }
    function soltar() {
      fis.tirar(cueI(), st.ang, vel(st.pot), st.lado, st.alto); st.tiro++;
      OJ.snd.taco(st.pot); OJ.vib(15); st.fase = 'rodando'; st.acc = 0; st.rodT = 0; pintar();
    }
    function sonido(t, v) {
      if (t === 'tronera') { OJ.snd.tronera(); OJ.vib(30); return; }
      if (st.sonT > 0 && v < 0.6) return; st.sonT = 0.03;
      if (t === 'bola') { OJ.snd.bola(v); if (v > 1.2) OJ.vib(8); } else OJ.snd.banda(v);
      if (!pool) chips();
    }
    function pasar() { st.turno = 1 - st.turno; if (st.turno === 0) st.entrada++; st.lado = st.alto = 0; turnoNuevo(); }
    function evaluar() {
      st.pot = 0; potPinta();
      if (pool) return evaluarPool();
      const e = fis.ev, ok = e.bolas.length === 2 && (!tres || e.antes2 >= 3), t = st.turno;
      if (ok) {
        st.pts[t]++; sumaPill(t); OJ.snd.punto(); OJ.vib(60);
        OJ.gran('¡Carambola!', tres ? 'A ' + e.antes2 + ' bandas · +1 punto' : '+1 punto · sigues tacando', '#3ee0b0'); pintar();
        return espera(1.5, st.pts[t] >= opt.meta ? () => terminar(t) : turnoNuevo);
      }
      const msg = e.bolas.length === 0 ? 'No tocaste ninguna bola' : e.bolas.length === 1 ? 'Faltó tocar la otra bola' : 'Solo ' + e.antes2 + (e.antes2 === 1 ? ' banda' : ' bandas') + ' antes de la segunda bola';
      OJ.snd.falla(); OJ.gran(e.bolas.length === 2 ? '¡Casi!' : 'Fallaste', msg, '#ffffff', 1500);
      espera(1.5, pasar);
    }
    /* Reglas de pool: dice qué pasó con un tiro sin cambiar nada (lo usan el juego y la máquina) */
    function juzgar(e) {
      const blanca = e.metidas.indexOf(0) >= 0, obj = e.metidas.filter(i => i > 0), t = st.turno, g = st.grupo[t]; let falta, sigue, gana = -1, motivo = '';
      if (b9) {
        falta = blanca || e.primera !== st.menor;
        motivo = blanca ? 'Metiste la blanca' : e.primera < 0 ? 'No tocaste ninguna bola' : 'Tenías que pegarle primero a la ' + st.menor;
        if (obj.indexOf(9) >= 0 && !falta) gana = t;
        sigue = !falta && obj.length > 0;
      } else {
        const mala = e.primera < 0 || (g ? (st.puede8 ? e.primera !== 8 : (e.primera === 8 || tipo(e.primera) !== g)) : (e.primera === 8 && !st.saque));
        falta = blanca || mala;
        motivo = blanca ? 'Metiste la blanca' : e.primera < 0 ? 'No tocaste ninguna bola' : st.puede8 ? 'Tenías que pegarle a la negra' : e.primera === 8 ? 'No le puedes pegar primero a la negra' : 'Le pegaste primero a una bola del otro';
        if (obj.indexOf(8) >= 0) gana = (!falta && st.puede8) ? t : 1 - t;
        const gg = g || (obj.length && obj[0] !== 8 ? tipo(obj[0]) : null);
        sigue = !falta && obj.some(i => i !== 8 && (!gg || tipo(i) === gg));
      }
      return { blanca, obj, falta, sigue, gana, motivo };
    }
    function reponer(i, x, z) {     // vuelve a poner una bola en la mesa, en un sitio libre
      const b = fis.b[i]; let zz = z, n = 0;
      const libre = () => fis.b.every((o, k) => k === i || !o.on || Math.hypot(o.x - x, o.z - zz) > 2 * BR + 0.002);
      while (!libre() && n++ < 60) zz = z + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * BR * 1.1;
      b.x = x; b.z = clamp(zz, -LZ, LZ); b.vx = b.vz = 0; b.on = true; prev[i].x = b.x; prev[i].z = b.z;
    }
    function evaluarPool() {
      const r = juzgar(fis.ev), t = st.turno, eraSaque = st.saque; st.saque = false;
      if (r.gana >= 0 && !(eraSaque && !b9)) {
        const bien = r.gana === t;
        OJ.gran(bien ? (b9 ? '¡Metiste la 9!' : '¡Metiste la negra!') : 'La negra antes de tiempo', bien ? 'Partida ganada' : 'Pierde ' + nombres[t], bien ? '#3ee0b0' : '#ff8a8a', 1900);
        return espera(1.7, () => terminar(r.gana));
      }
      if (!b9 && r.obj.indexOf(8) >= 0) reponer(8, 0, -0.71);      // la negra en el saque vuelve a la mesa
      if (b9 && r.obj.indexOf(9) >= 0) reponer(9, 0, -0.71);
      if (!b9 && !st.grupo[t] && !r.falta) { const p = r.obj.filter(i => i !== 8)[0]; if (p) { st.grupo[t] = tipo(p); st.grupo[1 - t] = tipo(p) === 'lisas' ? 'rayadas' : 'lisas'; } }
      if (r.blanca) reponer(0, 0, 0.71);
      if (r.falta) { OJ.snd.falla(); OJ.gran('Falta', r.motivo, '#ff8a8a', 1700); return espera(1.7, pasar); }
      if (r.sigue) { OJ.snd.punto(); OJ.vib(50); OJ.gran(r.obj.length > 1 ? '¡' + r.obj.length + ' bolas!' : '¡Adentro!', 'Sigues tacando', '#3ee0b0', 1300); pintar(); return espera(1.2, turnoNuevo); }
      espera(0.8, pasar);
    }
    function terminar(g) {
      st.fin = true; st.fase = 'fin'; pintar();
      const gano = opt.rival !== 'ia' || g === 0;
      gano ? OJ.snd.gana() : OJ.snd.pierde();
      OJ.app.final({ juego: 'billar', gano: opt.rival === 'ia' ? g === 0 : null, titulo: opt.rival === 'ia' ? (g === 0 ? '¡Ganaste!' : 'Ganó El Profe') : '¡Ganó ' + nombres[g] + '!',
        marcador: pool ? [[nombres[0], g === 0 ? '🏆' : '–'], [nombres[1], g === 1 ? '🏆' : '–']] : [[nombres[0], st.pts[0]], [nombres[1], st.pts[1]]], opt });
    }

    /* ---------------- la máquina ---------------- */
    function listaPool() {
      const c = fis.b[0], l = [], g = st.grupo[st.turno];
      if (st.saque) return [{ ang: Math.atan2(0.012 - c.x, -(-0.71 - c.z)), pot: 0.96, lado: 0, alto: 0.2 }];
      for (let i = 1; i < NB; i++) {
        const o = fis.b[i]; if (!o.on) continue;
        if (b9 ? i !== st.menor : (st.puede8 ? i !== 8 : (i === 8 || (g && tipo(i) !== g)))) continue;
        TRON.forEach(p => {
          let dx = p[0] - o.x, dz = p[1] - o.z; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
          const gx = o.x - dx * 2 * BR, gz = o.z - dz * 2 * BR; let ax = gx - c.x, az = gz - c.z; const al = Math.hypot(ax, az); ax /= al; az /= al;
          const corte = ax * dx + az * dz; if (corte < 0.3) return;
          const a = Math.atan2(gx - c.x, -(gz - c.z));
          [0.4, 0.6].forEach(pot => l.push({ ang: a, pot: clamp(pot + (al + dl) * 0.08, .3, .9), lado: 0, alto: -0.15, corte }));
        });
        const d = Math.hypot(o.x - c.x, o.z - c.z), a0 = Math.atan2(o.x - c.x, -(o.z - c.z));
        for (let k = 0; k < 4; k++) l.push({ ang: a0 + (Math.random() * 2 - 1) * Math.asin(Math.min(1, 2 * BR / d)) * 0.8, pot: 0.35 + Math.random() * 0.4, lado: 0, alto: 0, corte: 0 });
      }
      return l.sort((a, b) => b.corte - a.corte);      // primero los tiros más rectos: si se acaba el tiempo, ya probó los mejores
    }
    const IA_MS = 1300;      // El Profe no piensa más de esto aunque el celular sea lento
    function iaPiensa() {
      const ia = st.ia, t0 = performance.now(); if (!ia.ini) ia.ini = t0;
      const yaBasta = () => !!ia.mejor && performance.now() - ia.ini > IA_MS;
      if (pool) {
        while (ia.n < ia.lista.length && performance.now() - t0 < 8) {
          const c = ia.lista[ia.n++]; sim.copiar(fis); sim.tirar(0, c.ang, vel(c.pot), c.lado, c.alto);
          const r = juzgar(sim.simular(4000)), sc = r.gana === st.turno ? 2000 : r.gana >= 0 ? -100 : r.falta ? 0 : r.sigue ? 1000 + (c.corte || 0) * 100 : 300;
          if (sc > ia.sc) { ia.sc = sc; ia.mejor = c; }
        }
        if (ia.n < ia.lista.length && !yaBasta()) return;
      } else {
        while (ia.n < ia.max && performance.now() - t0 < 8) { ia.n++; const c = candidato(fis, sim, st.turno, tres); if (c.sc > ia.sc) { ia.sc = c.sc; ia.mejor = c; } }
        if (ia.n < ia.max && !yaBasta()) return;
      }
      const m = Object.assign({}, ia.mejor || { ang: st.ang, pot: 0.5, lado: 0, alto: 0 });
      m.ang += OJ.gauss() * (pool ? (st.saque ? 0.004 : IA_POOL[opt.dif]) : IA_ERR[tres ? 1 : 0][opt.dif]);
      st.lado = m.lado; st.alto = m.alto; ia.obj = m; ia.t = 0; ia.a0 = st.ang;
      let d = (m.ang - st.ang) % 6.2832; if (d > Math.PI) d -= 6.2832; if (d < -Math.PI) d += 6.2832; ia.da = d;
      st.fase = 'iaApunta'; pintar();
    }

    /* ---------------- entrada sobre la mesa ---------------- */
    const ray = new THREE.Raycaster(), plano = new THREE.Plane(V(0, 1, 0), -Y), pTmp = V(0, 0, 0), ndc = new THREE.Vector2();
    function angDedo(x, y) {
      ndc.set(x / OJ.W * 2 - 1, -(y / OJ.H * 2 - 1)); ray.setFromCamera(ndc, cam);
      if (!ray.ray.intersectPlane(plano, pTmp)) return null;
      const c = fis.b[cueI()]; return Math.atan2(pTmp.x - c.x, -(pTmp.z - c.z));
    }
    game.input = {
      down(x, y) { if (!humano()) return; st.arr = true; st.lx = x; st.la = st.vista === 'taco' ? null : angDedo(x, y); if (R.ayuda.textContent) R.ayuda.textContent = ''; },
      move(x, y) {
        if (!st.arr || !humano()) return;
        if (st.vista === 'taco') { st.ang += (x - st.lx) * 0.0042; st.lx = x; return; }
        const a = angDedo(x, y); if (a == null) return;
        if (st.la != null) { let d = a - st.la; if (d > Math.PI) d -= 6.2832; if (d < -Math.PI) d += 6.2832; st.ang += d; }
        st.la = a;
      },
      up() { st.arr = false; }
    };
    game.probar = (ang, pot, lado, alto) => { st.ang = ang; st.pot = pot; st.lado = lado || 0; st.alto = alto || 0; golpear(); };

    /* ---------------- cámara ---------------- */
    const cPos = V(0, 3.2, 2.6), cTar = V(0, Y, 0.1), dPos = V(0, 0, 0), dTar = V(0, 0, 0), up = V(0, 1, 0), dUp = V(0, 1, 0);
    const enc = { w: 0, h: 0, n: 0, yT: 0, yB: 0, xR: 0, mT: 0, mD: 4 }, TW = 2 * OX + 0.05, TL = 2 * OZ + 0.05, INCL = 0.96;
    let primer = true, kArriba = 0;
    function encuadre() {      // el hueco libre de la pantalla: entre el marcador y los botones, sin meterse debajo de la barra de fuerza
      if (enc.w === OJ.W && enc.h === OJ.H && enc.n-- > 0) return;
      enc.w = OJ.W; enc.h = OJ.H; enc.n = 40; enc.yT = OJ.H * 0.22; enc.yB = OJ.H * 0.86; enc.xR = OJ.W * 0.86;
      try {
        const a = R.cb.parentNode.getBoundingClientRect(), b = R.vista.getBoundingClientRect(), p = R.pot.getBoundingClientRect();
        if (a.bottom > 0 && b.top > a.bottom + 120) { enc.yT = a.bottom + 7; enc.yB = b.top - 9; }
        if (p.left > OJ.W * 0.5) enc.xR = p.left + 6;
      } catch (e) { /* se queda con las medidas de siempre */ }
      /* vista inclinada: la distancia justa para que toda la mesa quepa a lo ancho y entre el marcador y los botones */
      const se = Math.sin(INCL), ce = Math.cos(INCL), tv = Math.tan(56 * PI / 360), th = tv * OJ.W / OJ.H, y1 = 1 - 2 * enc.yT / OJ.H, y0 = 2 * enc.yB / OJ.H - 1;
      let zn = (OX + 0.03) / (0.95 * th), a = 0;
      for (let k = 0; k < 250; k++, zn += 0.04) { a = Math.min(TL, y0 * tv * zn / se); if ((TL - a) * se / ((zn + TL * ce) * tv) <= y1) break; }
      enc.mT = TL / 2 - a; enc.mD = zn + a * ce;
    }
    function camara(dt) {
      const rodando = st.fase === 'rodando' || st.fase === 'espera' || st.fase === 'fin';
      let v = st.vista; if (v === 'taco' && rodando) v = 'mesa';
      const c = fis.b[cueI()], dx = Math.sin(st.ang), dz = -Math.cos(st.ang);
      let fov = 56; dUp.set(0, 1, 0); encuadre();
      if (v === 'taco') { dPos.set(c.x - dx * 1.05, Y + 0.6, c.z - dz * 1.05); dTar.set(c.x + dx * 0.7, Y, c.z + dz * 0.7); fov = 58; }
      else if (v === 'arriba') {      // cenital: la mesa parada, llenando el hueco libre
        fov = 22;
        const s = Math.min((enc.yB - enc.yT) / TL, (enc.xR - 4) / TW), mx = 4 + s * TW / 2, cx = clamp(OJ.W / 2, mx, Math.max(mx, enc.xR - s * TW / 2)), cy = (enc.yT + enc.yB) / 2;      // s: pixeles por metro
        dPos.set((OJ.W / 2 - cx) / s, Y + OJ.H / s / 2 / Math.tan(fov * PI / 360), (OJ.H / 2 - cy) / s); dTar.set(dPos.x, Y, dPos.z); dUp.set(0, 0, -1);
      } else { dPos.set(0, Y + enc.mD * Math.sin(INCL), enc.mT + enc.mD * Math.cos(INCL)); dTar.set(0, Y, enc.mT); }
      const f = primer ? 1 : 1 - Math.exp(-dt * 6); primer = false;
      cPos.lerp(dPos, f); cTar.lerp(dTar, f); up.lerp(dUp, f).normalize(); kArriba += ((v === 'arriba' ? 1 : 0) - kArriba) * f;
      cam.fov += (fov - cam.fov) * f; cam.near = clamp((cPos.y - Y - 1.4) * 0.85, 0.03, 40); cam.position.copy(cPos); cam.up.copy(up); cam.lookAt(cTar); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      lampara.visible = cPos.y < 1.75;
      mpp = 2 * Math.tan(cam.fov * PI / 360) / OJ.H;
    }
    /* taco: se echa atrás con la fuerza, golpea, acompaña el tiro y se desvanece */
    function pintarTaco(dt) {
      const apunta = st.fase === 'apunta' || st.fase === 'iaApunta' || st.fase === 'golpe', sigue = st.fase === 'rodando' && st.rodT < 0.5 && tk.ok;
      if (apunta) { const c = fis.b[cueI()]; tk.x = c.x; tk.z = c.z; tk.ang = st.ang; tk.pot = st.pot; tk.lado = st.lado; tk.alto = st.alto; tk.ok = true; }
      taco.visible = apunta || sigue;
      if (!taco.visible) return;
      const dx = Math.sin(tk.ang), dz = -Math.cos(tk.ang), t = Math.max(0.02, hasta(tk.x, tk.z, -dx, -dz));
      const el = Math.asin(clamp(Math.max(0.021 / t, 0.032 / (t + CW)), 0.085, 0.6));      // se levanta lo justo para pasar por encima de la banda de atrás
      tk.el += (el - tk.el) * (1 - Math.exp(-dt * 12));
      ejeTaco.set(-dx * Math.cos(tk.el), Math.sin(tk.el), -dz * Math.cos(tk.el));
      let atras = 0.035 + tk.pot * 0.3, op = 1;
      if (st.fase === 'golpe') { const k = Math.min(1, st.t / 0.085); atras *= 1 - k * k; }
      else if (sigue) { const u = st.rodT / 0.5; atras = -0.022 * Math.min(1, u * 6) + 0.06 * u * u; op = 1 - clamp((u - 0.4) / 0.6, 0, 1); }
      taco.position.set(tk.x - dz * tk.lado * BR * 0.42, Y + BR + tk.alto * BR * 0.42, tk.z + dx * tk.lado * BR * 0.42).addScaledVector(ejeTaco, BR + atras);
      taco.quaternion.setFromUnitVectors(ejeY, ejeTaco);
      const g = 1 + 0.7 * kArriba; taco.scale.set(g, 1, g); tacoM.opacity = op;      // desde arriba se engruesa un poco para que se vea
    }

    /* ---------------- bucle ---------------- */
    game.update = function (dt) {
      st.sonT -= dt;
      if (st.fase === 'pensando') iaPiensa();
      else if (st.fase === 'iaApunta') {
        const ia = st.ia; ia.t += dt / 1.1; const u = Math.min(ia.t, 1), e = u * u * (3 - 2 * u);
        st.ang = ia.a0 + ia.da * e; st.pot = ia.obj.pot * clamp((ia.t - 0.55) / 0.45, 0, 1); potPinta();
        if (ia.t >= 1.25) golpear();
      } else if (st.fase === 'golpe') { st.t += dt; if (st.t >= 0.1) soltar(); }
      else if (st.fase === 'rodando') {
        st.acc += dt; st.rodT += dt; let n = Math.min(Math.floor(st.acc / DT), 48), mov = true; st.acc -= n * DT;
        while (n-- > 0 && mov) mov = fis.paso(sonido);
        if (st.rodT > 40) { fis.b.forEach(b => { b.vx = b.vz = 0; }); mov = false; }      // seguro: nunca se queda rodando para siempre
        if (!mov) evaluar();
      } else if (st.fase === 'espera') { st.t -= dt; if (st.t <= 0) { const f = st.fn; st.fn = null; f(); } }
      rodar(dt); camara(dt); pintarTaco(dt); pintarGuia();
    };
    game.dispose = function () { clearInterval(rep); hud.remove(); if (OJ.input === game.input) OJ.input = null; extras.forEach(t => t.dispose()); OJ.liberar(scene); };
    game.reiniciar = () => OJ.app.jugar('billar', opt);

    OJ.input = game.input;
    colocar(); turnoNuevo();
    return game;
  };
})();
