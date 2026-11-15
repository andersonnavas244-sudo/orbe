/*
 * Tejo 3D — el tejo colombiano: cancha de greda inclinada, bocín y mechas que explotan.
 * Puntos: mano 1 · mecha 3 · embocinada 6 · moñona 9.
 * Cada ronda cada equipo lanza 2 tejos; si nadie revienta mecha ni emboca, la mano (el tejo más cerca del bocín) vale 1.
 */
(function () {
  'use strict';
  const { V, std, tex, planks, noise, mesh, sprite, clamp } = OJ;
  const TILT = 0.78, CT = Math.cos(TILT), ST = Math.sin(TILT);
  const G = 9.8, ELEV = 36 * Math.PI / 180, S_MIN = 6.5, S_MAX = 9.5, DTV = 1 / 120;
  const P0 = V(0, 1.0, 6.3);              // de dónde sale el tejo
  const CAM_Z = 9.2, MECHA_R = 0.25, POR_RONDA = 2;
  const EQ = [{ n: 'Rojos', c: '#d7263d', hex: 0xd7263d }, { n: 'Azules', c: '#2f6fd0', hex: 0x2f6fd0 }];
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
      else if (z <= -0.86 && y < 1.8 && ax < 1.2) fin = { tipo: 'tabla' };
      else if (y <= 0.04) fin = { tipo: 'piso' };
      else if (z <= -2.5) fin = { tipo: 'pared' };
      pts.push(x, y, z);
    }
    return { pts, fin: fin || { tipo: 'piso' }, vx, vy, vz };
  }
  /* Velocidad necesaria para caer en un punto de la cancha (coordenadas locales de la greda) */
  function apuntarA(lx, ly) {
    const ty = 0.95 + ly * CT, tz = -ly * ST, dx = lx - P0.x, dz = P0.z - tz, D = Math.hypot(dx, dz), h = ty - P0.y;
    const den = 2 * Math.cos(ELEV) ** 2 * (D * Math.tan(ELEV) - h);
    return { phi: Math.atan2(dx, dz), s: Math.sqrt(G * D * D / den) };
  }

  OJ.Tejo = function (opt) {
    opt = Object.assign({ modo: 'ia', dif: 1, meta: 27, demo: false }, opt);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
    const game = { scene, cam, exposure: 0.85, nombre: 'tejo' };
    const nombres = opt.modo === 'ia' ? ['Tú', 'Máquina'] : ['Rojos', 'Azules'];
    const esIA = t => opt.demo || (opt.modo === 'ia' && t === 1);

    /* ---------------- escena ---------------- */
    OJ.semilla(11);
    scene.background = new THREE.Color(0x150d28); scene.fog = new THREE.Fog(0x150d28, 14, 32);
    const woodM = std({ map: tex(512, 512, planks('#7a5030', '#5e3c21', 'rgba(0,0,0,.4)', 10)), roughness: .72 });
    const fl = mesh(scene, new THREE.PlaneGeometry(40, 40), std({ map: tex(512, 512, planks('#6b4a35', '#57392a', 'rgba(0,0,0,.45)', 14), 7, 7), roughness: .9 }), V(0, 0, 0));
    fl.rotation.x = -Math.PI / 2;
    mesh(scene, new THREE.PlaneGeometry(18, 9), std({ map: tex(512, 512, planks('#5b4038', '#4a322b', 'rgba(0,0,0,.5)', 12), 3, 2), roughness: .95 }), V(0, 4.5, -2.7));
    const sign = mesh(scene, new THREE.PlaneGeometry(3.6, 0.85), new THREE.MeshBasicMaterial({ map: OJ.signTex('Tejo Colombiano', '#a32424', '#ffd34d', '#fff3d6', '800 150px "Baloo 2", sans-serif') }), V(0, 2.62, -2.65), false);
    sign.scale.setScalar(0.62);
    OJ.guirnalda(scene, 3.45, -4.5, 4.5, -2.25, 0.35);
    OJ.guirnalda(scene, 4.0, -4.5, 4.5, 1.2, 0.4);
    scene.add(new THREE.HemisphereLight(0xc7b3ff, 0x3a2414, 0.42));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.0); sun.position.set(2.5, 6.5, 4.5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3.4, bottom: -3, near: 1, far: 20 }); sun.shadow.bias = -0.0006; scene.add(sun);
    const bulb = new THREE.PointLight(0xffc070, 1.0, 10); bulb.position.set(0, 3.3, 1.2); scene.add(bulb);
    const boom = new THREE.PointLight(0xff8a2a, 0, 5); scene.add(boom);

    const cancha = new THREE.Group(); cancha.position.set(0, 0.95, 0); cancha.rotation.x = -TILT; scene.add(cancha);
    const clayT = tex(1024, 1024, (g, w, h) => {
      noise('#6f5847', ['rgba(60,45,35,.25)', 'rgba(175,155,135,.22)', 'rgba(95,75,60,.3)'], 9000, 4)(g, w, h);
      for (let k = 0; k < 9; k++) { const x = OJ.rnd() * w, y = OJ.rnd() * h, r = 26 + OJ.rnd() * 18; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,28,20,.55)'); gr.addColorStop(1, 'rgba(40,28,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    });
    mesh(cancha, new THREE.BoxGeometry(2, 2, 0.2), std({ map: clayT, roughness: 1 }), V(0, 0, -0.1));
    [[0, 1.075, 2.3, 0.15], [0, -1.075, 2.3, 0.15], [1.075, 0, 0.15, 2.0], [-1.075, 0, 0.15, 2.0]].forEach(a => mesh(cancha, new THREE.BoxGeometry(a[2], a[3], 0.36), woodM, V(a[0], a[1], 0.02)));
    mesh(scene, new THREE.BoxGeometry(2.3, 1.78, 0.12), woodM, V(0, 0.89, -0.94));
    mesh(scene, new THREE.BoxGeometry(2.3, 0.16, 0.32), woodM, V(0, 0.08, 0.86));
    mesh(cancha, new THREE.TorusGeometry(0.22, 0.035, 16, 48), std({ color: 0xa9b1ba, metalness: .9, roughness: .28 }), V(0, 0, 0.015));
    mesh(cancha, new THREE.CircleGeometry(0.19, 32), std({ color: 0x2a2019, roughness: 1 }), V(0, 0, 0.003));

    /* mechas: 4 sobres triangulares con pólvora sobre el borde del bocín */
    const triG = s => { const sh = new THREE.Shape(); sh.moveTo(0, 0.17 * s); sh.lineTo(-0.1 * s, -0.04 * s); sh.lineTo(0.1 * s, -0.04 * s); sh.lineTo(0, 0.17 * s); return new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); };
    const gBig = triG(1), gSmall = triG(0.55), mW = std({ color: 0xf6f2e8, roughness: .85 }), mR = std({ color: 0xd8343f, roughness: .7 });
    const mechas = [Math.PI / 2, 0, Math.PI, -Math.PI / 2].map(a => {
      const g = new THREE.Group(); g.position.set(Math.cos(a) * MECHA_R, Math.sin(a) * MECHA_R, 0.03); g.rotation.z = a - Math.PI / 2;
      const inner = new THREE.Group(); inner.rotation.x = 0.9; g.add(inner);
      mesh(inner, gBig, mW); mesh(inner, gSmall, mR, V(0, 0.01, 0.004), false); mesh(inner, gSmall, mR, V(0, 0.01, -0.004), false);
      cancha.add(g);
      return { g, x: Math.cos(a) * MECHA_R, y: Math.sin(a) * MECHA_R, viva: true };
    });

    /* aro que marca la mano y el punto donde caería el tejo */
    const aroMano = mesh(cancha, new THREE.RingGeometry(0.15, 0.19, 40), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), V(0, 0, 0.05), false);
    const aroCae = mesh(cancha, new THREE.RingGeometry(0.1, 0.135, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), V(0, 0, 0.045), false);
    const aroBoc = mesh(cancha, new THREE.RingGeometry(0.2, 0.27, 48), new THREE.MeshBasicMaterial({ color: 0x9fe1ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), V(0, 0, 0.04), false);

    /* guía de puntos */
    const NG = 26, guiaG = new THREE.SphereGeometry(0.03, 8, 8);
    const guia = []; for (let i = 0; i < NG; i++) { const m = mesh(scene, guiaG, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: .8, toneMapped: false }), null, false); m.visible = false; guia.push(m); }
    const estela = []; for (let i = 0; i < 12; i++) { const m = mesh(scene, guiaG, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.5 * (1 - i / 12), toneMapped: false }), null, false); m.visible = false; m.scale.setScalar(1.3 * (1 - i / 14)); estela.push(m); }
    const hist = [];

    /* efectos */
    const chispas = new OJ.Chispas(scene, 150, 0xffa040, 0.08), nucleo = new OJ.Chispas(scene, 60, 0xfff0c0, 0.055), polvo = new OJ.Chispas(scene, 40, 0xcbb49a, 0.05);
    const humo = []; for (let i = 0; i < 10; i++) { const s = sprite(scene, 0x6e675e, V(0, -5, 0), 0.3, 0, false); s.userData.v = V(0, 0, 0); humo.push(s); }
    const fuego = [sprite(scene, 0xff6a10, V(0, -5, 0), 1.1, 0, true), sprite(scene, 0xffc060, V(0, -5, 0), 0.55, 0, true), sprite(scene, 0xffffff, V(0, -5, 0), 0.2, 0, true)];
    let humoV = 0, fuegoV = 0, boomI = 0, shake = 0, zoom = 0, manoV = 0, bocV = 0;
    const nrm = V(0, ST, CT);

    /* tejos */
    const tejoG = new THREE.CylinderGeometry(0.115, 0.125, 0.06, 32), tejoM = std({ color: 0xc9a25e, metalness: .85, roughness: .26 }), capG = new THREE.CircleGeometry(0.075, 24);
    function nuevoTejo(eq) {
      const g = new THREE.Group(); mesh(g, tejoG, tejoM);
      const capM = new THREE.MeshStandardMaterial({ color: EQ[eq].hex, roughness: .5 });
      const a = mesh(g, capG, capM, V(0, 0.0312, 0), false); a.rotation.x = -Math.PI / 2;
      const b = mesh(g, capG, capM, V(0, -0.0312, 0), false); b.rotation.x = Math.PI / 2;
      g.userData.eq = eq; scene.add(g); return g;
    }
    let enMano = null;
    const tejos = [];   // los que ya cayeron en esta ronda

    /* ---------------- estado ---------------- */
    const st = { pts: [0, 0], ronda: 1, inicia: 0, turno: 0, tiros: [0, 0], puntuo: false, fase: 'apunta', t: 0, fn: null, iaT: 1.2,
      arr: false, sx: 0, sy: 0, pot: 0, aim: 0, tt: 0, vuelo: null, vi: 0, cae: null, fin: false };
    game.st = st;

    /* ---------------- marcador ---------------- */
    let hud = null, R = {};
    if (!opt.demo) {
      hud = OJ.el('div', 'hud tejo-hud', `
        <div class="hud-top">
          <div class="row"><button class="ic" data-a="pausa" aria-label="Menú">☰</button><span class="brand">Tejo 3D</span><span class="sub" data-r="ronda"></span></div>
          <div class="row teams"><div class="pill" data-r="p0">${nombres[0]} <b>0</b></div><span class="meta">a ${opt.meta} puntos</span><div class="pill" data-r="p1">${nombres[1]} <b>0</b></div></div>
          <div class="row"><div class="turno" data-r="turno"></div><div class="tejos-rest" data-r="rest"></div></div>
        </div>
        <div class="hud-bot">
          <div class="lbl"><span>Fuerza</span><span>Mano 1 · Mecha 3 · Embocinada 6 · Moñona 9</span></div>
          <div class="bar"><i data-r="bar"></i></div>
          <div class="ayuda" data-r="ayuda"></div>
        </div>`);
      OJ.ui.appendChild(hud);
      hud.querySelectorAll('[data-r]').forEach(e => { R[e.dataset.r] = e; });
      hud.querySelector('[data-a="pausa"]').onclick = () => OJ.app.pausa(game);
    }
    function pintar() {
      if (!hud) return;
      R.ronda.textContent = 'Ronda ' + st.ronda;
      [R.p0, R.p1].forEach((p, i) => {
        p.querySelector('b').textContent = st.pts[i];
        const on = st.turno === i && !st.fin; p.classList.toggle('on', on); p.style.background = on ? EQ[i].c : '';
      });
      const quedan = POR_RONDA - st.tiros[st.turno];
      R.turno.textContent = st.fin ? '' : (esIA(st.turno) ? 'Lanza la máquina…' : 'Lanza: ' + nombres[st.turno]);
      R.rest.style.color = EQ[st.turno].c;
      R.rest.innerHTML = st.fin ? '' : Array.from({ length: POR_RONDA }, (_, i) => `<i class="${i < quedan ? 'q' : ''}"></i>`).join('');
      const humano = st.fase === 'apunta' && !esIA(st.turno) && !st.fin;
      R.ayuda.textContent = humano ? 'Arrastra hacia atrás y suelta para lanzar' : '';
      R.ayuda.classList.toggle('late', humano);
    }
    function sumar(eq, n) {
      st.pts[eq] += n; st.puntuo = true;
      if (hud) { const p = eq ? R.p1 : R.p0; p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube'); }
    }

    /* ---------------- flujo ---------------- */
    function espera(seg, fn) { st.fase = 'espera'; st.t = seg; st.fn = fn; }
    function tomarTejo() {
      enMano = nuevoTejo(st.turno); enMano.position.copy(P0); enMano.rotation.set(0.5, 0, 0);
      st.fase = 'apunta'; st.arr = false; st.pot = 0; st.aim = 0; st.iaT = opt.demo ? 0.9 : 1.15; if (hud) R.bar.style.width = '0%';
      pintar();
    }
    function nuevaRonda() {
      tejos.forEach(t => { cancha.remove(t); scene.remove(t); }); tejos.length = 0;
      mechas.forEach(m => { m.viva = true; m.g.visible = true; });
      st.tiros = [0, 0]; st.puntuo = false; st.turno = st.inicia; manoV = 0;
      tomarTejo();
    }
    function lanzar(phi, s) {
      st.vuelo = tray(phi, s); st.vi = 0; st.fase = 'vuelo'; hist.length = 0;
      guia.forEach(m => { m.visible = false; }); aroCae.material.opacity = 0;
      if (!opt.demo) OJ.snd.silbido();
      if (hud) { R.ayuda.textContent = ''; R.ayuda.classList.remove('late'); }
    }
    function lanzarIA() {
      const d = opt.demo ? 1 : opt.dif, vivas = mechas.filter(m => m.viva);
      let tx = 0, ty = 0;
      if (vivas.length && Math.random() < 0.75) { const m = vivas[Math.floor(Math.random() * vivas.length)]; tx = m.x * 0.9; ty = m.y * 0.9; }
      const a = apuntarA(tx, ty);
      lanzar(a.phi + OJ.gauss() * IA_ANG[d], a.s + OJ.gauss() * IA_VEL[d]);
    }
    function explotar(m, fuerte) {
      const p = V(0, 0, 0); m.g.getWorldPosition(p); m.viva = false; m.g.visible = false;
      chispas.explotar(p, nrm.clone().multiplyScalar(1.6), 1, fuerte ? 4.2 : 3.4, 1.15); nucleo.explotar(p, nrm.clone().multiplyScalar(1.2), .4, 2, .7);
      humo.forEach(s => { s.position.copy(p).add(V((Math.random() - .5) * .35, Math.random() * .2, (Math.random() - .5) * .3)); s.userData.v.set((Math.random() - .5) * .4, .5 + Math.random() * .6, (Math.random() - .5) * .3); s.scale.setScalar(.22); });
      fuego.forEach(s => s.position.copy(p).addScaledVector(nrm, 0.08));
      humoV = 1; fuegoV = 1; boom.position.copy(p).addScaledVector(nrm, 0.4); boomI = fuerte ? 7 : 5; shake = fuerte ? 0.2 : 0.13; zoom = 1;
      if (!opt.demo) { OJ.snd.mecha(); OJ.vib(fuerte ? 180 : 110); OJ.destello('#ffb060', fuerte ? .6 : .42); }
    }
    function aterrizar() {
      const f = st.vuelo.fin, eq = st.turno, t = enMano; enMano = null;
      estela.forEach(m => { m.visible = false; });
      if (f.tipo !== 'greda') {
        // rebota y cae al piso
        const n = st.vuelo.pts.length, p = V(st.vuelo.pts[n - 3], st.vuelo.pts[n - 2], st.vuelo.pts[n - 1]);
        st.cae = { t, v: f.tipo === 'piso' ? V(st.vuelo.vx * .25, 0.9, st.vuelo.vz * .25) : V(st.vuelo.vx * .2 + (Math.random() - .5), 1.6, 1.3 + Math.random()), vida: 1.5 };
        t.position.copy(p);
        if (!opt.demo) { f.tipo === 'piso' ? OJ.snd.greda() : OJ.snd.tabla(); OJ.gran(f.tipo === 'tabla' ? '¡Tabla!' : 'Afuera', 'No cayó en la greda', '#ffffff', 1300); }
        st.fase = 'cae'; st.t = 1.25; st.fn = () => despues(eq);
        return;
      }
      let lx = f.lx, ly = f.ly;
      const d = Math.hypot(lx, ly); let mi = -1, md = 9;
      mechas.forEach((m, i) => { if (!m.viva) return; const dd = Math.hypot(lx - m.x, ly - m.y); if (dd < md) { md = dd; mi = i; } });
      const toca = md < 0.155;
      let tipo = 'mano';
      if (toca && d < 0.15) tipo = 'monona'; else if (d < 0.095) tipo = 'embocinada'; else if (toca) tipo = 'mecha';
      if (tipo === 'monona') { lx *= 0.35; ly *= 0.35; }
      const dl = Math.hypot(lx, ly);
      cancha.add(t); t.position.set(lx, ly, dl > 0.1 && dl < 0.36 ? 0.06 : 0.022);   // sobre el aro del bocín queda montado
      t.rotation.set(Math.PI / 2 + (Math.random() - .5) * .3, 0, (Math.random() - .5) * .3);
      t.userData.d = Math.hypot(lx, ly); tejos.push(t);
      const wp = V(0, 0, 0); t.getWorldPosition(wp);
      polvo.explotar(wp, nrm.clone().multiplyScalar(.8), .2, 1.1, .6);
      if (!opt.demo) { OJ.snd.greda(); OJ.vib(25); }
      if (tipo === 'mecha') { explotar(mechas[mi], false); sumar(eq, 3); if (!opt.demo) OJ.gran('¡Mecha!', '+3 puntos', '#ffd34d'); }
      else if (tipo === 'embocinada') { bocV = 1; shake = 0.05; zoom = 1; sumar(eq, 6); if (!opt.demo) { OJ.snd.metal(); OJ.snd.punto(); OJ.vib(80); OJ.gran('¡Embocinada!', '+6 puntos', '#9fe1ff'); } }
      else if (tipo === 'monona') { explotar(mechas[mi], true); bocV = 1; sumar(eq, 9); if (!opt.demo) { OJ.snd.metal(); OJ.gran('¡Moñona!', '+9 puntos', '#ff8a5a', 2100); } }
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
      aroMano.position.set(m.position.x, m.position.y, 0.05); manoV = 1;
      sumar(eq, 1); st.puntuo = false; st.turno = eq; pintar();
      if (!opt.demo) { OJ.snd.punto(); OJ.gran('Mano', '+1 para ' + nombres[eq] + ': quedó más cerca del bocín', EQ[eq].c === '#d7263d' ? '#ff8e9a' : '#9cc4ff', 1900); }
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
      down(x, y) { if (st.fase !== 'apunta' || esIA(st.turno) || st.fin) return; st.arr = true; st.sx = x; st.sy = y; st.pot = 0; st.aim = 0; },
      move(x, y) {
        if (!st.arr) return;
        st.pot = clamp((y - st.sy) / (OJ.H * 0.27), 0, 1); st.aim = clamp(-(x - st.sx) / (OJ.W * 0.42), -1, 1);
      },
      up() {
        if (!st.arr) return; st.arr = false;
        if (st.pot < 0.08) { st.pot = 0; guia.forEach(m => { m.visible = false; }); aroCae.material.opacity = 0; if (hud) R.bar.style.width = '0%'; return; }
        const v = valores(), e = 0.004 * ((opt.modo === 'ia' ? opt.dif : 1) + 1); lanzar(v.phi + OJ.gauss() * e, v.s + OJ.gauss() * e * 8);
      }
    };
    /* Para pruebas automáticas: lanza hacia un punto de la greda */
    game.probar = (lx, ly) => { const a = apuntarA(lx, ly); lanzar(a.phi, a.s); };

    /* ---------------- bucle ---------------- */
    const look = V(0, 1.02, 0); let camT = 0;
    game.resize = (w, h) => { cam.fov = clamp(2 * Math.atan(2.75 / (2 * CAM_Z * (w / h))) * 180 / Math.PI, 24, 46); };
    game.update = function (dt) {
      st.tt += dt; camT += dt;
      if (st.fase === 'apunta') {
        if (esIA(st.turno)) { st.iaT -= dt; if (st.iaT <= 0) lanzarIA(); }
        if (enMano) {
          enMano.position.set(P0.x - st.aim * 0.05, P0.y + Math.sin(st.tt * 2) * 0.012, P0.z + st.pot * 0.3);
          enMano.rotation.set(0.5 + st.pot * 0.5, st.tt * 0.8, 0);
        }
        if (st.arr) {
          const v = valores(), tr = tray(v.phi, v.s), n = tr.pts.length / 3, frac = opt.modo === 'ia' ? GUIA[opt.dif] : GUIA[1];
          for (let i = 0; i < NG; i++) {
            const k = Math.floor((i + 1) / NG * (n - 1) * frac), m = guia[i];
            m.visible = true; m.position.set(tr.pts[k * 3], tr.pts[k * 3 + 1], tr.pts[k * 3 + 2]); m.material.opacity = 0.85 * (1 - i / NG * 0.6); m.scale.setScalar(0.5 + 0.8 * i / NG);
          }
          if (frac >= 1 && tr.fin.tipo === 'greda') { aroCae.position.set(tr.fin.lx, tr.fin.ly, 0.045); aroCae.material.opacity = 0.9; } else aroCae.material.opacity = 0;
          if (hud) R.bar.style.width = Math.round(v.pot * 100) + '%';
        }
      } else if (st.fase === 'vuelo') {
        const n = st.vuelo.pts.length / 3;
        st.vi += dt / DTV;
        const i = Math.min(Math.floor(st.vi), n - 1), p = st.vuelo.pts;
        enMano.position.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); enMano.rotation.x -= dt * 11; enMano.rotation.z = 0.25;
        hist.unshift(enMano.position.clone()); if (hist.length > 12) hist.pop();
        estela.forEach((m, k) => { if (hist[k]) { m.visible = true; m.position.copy(hist[k]); } });
        if (st.vi >= n - 1) aterrizar();
      } else if (st.fase === 'cae') {
        const c = st.cae;
        if (c) {
          c.v.y -= G * dt; c.t.position.addScaledVector(c.v, dt); c.t.rotation.x += dt * 7; c.t.rotation.z += dt * 3;
          if (c.t.position.y < 0.035) { c.t.position.y = 0.035; c.v.set(c.v.x * .5, Math.abs(c.v.y) * .25, c.v.z * .5); if (c.v.length() < .4) { c.t.rotation.set(0, 0, 0); c.v.set(0, 0, 0); } }
        }
        st.t -= dt; if (st.t <= 0) { if (c) { scene.remove(c.t); st.cae = null; } const f = st.fn; st.fn = null; f(); }
      } else if (st.fase === 'espera') {
        st.t -= dt; if (st.t <= 0) { const f = st.fn; st.fn = null; f(); }
      }
      // efectos
      chispas.update(dt); nucleo.update(dt); polvo.update(dt);
      if (humoV > 0) { humoV -= dt / 2.2; humo.forEach(s => { s.position.addScaledVector(s.userData.v, dt); s.scale.multiplyScalar(1 + dt * 1.2); s.material.opacity = 0.42 * Math.max(humoV, 0); }); }
      if (fuegoV > 0) { fuegoV -= dt / 0.45; const k = Math.max(fuegoV, 0); fuego[0].material.opacity = .7 * k; fuego[1].material.opacity = .85 * k; fuego[2].material.opacity = k; fuego.forEach((s, i) => s.scale.setScalar([1.1, .55, .2][i] * (1.6 - k * .6))); }
      if (manoV > 0) { manoV -= dt / 2.2; aroMano.material.opacity = Math.max(0, manoV) * (0.6 + 0.4 * Math.sin(st.tt * 14)); aroMano.scale.setScalar(1 + (1 - manoV) * .5); } else aroMano.material.opacity = 0;
      if (bocV > 0) { bocV -= dt / 0.9; aroBoc.scale.setScalar(1 + (1 - bocV) * 2.6); aroBoc.material.opacity = .9 * Math.max(bocV, 0); }
      boomI *= Math.pow(0.02, dt); boom.intensity = boomI; shake *= Math.pow(0.008, dt); zoom *= Math.pow(0.25, dt);
      const sway = opt.demo ? Math.sin(camT * 0.25) * 1.5 : 0;
      cam.position.set(sway + (Math.random() - .5) * shake, 1.75 + (opt.demo ? 0.35 : 0) + (Math.random() - .5) * shake, CAM_Z - zoom * 0.7 - (opt.demo ? 0.4 : 0));
      cam.lookAt(look);
    };
    game.dispose = function () { if (hud) hud.remove(); if (OJ.input === game.input) OJ.input = null; OJ.liberar(scene); };
    game.reiniciar = () => OJ.app.jugar('tejo', opt);

    if (!opt.demo) OJ.input = game.input;
    nuevaRonda();
    return game;
  };
  OJ.Tejo.tray = tray; OJ.Tejo.apuntarA = apuntarA;
})();
