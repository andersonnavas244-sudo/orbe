/*
 * Juegos de Colombia — menú, opciones de partida, pausa, final, ajustes y puente con Android.
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

  const stats = store.get('stats', { tejo: { g: 0, p: 0 }, billar: { g: 0, p: 0 } });
  const prefs = store.get('prefs', { tejo: { modo: 'ia', dif: 1, meta: 27 }, billar: { modo: 'libre', rival: 'ia', dif: 1, meta: 10 } });
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
      <div class="lema">Tejo y billar en 3D, para jugar con amigos</div>
      <div class="cards">
        <button class="card tejo" data-j="tejo"><div class="card-img" style="background-image:url(img/tejo.jpg)"></div>
          <div class="card-b"><div class="card-t">Tejo 3D</div><div class="card-s">Lanza el tejo y revienta las mechas</div><div class="card-e">${stats.tejo.g ? 'Ganadas: ' + stats.tejo.g : 'Mano · Mecha · Embocinada · Moñona'}</div></div><div class="card-go">▶</div></button>
        <button class="card billar" data-j="billar"><div class="card-img" style="background-image:url(img/billar.jpg)"></div>
          <div class="card-b"><div class="card-t">Billar 3D</div><div class="card-s">Carambola libre y a tres bandas</div><div class="card-e">${stats.billar.g ? 'Ganadas: ' + stats.billar.g : 'Con efecto, bandas y El Profe'}</div></div><div class="card-go">▶</div></button>
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
    return `<h3>${titulo}</h3><div class="seg" data-k="${clave}">` + ops.map(o => `<button data-v="${o[0]}" class="${String(o[0]) === String(val) ? 'on' : ''}">${o[1]}${o[2] ? '<small>' + o[2] + '</small>' : ''}</button>`).join('') + '</div>';
  }
  function opciones(j) {
    const p = prefs[j];
    const html = j === 'tejo' ? `
      <h2>Tejo 3D</h2><p>Lanza el tejo a la cancha de greda y revienta las mechas del bocín.</p>
      <div class="reglas"><b>Mecha 3</b> · revientas una mecha<br><b>Embocinada 6</b> · el tejo queda dentro del bocín<br><b>Moñona 9</b> · revientas la mecha y quedas en el bocín<br><b>Mano 1</b> · si nadie revienta, gana el tejo más cercano</div>
      ${segmento('Jugadores', 'modo', [['ia', '1 jugador', 'contra la máquina'], ['2j', '2 jugadores', 'en el mismo celular']], p.modo)}
      ${segmento('Dificultad', 'dif', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], p.dif)}
      ${segmento('Partida a', 'meta', [[9, '9', 'rápida'], [15, '15'], [27, '27', 'tradicional']], p.meta)}
      <button class="btn" data-x="jugar">Jugar</button>` : `
      <h2>Billar 3D</h2><p>Carambola en mesa sin troneras, como en los billares de Colombia.</p>
      <div class="reglas"><b>Libre</b> · tu bola debe tocar las otras dos<br><b>Tres bandas</b> · además toca 3 bandas antes de la segunda bola<br>Si haces carambola, sigues tacando.</div>
      ${segmento('Juego', 'modo', [['libre', 'Carambola libre', 'para empezar'], ['tres', 'Tres bandas', 'el clásico']], p.modo)}
      ${segmento('Jugadores', 'rival', [['ia', '1 jugador', 'contra El Profe'], ['2j', '2 jugadores', 'en el mismo celular']], p.rival)}
      ${segmento('Dificultad', 'dif', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], p.dif)}
      ${segmento('Partida a', 'meta', [[5, '5'], [10, '10'], [20, '20']], p.meta)}
      <button class="btn verde" data-x="jugar">Jugar</button>`;
    const v = abrirHoja(html + '<button class="btn gris" data-x="cerrar">Volver</button>');
    v.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => {
        const k = b.parentNode.dataset.k, val = b.dataset.v; p[k] = /^\d+$/.test(val) ? +val : val;
        b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); store.set('prefs', prefs); OJ.snd.toque();
      };
    });
    v.querySelector('[data-x="jugar"]').onclick = () => app.jugar(j, Object.assign({}, p));
    v.querySelector('[data-x="cerrar"]').onclick = cerrarHoja;
    v.addEventListener('click', e => { if (e.target === v) cerrarHoja(); });
  }
  app.opciones = opciones;
  app.jugar = function (j, opt) {
    limpiar(); app.pantalla = j; OJ.audio();
    OJ.setGame(j === 'tejo' ? OJ.Tejo(opt) : OJ.Billar(opt));
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
    const m = r.marcador;
    setTimeout(() => {
      const v = abrirHoja(`<div class="centro-t"><div class="final-copa">${r.gano === false ? '🎯' : '🏆'}</div><h2>${r.titulo}</h2>
        <div class="final-m"><div>${m[0][1]}<small>${m[0][0]}</small></div><div style="opacity:.5">–</div><div>${m[1][1]}<small>${m[1][0]}</small></div></div></div>
        <button class="btn ${r.juego === 'billar' ? 'verde' : ''}" data-x="otra">Revancha</button>
        <button class="btn gris" data-x="compartir">Compartir resultado</button>
        <button class="btn gris" data-x="salir">Menú</button>`, true);
      v.querySelector('[data-x="otra"]').onclick = () => { cerrarHoja(); anuncio(); app.jugar(r.juego, r.opt); };
      v.querySelector('[data-x="salir"]').onclick = () => { cerrarHoja(); anuncio(); inicio(); };
      v.querySelector('[data-x="compartir"]').onclick = () => {
        const t = (r.juego === 'tejo' ? '🎯 Tejo 3D' : '🎱 Billar 3D') + ' · ' + m[0][0] + ' ' + m[0][1] + ' – ' + m[1][1] + ' ' + m[1][0] + '\nJuega tejo y billar colombianos en tu celular: Juegos de Colombia';
        try { if (N && N.share) N.share(t); else if (navigator.share) navigator.share({ text: t }); else OJ.toast('Resultado: ' + m[0][1] + ' – ' + m[1][1]); } catch (e) { /* */ }
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
      <div class="opc"><span>Tejo: ganadas ${stats.tejo.g} · perdidas ${stats.tejo.p}</span></div>
      <div class="opc"><span>Billar: ganadas ${stats.billar.g} · perdidas ${stats.billar.p}</span></div>
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
    if (q === 'tejo' || q === 'billar') {
      const o = Object.assign({}, prefs[q]);
      ['modo', 'rival'].forEach(k => { if (OJ.Q.get(k)) o[k] = OJ.Q.get(k); });
      ['dif', 'meta'].forEach(k => { if (OJ.Q.get(k)) o[k] = +OJ.Q.get(k); });
      app.jugar(q, o);
    } else inicio();
    const s = document.getElementById('splash'); s.classList.add('fuera'); setTimeout(() => s.remove(), 600);
    window.__listo = true;
  }
  const fuentes = document.fonts ? Promise.all([document.fonts.load('800 60px "Baloo 2"'), document.fonts.load('900 20px Nunito')]) : Promise.resolve();
  Promise.race([fuentes, new Promise(r => setTimeout(r, 1800))]).catch(() => { }).then(arrancar);
})();
