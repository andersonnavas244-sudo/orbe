/*
 * Orbe Juegos — motor común: render 3D (three.js), texturas hechas por código, sonido sintetizado,
 * partículas, entrada táctil y utilidades de interfaz. Todo funciona sin internet.
 */
(function () {
  'use strict';
  const OJ = window.OJ = {};
  const Q = OJ.Q = new URLSearchParams(location.search);
  OJ.N = window.AndroidJuegos || null;

  /* ---------- guardado en el teléfono ---------- */
  OJ.store = {
    get(k, d) { try { const v = localStorage.getItem('juegos.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('juegos.' + k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } }
  };
  OJ.cfg = Object.assign({ sonido: true, vibrar: true }, OJ.store.get('cfg', {}));
  OJ.guardarCfg = () => OJ.store.set('cfg', OJ.cfg);

  /* ---------- azar con semilla (las texturas salen siempre iguales) ---------- */
  let seed = 11;
  const rnd = OJ.rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  OJ.semilla = s => { seed = s; };
  OJ.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  OJ.gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };

  /* ---------- ayudas de three.js ---------- */
  OJ.V = (x, y, z) => new THREE.Vector3(x, y, z);
  OJ.std = o => new THREE.MeshStandardMaterial(o);
  OJ.tex = function (w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = OJ.aniso || 4;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };
  OJ.planks = (a, b, line, n) => (g, w, h) => {
    const ph = h / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * ph, w, ph); g.fillStyle = line; g.fillRect(0, i * ph + ph - 2, w, 2); }
    for (let k = 0; k < 700; k++) { g.fillStyle = 'rgba(30,15,5,' + (rnd() * .16).toFixed(3) + ')'; g.fillRect(rnd() * w, rnd() * h, rnd() * 90 + 10, 1 + rnd()); }
  };
  OJ.noise = (base, spots, n, rmax) => (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let k = 0; k < n; k++) { g.fillStyle = spots[k % spots.length]; g.beginPath(); g.arc(rnd() * w, rnd() * h, rnd() * rmax + .4, 0, 6.3); g.fill(); }
  };
  OJ.signTex = (text, bg, border, fg, font) => OJ.tex(1024, 240, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = border; g.lineWidth = 12; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = fg; let px = parseInt(font.match(/(\d+)px/)[1], 10); g.font = font;
    while (g.measureText(text).width > w - 110 && px > 40) { px -= 4; g.font = font.replace(/\d+px/, px + 'px'); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 6);
  });
  OJ.dotTex = OJ.tex(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  OJ.dotTex._fija = true;
  OJ.mesh = function (parent, geo, mat, pos, shadow) {
    const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    parent.add(m); return m;
  };
  OJ.sprite = function (parent, color, pos, scale, opacity, additive) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: OJ.dotTex, color, transparent: true, opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.position.copy(pos); s.scale.setScalar(scale); parent.add(s); return s;
  };
  /* Guirnalda de bombillos y banderines con los colores de Colombia */
  OJ.guirnalda = function (scene, y, x0, x1, z, sag) {
    const cols = [0xffd34d, 0xff5a5a, 0x5ad1ff, 0x7dff7a, 0xff9a3c], flagCols = [0xfcd116, 0xfcd116, 0x003893, 0xce1126], wire = [];
    const tri = new THREE.Shape(); tri.moveTo(-0.11, 0); tri.lineTo(0.11, 0); tri.lineTo(0, -0.24); tri.lineTo(-0.11, 0);
    const triG = new THREE.ShapeGeometry(tri), bG = new THREE.SphereGeometry(0.06, 10, 10), n = 22;
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + (x1 - x0) * u, yy = y - sag * 4 * u * (1 - u);
      wire.push(OJ.V(x, yy, z));
      if (i % 2 === 0) {
        const c = cols[(i / 2) % 5];
        const b = OJ.mesh(scene, bG, new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), OJ.V(x, yy - 0.09, z), false);
        OJ.sprite(scene, c, b.position, 0.42, 0.45, true);
      } else {
        const f = OJ.mesh(scene, triG, OJ.std({ color: flagCols[i % 4], side: THREE.DoubleSide, roughness: .8 }), OJ.V(x, yy, z + 0.01), false);
        f.rotation.z = (rnd() - .5) * .15;
      }
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
  };

  /*
   * Reflejos realistas: arma un "estudio" (cielo en degradado + paneles de luz) y lo convierte en mapa de entorno.
   * Todos los materiales estándar de la escena lo reflejan (bolas, fichas, metal, barniz).
   *   OJ.entorno(scene, '#arriba', '#abajo', [{ p: [x, y, z], w, h, c: 0xffffff, f: 4 }, ...])   f = fuerza de la luz
   */
  OJ.entorno = function (scene, arriba, abajo, luces) {
    const s = new THREE.Scene();
    const fondo = OJ.tex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, arriba); gr.addColorStop(1, abajo); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: fondo })));
    (luces || []).forEach(l => {
      const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); m.color.set(l.c || 0xffffff).multiplyScalar(l.f || 3);
      const q = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.h), m); q.position.set(l.p[0], l.p[1], l.p[2]); q.lookAt(0, 0, 0); s.add(q);
    });
    const pm = new THREE.PMREMGenerator(OJ.R), rt = pm.fromScene(s, 0.03);
    scene.environment = rt.texture; scene.userData.envRT = rt; pm.dispose(); OJ.liberar(s);
  };
  /* Caja con bordes redondeados (fichas de dominó, dados). Conserva las 6 caras para usar un material por cara. */
  OJ.cajaRedonda = function (w, h, d, radio, seg) {
    const g = new THREE.BoxGeometry(w, h, d, seg || 5, seg || 5, seg || 5), pos = g.attributes.position, nor = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3();
    const hx = w / 2 - radio, hy = h / 2 - radio, hz = d / 2 - radio;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
      v.sub(c); if (v.lengthSq() < 1e-12) v.fromBufferAttribute(nor, i); v.normalize();
      nor.setXYZ(i, v.x, v.y, v.z); pos.setXYZ(i, c.x + v.x * radio, c.y + v.y * radio, c.z + v.z * radio);
    }
    return g;
  };

  /* ---------- partículas (chispas) ---------- */
  OJ.Chispas = function (scene, n, color, size) {
    this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.vida = 0; this.dur = 1;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color, size, map: OJ.dotTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
  };
  OJ.Chispas.prototype.explotar = function (p, bias, vmin, vmax, dur) {
    for (let i = 0; i < this.n; i++) {
      let x = Math.random() - .5, y = Math.random() - .5, z = Math.random() - .5; const l = Math.hypot(x, y, z) || 1, s = (vmin + Math.random() * (vmax - vmin)) / l;
      this.vel[i * 3] = x * s + bias.x; this.vel[i * 3 + 1] = y * s + bias.y; this.vel[i * 3 + 2] = z * s + bias.z;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    }
    this.vida = 1; this.dur = dur || 1.1;
  };
  OJ.Chispas.prototype.update = function (dt) {
    if (this.vida <= 0) return;
    this.vida -= dt / this.dur;
    for (let i = 0; i < this.n; i++) {
      this.vel[i * 3 + 1] -= 5.5 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = Math.max(0, this.vida);
  };

  /* ---------- render y bucle ---------- */
  const cv = document.getElementById('c');
  const R = OJ.R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('captura') });
  /* Nitidez alta sin ahogar al celular: hasta 2x y como máximo ~2,1 millones de píxeles por cuadro (una pantalla 1080p) */
  const tope = Math.sqrt(2.1e6 / Math.max(1, window.innerWidth * window.innerHeight));
  let pr = Math.max(1, Math.min(window.devicePixelRatio || 1, +Q.get('dpr') || Math.min(OJ.store.get('pr4', 2), tope)));
  OJ.aniso = Math.min(16, R.capabilities.getMaxAnisotropy());
  R.setPixelRatio(pr);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap;
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping;
  let cur = null, last = 0;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight; OJ.W = w; OJ.H = h; R.setSize(w, h, false);
    if (cur) { cur.cam.aspect = w / h; if (cur.resize) cur.resize(w, h); cur.cam.updateProjectionMatrix(); }
  }
  window.addEventListener('resize', resize);
  OJ.liberar = function (scene) {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { if (m.map && !m.map._fija) m.map.dispose(); m.dispose(); });
    });
    if (scene.background && scene.background.isTexture) scene.background.dispose();
    if (scene.userData.envRT) { scene.userData.envRT.dispose(); scene.userData.envRT = null; scene.environment = null; }
  };
  OJ.setGame = function (g) {
    if (cur && cur.dispose) cur.dispose();
    cur = g; OJ.juego = g;
    if (g) { R.toneMappingExposure = g.exposure || 1; g.scene.traverse(o => { if (o.isLight && o.castShadow && o.shadow.radius < 1.8) o.shadow.radius = 1.8; }); resize(); }
  };
  /* Calidad automática: si el celular va lento, baja la resolución (y luego las sombras) para que no se trabe */
  let lento = 0;
  function medir(real) {
    if (real > 0.5 || Q.has('dpr')) return;
    if (real > 0.026) lento += real; else lento = Math.max(0, lento - real * 0.5);      // por debajo de ~38 cuadros por segundo
    if (lento < 1.4) return;
    lento = 0;
    if (pr > 1) { pr = Math.max(1, pr - 0.25); R.setPixelRatio(pr); OJ.store.set('pr4', pr); resize(); }
    else if (R.shadowMap.enabled) { R.shadowMap.enabled = false; if (cur) cur.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  }
  /* Las sombras se recalculan un cuadro sí y otro no: casi no se nota y ahorra mucho en el celular */
  R.shadowMap.autoUpdate = false; let cuadro = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const real = (t - last) / 1000, dt = Math.min(real, 0.05); last = t;
    if (cur && !OJ.pausado) { cur.update(dt); R.shadowMap.needsUpdate = (cuadro++ & 1) === 0; R.render(cur.scene, cur.cam); medir(real); }
  }
  /* Para pruebas: adelanta el juego sin esperar al reloj */
  OJ.avanzar = function (seg) { const n = Math.round(seg * 60); for (let i = 0; i < n && cur; i++) cur.update(1 / 60); if (cur) { R.shadowMap.needsUpdate = true; R.render(cur.scene, cur.cam); } };
  OJ.iniciar = function () { resize(); requestAnimationFrame(frame); };

  /* ---------- entrada táctil sobre el lienzo ---------- */
  OJ.input = null;
  let ptr = null;
  cv.addEventListener('pointerdown', e => { if (ptr != null || !OJ.input) return; ptr = e.pointerId; try { cv.setPointerCapture(ptr); } catch (x) { /* */ } OJ.audio(); if (OJ.input.down) OJ.input.down(e.clientX, e.clientY); });
  cv.addEventListener('pointermove', e => { if (e.pointerId === ptr && OJ.input && OJ.input.move) OJ.input.move(e.clientX, e.clientY); });
  const fin = e => { if (e.pointerId !== ptr) return; ptr = null; if (OJ.input && OJ.input.up) OJ.input.up(e.clientX, e.clientY); };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);

  /* ---------- sonido sintetizado (Web Audio) ---------- */
  let ac = null, master = null, ruidoBuf = null;
  OJ.audio = function () {
    if (!OJ.cfg.sonido || OJ.mudo) return null;
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
        ruidoBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
        const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return null; }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tono(f0, f1, dur, vol, type, t0) {
    const a = OJ.audio(); if (!a) return;
    const t = a.currentTime + (t0 || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function ruido(dur, vol, fq, q, type, f1, t0) {
    const a = OJ.audio(); if (!a) return;
    const t = a.currentTime + (t0 || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = ruidoBuf; s.loop = true; f.type = type || 'lowpass'; f.frequency.setValueAtTime(fq, t); f.Q.value = q || 1;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  OJ.snd = {
    toque() { tono(620, 900, .07, .12, 'sine'); },
    bola(v) { const k = OJ.clamp(v / 3, .08, 1); tono(2600, 1700, .03, .3 * k, 'triangle'); ruido(.035, .3 * k, 3800, 1.5, 'bandpass'); },
    banda(v) { const k = OJ.clamp(v / 3, .1, 1); tono(170, 80, .1, .32 * k, 'sine'); ruido(.06, .14 * k, 600, 1, 'lowpass'); },
    taco(v) { const k = OJ.clamp(v, .25, 1); tono(1000, 380, .05, .32 * k, 'triangle'); ruido(.04, .3 * k, 2000, 1, 'bandpass'); },
    silbido() { ruido(.75, .07, 500, 2.5, 'bandpass', 2200); },
    greda() { ruido(.2, .55, 420, .8, 'lowpass', 120); tono(130, 48, .2, .55, 'sine'); },
    tabla() { tono(330, 150, .12, .4, 'square'); ruido(.08, .3, 1200, 1, 'bandpass'); },
    metal() { tono(2100, 2050, .5, .16, 'sine'); tono(3150, 3100, .35, .1, 'sine'); tono(1380, 1350, .4, .1, 'sine'); },
    mecha() {
      ruido(.55, 1, 2400, .7, 'lowpass', 160); tono(170, 32, .55, .9, 'sine'); tono(90, 30, .4, .6, 'square');
      for (let i = 0; i < 9; i++) ruido(.03, .25, 3000 + Math.random() * 3000, 2, 'bandpass', 0, .12 + Math.random() * .5);
    },
    punto() { [523, 659, 784, 1047].forEach((f, i) => tono(f, f, .16, .2, 'triangle', i * .08)); },
    gana() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tono(f, f, .2, .22, 'triangle', i * .11)); ruido(1.6, .12, 2500, .5, 'bandpass', 3500, .2); },
    pierde() { [392, 349, 311, 262].forEach((f, i) => tono(f, f * .97, .26, .18, 'sine', i * .16)); },
    falla() { tono(260, 180, .2, .14, 'sine'); },
    tronera() { tono(150, 60, .22, .5, 'sine'); ruido(.12, .25, 700, 1, 'lowpass'); },
    dado() { for (let i = 0; i < 5; i++) ruido(.03, .22, 2500 + Math.random() * 1500, 2, 'bandpass', 0, i * .07 + Math.random() * .02); },
    ficha() { tono(520, 300, .07, .25, 'triangle'); ruido(.03, .2, 1800, 1, 'bandpass'); },
    come() { tono(300, 90, .25, .4, 'sawtooth'); ruido(.2, .3, 900, 1, 'lowpass'); }
  };
  OJ.vib = function (ms) {
    if (!OJ.cfg.vibrar) return;
    try { if (OJ.N && OJ.N.vibrate) OJ.N.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* */ }
  };

  /* ---------- interfaz ---------- */
  OJ.ui = document.getElementById('ui');
  OJ.el = function (tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const toastEl = document.getElementById('toast'); let toastT = 0;
  OJ.toast = function (msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2600); };
  window.orbeToast = OJ.toast;
  const granEl = document.getElementById('gran'); let granT = 0;
  OJ.gran = function (titulo, sub, color, ms) {
    granEl.innerHTML = '<div class="gran-t" style="color:' + (color || '#ffd34d') + '">' + titulo + '</div>' + (sub ? '<div class="gran-s">' + sub + '</div>' : '');
    granEl.classList.remove('on'); void granEl.offsetWidth; granEl.classList.add('on');
    clearTimeout(granT); granT = setTimeout(() => granEl.classList.remove('on'), ms || 1700);
  };
  OJ.granFuera = function () { clearTimeout(granT); granEl.classList.remove('on'); };
  const destEl = document.getElementById('destello');
  OJ.destello = function (color, fuerza) {
    destEl.style.transition = 'none'; destEl.style.background = color; destEl.style.opacity = fuerza;
    void destEl.offsetWidth; destEl.style.transition = 'opacity .5s ease-out'; destEl.style.opacity = 0;
  };
})();
