/*
 * Juegos de Colombia — piezas de interfaz para los juegos de mesa (parqués y dominó):
 * avatares ilustrados (emoji sobre un círculo de color), globitos de charla, frases rápidas y emojis,
 * y el reloj de turno. Solo HTML/CSS: no toca el 3D.
 */
(function () {
  'use strict';
  OJ.FRASES = [['¡Buena!', '¡Buena!'], ['¡Paso!', '¡Paso!'], ['¡Dale!', '¡Dale!'], ['Gracias', 'Gracias por la partida']];
  OJ.EMOJIS = ['😀', '😂', '😮', '😎', '😡', '👏', '🔥', '🙏'];

  /* avatar redondo: un emoji ilustrado sobre el color del jugador */
  OJ.avatar = (cara, color, cls) => `<span class="av ${cls || ''}" style="--c:${color}"><span>${cara}</span></span>`;

  /* globito de charla pegado a un elemento (el elemento debe tener position) */
  OJ.globo = function (el, texto) {
    if (!el) return;
    let g = el.querySelector(':scope > .globo');
    if (!g) { g = OJ.el('div', 'globo'); el.appendChild(g); }
    g.textContent = texto; g.classList.toggle('emoji', /^\p{Extended_Pictographic}+$/u.test(texto));
    g.classList.remove('on'); void g.offsetWidth; g.classList.add('on');
    clearTimeout(g._t); g._t = setTimeout(() => g.classList.remove('on'), 2400);
  };

  /* barra de frases rápidas: 'fila' (siempre visible) o 'boton' (un botón 💬 que abre las opciones) */
  OJ.charla = function (modo, decir) {
    let espera = 0;
    const caja = OJ.el('div', 'charla ' + modo);
    const frases = OJ.FRASES.map(f => `<button data-t="${f[1]}">${f[0]}</button>`).join(''), emojis = OJ.EMOJIS.map(e => `<button class="em" data-t="${e}">${e}</button>`).join('');
    if (modo === 'fila') caja.innerHTML = `<div class="ch-l" data-l="f">${frases}</div><div class="ch-l oculto" data-l="e">${emojis}</div><button class="ch-sw" aria-label="Emojis">😀</button>`;
    else caja.innerHTML = `<button class="ch-abre" aria-label="Frases y emojis">💬</button><div class="ch-pop oculto"><div class="ch-l">${frases}</div><div class="ch-l">${emojis}</div></div>`;
    const sw = caja.querySelector('.ch-sw'), abre = caja.querySelector('.ch-abre'), pop = caja.querySelector('.ch-pop');
    if (sw) sw.onclick = () => { const f = caja.querySelector('[data-l="f"]'), e = caja.querySelector('[data-l="e"]'), ver = e.classList.contains('oculto'); e.classList.toggle('oculto', !ver); f.classList.toggle('oculto', ver); sw.textContent = ver ? 'Aa' : '😀'; OJ.snd.toque(); };
    if (abre) abre.onclick = () => { pop.classList.toggle('oculto'); OJ.snd.toque(); };
    caja.querySelectorAll('[data-t]').forEach(b => {
      b.onclick = () => {
        const ahora = performance.now(); if (ahora < espera) return; espera = ahora + 1500;
        if (pop) pop.classList.add('oculto');
        OJ.snd.toque(); decir(b.dataset.t);
      };
    });
    caja.cerrar = () => { if (pop) pop.classList.add('oculto'); };
    return caja;
  };

  /* lo que dicen las máquinas según lo que pasa (no siempre hablan) */
  const DICHOS = {
    bien: ['¡Buena!', '🔥', '😎', '¡Dale!', '👏'], mal: ['😮', '😡', '🙏', '¡Uy!'], paso: ['¡Paso!', '😅', '🙏'],
    gana: ['¡Dale!', '😎', '🔥'], fin: ['Gracias por la partida', '👏', 'Gracias por la partida'], saludo: ['¡Dale!', '😀', '¡Buena suerte!']
  };
  OJ.dicho = (tipo, prob) => (Math.random() < (prob == null ? 0.35 : prob) ? DICHOS[tipo][Math.floor(Math.random() * DICHOS[tipo].length)] : null);
})();
