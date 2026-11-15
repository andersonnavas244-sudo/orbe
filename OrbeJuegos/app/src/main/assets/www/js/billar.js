/*
 * Billar 3D — carambola en mesa sin troneras, como se juega en Colombia.
 *  · Libre: haces punto si tu bola toca las otras dos.
 *  · Tres bandas: además tu bola debe tocar 3 bandas (o más) antes de tocar la segunda bola.
 * Si haces carambola sigues tacando; si fallas, pasa el turno.
 */
(function () {
  'use strict';
  const { V, std, tex, planks, noise, mesh, sprite, clamp } = OJ;
  const HX = 0.71, HZ = 1.42, BR = 0.0305, LX = HX - BR, LZ = HZ - BR, Y = 0.8, DT = 1 / 240, D2 = 4 * BR * BR;
  const V_MIN = 0.45, V_MAX = 5.4;

  /* ============================ física (2D sobre el paño) ============================ */
  function Fis() { this.b = [0, 1, 2].map(() => ({ x: 0, z: 0, vx: 0, vz: 0, s: 0, f: 0 })); this.cue = 0; this.ev = ev0(); }
  function ev0() { return { bandas: 0, bolas: [], antes2: 0, cerca: 9 }; }
  Fis.prototype.inicio = function () {
    const p = [[0.18, 0.71], [0, 0.71], [0, -0.71]];
    this.b.forEach((b, i) => { b.x = p[i][0]; b.z = p[i][1]; b.vx = b.vz = b.s = b.f = 0; });
  };
  Fis.prototype.copiar = function (o) {
    for (let i = 0; i < 3; i++) { const a = this.b[i], c = o.b[i]; a.x = c.x; a.z = c.z; a.vx = c.vx; a.vz = c.vz; a.s = c.s; a.f = c.f; }
    this.cue = o.cue;
  };
  Fis.prototype.tirar = function (i, ang, vel, lado, alto) {
    const b = this.b[i]; b.vx = Math.sin(ang) * vel; b.vz = -Math.cos(ang) * vel; b.s = lado; b.f = alto; this.cue = i; this.ev = ev0();
  };
  Fis.prototype.banda = function (b, nx, nz, cb) {      // n apunta hacia dentro de la mesa
    const vn = -(b.vx * nx + b.vz * nz), tx = nz, tz = -nx;
    const vt = (b.vx * tx + b.vz * tz) * 0.93 + b.s * 0.3 * vn; b.s *= 0.5;
    const out = vn * 0.84; b.vx = nx * out + tx * vt; b.vz = nz * out + tz * vt;
    if (b === this.b[this.cue]) this.ev.bandas++;
    if (cb) cb('banda', vn, b);
  };
  Fis.prototype.paso = function (cb) {
    const bs = this.b; let mov = false;
    for (let i = 0; i < 3; i++) {
      const b = bs[i], v = Math.hypot(b.vx, b.vz);
      if (v < 1e-5) { b.vx = b.vz = 0; continue; }
      mov = true;
      const nv = v - (0.2 + 0.1 * v) * DT;
      if (nv < 0.012) { b.vx = b.vz = 0; continue; }
      const k = nv / v; b.vx *= k; b.vz *= k; b.x += b.vx * DT; b.z += b.vz * DT;
      if (b.x > LX && b.vx > 0) { b.x = LX; this.banda(b, -1, 0, cb); } else if (b.x < -LX && b.vx < 0) { b.x = -LX; this.banda(b, 1, 0, cb); }
      if (b.z > LZ && b.vz > 0) { b.z = LZ; this.banda(b, 0, -1, cb); } else if (b.z < -LZ && b.vz < 0) { b.z = -LZ; this.banda(b, 0, 1, cb); }
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const a = bs[i], c = bs[j], dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz;
      if (d2 >= D2 || d2 < 1e-12) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, vn = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz, ov = (2 * BR - d) / 2;
      a.x -= nx * ov; a.z -= nz * ov; c.x += nx * ov; c.z += nz * ov;
      if (vn <= 0) continue;
      const q = (i === this.cue || j === this.cue) ? bs[this.cue] : null; let ux = 0, uz = 0;
      if (q && q.f) { const sp = Math.hypot(q.vx, q.vz); if (sp > 1e-6) { ux = q.vx / sp; uz = q.vz / sp; } }
      const J = vn * 0.975; a.vx -= J * nx; a.vz -= J * nz; c.vx += J * nx; c.vz += J * nz;
      if (q) {
        if (q.f) { const k = q.f * 0.5 * vn; q.vx += ux * k; q.vz += uz * k; q.f = 0; }   // efecto alto (corrido) o bajo (retroceso)
        const o = i === this.cue ? j : i, e = this.ev;
        if (e.bolas.indexOf(o) < 0) { e.bolas.push(o); if (e.bolas.length === 2) e.antes2 = e.bandas; }
      }
      if (cb) cb('bola', vn, a, c);
    }
    const e = this.ev;
    if (e.bolas.length === 1) {
      const q = bs[this.cue], o = bs[3 - this.cue - e.bolas[0]], dd = Math.hypot(q.x - o.x, q.z - o.z) - 2 * BR;
      if (dd < e.cerca) e.cerca = dd;
    }
    return mov;
  };
  Fis.prototype.simular = function (max) { let n = 0; while (n < max && this.paso()) n++; return this.ev; };
  OJ.BillarFis = Fis;

  /* La máquina prueba tiros al azar en una copia de la mesa y se queda con el mejor */
  const IA_N = [[10, 45, 170], [12, 45, 170]], IA_ERR = [[0.03, 0.01, 0.004], [0.012, 0.006, 0.003]];
  function candidato(fis, sim, cue, tres) {
    const c = fis.b[cue]; let ang;
    if (Math.random() < 0.72) {
      const o = fis.b[[0, 1, 2].filter(i => i !== cue)[Math.random() < .5 ? 0 : 1]], d = Math.hypot(o.x - c.x, o.z - c.z);
      ang = Math.atan2(o.x - c.x, -(o.z - c.z)) + (Math.random() * 2 - 1) * Math.asin(Math.min(1, 2 * BR / d)) * 0.97;
    } else ang = Math.random() * 6.2832;
    const pot = 0.25 + Math.random() * 0.7, lado = (Math.random() * 2 - 1) * 0.8, alto = (Math.random() * 2 - 1) * 0.6;
    sim.copiar(fis); sim.tirar(cue, ang, V_MIN + Math.pow(pot, 1.25) * (V_MAX - V_MIN), lado, alto);
    const e = sim.simular(4000), ok = e.bolas.length === 2 && (!tres || e.antes2 >= 3);
    const sc = ok ? 1000 - Math.abs(pot - 0.5) * 60 : e.bolas.length === 2 ? 500 + e.antes2 * 50 : e.bolas.length === 1 ? 300 - e.cerca * 150 + (tres ? Math.min(e.bandas, 3) * 20 : 0) : 0;
    return { sc, ok, ang, pot, lado, alto };
  }
  OJ.BillarIA = { candidato, IA_N, IA_ERR, V_MIN, V_MAX };

  /* ============================ juego ============================ */
  OJ.Billar = function (opt) {
    opt = Object.assign({ modo: 'libre', rival: 'ia', dif: 1, meta: 10 }, opt);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(56, 1, 0.03, 60);
    const game = { scene, cam, exposure: 1.2, nombre: 'billar' };
    const nombres = opt.rival === 'ia' ? ['Tú', 'El Profe'] : ['Blanca', 'Amarilla'];
    const esIA = t => opt.rival === 'ia' && t === 1;
    const tres = opt.modo === 'tres';
    const fis = new Fis(), sim = new Fis(); fis.inicio();
    game.fis = fis;

    /* ---------------- escena ---------------- */
    OJ.semilla(23);
    scene.background = new THREE.Color(0x0b0910); scene.fog = new THREE.Fog(0x0b0910, 9, 24);
    const fl = mesh(scene, new THREE.PlaneGeometry(30, 30), std({ map: tex(512, 512, planks('#3a2418', '#2f1d13', 'rgba(0,0,0,.5)', 12), 8, 8), roughness: .9 }), V(0, 0, 0));
    fl.rotation.x = -Math.PI / 2;
    mesh(scene, new THREE.PlaneGeometry(14, 6), std({ map: tex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1d2a26' : '#22322d'; g.fillRect(i * w / 8, 0, w / 8, h); } }, 6, 1), roughness: .95 }), V(0, 3, -3.4));
    const neon = mesh(scene, new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: tex(1024, 256, (g, w, h) => {
      g.font = '800 140px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff3fa4'; g.shadowBlur = 50; g.fillStyle = '#ffd6ee';
      for (let i = 0; i < 4; i++) g.fillText('Billar Colombia', w / 2, h / 2 + 8);
    }) }), V(0, 1.75, -3.35), false);
    neon.scale.setScalar(1.1);
    const pink = new THREE.PointLight(0xff3fa4, 0.8, 4); pink.position.set(0, 1.7, -3.0); scene.add(pink);
    for (let i = 0; i < 5; i++) mesh(scene, new THREE.CylinderGeometry(0.012, 0.016, 1.45, 8), std({ color: i % 2 ? 0xd9b77e : 0x6b3a1c, roughness: .4 }), V(-2.2 + i * 0.09, 0.85, -3.3));

    const feltT = tex(512, 512, noise('#1f63b8', ['rgba(255,255,255,.04)', 'rgba(0,0,30,.07)'], 9000, 1.6), 3, 6);
    mesh(scene, new THREE.BoxGeometry(HX * 2, 0.04, HZ * 2), std({ map: feltT, roughness: 1 }), V(0, Y - 0.02, 0));
    const cushM = std({ color: 0x1a56a0, roughness: 1 });
    mesh(scene, new THREE.BoxGeometry(0.05, 0.045, HZ * 2), cushM, V(HX + 0.025, Y + 0.0225, 0)); mesh(scene, new THREE.BoxGeometry(0.05, 0.045, HZ * 2), cushM, V(-HX - 0.025, Y + 0.0225, 0));
    mesh(scene, new THREE.BoxGeometry(HX * 2 + 0.1, 0.045, 0.05), cushM, V(0, Y + 0.0225, HZ + 0.025)); mesh(scene, new THREE.BoxGeometry(HX * 2 + 0.1, 0.045, 0.05), cushM, V(0, Y + 0.0225, -HZ - 0.025));
    const railM = new THREE.MeshPhysicalMaterial({ color: 0x5a2212, roughness: .55, clearcoat: .35, clearcoatRoughness: .45 });
    const RW = 0.16, RX = HX + 0.05 + RW / 2, RZ = HZ + 0.05 + RW / 2;
    mesh(scene, new THREE.BoxGeometry(RW, 0.08, (HZ + 0.05 + RW) * 2), railM, V(RX, Y + 0.005, 0)); mesh(scene, new THREE.BoxGeometry(RW, 0.08, (HZ + 0.05 + RW) * 2), railM, V(-RX, Y + 0.005, 0));
    mesh(scene, new THREE.BoxGeometry((HX + 0.05) * 2, 0.08, RW), railM, V(0, Y + 0.005, RZ)); mesh(scene, new THREE.BoxGeometry((HX + 0.05) * 2, 0.08, RW), railM, V(0, Y + 0.005, -RZ));
    const dm = new THREE.MeshBasicMaterial({ color: 0xf3efe2 }), dg = new THREE.CircleGeometry(0.011, 12);
    for (let k = 1; k <= 7; k++) [RX, -RX].forEach(x => { mesh(scene, dg, dm, V(x, Y + 0.046, -HZ + k * HZ / 4), false).rotation.x = -Math.PI / 2; });
    for (let k = 1; k <= 3; k++) [RZ, -RZ].forEach(z => { mesh(scene, dg, dm, V(-HX + k * HX / 2, Y + 0.046, z), false).rotation.x = -Math.PI / 2; });
    const bodyM = std({ color: 0x3a160c, roughness: .5 });
    mesh(scene, new THREE.BoxGeometry(RX * 2 + RW, 0.5, RZ * 2 + RW), bodyM, V(0, Y - 0.3, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => mesh(scene, new THREE.BoxGeometry(0.17, 0.4, 0.17), bodyM, V(a * (RX - 0.05), 0.2, b * (RZ - 0.15))));

    const lampara = new THREE.Group(); scene.add(lampara);
    mesh(lampara, new THREE.BoxGeometry(0.55, 0.13, 2.0), std({ color: 0x1d3b2a, roughness: .5, metalness: .3 }), V(0, 1.95, 0), false);
    mesh(lampara, new THREE.PlaneGeometry(0.5, 1.94), new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false }), V(0, 1.884, 0), false).rotation.x = Math.PI / 2;
    [-0.8, 0.8].forEach(z => mesh(lampara, new THREE.CylinderGeometry(0.006, 0.006, 1.2, 6), std({ color: 0x111111 }), V(0, 2.6, z), false));
    [-0.75, 0, 0.75].forEach(z => { const l = new THREE.SpotLight(0xfff0d6, 1.25, 6, 0.85, 0.65, 1); l.position.set(0, 1.86, z); l.target.position.set(0, Y, z * 1.1); scene.add(l); scene.add(l.target); });
    const sol = new THREE.DirectionalLight(0xfff0d6, 0.3); sol.position.set(0.5, 4, 0.9); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -1.2, right: 1.2, top: 1.9, bottom: -1.9, near: 1, far: 6 }); sol.shadow.bias = -0.0005; scene.add(sol);
    scene.add(new THREE.HemisphereLight(0x8090ff, 0x100808, 0.3));

    /* bolas (con punticos para que se vea cómo ruedan) */
    const bolaTex = (base, punto) => tex(256, 128, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = punto;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse((k + .5) * w / 4, h / 2, 7, 7, 0, 0, 6.3); g.fill(); }
      g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
    });
    const bG = new THREE.SphereGeometry(BR, 40, 28);
    const cols = [['#f7f5ee', '#d61f2c'], ['#f2c21a', '#b3261e'], ['#d61f2c', '#ffffff']];
    const bolas = cols.map(c => mesh(scene, bG, new THREE.MeshPhysicalMaterial({ map: bolaTex(c[0], c[1]), roughness: .12, clearcoat: 1, clearcoatRoughness: .05 })));
    const prev = [0, 1, 2].map(() => ({ x: 0, z: 0 }));
    const qTmp = new THREE.Quaternion(), ejeTmp = V(0, 0, 0);
    function colocar() { bolas.forEach((m, i) => { const b = fis.b[i]; m.position.set(b.x, Y + BR, b.z); prev[i].x = b.x; prev[i].z = b.z; }); }
    function rodar() {
      bolas.forEach((m, i) => {
        const b = fis.b[i], dx = b.x - prev[i].x, dz = b.z - prev[i].z, d = Math.hypot(dx, dz);
        if (d > 1e-6) { ejeTmp.set(dz / d, 0, -dx / d); qTmp.setFromAxisAngle(ejeTmp, d / BR); m.quaternion.premultiply(qTmp); }
        m.position.set(b.x, Y + BR, b.z); prev[i].x = b.x; prev[i].z = b.z;
      });
    }

    /* guía punteada, bola fantasma y taco */
    const NGP = 700, gPos = new Float32Array(NGP * 3), gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    const gMat = new THREE.PointsMaterial({ color: 0xe8fff8, size: 0.016, map: OJ.dotTex, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
    const gPts = new THREE.Points(gGeo, gMat); gPts.frustumCulled = false; scene.add(gPts);
    const fantasma = mesh(scene, bG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .32, depthWrite: false }), null, false);
    const taco = new THREE.Group(); scene.add(taco);
    const seg = (r0, r1, y0, y1, color, rough, metal) => mesh(taco, new THREE.CylinderGeometry(r1, r0, y1 - y0, 16), std({ color, roughness: rough, metalness: metal || 0 }), V(0, (y0 + y1) / 2, 0));
    seg(0.0063, 0.0065, 0, 0.012, 0x2a5fd1, .9); seg(0.0066, 0.0067, 0.012, 0.035, 0xf4f1e8, .3); seg(0.0068, 0.0098, 0.035, 0.78, 0xe6c896, .35);
    seg(0.0105, 0.0105, 0.78, 0.8, 0xc9ccd1, .25, .9); seg(0.0106, 0.0145, 0.8, 1.3, 0x3a1a0c, .3); seg(0.0146, 0.015, 1.3, 1.46, 0x0d0d0d, .4);
    const ejeY = V(0, 1, 0), ejeTaco = V(0, 0, 0);

    /* ---------------- estado ---------------- */
    const VISTAS = ['mesa', 'arriba', 'taco'], VISTA_N = { mesa: 'Vista: mesa', arriba: 'Vista: arriba', taco: 'Vista: taco' };
    const st = { pts: [0, 0], turno: 0, entrada: 1, fase: 'apunta', ang: 0, pot: 0, lado: 0, alto: 0, vista: OJ.store.get('billar.vista', 'mesa'), acc: 0, t: 0, fn: null, tiro: 0,
      arr: false, lx: 0, la: null, ia: null, fin: false, sonT: 0 };
    game.st = st;
    const GUIA_N = opt.rival === 'ia' ? [3, 1, 0][opt.dif] : 1;

    /* ---------------- marcador y controles ---------------- */
    const hud = OJ.el('div', 'hud bil-hud', `
      <div class="hud-top">
        <div class="row"><button class="ic" data-a="pausa" aria-label="Menú">☰</button><span class="brand">Billar 3D</span><span class="sub">${tres ? 'Tres bandas' : 'Carambola libre'} · a ${opt.meta}</span></div>
        <div class="row teams"><div class="pill" data-r="p0"><i class="bolita b0"></i>${nombres[0]} <b>0</b></div><span class="meta" data-r="ent"></span><div class="pill" data-r="p1"><i class="bolita b1"></i>${nombres[1]} <b>0</b></div></div>
        <div class="turno" data-r="turno"></div>
        <div class="chips"><span data-r="cb">Bolas 0/2</span>${tres ? '<span data-r="cn">Bandas 0/3</span>' : ''}</div>
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
    function pintar() {
      [R.p0, R.p1].forEach((p, i) => { p.querySelector('b').textContent = st.pts[i]; const on = st.turno === i && !st.fin; p.classList.toggle('on', on); p.style.background = on ? (i ? '#b58a00' : '#13a37a') : ''; });
      R.ent.textContent = 'Entrada ' + st.entrada;
      R.turno.textContent = st.fin ? '' : st.fase === 'pensando' || st.fase === 'iaApunta' ? 'El Profe está pensando…' : esIA(st.turno) ? 'Juega El Profe' : (opt.rival === 'ia' ? 'Te toca tacar' : 'Taca: bola ' + nombres[st.turno].toLowerCase());
      R.vista.textContent = VISTA_N[st.vista];
      R.pot.classList.toggle('off', !humano());
      hud.querySelectorAll('.bil button').forEach(b => { if (b.dataset.a !== 'vista') b.style.opacity = humano() ? 1 : .3; });
      R.ayuda.textContent = humano() ? (st.tiro === 0 && st.pts[0] + st.pts[1] === 0 ? 'Desliza para apuntar · jala la barra para tacar' : '') : '';
      R.dot.style.left = (50 + st.lado * 34) + '%'; R.dot.style.top = (50 - st.alto * 34) + '%';
    }
    function chips() {
      const e = fis.ev; R.cb.textContent = 'Bolas ' + e.bolas.length + '/2'; R.cb.classList.toggle('ok', e.bolas.length === 2);
      if (tres) { const n = e.bolas.length === 2 ? e.antes2 : e.bandas; R.cn.textContent = 'Bandas ' + n + '/3'; R.cn.classList.toggle('ok', n >= 3); }
    }
    function sumaPill(i) { const p = i ? R.p1 : R.p0; p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube'); }

    // barra de fuerza: se jala hacia abajo y se suelta
    let potArr = false;
    const potDe = y => { const r = R.track.getBoundingClientRect(); return clamp((y - r.top) / r.height, 0, 1); };
    const potPinta = () => { R.fill.style.height = (st.pot * 100) + '%'; R.knob.style.top = (st.pot * 100) + '%'; R.knob.textContent = st.pot > 0.02 ? Math.round(st.pot * 100) + '%' : 'JALA'; };
    R.pot.addEventListener('pointerdown', e => { if (!humano()) return; potArr = true; try { R.pot.setPointerCapture(e.pointerId); } catch (x) { /* */ } OJ.audio(); st.pot = potDe(e.clientY); potPinta(); });
    R.pot.addEventListener('pointermove', e => { if (!potArr) return; st.pot = potDe(e.clientY); potPinta(); });
    const potFin = () => { if (!potArr) return; potArr = false; if (st.pot > 0.05 && humano()) golpear(); else { st.pot = 0; potPinta(); } };
    R.pot.addEventListener('pointerup', potFin); R.pot.addEventListener('pointercancel', potFin);

    // botones
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
      const c = fis.b[st.turno]; let x = c.x, z = c.z, dx = Math.sin(ang), dz = -Math.cos(ang); const pts = [[x, z]]; let bola = null;
      for (let k = 0; k <= nb; k++) {
        let tb = 1e9, bi = -1;
        for (let i = 0; i < 3; i++) {
          if (i === st.turno) continue;
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
      gPts.visible = ver; fantasma.visible = false;
      if (!ver) return;
      const tr = trazar(st.ang, st.fase === 'apunta' ? GUIA_N : 0); let n = 0;
      const linea = (x0, z0, x1, z1, ini) => {
        const L = Math.hypot(x1 - x0, z1 - z0), paso = 0.032;
        for (let s = ini; s < L && n < NGP; s += paso) { const u = s / L; gPos[n * 3] = x0 + (x1 - x0) * u; gPos[n * 3 + 1] = Y + 0.006; gPos[n * 3 + 2] = z0 + (z1 - z0) * u; n++; }
      };
      for (let k = 0; k < tr.pts.length - 1; k++) linea(tr.pts[k][0], tr.pts[k][1], tr.pts[k + 1][0], tr.pts[k + 1][1], k ? 0.016 : BR + 0.02);
      if (tr.bola) {
        const b = tr.bola, o = fis.b[b.i]; let nx = o.x - b.gx, nz = o.z - b.gz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        fantasma.visible = true; fantasma.position.set(b.gx, Y + BR, b.gz);
        linea(o.x, o.z, o.x + nx * 0.34, o.z + nz * 0.34, BR + 0.01);
        const dn = b.dx * nx + b.dz * nz; let tx = b.dx - dn * nx, tz = b.dz - dn * nz; const tl = Math.hypot(tx, tz);
        if (tl > 0.05) linea(b.gx, b.gz, b.gx + tx / tl * 0.26, b.gz + tz / tl * 0.26, BR + 0.01);
      }
      gGeo.setDrawRange(0, n); gGeo.attributes.position.needsUpdate = true;
    }

    /* ---------------- flujo ---------------- */
    function espera(seg, fn) { st.fase = 'espera'; st.t = seg; st.fn = fn; }
    function apuntarInicial() {
      const c = fis.b[st.turno]; let best = 2, bd = 9;
      [0, 1, 2].forEach(i => { if (i === st.turno) return; const d = Math.hypot(fis.b[i].x - c.x, fis.b[i].z - c.z); if (d < bd) { bd = d; best = i; } });
      const o = fis.b[st.tiro === 0 && st.entrada === 1 ? 2 : best];
      st.ang = Math.atan2(o.x - c.x, -(o.z - c.z));
    }
    function turnoNuevo() {
      st.pot = 0; potPinta(); fis.cue = st.turno; fis.ev = ev0(); chips(); apuntarInicial();
      if (esIA(st.turno)) { st.fase = 'pensando'; st.ia = { n: 0, max: IA_N[tres ? 1 : 0][opt.dif], mejor: null, sc: -1 }; st.lado = st.alto = 0; }
      else st.fase = 'apunta';
      pintar();
    }
    function golpear() { st.fase = 'golpe'; st.t = 0; pintar(); }
    function soltar() {
      const vel = V_MIN + Math.pow(st.pot, 1.25) * (V_MAX - V_MIN);
      fis.tirar(st.turno, st.ang, vel, st.lado, st.alto); st.tiro++;
      OJ.snd.taco(st.pot); OJ.vib(15); st.fase = 'rodando'; st.acc = 0; chips(); pintar();
    }
    function sonido(tipo, v) {
      if (st.sonT > 0 && v < 0.6) return; st.sonT = 0.03;
      if (tipo === 'bola') { OJ.snd.bola(v); if (v > 1.2) OJ.vib(8); } else OJ.snd.banda(v);
      chips();
    }
    function evaluar() {
      const e = fis.ev, ok = e.bolas.length === 2 && (!tres || e.antes2 >= 3), t = st.turno;
      st.pot = 0; potPinta();
      if (ok) {
        st.pts[t]++; sumaPill(t); OJ.snd.punto(); OJ.vib(60);
        OJ.gran('¡Carambola!', tres ? 'A ' + e.antes2 + ' bandas · +1 punto' : '+1 punto · sigues tacando', '#3ee0b0');
        pintar();
        if (st.pts[t] >= opt.meta) return espera(1.6, terminar);
        return espera(1.5, turnoNuevo);
      }
      const msg = e.bolas.length === 0 ? 'No tocaste ninguna bola' : e.bolas.length === 1 ? 'Faltó tocar la otra bola' : 'Solo ' + e.antes2 + (e.antes2 === 1 ? ' banda' : ' bandas') + ' antes de la segunda bola';
      OJ.snd.falla(); OJ.gran(e.bolas.length === 2 ? '¡Casi!' : 'Fallaste', msg, '#ffffff', 1500);
      espera(1.5, () => { st.turno = 1 - t; if (st.turno === 0) st.entrada++; st.lado = st.alto = 0; turnoNuevo(); });
    }
    function terminar() {
      st.fin = true; st.fase = 'fin'; pintar();
      const g = st.pts[0] >= opt.meta ? 0 : 1, gano = opt.rival !== 'ia' || g === 0;
      gano ? OJ.snd.gana() : OJ.snd.pierde();
      OJ.app.final({ juego: 'billar', gano: opt.rival === 'ia' ? g === 0 : null, titulo: opt.rival === 'ia' ? (g === 0 ? '¡Ganaste!' : 'Ganó El Profe') : '¡Ganó la bola ' + nombres[g].toLowerCase() + '!',
        marcador: [[nombres[0], st.pts[0]], [nombres[1], st.pts[1]]], opt });
    }

    /* ---------------- la máquina ---------------- */
    function iaPiensa() {
      const ia = st.ia, t0 = performance.now();
      while (ia.n < ia.max && performance.now() - t0 < 9) { ia.n++; const c = candidato(fis, sim, st.turno, tres); if (c.sc > ia.sc) { ia.sc = c.sc; ia.mejor = c; } }
      if (ia.n >= ia.max) {
        const m = ia.mejor || { ang: st.ang, pot: 0.5, lado: 0, alto: 0 };
        m.ang += OJ.gauss() * IA_ERR[tres ? 1 : 0][opt.dif];
        st.lado = m.lado; st.alto = m.alto; ia.obj = m; ia.t = 0; ia.a0 = st.ang;
        let d = (m.ang - st.ang) % 6.2832; if (d > Math.PI) d -= 6.2832; if (d < -Math.PI) d += 6.2832; ia.da = d;
        st.fase = 'iaApunta'; pintar();
      }
    }

    /* ---------------- entrada sobre la mesa ---------------- */
    const ray = new THREE.Raycaster(), plano = new THREE.Plane(V(0, 1, 0), -Y), pTmp = V(0, 0, 0), ndc = new THREE.Vector2();
    function angDedo(x, y) {
      ndc.set(x / OJ.W * 2 - 1, -(y / OJ.H * 2 - 1)); ray.setFromCamera(ndc, cam);
      if (!ray.ray.intersectPlane(plano, pTmp)) return null;
      const c = fis.b[st.turno]; return Math.atan2(pTmp.x - c.x, -(pTmp.z - c.z));
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
    /* Para pruebas automáticas */
    game.probar = (ang, pot, lado, alto) => { st.ang = ang; st.pot = pot; st.lado = lado || 0; st.alto = alto || 0; golpear(); };

    /* ---------------- cámara ---------------- */
    const cPos = V(0, 3.2, 2.6), cTar = V(0, Y, 0.1), dPos = V(0, 0, 0), dTar = V(0, 0, 0), up = V(0, 1, 0), dUp = V(0, 1, 0);
    let primer = true;
    function camara(dt) {
      const asp = OJ.W / OJ.H, rodando = st.fase === 'rodando' || st.fase === 'espera' || st.fase === 'fin';
      let v = st.vista; if (v === 'taco' && rodando) v = 'mesa';
      const c = fis.b[st.turno], dx = Math.sin(st.ang), dz = -Math.cos(st.ang);
      let fov = 56; dUp.set(0, 1, 0);
      if (v === 'taco') { dPos.set(c.x - dx * 1.05, Y + 0.6, c.z - dz * 1.05); dTar.set(c.x + dx * 0.7, Y, c.z + dz * 0.7); fov = 58; }
      else if (v === 'arriba') {
        fov = 40; const need = Math.max(4.75 / 2, (2.02 / asp) / 2) / Math.tan(fov * Math.PI / 360);
        dPos.set(0, Y + need, 0.1); dTar.set(0, Y, 0.1); dUp.set(0, 0, -1);
      } else {
        const k = clamp(0.5 / asp, 0.7, 1.25);          // en pantallas angostas la cámara sube y se aleja
        dPos.set(0, Y + 2.45 * k, 2.3 * k + 0.35); dTar.set(0, Y, 0.22); fov = 56;
      }
      const f = primer ? 1 : 1 - Math.exp(-dt * 6); primer = false;
      cPos.lerp(dPos, f); cTar.lerp(dTar, f); up.lerp(dUp, f).normalize();
      cam.fov += (fov - cam.fov) * f; cam.position.copy(cPos); cam.up.copy(up); cam.lookAt(cTar); cam.updateProjectionMatrix();
      lampara.visible = cPos.y < 1.75;
      gMat.size = clamp(7.5 * cam.position.distanceTo(bolas[st.turno].position) / (OJ.H / 2) * Math.tan(cam.fov * Math.PI / 360) * 2.2, 0.008, 0.06);
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
        st.acc += dt; let n = Math.min(Math.floor(st.acc / DT), 48), mov = true; st.acc -= n * DT;
        while (n-- > 0 && mov) mov = fis.paso(sonido);
        if (!mov) { chips(); evaluar(); }
      } else if (st.fase === 'espera') { st.t -= dt; if (st.t <= 0) { const f = st.fn; st.fn = null; f(); } }
      rodar();
      // taco
      const ver = st.fase === 'apunta' || st.fase === 'iaApunta' || st.fase === 'golpe';
      taco.visible = ver;
      if (ver) {
        const c = fis.b[st.turno], dx = Math.sin(st.ang), dz = -Math.cos(st.ang), el = 0.1;
        ejeTaco.set(-dx * Math.cos(el), Math.sin(el), -dz * Math.cos(el)).normalize();
        let atras = 0.035 + st.pot * 0.3; if (st.fase === 'golpe') atras *= Math.max(0, 1 - st.t / 0.08);
        taco.position.set(c.x, Y + BR, c.z).addScaledVector(ejeTaco, BR + atras); taco.quaternion.setFromUnitVectors(ejeY, ejeTaco);
      }
      pintarGuia(); camara(dt);
    };
    game.dispose = function () { clearInterval(rep); hud.remove(); if (OJ.input === game.input) OJ.input = null; OJ.liberar(scene); };
    game.reiniciar = () => OJ.app.jugar('billar', opt);

    OJ.input = game.input;
    colocar(); turnoNuevo();
    return game;
  };
})();
