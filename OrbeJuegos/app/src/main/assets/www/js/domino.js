/*
 * Dominó — reglas, turnos, máquina rival e interfaz. Lo visual (mesa y fichas) está en domino3d.js.
 * Doble seis, como se juega en Colombia. Modos:
 *  · 1 contra 1: 7 fichas cada uno y el resto al pozo; si no tienes jugada robas hasta poder (o hasta acabar el pozo) y luego pasas.
 *  · Todos contra todos (4): 7 fichas cada uno, sin pozo; quien no puede, pasa.
 *  · Parejas 2 contra 2: tú y el de enfrente contra los de los lados; sin pozo.
 *  · En la primera mano sale quien tenga el doble más alto (con ese doble); después sale quien ganó la mano anterior.
 *  · La mano termina cuando alguien se queda sin fichas (dominó) o nadie puede jugar (tranca: gana quien —o la pareja que— sume menos).
 *  · El ganador suma los puntos de las fichas que les quedaron a los rivales. La partida es a 50 o 100 puntos.
 * Asientos (los pone domino3d.js): 0 abajo (tú); con 2 jugadores el 1 arriba; con 4: 1 derecha, 2 enfrente, 3 izquierda.
 */
(function () {
  'use strict';
  const RELOJ = 20;
  const pips = f => f[0] + f[1], suma = l => l.reduce((s, f) => s + pips(f), 0);
  const cabe = (f, x) => f[0] === x || f[1] === x, otro = (f, x) => (f[0] === x ? f[1] : f[0]);
  const MODOS = { '1v1': '1 contra 1', todos: 'Todos contra todos', parejas: 'Parejas' };

  OJ.Domino = function (opt) {
    opt = Object.assign({ modo: '1v1', dif: 1, meta: 100 }, opt);
    if (!MODOS[opt.modo]) opt.modo = opt.n === 4 ? 'todos' : '1v1';
    const n = opt.modo === '1v1' ? 2 : 4, parejas = opt.modo === 'parejas';
    const v = OJ.Domino3D({ jugadores: n });
    const game = { scene: v.scene, cam: v.cam, exposure: v.exposure, nombre: 'domino', vista: v, resize: v.resize };
    const esIA = j => !!opt.demo || j !== 0;
    /* personajes: avatares ilustrados con emoji, nada de fotos */
    const GENTE = n === 2 ? [['Tú', '😀', '#ffc93c'], ['Pacho', '👨', '#7fc8ff']]
      : [['Tú', '😀', '#ffc93c'], ['Rosa', '👵', '#ff8fb1'], ['Pacho', '👨', '#7fc8ff'], ['Lucho', '🧔', '#8ee07a']];
    if (opt.demo) GENTE[0] = ['Ana', '👩', '#ffc93c'];
    const nombre = j => GENTE[j][0];
    const lado = j => (parejas ? j % 2 : j);                // a quién se le anotan los puntos
    const NL = parejas ? 2 : n, nomLado = k => (parejas ? (k ? 'Ellos' : 'Nosotros') : nombre(k));
    const manos = [], st = { fin: false, turno: 0, fase: 'espera', t: 0, fn: null, pts: new Array(NL).fill(0), pases: 0, manoN: 0, salidor: -1, obligada: null, sel: -1, jug: [], reloj: RELOJ, dice: null };
    let pozo = [];
    game.st = st; game.manos = manos;

    /* ---------------- interfaz ---------------- */
    const X = n === 2 ? [null, 50] : [null, 80, 50, 20];
    const hud = OJ.el('div', 'hud dm-hud', `
      <div class="dm-barra"><button class="ic" data-a="pausa" aria-label="Menú">☰</button><div class="dm-info" data-r="info"></div></div>
      ${GENTE.map((g, j) => j ? `<div class="dm-av${parejas && j === 2 ? ' pareja' : ''}${X[j] > 60 ? ' der' : ''}" data-j="${j}" style="left:${X[j]}%">${OJ.avatar(g[1], g[2])}<div class="dm-id"><span class="dm-nom">${g[0]}${parejas && j === 2 ? ' 🤝' : ''}</span><span class="dm-cnt" data-f="${j}"></span></div></div>` : '').join('')}
      <div class="dm-panel${n === 2 ? ' arriba' : ''}">${Array.from({ length: NL }, (_, k) => `<div data-k="${k}"><span>${nomLado(k)}</span><b data-p="${k}">0/${opt.meta}</b></div>`).join('')}${n === 2 ? '<div class="dm-pozo"><span>Pozo</span><b data-r="pozo">14</b></div>' : ''}</div>
      <div class="dm-yo" data-j="0">${OJ.avatar(GENTE[0][1], GENTE[0][2], 'chico')}</div>
      <div class="dm-tu oculto" data-r="tu"><div class="dm-tu-t" data-r="tuT">¡Tu turno!</div><div class="dm-tu-s" data-r="tuS"></div>
        <button class="btn" data-a="robar">Robar</button><button class="btn" data-a="pasar">Pasar</button><i class="reloj" data-r="reloj"></i></div>
      <div class="dm-ab" data-r="ab"></div>`);
    OJ.ui.appendChild(hud);
    const R = {}; hud.querySelectorAll('[data-r]').forEach(e => { R[e.dataset.r] = e; });
    const robarB = hud.querySelector('[data-a="robar"]'), pasarB = hud.querySelector('[data-a="pasar"]');
    const avEl = j => hud.querySelector('[data-j="' + j + '"]');
    hud.querySelector('[data-a="pausa"]').onclick = () => OJ.app.pausa(game);
    robarB.onclick = () => { if (st.fase === 'robar' && !st.fin) { OJ.audio(); robarUna(0, () => turno(0)); } };
    pasarB.onclick = () => { if (st.fase === 'pasar' && !st.fin) { OJ.audio(); pasar(0); } };
    const charla = OJ.charla('fila', t => { OJ.globo(avEl(0), t); const k = 1 + Math.floor(Math.random() * (n - 1)), d = OJ.dicho('saludo', 0.45); if (d && !opt.demo) st.dice = { j: k, t: d, en: 0.9 + Math.random() }; });
    R.ab.appendChild(charla);
    function hablar(j, tipo, prob) { if (!esIA(j) || opt.demo || j === 0) return; const d = OJ.dicho(tipo, prob); if (d) OJ.globo(avEl(j), d); }
    let tuto = null;
    if (!opt.demo && !OJ.store.get('domino.ayuda2', 0)) {
      tuto = OJ.el('div', 'velo centro', `<div class="sheet"><h2>Cómo se juega</h2><div class="reglas">
        · Toca una de tus fichas <b>levantadas</b> para ponerla. Si cabe en las dos puntas, toca el <b>aro amarillo</b> de la punta que quieras.<br>
        · Si no tienes jugada ${n === 2 ? '<b>roba</b> del pozo; si se acaba, <b>pasa</b>' : '<b>pasa</b>'}. Tienes ${RELOJ} segundos por turno.<br>
        · Gana la mano quien ponga todas sus fichas (<b>¡dominó!</b>) o, si se tranca, quien sume menos.${parejas ? ' Juegas en <b>pareja con Pacho</b>, el de enfrente.' : ''}<br>
        · El ganador se lleva los puntos de las fichas de los rivales. Gana quien llegue a ${opt.meta}.</div>
        <button class="btn" data-x="ok">¡A jugar!</button></div>`);
      hud.appendChild(tuto);
      tuto.querySelector('[data-x="ok"]').onclick = () => { OJ.store.set('domino.ayuda2', 1); tuto.remove(); tuto = null; OJ.snd.toque(); };
    }
    const humano = () => !st.fin && st.turno === 0 && !esIA(0) && (st.fase === 'elegir' || st.fase === 'lado' || st.fase === 'robar' || st.fase === 'pasar');
    function pintar() {
      R.info.innerHTML = `<b>Ronda ${Math.max(1, st.manoN)}</b> · ${MODOS[opt.modo]} · a ${opt.meta}`;
      for (let j = 1; j < n; j++) {
        const a = avEl(j), c = manos[j] ? manos[j].length : 7; a.classList.toggle('on', st.turno === j && !st.fin && st.fase !== 'finMano');
        hud.querySelector('[data-f="' + j + '"]').textContent = c === 1 ? '¡1 ficha!' : c + ' fichas'; a.classList.toggle('una', c === 1);
      }
      avEl(0).classList.toggle('on', st.turno === 0 && !st.fin && st.fase !== 'finMano');
      for (let k = 0; k < NL; k++) { hud.querySelector('[data-p="' + k + '"]').textContent = st.pts[k] + '/' + opt.meta; hud.querySelector('[data-k="' + k + '"]').classList.toggle('yo', lado(0) === k && !opt.demo); }
      if (R.pozo) R.pozo.textContent = pozo.length;
      const yo = humano();
      R.tu.classList.toggle('oculto', !yo);
      if (yo) {
        R.tuT.textContent = st.fase === 'robar' ? 'No tienes jugada' : st.fase === 'pasar' ? 'No tienes jugada' : '¡Tu turno!';
        R.tuS.textContent = st.fase === 'elegir' ? (v.extremos() ? 'Toca una ficha levantada' : st.obligada ? 'Sales con el doble ' + st.obligada[0] : 'Sales tú: pon la que quieras')
          : st.fase === 'lado' ? 'Toca el aro amarillo de la punta' : st.fase === 'robar' ? 'Roba del pozo' : 'Pasa el turno';
        robarB.classList.toggle('oculto', st.fase !== 'robar'); pasarB.classList.toggle('oculto', st.fase !== 'pasar');
      }
    }
    const aviso = (t, s, c, ms) => { if (!opt.demo || game.avisos) OJ.gran(t, s, c || '#ffd34d', ms || 1300); if (game.log) game.log.push(t + (s ? ' · ' + s : '')); };
    function verManos(jug, boca) { v.mano(manos[0], jug || []); if (boca) v.rivales(manos.slice(1).map(m => m.length), manos.slice(1)); else v.rivales(manos.slice(1).map(m => m.length)); v.pozo(pozo.length); }
    const vis = (k, ...a) => { if (typeof v[k] === 'function') v[k](...a); };      // métodos opcionales de la vista

    /* ---------------- reglas ---------------- */
    function jugables(j) {
      const e = v.extremos(), l = [];
      manos[j].forEach((f, i) => {
        if (!e) { if (!st.obligada || (f[0] === st.obligada[0] && f[1] === st.obligada[1])) l.push(i); }
        else if (cabe(f, e.izq) || cabe(f, e.der)) l.push(i);
      });
      return l;
    }
    function lados(f) { const e = v.extremos(); if (!e) return ['der']; const l = []; if (cabe(f, e.izq)) l.push('izq'); if (cabe(f, e.der)) l.push('der'); return l; }
    function elegirIA(j, jug, dif) {
      const e = v.extremos(), ops = [];
      jug.forEach(i => lados(manos[j][i]).forEach(l => ops.push({ i, l })));
      if (Math.random() < [0.6, 0.18, 0.05][dif]) return ops[Math.floor(Math.random() * ops.length)];      // a veces juega por instinto
      let mejor = ops[0], ms = -1e9;
      ops.forEach(o => {
        const f = manos[j][o.i], doble = f[0] === f[1]; let sc = pips(f) + (doble ? 5 : 0);
        if (dif === 2) {
          // cuida no trancarse: que le queden fichas para las puntas nuevas
          const ext = e ? { izq: e.izq, der: e.der } : { izq: f[0], der: f[1] };
          if (e) ext[o.l] = otro(f, e[o.l]);
          const resto = manos[j].filter((_, k) => k !== o.i);
          sc += resto.filter(x => cabe(x, ext.izq) || cabe(x, ext.der)).length * 3 + (doble ? 1 : 0);
          if (ext.izq === ext.der && resto.some(x => cabe(x, ext.izq))) sc += 2;
          if (parejas) {      // en parejas: no le cierra el juego al compañero si a este le quedan pocas
            const comp = manos[(j + 2) % 4]; if (comp && comp.length <= 2 && !comp.some(x => cabe(x, ext.izq) || cabe(x, ext.der))) sc -= 4;
          }
        }
        sc += Math.random() * [4, 3, 1.5][dif];
        if (sc > ms) { ms = sc; mejor = o; }
      });
      return mejor;
    }

    /* ---------------- flujo (todas las esperas van por update) ---------------- */
    function espera(seg, fn) { st.fase = 'espera'; st.t = seg; st.fn = fn; }
    function nuevaMano(salidor) {
      st.manoN++; st.pases = 0; st.obligada = null; st.sel = -1;
      const todas = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) todas.push([a, b]);
      for (let i = todas.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); const t = todas[i]; todas[i] = todas[k]; todas[k] = t; }
      if (game.repartir) game.repartir(todas);          // para pruebas
      manos.length = 0; for (let j = 0; j < n; j++) manos.push(todas.splice(0, 7).sort((x, y) => pips(x) - pips(y)));
      pozo = n === 2 ? todas : [];
      v.reiniciar(); verManos([]);
      if (salidor < 0) {      // primera mano: el doble más alto (si nadie tiene dobles, la ficha más alta)
        let mj = 0, mf = null, mv = -1;
        manos.forEach((m, j) => m.forEach(f => { const val = f[0] === f[1] ? 100 + f[0] : pips(f) + f[1] / 10; if (val > mv) { mv = val; mj = j; mf = f; } }));
        salidor = mj; st.obligada = mf;
        aviso('Ronda ' + st.manoN, 'Sale ' + nombre(mj) + ' con el ' + (mf[0] === mf[1] ? 'doble ' + mf[0] : mf[0] + '-' + mf[1]), '#ffffff', 1600);
      } else aviso('Ronda ' + st.manoN, 'Sale ' + nombre(salidor), '#ffffff', 1300);
      st.salidor = salidor; st.turno = salidor; pintar();
      espera(1.4, () => turno(salidor));
    }
    function turno(j) {
      if (st.fin) return;
      st.turno = j; st.sel = -1; v.marcarExtremos(false); vis('turno', j);
      const jug = jugables(j); st.jug = jug; st.reloj = RELOJ;
      if (!jug.length) {
        if (j === 0 && !esIA(0)) verManos([]);
        if (pozo.length) { if (esIA(j)) espera(0.45, () => robarUna(j, () => turno(j))); else { st.fase = 'robar'; pintar(); } }
        else if (esIA(j)) espera(0.7, () => pasar(j));
        else { st.fase = 'pasar'; pintar(); }
        return;
      }
      if (esIA(j)) { pintar(); espera(0.75 + Math.random() * 0.35, () => { const o = elegirIA(j, jugables(j), opt.dif); poner(j, o.i, o.l); }); return; }
      st.fase = 'elegir'; verManos(jug); pintar();
    }
    function robarUna(j, cb) {
      if (!pozo.length) return cb();
      st.fase = 'animando'; const f = pozo.pop(); v.pozo(pozo.length); pintar();
      v.robar(j, () => {
        manos[j].push(f); if (j === 0) manos[0].sort((x, y) => pips(x) - pips(y));
        verManos([]); pintar(); const r = st.reloj; espera(0.12, () => { cb(); if (j === 0) st.reloj = Math.max(r, 6); });
      });
    }
    function pasar(j) {
      st.pases++; OJ.snd.falla();
      aviso('Pasa', nombre(j) + ' no tiene jugada', '#ffffff', 900);
      if (j === 0 && !opt.demo) OJ.globo(avEl(0), '¡Paso!'); else hablar(j, 'paso', 0.55);
      if (st.pases >= n) return espera(1, tranca);
      espera(0.9, () => turno((j + 1) % n));
    }
    function poner(j, i, lado_) {
      const f = manos[j][i]; st.fase = 'animando'; st.sel = -1; st.obligada = null; v.marcarExtremos(false);
      manos[j].splice(i, 1); st.pases = 0;
      v.poner(f, lado_, j, () => {
        if (j !== 0 || esIA(0)) verManos([]); else v.rivales(manos.slice(1).map(m => m.length));
        pintar();
        if (!manos[j].length) return espera(0.4, () => finMano(j, 'domino'));
        if (manos[j].length === 1) { vis('ultima', j); aviso(j === 0 && !opt.demo ? '¡Te queda una!' : '¡A ' + nombre(j) + ' le queda una!', 'Cuidado con el dominó', '#ffe14d', 1300); OJ.snd.toque(); }
        else if (f[0] === f[1] && f[0] >= 5) hablar(j, 'bien', 0.3);
        else if (j === 0) hablar(1 + Math.floor(Math.random() * (n - 1)), 'bien', 0.1);
        if (bloqueada()) return espera(0.6, tranca);
        espera(0.25, () => turno((j + 1) % n));
      });
      if (j !== 0 || esIA(0)) v.rivales(manos.slice(1).map(m => m.length));
      pintar();
    }
    /* nadie puede jugar: las dos puntas piden un número que ya no tiene nadie y el pozo está vacío */
    function bloqueada() {
      if (pozo.length) return false;
      const e = v.extremos(); if (!e) return false;
      return manos.every(m => !m.some(f => cabe(f, e.izq) || cabe(f, e.der)));
    }
    function tranca() {
      const s = new Array(NL).fill(0); manos.forEach((m, j) => { s[lado(j)] += suma(m); });
      const min = Math.min(...s), quienes = s.map((x, k) => (x === min ? k : -1)).filter(k => k >= 0);
      if (quienes.length > 1) {
        vis('temblar', 1); vis('turno', -1); verManos([], true);
        aviso('¡Tranca!', 'Empate a ' + min + ' puntos: nadie suma', '#ffffff', 2000);
        st.fase = 'finMano'; pintar();
        return espera(2.6, () => nuevaMano(st.salidor));
      }
      // gana la mano el jugador del lado ganador con menos puntos en la mano
      const k = quienes[0]; let w = -1; manos.forEach((m, j) => { if (lado(j) === k && (w < 0 || suma(m) < suma(manos[w]))) w = j; });
      finMano(w, 'tranca');
    }
    function finMano(w, como) {
      st.fase = 'finMano'; verManos([], true); vis('turno', -1); if (como === 'tranca') vis('temblar', 1);
      const k = lado(w), gana = manos.reduce((acc, m, j) => acc + (lado(j) === k ? 0 : suma(m)), 0);
      st.pts[k] += gana; pintar();
      const quien = parejas ? (k === lado(0) && !opt.demo ? 'Ustedes suman ' : 'Ellos suman ') : nombre(w) + ' suma ';
      if (como === 'domino') { aviso('¡Dominó!', (parejas ? nombre(w) + ' cerró · ' : '') + quien + gana + ' puntos', '#3ee0b0', 2000); OJ.snd.punto(); }
      else { aviso('¡Tranca!', (parejas ? '' : nombre(w) + ' sumó menos · ') + quien + gana + ' puntos', '#ffe14d', 2200); OJ.snd.metal(); }
      hablar(w, 'gana', 0.6);
      if (k === lado(0) && !opt.demo) OJ.vib(60);
      if (st.pts[k] >= opt.meta) return espera(2.2, () => terminar(w));
      espera(2.8, () => nuevaMano(w));
    }
    function terminar(w) {
      st.fin = true; st.fase = 'fin'; pintar(); v.celebrar();
      for (let j = 1; j < n; j++) hablar(j, lado(j) === lado(w) ? 'gana' : 'fin', 0.7);
      if (opt.demo) return;
      const gano = lado(w) === lado(0);
      gano ? OJ.snd.gana() : OJ.snd.pierde();
      OJ.app.final({ juego: 'domino', gano, titulo: gano ? (parejas ? '¡Ganaron!' : '¡Ganaste!') : (parejas ? 'Ganaron Rosa y Lucho' : 'Ganó ' + nombre(w)),
        filas: st.pts.map((p, k) => ({ nombre: parejas ? (k ? 'Rosa y Lucho' : 'Tú y Pacho') : nombre(k), valor: p, color: parejas ? (k ? '#ff8fb1' : '#ffc93c') : GENTE[k][2], cara: parejas ? (k ? '👵' : '😀') : GENTE[k][1], gana: k === lado(w) })),
        resumen: (gano ? 'Gané' : 'Perdí') + ' una partida de dominó (' + MODOS[opt.modo] + ') a ' + opt.meta + ': ' + st.pts.join(' – '), opt });
    }
    /* se acabó el reloj: juega solo */
    function solo() {
      OJ.toast('Se acabó tu tiempo: jugó la máquina por ti');
      if (st.fase === 'robar') return robarB.onclick();
      if (st.fase === 'pasar') return pasar(0);
      const jug = jugables(0); if (jug.length) { const o = elegirIA(0, jug, 1); poner(0, o.i, o.l); }
    }

    /* ---------------- toques ---------------- */
    function tocarFicha(i) {
      if (st.jug.indexOf(i) < 0) { if (i >= 0) OJ.toast('Esa ficha no cabe en ninguna punta'); return; }
      const l = lados(manos[0][i]); OJ.snd.toque();
      if (l.length === 1) return poner(0, i, l[0]);
      st.sel = i; st.fase = 'lado'; v.marcarExtremos(true, manos[0][i]); pintar();
    }
    game.input = {
      down(x, y) {
        if (st.fin || tuto || esIA(st.turno) || st.turno !== 0) return;
        if (st.fase === 'lado') {
          const l = v.ladoEn(x, y); if (l) return poner(0, st.sel, l);
          const i = v.fichaManoEn(x, y);
          if (i >= 0 && i !== st.sel) { st.fase = 'elegir'; v.marcarExtremos(false); return tocarFicha(i); }
          if (i === st.sel) { st.fase = 'elegir'; st.sel = -1; v.marcarExtremos(false); pintar(); }
          return;
        }
        if (st.fase === 'elegir') { const i = v.fichaManoEn(x, y); if (i >= 0) tocarFicha(i); }
      }
    };
    /* para pruebas */
    game.tocarFicha = i => { if (st.fase === 'elegir' || st.fase === 'lado') { st.fase = 'elegir'; v.marcarExtremos(false); tocarFicha(i); } };
    game.tocarLado = l => { if (st.fase === 'lado') poner(0, st.sel, l); };
    game.robar = () => robarB.onclick();
    game.pasar = () => pasarB.onclick();
    game.quedanPozo = () => pozo.length;

    let rel = -1;
    game.update = function (dt) {
      v.update(dt);
      if (st.fase === 'espera' && !v.ocupado()) { st.t -= dt; if (st.t <= 0) { const f = st.fn; st.fn = null; f(); } }
      if (st.dice) { st.dice.en -= dt; if (st.dice.en <= 0) { OJ.globo(avEl(st.dice.j), st.dice.t); st.dice = null; } }
      if (humano() && !tuto && opt.reloj !== false) {
        st.reloj -= dt;
        const k = Math.max(0, st.reloj / RELOJ); if (Math.abs(k - rel) > 0.004) { rel = k; R.reloj.style.transform = 'scaleX(' + k.toFixed(3) + ')'; R.reloj.classList.toggle('poco', st.reloj < 5); }
        if (st.reloj <= 0) solo();
      }
    };
    game.dispose = function () { hud.remove(); if (OJ.input === game.input) OJ.input = null; v.dispose(); };
    game.reiniciar = () => OJ.app.jugar('domino', opt);

    OJ.input = game.input;
    st.turno = 0; pintar(); espera(0.01, () => nuevaMano(-1));
    if (!opt.demo) st.dice = { j: n === 2 ? 1 : 2, t: parejas ? '¡Dale, compañero!' : '¡Buena suerte!', en: 0.8 };
    return game;
  };
})();
