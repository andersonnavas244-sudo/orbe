/*
 * Juegos de Colombia — menú (tejo, billar, parqués y dominó), opciones de partida, pausa, final, ajustes y puente con Android.
 * Puente nativo (window.AndroidJuegos, opcional): adBreak(), share(texto), openUrl(url), buyPremium(),
 * manageSubscription(), isPremium(), vibrate(ms). Android llama a onNativePremium(bool, precio), orbeToast(msg) y orbeBack().
 */
(function () {
  'use strict';
  const { el, store } = OJ;
  const N = OJ.N;
  const app = OJ.app = { pantalla: 'inicio', premium: false, precio: '' };
  const POLITICA = 'https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-juegos.md';
  try { app.premium = !!(N && N.isPremium && N.isPremium()); } catch (e) { /* */ }
  window.onNativePremium = function (p, precio) { app.premium = !!p; if (precio) app.precio = precio; if (app.pantalla === 'inicio') inicio(); };

  const REGLAS_BILLAR = {
    bola8: '<b>Bola 8</b> · mete tus 7 bolas: lisas (1 a 7) o rayadas (9 a 15), según la primera que metas. Al final mete la <b>negra</b> y ganas.<br><b>Falta</b>: meter la blanca, no tocar bola o pegarle primero a una que no es tuya. Si metes la negra antes de tiempo, pierdes.',
    bola9: '<b>Bola 9</b> · pégale siempre primero a la bola más baja de la mesa. Gana quien meta la <b>9</b>, aunque sea de rebote.<br><b>Falta</b>: meter la blanca o no pegarle primero a la más baja. Pasa el turno.',
    libre: '<b>Carambola libre</b> · tu bola debe tocar las otras dos. Cada carambola vale un punto y sigues tacando.',
    tres: '<b>Tres bandas</b> · tu bola toca las otras dos y, antes de la segunda, pega en <b>3 bandas o más</b>. Cada carambola vale un punto y sigues tacando.'
  };
  const stats = Object.assign({ tejo: { g: 0, p: 0 }, billar: { g: 0, p: 0 }, parques: { g: 0, p: 0 }, domino: { g: 0, p: 0 } }, store.get('stats', {}));
  const prefs = store.get('prefs', { v: 2, tejo: { modo: 'ia', dif: 1, meta: 27 }, billar: { modo: 'bola8', rival: 'ia', dif: 1, meta: 10 } });
  if (!prefs.parques) prefs.parques = { modo: 'ia', n: 4, dif: 1, reglas: 'colombiano' };
  if (!prefs.parques.reglas) prefs.parques.reglas = 'colombiano';
  if (!prefs.domino) prefs.domino = { modo: '1v1', dif: 1, meta: 100 };
  if (!prefs.domino.modo) prefs.domino.modo = prefs.domino.n === 4 ? 'todos' : '1v1';
  if (!(prefs.v >= 2)) { prefs.v = 2; prefs.billar.modo = 'bola8'; }      // llegaron bola 8 y bola 9: se estrenan con el pool
  if (!REGLAS_BILLAR[prefs.billar.modo]) prefs.billar.modo = 'bola8';
  const JUEGOS = [['tejo', 'Tejo', 'Revienta las mechas', 'Mecha · Moñona'], ['billar', 'Billar', 'Pool y carambola', 'Bola 8 · Bola 9 · 3 bandas'],
    ['parques', 'Parqués', 'De 2 a 4 jugadores', 'Pares · Cárcel · Cielo'], ['domino', 'Dominó', 'Doble seis', 'Dominó · Tranca']];
  const NOMBRE_J = { tejo: 'Tejo 3D', billar: 'Billar 3D', parques: 'Parqués 3D', domino: 'Dominó 3D' };
  let hoja = null;
  function cerrarHoja() { if (hoja) { hoja.remove(); hoja = null; } OJ.pausado = false; }
  function abrirHoja(html, centro) {
    cerrarHoja();
    hoja = el('div', 'velo' + (centro ? ' centro' : ''), '<div class="sheet">' + html + '</div>');
    OJ.ui.appendChild(hoja); return hoja;
  }
  function limpiar() { cerrarHoja(); OJ.ui.querySelectorAll('.home').forEach(e => e.remove()); OJ.granFuera(); }

  /* ---------------- inicio ---------------- */
  function inicio() {
    limpiar(); app.pantalla = 'inicio';
    if (!OJ.juego || !OJ.juego.demo) { const g = OJ.Tejo({ demo: true, meta: 1e9 }); g.demo = true; OJ.setGame(g); }
    const h = el('div', 'home', `
      <div class="franja"><i></i><i></i><i></i></div>
      <div class="logo">Juegos de <b>Colombia</b></div>
      <div class="lema">Tejo, billar, parqués y dominó en 3D</div>
      <div class="cards">${JUEGOS.map(x => `
        <button class="card ${x[0]}" data-j="${x[0]}"><div class="card-img" style="background-image:url(img/${x[0]}.jpg)"></div>
          <div class="card-b"><div class="card-t">${x[1]}</div><div class="card-s">${x[2]}</div><div class="card-e">${stats[x[0]].g ? '🏆 Ganadas: ' + stats[x[0]].g : x[3]}</div></div></button>`).join('')}
      </div>
      <div class="home-bot"><button data-a="ajustes">⚙ Ajustes</button>${app.premium ? '' : '<button class="oro" data-a="premium">★ Sin anuncios</button>'}</div>`);
    OJ.ui.appendChild(h);
    h.querySelectorAll('.card').forEach(c => { c.onclick = () => { OJ.audio(); OJ.snd.toque(); opciones(c.dataset.j); }; });
    h.querySelector('[data-a="ajustes"]').onclick = ajustes;
    const p = h.querySelector('[data-a="premium"]'); if (p) p.onclick = premium;
  }
  app.inicio = inicio;

  /* ---------------- opciones de partida ---------------- */
  function segmento(titulo, clave, ops, val) {
    return (titulo ? `<h3>${titulo}</h3>` : '') + `<div class="seg" data-k="${clave}">` + ops.map(o => `<button data-v="${o[0]}" class="${String(o[0]) === String(val) ? 'on' : ''}">${o[1]}${o[2] ? '<small>' + o[2] + '</small>' : ''}</button>`).join('') + '</div>';
  }
  function opciones(j) {
    const p = prefs[j];
    const html = j === 'tejo' ? `
      <h2>Tejo 3D</h2><p>Lanza el tejo a la cancha de greda y revienta las mechas del bocín.</p>
      <div class="reglas"><b>Mecha 3</b> · revientas una mecha<br><b>Embocinada 6</b> · el tejo queda dentro del bocín<br><b>Moñona 9</b> · revientas la mecha y quedas en el bocín<br><b>Mano 1</b> · si nadie revienta, gana el tejo más cercano</div>
      ${segmento('Jugadores', 'modo', [['ia', '1 jugador', 'contra la máquina'], ['2j', '2 jugadores', 'en el mismo celular']], p.modo)}
      ${segmento('Dificultad', 'dif', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], p.dif)}
      ${segmento('Partida a', 'meta', [[9, '9', 'rápida'], [15, '15'], [27, '27', 'tradicional']], p.meta)}
      <button class="btn" data-x="jugar">Jugar</button>` : j === 'parques' ? `
      <h2>Parqués 3D</h2>
      <div class="reglas">Cada dado mueve por separado · cae sobre un rival fuera de seguro y <b>te lo comes</b> (+20) · al cielo +10 · dos fichas iguales hacen <b>barrera</b> · lleva tus 4 fichas al <b>cielo</b>.</div>
      ${segmento('Modo', 'modo', [['ia', 'Contra la máquina', 'tú eres amarillo'], ['local', 'Con amigos', 'en el mismo celular']], p.modo)}
      ${segmento('Jugadores', 'n', [[2, '2'], [3, '3'], [4, '4']], p.n)}
      ${segmento('Reglas', 'reglas', [['colombiano', 'Parqués', 'sales con pares'], ['parchis', 'Parchís', 'sales con un 5']], p.reglas)}
      <div data-r="dif">${segmento('Dificultad', 'dif', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], p.dif)}</div>
      <button class="btn" data-x="jugar">Jugar</button>` : j === 'domino' ? `
      <h2>Dominó 3D</h2>
      <div class="reglas">Doble seis · pon una ficha que case con una punta · gana la mano quien se quede sin fichas (<b>¡dominó!</b>) o quien sume menos si se <b>tranca</b>, y se lleva los puntos de los demás.</div>
      ${segmento('Modo', 'modo', [['1v1', '1 contra 1', 'con pozo'], ['parejas', 'Parejas', '2 contra 2'], ['todos', 'Todos', '4 jugadores']], p.modo)}
      ${segmento('Dificultad', 'dif', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], p.dif)}
      ${segmento('Partida a', 'meta', [[50, '50', 'rápida'], [100, '100', 'tradicional']], p.meta)}
      <button class="btn" data-x="jugar">Jugar</button>` : `
      <h2>Billar 3D</h2>
      <h3>Juego</h3>
      <div class="juegos">${segmento('', 'modo', [['bola8', 'Bola 8', 'pool clásico'], ['bola9', 'Bola 9', 'rápido']], p.modo)}
      ${segmento('', 'modo', [['libre', 'Carambola libre', 'sin troneras'], ['tres', 'Tres bandas', 'para expertos']], p.modo)}</div>
      <div class="reglas" data-r="reglas">${REGLAS_BILLAR[p.modo]}</div>
      ${segmento('Jugadores', 'rival', [['ia', '1 jugador', 'contra El Profe'], ['2j', '2 jugadores', 'en el mismo celular']], p.rival)}
      ${segmento('Dificultad', 'dif', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], p.dif)}
      <div data-r="meta">${segmento('Partida a', 'meta', [[5, '5 puntos'], [10, '10 puntos'], [20, '20 puntos']], p.meta)}</div>
      <button class="btn verde" data-x="jugar">Jugar</button>`;
    const v = abrirHoja(html + '<button class="btn gris" data-x="cerrar">Volver</button>');
    const reglas = v.querySelector('[data-r="reglas"]'), meta = v.querySelector('[data-r="meta"]');
    const verModo = () => {
      if (j === 'parques') v.querySelector('[data-r="dif"]').classList.toggle('oculto', p.modo === 'local');
      if (j !== 'billar') return; reglas.innerHTML = REGLAS_BILLAR[p.modo]; meta.classList.toggle('oculto', p.modo === 'bola8' || p.modo === 'bola9'); };
    verModo();
    v.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => {
        const k = b.parentNode.dataset.k, val = b.dataset.v; p[k] = /^\d+$/.test(val) ? +val : val;
        // una misma opción puede estar repartida en varias filas (los 4 juegos del billar): se limpian todas
        v.querySelectorAll('.seg[data-k="' + k + '"] button').forEach(x => x.classList.toggle('on', x === b)); store.set('prefs', prefs); OJ.snd.toque();
        if (k === 'modo') verModo();
      };
    });
    v.querySelector('[data-x="jugar"]').onclick = () => app.jugar(j, Object.assign({}, p));
    v.querySelector('[data-x="cerrar"]').onclick = cerrarHoja;
    v.addEventListener('click', e => { if (e.target === v) cerrarHoja(); });
  }
  app.opciones = opciones;
  app.jugar = function (j, opt) {
    limpiar(); app.pantalla = j; OJ.audio();
    OJ.setGame(j === 'tejo' ? OJ.Tejo(opt) : j === 'parques' ? OJ.Parques(opt) : j === 'domino' ? OJ.Domino(opt) : OJ.Billar(opt));
  };

  /* ---------------- pausa ---------------- */
  app.pausa = function (game) {
    OJ.snd.toque();
    const v = abrirHoja(`<h2>Pausa</h2>
      <button class="btn" data-x="seguir">Seguir jugando</button>
      <button class="btn gris" data-x="reiniciar">Empezar de nuevo</button>
      <button class="btn gris" data-x="salir">Salir al menú</button>
      <div class="opc" style="margin-top:12px"><span>Sonido</span><button class="sw ${OJ.cfg.sonido ? 'on' : ''}" data-c="sonido" aria-label="Sonido"></button></div>
      <div class="opc"><span>Vibración</span><button class="sw ${OJ.cfg.vibrar ? 'on' : ''}" data-c="vibrar" aria-label="Vibración"></button></div>`, true);
    OJ.pausado = true;
    interruptores(v);
    v.querySelector('[data-x="seguir"]').onclick = cerrarHoja;
    v.querySelector('[data-x="reiniciar"]').onclick = () => { cerrarHoja(); game.reiniciar(); };
    v.querySelector('[data-x="salir"]').onclick = () => { cerrarHoja(); anuncio(); inicio(); };
  };
  function interruptores(v) {
    v.querySelectorAll('.sw').forEach(s => { s.onclick = () => { const k = s.dataset.c; OJ.cfg[k] = !OJ.cfg[k]; s.classList.toggle('on', OJ.cfg[k]); OJ.guardarCfg(); if (OJ.cfg[k]) { k === 'sonido' ? OJ.snd.toque() : OJ.vib(40); } }; });
  }

  /* ---------------- final de partida ---------------- */
  app.final = function (r) {
    if (r.gano != null) { const s = stats[r.juego]; r.gano ? s.g++ : s.p++; store.set('stats', stats); }
    const JN = { bola8: 'Bola 8', bola9: 'Bola 9', libre: 'Carambola libre', tres: 'Tres bandas' }, juegoN = r.juego === 'billar' ? JN[r.opt.modo] || '' : '';
    let marc, resumen;
    if (r.filas) {        // parqués y dominó: de 2 a 4 jugadores en lista
      marc = '<div class="final-l">' + r.filas.map(f => `<div class="${f.gana ? 'gana' : ''}">${f.cara ? OJ.avatar(f.cara, f.color, 'chico') : '<i style="background:' + f.color + '"></i>'}<span>${f.nombre}</span><b>${f.valor}</b>${f.gana ? '<em>🏆</em>' : ''}</div>`).join('') + '</div>';
      resumen = r.resumen || r.titulo;
    } else {
      const m = r.marcador, num = typeof m[0][1] === 'number';      // en pool llega [[nombre,'🏆'],[nombre,'–']]
      const lado = x => `<div class="${!num && x[1] !== '🏆' ? 'pierde' : ''}">${x[1]}<small>${x[0]}</small></div>`;
      const quien = m[0][1] === '🏆' ? m[0][0] : m[1][0];
      resumen = num ? m[0][0] + ' ' + m[0][1] + ' – ' + m[1][1] + ' ' + m[1][0] : (quien === 'Tú' ? '¡Gané una partida de ' + juegoN + '!' : 'Ganó ' + quien + ' una partida de ' + juegoN);
      marc = `<div class="final-m${num ? '' : ' pool'}">${lado(m[0])}<div class="sep">${num ? '–' : 'vs'}</div>${lado(m[1])}</div>`;
    }
    const ICONO = { tejo: '🎯', billar: '🎱', parques: '🎲', domino: '👏' };
    setTimeout(() => {
      const v = abrirHoja(`<div class="centro-t"><div class="final-copa">${r.gano === false ? ICONO[r.juego] : '🏆'}</div><h2>${r.titulo}</h2>${juegoN ? '<div class="final-j">' + juegoN + '</div>' : ''}
        ${marc}</div>
        <button class="btn ${r.juego === 'billar' ? 'verde' : ''}" data-x="otra">Revancha</button>
        <button class="btn gris" data-x="compartir">Compartir resultado</button>
        <button class="btn gris" data-x="salir">Menú</button>`, true);
      v.querySelector('[data-x="otra"]').onclick = () => { cerrarHoja(); anuncio(); app.jugar(r.juego, r.opt); };
      v.querySelector('[data-x="salir"]').onclick = () => { cerrarHoja(); anuncio(); inicio(); };
      v.querySelector('[data-x="compartir"]').onclick = () => {
        const t = ICONO[r.juego] + ' ' + NOMBRE_J[r.juego] + ' · ' + resumen + '\nJuega tejo, billar, parqués y dominó en tu celular: Juegos de Colombia';
        try { if (N && N.share) N.share(t); else if (navigator.share) navigator.share({ text: t }); else OJ.toast(resumen); } catch (e) { /* */ }
      };
    }, 1300);
  };
  function anuncio() { try { if (N && N.adBreak && !app.premium) N.adBreak(); } catch (e) { /* */ } }

  /* ---------------- ajustes y premium ---------------- */
  function ajustes() {
    OJ.audio(); OJ.snd.toque();
    const v = abrirHoja(`<h2>Ajustes</h2>
      <div class="opc"><span>Sonido</span><button class="sw ${OJ.cfg.sonido ? 'on' : ''}" data-c="sonido" aria-label="Sonido"></button></div>
      <div class="opc"><span>Vibración</span><button class="sw ${OJ.cfg.vibrar ? 'on' : ''}" data-c="vibrar" aria-label="Vibración"></button></div>
      <h3>Tus partidas contra la máquina</h3>
      <div class="estad">${JUEGOS.map(x => `<div><span>${x[1]}</span><b>${stats[x[0]].g}</b><small>ganadas</small><b>${stats[x[0]].p}</b><small>perdidas</small></div>`).join('')}</div>
      ${app.premium ? '<button class="btn gris" data-x="sub">Administrar suscripción</button>' : '<button class="btn" data-x="premium">★ Quitar anuncios</button>'}
      <button class="btn gris" data-x="politica">Política de privacidad</button>
      <button class="btn gris" data-x="cerrar">Cerrar</button>`);
    interruptores(v);
    const b = (x, f) => { const e = v.querySelector('[data-x="' + x + '"]'); if (e) e.onclick = f; };
    b('cerrar', cerrarHoja); b('premium', premium);
    b('sub', () => { try { N && N.manageSubscription && N.manageSubscription(); } catch (e) { /* */ } });
    b('politica', () => { try { if (N && N.openUrl) N.openUrl(POLITICA); else window.open(POLITICA, '_blank'); } catch (e) { /* */ } });
    v.addEventListener('click', e => { if (e.target === v) cerrarHoja(); });
  }
  function premium() {
    const v = abrirHoja(`<h2>Juega sin anuncios</h2><p>Con Premium quitas todos los anuncios y apoyas que sigamos haciendo juegos colombianos.</p>
      <div class="reglas"><b>${app.precio || '$9.000 COP al mes'}</b><br>Se renueva cada mes. Puedes cancelar cuando quieras desde Google Play.</div>
      <button class="btn" data-x="comprar">Quitar anuncios</button><button class="btn gris" data-x="cerrar">Ahora no</button>`);
    v.querySelector('[data-x="comprar"]').onclick = () => { try { if (N && N.buyPremium) N.buyPremium(); else OJ.toast('Disponible en la app de Google Play'); } catch (e) { /* */ } cerrarHoja(); };
    v.querySelector('[data-x="cerrar"]').onclick = cerrarHoja;
    v.addEventListener('click', e => { if (e.target === v) cerrarHoja(); });
  }

  /* ---------------- botón atrás de Android ---------------- */
  window.orbeBack = function () {
    if (hoja) { cerrarHoja(); return true; }
    if (app.pantalla !== 'inicio') { if (OJ.juego && OJ.juego.st && OJ.juego.st.fin) inicio(); else app.pausa(OJ.juego); return true; }
    return false;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.pantalla !== 'inicio' && !hoja && OJ.juego && !(OJ.juego.st && OJ.juego.st.fin)) app.pausa(OJ.juego); });

  /* ---------------- arranque ---------------- */
  function arrancar() {
    OJ.iniciar();
    const q = OJ.Q.get('juego');
    if (prefs[q] && NOMBRE_J[q]) {
      const o = Object.assign({}, prefs[q]);
      ['modo', 'rival', 'reglas'].forEach(k => { if (OJ.Q.get(k)) o[k] = OJ.Q.get(k); });
      ['dif', 'meta', 'n'].forEach(k => { if (OJ.Q.get(k)) o[k] = +OJ.Q.get(k); });
      if (OJ.Q.has('demo')) o.demo = true;
      app.jugar(q, o);
    } else inicio();
    const s = document.getElementById('splash'); s.classList.add('fuera'); setTimeout(() => s.remove(), 600);
    window.__listo = true;
  }
  const fuentes = document.fonts ? Promise.all([document.fonts.load('800 60px "Baloo 2"'), document.fonts.load('900 20px Nunito')]) : Promise.resolve();
  Promise.race([fuentes, new Promise(r => setTimeout(r, 1800))]).catch(() => { }).then(arrancar);
})();
