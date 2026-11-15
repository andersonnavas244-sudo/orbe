/*
 * Parqués — reglas, turnos, máquina rival e interfaz. Lo visual (tablero, fichas, dados) está en parques3d.js.
 * Reglas (parqués colombiano, con las dinámicas del parchís):
 *  · 2, 3 o 4 jugadores, 4 fichas cada uno, empiezan en la cárcel. Dos dados.
 *  · Salida — colombiano: con pares salen todas las fichas presas (si no tienes fichas afuera, 3 intentos por turno).
 *             parchís: sale una ficha con cada 5 (un dado en 5 o los dos sumando 5), y es obligatorio sacarla.
 *    Al salir se come lo que haya en su salida.
 *  · Cada dado se mueve por separado (pueden ser en la misma ficha). Si puedes mover, debes mover.
 *  · Caer en una casilla con ficha rival que no sea seguro: se la come (va a la cárcel) y ganas un premio de 20 casillas.
 *    Meter una ficha al cielo da un premio de 10. Los premios se mueven con cualquier ficha, enteros.
 *  · Barrera: dos fichas del mismo color en una casilla no dejan pasar a nadie (ni al dueño). Con pares es obligatorio abrirla.
 *  · Pares: repites. Tres pares seguidos: tu ficha más adelantada sube al cielo.
 *  · Recorrido: salida → pista hasta su final → 7 casillas de llegada → cielo, con cuenta exacta. Gana quien lleve las 4.
 * Progreso de una ficha: -1 cárcel · 0..63 pista (0 = salida, 63 = final) · 64..70 llegada · 71 cielo.
 */
(function () {
  'use strict';
  const NOM = ['Amarillo', 'Azul', 'Rojo', 'Verde'], COL = ['#f4c20d', '#1e6fe0', '#e53935', '#1faa59'];
  const RIVAL = [null, ['Camilo', '👨'], ['Rosa', '👵'], ['Pacho', '🧔']], CARA_LOCAL = ['😀', '😎', '🤠', '😺'];
  const ULT = 63, LLEGA = 64, CIELO = 71, RELOJ = 20, PREMIO_COME = 20, PREMIO_CIELO = 10;
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const caraDado = n => { let h = ''; for (let i = 0; i < 9; i++) h += '<i' + ((PIPS[n] || []).indexOf(i) >= 0 ? ' class="p"' : '') + '></i>'; return h; };

  OJ.Parques = function (opt) {
    opt = Object.assign({ modo: 'ia', n: 4, dif: 1, reglas: 'colombiano' }, opt);
    const n = OJ.clamp(opt.n | 0, 2, 4), parchis = opt.reglas === 'parchis';
    const J = n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3];
    const v = OJ.Parques3D({ jugadores: n });
    const SALIDA = v.SALIDA, SEGUROS = v.SEGUROS;
    const esIA = j => opt.modo === 'demo' || (opt.modo === 'ia' && j !== 0);
    const nombre = j => (opt.modo === 'ia' ? (j === 0 ? 'Tú' : RIVAL[j][0]) : NOM[j]);
    const cara = j => (opt.modo === 'ia' ? (j === 0 ? '😀' : RIVAL[j][1]) : CARA_LOCAL[j]);
    const game = { scene: v.scene, cam: v.cam, exposure: v.exposure, nombre: 'parques', vista: v, resize: v.resize };
    const P = [0, 1, 2, 3].map(() => [-1, -1, -1, -1]);
    const st = { fin: false, ti: 0, fase: 'tirar', dados: [0, 0], disp: [], pares: 0, intentos: 0, t: 0, fn: null, sel: null, ganador: -1, jugadas: 0, abrir: false, reloj: RELOJ };
    game.st = st; game.P = P;

    /* ---------------- ayudas del tablero ---------------- */
    const donde = (j, p) => (p < 0 ? { t: 'carcel' } : p <= ULT ? { t: 'pista', i: (SALIDA[j] + p) % 68 } : { t: 'llegada', k: Math.min(p - LLEGA, 7) });
    const idx = (j, p) => (p >= 0 && p <= ULT ? (SALIDA[j] + p) % 68 : -1);
    const seguro = i => SEGUROS.indexOf(i) >= 0;
    const enCielo = j => P[j].filter(p => p >= CIELO).length;
    const cuantos = (k, i, Q) => Q[k].filter(p => idx(k, p) === i).length;
    const barrera = (i, Q) => J.some(k => cuantos(k, i, Q) >= 2);
    const enBarrera = (j, f, Q) => { const i = idx(j, Q[j][f]); return i >= 0 && cuantos(j, i, Q) >= 2; };
    function rivalesEn(j, i, Q) { const l = []; J.forEach(k => { if (k !== j) Q[k].forEach((p, f) => { if (idx(k, p) === i) l.push([k, f]); }); }); return l; }
    const libres = () => st.disp.map((x, id) => Object.assign({ id }, x)).filter(x => !x.usado);
    function camino(j, p, d, Q) {      // ¿puede avanzar d casillas sin pasar por una barrera?
      if (p + d > CIELO) return false;
      for (let s = 1; s <= d; s++) { const q = p + s; if (q <= ULT && barrera(idx(j, q), Q)) return false; }
      return true;
    }
    /* jugadas posibles: { f, ids:[...], d, salir } */
    function opciones(j, Q, dd) {
      const l = [], salidas = [];
      const presa = Q[j].findIndex(p => p < 0);
      if (parchis && presa >= 0 && cuantos(j, SALIDA[j], Q) < 2) {
        const cinco = dd.find(x => x.tipo === 'dado' && x.d === 5);
        if (cinco) salidas.push({ f: presa, ids: [cinco.id], d: 5, salir: true });
        else { const ds = dd.filter(x => x.tipo === 'dado'); if (ds.length === 2 && ds[0].d + ds[1].d === 5) salidas.push({ f: presa, ids: [ds[0].id, ds[1].id], d: 5, salir: true }); }
      }
      if (salidas.length) return salidas;            // con un 5 es obligatorio sacar ficha
      for (let f = 0; f < 4; f++) {
        const p = Q[j][f]; if (p < 0 || p >= CIELO) continue;
        const vistos = [];
        dd.forEach(x => { if (vistos.indexOf(x.d) < 0 && camino(j, p, x.d, Q)) { vistos.push(x.d); l.push({ f, ids: [x.id], d: x.d }); } });
      }
      if (st.abrir) { const b = l.filter(o => enBarrera(j, o.f, Q)); if (b.length) return b; }   // con pares hay que abrir la barrera
      return l;
    }
    /* ¿una ficha en esa posición la pueden comer en el próximo tiro? (0 nada · 0.5 poco · 1 mucho) */
    function peligro(j, p, Q) {
      if (p < 0 || p > ULT) return 0;
      const i = idx(j, p); let r = 0;
      J.forEach(k => {
        if (k === j) return;
        if (i === SALIDA[k] && Q[k].some(x => x < 0)) r = Math.max(r, 0.5);
        if (seguro(i) || cuantos(j, i, Q) >= 2) return;
        Q[k].forEach(x => { if (x < 0 || x > ULT) return; const ri = (SALIDA[k] + x) % 68, dist = (i - ri + 68) % 68; if (dist >= 1 && dist <= 12 && x + dist <= ULT) r = Math.max(r, dist <= 6 ? 1 : 0.6); });
      });
      return r;
    }
    function aplicar(j, op, Q) {      // copia del tablero con la jugada hecha (para que la máquina piense)
      const R = Q.map(x => x.slice()), np = op.salir ? 0 : R[j][op.f] + op.d; R[j][op.f] = np;
      const i = idx(j, np), com = i >= 0 && (op.salir || !seguro(i)) ? rivalesEn(j, i, R) : [];
      com.forEach(([k, f]) => { R[k][f] = -1; });
      return { R, com: com.length, np };
    }
    function puntaje(j, op, Q) {
      const p = Q[j][op.f], a = aplicar(j, op, Q), np = a.np; let sc = 0;
      sc += a.com * 140;                                   // comer (y el premio de 20)
      if (op.salir) sc += 60;                              // salir de la cárcel
      if (np === CIELO) sc += 90;                          // llegar al cielo
      else if (np >= LLEGA && p <= ULT) sc += 40;          // entrar a la llegada (ya nadie la come)
      else if (np >= LLEGA) sc += 4;
      const i = idx(j, np); if (i >= 0 && seguro(i)) sc += 28;     // ponerse en seguro
      if (i >= 0 && cuantos(j, i, a.R) >= 2) sc += 18;             // armar barrera
      const antes = peligro(j, p, Q), despues = peligro(j, np, a.R);
      sc += antes * 40 - despues * 45;                     // huir del peligro
      sc += np * 0.3;
      return { sc, R: a.R };
    }
    function elegirIA(j, l, dif) {
      if (Math.random() < [0.45, 0.15, 0.04][dif]) return l[Math.floor(Math.random() * l.length)];      // a veces juega por instinto
      const ruido = [32, 15, 6][dif] || 0, dd = libres();
      let mejor = l[0], ms = -1e9;
      l.forEach(op => {
        const r = puntaje(j, op, P); let sc = r.sc + Math.random() * ruido;
        if (dif === 2 && dd.length >= 2) {          // difícil: piensa también lo que le queda por mover
          const resto = dd.filter(x => op.ids.indexOf(x.id) < 0), l2 = opciones(j, r.R, resto);
          let m2 = l2.length ? -1e9 : -15; l2.forEach(o2 => { m2 = Math.max(m2, puntaje(j, o2, r.R).sc); }); sc += m2;
        }
        if (sc > ms) { ms = sc; mejor = op; }
      });
      return mejor;
    }

    /* ---------------- interfaz ---------------- */
    const hud = OJ.el('div', 'hud pq-hud', `
      <div class="jg-top">
        <div class="jg-fila"><button class="ic" data-a="pausa" aria-label="Menú">☰</button><div class="jg-chips">${J.map(j => `<div class="jg-chip con-av" data-j="${j}">${OJ.avatar(cara(j), COL[j])}<span>${nombre(j)}</span><b data-c="${j}">★ 0/4</b></div>`).join('')}</div></div>
        <div class="jg-turno" data-r="turno"><span data-r="tt"></span><i class="reloj" data-r="reloj"></i></div>
      </div>
      <div class="jg-bot pq-bot">
        <div class="pq-dados" data-r="dados"><div class="dado" data-d="0"></div><div class="dado" data-d="1"></div><div class="pq-premio oculto" data-r="premio"></div></div>
        <button class="btn pq-tirar" data-a="tirar">Tirar dados</button>
        <div class="pq-elige oculto" data-r="elige"></div>
      </div>`);
    OJ.ui.appendChild(hud);
    const R = {}; hud.querySelectorAll('[data-r]').forEach(e => { R[e.dataset.r] = e; });
    const dadosEl = [...hud.querySelectorAll('.dado')], tirarB = hud.querySelector('[data-a="tirar"]');
    const chip = j => hud.querySelector('.jg-chip[data-j="' + j + '"]');
    hud.querySelector('[data-a="pausa"]').onclick = () => OJ.app.pausa(game);
    tirarB.onclick = () => { if (humanoEspera() && st.fase === 'tirar') { OJ.audio(); tirar(); } };
    const charla = OJ.charla('boton', t => { const j = opt.modo === 'local' ? J[st.ti] : 0; OJ.globo(chip(j), t); if (opt.modo === 'ia') responder(); });
    hud.querySelector('.pq-bot').appendChild(charla);
    function responder() { const k = J.filter(j => esIA(j))[Math.floor(Math.random() * (J.length - 1))]; const d = OJ.dicho('saludo', 0.5); if (k != null && d) st.dice = { j: k, t: d, en: 0.8 + Math.random() }; }
    function hablar(j, tipo, prob) { if (!esIA(j) || opt.modo === 'demo') return; const d = OJ.dicho(tipo, prob); if (d) OJ.globo(chip(j), d); }
    let tuto = null;
    if (opt.modo !== 'demo' && !OJ.store.get('parques.ayuda2', 0)) {
      tuto = OJ.el('div', 'velo centro', `<div class="sheet"><h2>Cómo se juega</h2><div class="reglas">
        · ${parchis ? 'Saca un <b>5</b> para sacar una ficha de la cárcel.' : 'Saca <b>pares</b> para sacar tus fichas de la cárcel.'}<br>· Cada dado mueve por separado: toca la ficha que <b>brinca</b>.<br>
        · Cae sobre un rival (fuera de las casillas con ⭐) y <b>te lo comes</b>: ganas <b>20</b> casillas. Meter una al cielo da <b>10</b>.<br>
        · Dos fichas iguales en una casilla hacen <b>barrera</b>: nadie pasa.<br>· Pares: repites. Gana quien lleve sus 4 fichas al <b>cielo</b>.</div>
        <button class="btn" data-x="ok">¡A jugar!</button></div>`);
      hud.appendChild(tuto);
      tuto.querySelector('[data-x="ok"]').onclick = () => { cerrarTuto(); OJ.snd.toque(); };
    }
    function cerrarTuto() { if (!tuto) return; OJ.store.set('parques.ayuda2', 1); tuto.remove(); tuto = null; }
    const humanoEspera = () => !st.fin && !esIA(J[st.ti]) && (st.fase === 'tirar' || st.fase === 'elegir');

    function pintar() {
      const j = J[st.ti], ia = esIA(j), humano = !ia && !st.fin;
      J.forEach(k => {
        const c = chip(k), on = k === j && !st.fin; c.classList.toggle('on', on);
        c.style.borderColor = on ? COL[k] : ''; hud.querySelector('[data-c="' + k + '"]').textContent = '★ ' + enCielo(k) + '/4';
      });
      let t = '';
      if (ia) t = 'Juega ' + nombre(j) + '…';
      else if (!st.fin) {
        const quien = opt.modo === 'ia' ? 'Te toca' : 'Turno de ' + NOM[j];
        t = st.fase === 'tirar' ? quien + ': tira los dados' + (st.intentos ? ' (' + (st.intentos + 1) + ' de 3)' : '')
          : st.fase === 'elegir' ? (st.sel ? '¿Cuánto la mueves?' : st.abrir ? 'Pares: abre tu barrera' : quien + ': toca una ficha que brinca') : quien;
      }
      R.tt.textContent = t; R.turno.classList.toggle('oculto', !t); R.turno.style.background = COL[j]; R.turno.style.color = j === 0 ? '#2a1d00' : '#fff';
      R.reloj.style.display = humanoEspera() && !tuto ? '' : 'none';
      const dd = st.disp;
      dadosEl.forEach((d, k) => { const x = dd[k]; d.innerHTML = caraDado(st.dados[k]); d.classList.toggle('usado', !!x && x.usado); d.classList.toggle('vacio', !x || st.fase === 'dados'); });
      const prem = dd.slice(2).filter(x => !x.usado);
      R.premio.classList.toggle('oculto', !prem.length); R.premio.innerHTML = prem.map(x => '<b>+' + x.d + '</b>').join('');
      tirarB.classList.toggle('oculto', !!st.sel);
      tirarB.disabled = !(humano && st.fase === 'tirar');
      tirarB.classList.toggle('apagado', tirarB.disabled);
      tirarB.textContent = humano && st.fase === 'elegir' ? 'Mueve una ficha' : 'Tirar dados';
      R.elige.classList.toggle('oculto', !st.sel);
      if (st.sel) {
        R.elige.innerHTML = st.sel.map((op, k) => `<button class="btn" data-e="${k}">${op.ids.length > 1 || op.ids[0] < 2 ? 'Mover' : 'Premio'} <b>${op.d}</b></button>`).join('');
        R.elige.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => { if (st.fase === 'elegir' && st.sel) jugar(st.sel[+b.dataset.e]); }; });
        R.elige.classList.toggle('muchos', st.sel.length > 2);
      }
    }
    const vis = (k, ...a) => { if (typeof v[k] === 'function') v[k](...a); };      // métodos opcionales de la vista
    const aviso = (t, s, c, ms) => { if (opt.modo !== 'demo' || game.avisos) OJ.gran(t, s, c || '#ffd34d', ms || 1300); if (game.log) game.log.push(t + (s ? ' · ' + s : '')); };

    /* ---------------- flujo (todas las esperas van por update) ---------------- */
    function espera(seg, fn) { st.fase = 'espera'; st.t = seg; st.fn = fn; }
    function empezar() { st.pares = 0; st.intentos = 0; nuevoTiro(); }
    function nuevoTiro() {
      const j = J[st.ti]; st.disp = []; st.sel = null; st.abrir = false; v.resaltar([]); vis('turno', j);
      if (opt.modo === 'local') v.enfocar(j);
      if (esIA(j)) { pintar(); espera(0.7, tirar); return; }
      st.fase = 'tirar'; st.reloj = RELOJ; pintar();
    }
    function tirar() {
      cerrarTuto();
      const f = game.forzar && game.forzar.shift(), a = f ? f[0] : 1 + Math.floor(Math.random() * 6), b = f ? f[1] : 1 + Math.floor(Math.random() * 6);
      st.dados = [a, b]; st.disp = []; st.fase = 'dados'; pintar();
      v.dados(a, b, trasDados);
    }
    function trasDados() {
      const j = J[st.ti], par = st.dados[0] === st.dados[1];
      st.disp = st.dados.map(d => ({ d, tipo: 'dado', usado: false })); st.jugadas++;
      if (par) { st.pares++; if (st.pares >= 3) return tresPares(j); }
      const fuera = P[j].filter(p => p >= 0 && p < CIELO).length, presas = P[j].filter(p => p < 0).length;
      if (!parchis) {
        if (!fuera) {
          gastar();
          if (par) { aviso('¡Pares!', presas > 1 ? 'Salen tus fichas · repites' : 'Sale tu ficha · repites', '#3ee0b0'); hablar(j, 'bien'); return salir(j, () => espera(1, nuevoTiro)); }
          st.intentos++;
          if (st.intentos < 3) { aviso('Sin pares', 'Intento ' + st.intentos + ' de 3', '#ffffff', 1000); OJ.snd.falla(); return espera(1.1, nuevoTiro); }
          aviso('Sin pares', 'Pasa el turno', '#ffffff', 1100); OJ.snd.falla(); hablar(j, 'mal', 0.25); return espera(1.2, siguiente);
        }
        if (par && presas) { gastar(); aviso('¡Pares!', 'Salen las fichas de la cárcel · repites', '#3ee0b0'); return salir(j, () => espera(1, nuevoTiro)); }
      }
      if (par) st.abrir = P[j].some((p, f) => p >= 0 && enBarrera(j, f, P));
      pintar(); continuar();
    }
    const gastar = () => st.disp.forEach(x => { x.usado = true; });
    /* colombiano: con pares salen todas las presas */
    function salir(j, cb) {
      OJ.snd.punto(); OJ.vib(40);
      for (let f = 0; f < 4; f++) if (P[j][f] < 0) { P[j][f] = 0; v.mover(j, f, [donde(j, 0)], null); }
      pintar();
      espera(0.3, () => { if (comerEn(j, SALIDA[j], true)) { st.disp.push({ d: PREMIO_COME, tipo: 'premio', usado: false }); vis('premio', j, PREMIO_COME, donde(j, 0)); return espera(1.1, continuar); } cb(); });      // con premio: lo mueve y luego repite por los pares
    }
    function comerEn(j, i, enSalida) {
      if (i < 0 || (!enSalida && seguro(i))) return 0;
      const com = rivalesEn(j, i, P);
      com.forEach(([k, f]) => { P[k][f] = -1; v.capturar(k, f, null); });
      if (com.length) {
        const yo = opt.modo === 'ia' && j === 0, aMi = opt.modo === 'ia' && com[0][0] === 0;
        aviso(yo ? '¡Te la comiste!' : aMi ? '¡Te comieron!' : '¡Se la comió!', yo ? 'Mandaste a la cárcel a ' + nombre(com[0][0]) + ' · premio de 20' : nombre(j) + ' mandó a la cárcel a ' + (aMi ? 'tu ficha' : nombre(com[0][0])) + ' · premio de 20', yo ? '#3ee0b0' : '#ff8a8a', 1600); hablar(j, 'bien', 0.6); hablar(com[0][0], 'mal', 0.6); }
      return com.length;
    }
    function tresPares(j) {
      gastar();
      let f = -1, m = -2; for (let k = 0; k < 4; k++) if (P[j][k] < CIELO && P[j][k] > m) { m = P[j][k]; f = k; }
      aviso('¡Tres pares!', 'Una ficha de ' + nombre(j) + ' sube al cielo', '#ffe14d', 1600); OJ.snd.punto(); hablar(j, 'gana', 0.6);
      if (f < 0) return espera(1.2, siguiente);
      P[j][f] = CIELO; v.mover(j, f, [donde(j, CIELO)], null); pintar();
      espera(1.4, () => (enCielo(j) >= 4 ? terminar(j) : siguiente()));
    }
    function continuar() {
      const j = J[st.ti], l = opciones(j, P, libres());
      if (!l.length) {
        const nada = st.disp.slice(0, 2).every(x => !x.usado), premio = st.disp.slice(2).some(x => !x.usado); gastar();
        if (nada) { aviso('Sin jugada', 'Ninguna ficha puede mover', '#ffffff', 1200); OJ.snd.falla(); }
        else if (premio) aviso('Premio perdido', 'Ninguna ficha lo puede usar', '#ffffff', 1100);
        return finJugada(nada || premio ? 1.2 : 0.3);
      }
      if (esIA(j)) { pintar(); const op = elegirIA(j, l, opt.dif); v.resaltar([{ j, f: op.f }]); return espera(0.5, () => jugar(op)); }
      st.fase = 'elegir'; st.sel = null; st.reloj = Math.max(st.reloj, 8);
      const fs = []; l.forEach(o => { if (fs.indexOf(o.f) < 0) fs.push(o.f); });
      v.resaltar(fs.map(f => ({ j, f }))); pintar();
    }
    function tocarFicha(f) {
      const j = J[st.ti], l = opciones(j, P, libres()).filter(o => o.f === f);
      if (!l.length) { OJ.toast(P[j][f] < 0 ? (parchis ? 'Necesitas un 5 para salir' : 'Necesitas pares para salir') : 'Esa ficha no puede mover'); return; }
      OJ.snd.toque();
      if (l.length === 1) return jugar(l[0]);
      st.sel = l; v.resaltar([{ j, f }]); vis('marcarCasillas', l.map(o => donde(j, o.salir ? 0 : P[j][f] + o.d)), j); pintar();
    }
    function jugar(op) {
      const j = J[st.ti], p0 = P[j][op.f], pasos = [];
      const np = op.salir ? 0 : p0 + op.d;
      if (op.salir) pasos.push(donde(j, 0)); else for (let s = 1; s <= op.d; s++) pasos.push(donde(j, p0 + s));
      const eraBarrera = !op.salir && enBarrera(j, op.f, P);
      op.ids.forEach(id => { st.disp[id].usado = true; });
      st.sel = null; v.resaltar([]); st.fase = 'mover'; P[j][op.f] = np;
      if (eraBarrera) st.abrir = false;
      pintar();
      v.mover(j, op.f, pasos, () => {
        const com = comerEn(j, idx(j, np), !!op.salir);
        let pausa = 0.15;
        if (com) { st.disp.push({ d: PREMIO_COME, tipo: 'premio', usado: false }); vis('premio', j, PREMIO_COME); pausa = 1.1; }
        if (op.salir) { OJ.snd.punto(); if (!com) aviso('¡Sale!', 'Una ficha de ' + nombre(j) + ' sale de la cárcel', '#3ee0b0', 1000); pausa = Math.max(pausa, 0.6); }
        if (np === CIELO) {
          OJ.snd.punto(); OJ.vib(50); pausa = Math.max(pausa, 0.9);
          if (enCielo(j) < 4) { st.disp.push({ d: PREMIO_CIELO, tipo: 'premio', usado: false }); vis('premio', j, PREMIO_CIELO); if (!com) aviso('¡Al cielo!', (opt.modo === 'ia' && j === 0 ? 'Llevas ' : nombre(j) + ' lleva ') + enCielo(j) + ' de 4 · premio de 10', '#ffe14d', 1300); hablar(j, 'bien', 0.4); }
        }
        if (st.abrir && !P[j].some((p, f) => p >= 0 && enBarrera(j, f, P))) st.abrir = false;
        pintar();
        if (enCielo(j) >= 4) return espera(0.8, () => terminar(j));
        espera(pausa, continuar);
      });
    }
    function finJugada(seg) {
      pintar();
      if (st.dados[0] === st.dados[1]) espera(seg, () => { aviso('¡Pares!', 'Repites turno', '#3ee0b0', 1000); espera(0.9, nuevoTiro); });
      else espera(seg + 0.3, siguiente);
    }
    function siguiente() { st.ti = (st.ti + 1) % J.length; empezar(); }
    function terminar(j) {
      st.fin = true; st.fase = 'fin'; st.ganador = j; st.sel = null; st.disp = []; v.resaltar([]); vis('turno', -1); v.celebrar(j); pintar();
      J.forEach(k => { if (k !== j) hablar(k, 'fin', 0.7); }); hablar(j, 'gana', 0.8);
      if (opt.modo === 'demo') return;
      const gano = opt.modo !== 'ia' || j === 0;
      gano ? OJ.snd.gana() : OJ.snd.pierde();
      OJ.app.final({ juego: 'parques', gano: opt.modo === 'ia' ? j === 0 : null, titulo: opt.modo === 'ia' ? (j === 0 ? '¡Ganaste!' : 'Ganó ' + nombre(j)) : '¡Ganó ' + NOM[j] + '!',
        filas: J.map(k => ({ nombre: nombre(k), valor: '★ ' + enCielo(k) + '/4', color: COL[k], cara: cara(k), gana: k === j })), resumen: (j === 0 && opt.modo === 'ia' ? 'Gané' : 'Ganó ' + nombre(j)) + ' una partida de parqués', opt });
    }
    /* se acabó el reloj: juega solo */
    function solo() {
      const j = J[st.ti]; OJ.toast('Se acabó tu tiempo: jugó la máquina por ti');
      if (st.fase === 'tirar') return tirar();
      const l = opciones(j, P, libres()); if (l.length) jugar(elegirIA(j, l, 1));
    }

    /* ---------------- toques ---------------- */
    game.input = {
      down(x, y) {
        charla.cerrar();
        if (st.fin || tuto) return;
        const j = J[st.ti]; if (esIA(j)) return;
        if (st.fase === 'tirar') { if (v.dadosEn(x, y)) { OJ.audio(); tirar(); } return; }
        if (st.fase === 'elegir') { const h = v.fichaEn(x, y); if (h && h.j === j) tocarFicha(h.f); }
      }
    };
    /* para pruebas */
    game.tirar = () => { if (st.fase === 'tirar') tirar(); };
    game.tocarFicha = tocarFicha;
    game.elegir = k => { if (st.sel && st.sel[k]) jugar(st.sel[k]); };
    game.poner = (j, f, p) => { P[j][f] = p; v.colocar(j, f, donde(j, p)); pintar(); };
    game.opciones = () => opciones(J[st.ti], P, libres());

    let rel = -1;
    game.update = function (dt) {
      v.update(dt);
      if (st.fase === 'espera' && !v.ocupado()) { st.t -= dt; if (st.t <= 0) { const f = st.fn; st.fn = null; f(); } }
      if (st.dice) { st.dice.en -= dt; if (st.dice.en <= 0) { OJ.globo(chip(st.dice.j), st.dice.t); st.dice = null; } }
      if (humanoEspera() && !tuto && opt.reloj !== false) {
        st.reloj -= dt;
        const k = Math.max(0, st.reloj / RELOJ); if (Math.abs(k - rel) > 0.004) { rel = k; R.reloj.style.transform = 'scaleX(' + k.toFixed(3) + ')'; R.reloj.classList.toggle('poco', st.reloj < 5); }
        if (st.reloj <= 0) solo();
      }
    };
    game.dispose = function () { hud.remove(); if (OJ.input === game.input) OJ.input = null; v.dispose(); };
    game.reiniciar = () => OJ.app.jugar('parques', opt);

    OJ.input = game.input;
    v.enfocar(opt.modo === 'local' ? J[0] : 0);
    empezar();
    if (opt.modo === 'ia') st.dice = { j: J[1], t: '¡Buena suerte!', en: 1.2 };
    return game;
  };
})();
