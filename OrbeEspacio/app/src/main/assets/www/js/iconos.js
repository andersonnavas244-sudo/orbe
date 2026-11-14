/* Orbe Espacio – iconos vectoriales (nítidos en pantallas 4K a cualquier tamaño) */
(() => {
  'use strict';

  // Degradados compartidos (en un SVG visible de tamaño 0, así funcionan en todo el documento)
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="g-tab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cf4ff"/><stop offset=".55" stop-color="#7b8cff"/><stop offset="1" stop-color="#c77dff"/></linearGradient>
    <linearGradient id="g-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c66b"/><stop offset=".5" stop-color="#b9781f"/><stop offset="1" stop-color="#6b420c"/></linearGradient>
    <linearGradient id="g-panel-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb4ff"/><stop offset=".5" stop-color="#2e5fd6"/><stop offset="1" stop-color="#16306e"/></linearGradient>
    <linearGradient id="g-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d5dbe6"/><stop offset="1" stop-color="#7d8799"/></linearGradient>
    <radialGradient id="g-glow"><stop offset="0" stop-color="rgba(255,214,120,.55)"/><stop offset="1" stop-color="rgba(255,214,120,0)"/></radialGradient>
    <radialGradient id="g-glow-b"><stop offset="0" stop-color="rgba(120,170,255,.55)"/><stop offset="1" stop-color="rgba(120,170,255,0)"/></radialGradient>
    <pattern id="p-cells" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><path d="M2.4 0V2.4H0" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".35"/></pattern>
  </defs></svg>`;

  const svg = (body, vb = '0 0 24 24', extra = '') => `<svg viewBox="${vb}" ${extra} aria-hidden="true">${body}</svg>`;

  const G = {
    mapa: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 0 0-6.9 12h3.4l1-2.2a2 2 0 0 1 .4-2.8l1.4-1c.4-.3.6-.7.6-1.2V6.5A2 2 0 0 1 14 4.3 8 8 0 0 0 12 4Zm5.5 2.2-1.5.8v2.5a3 3 0 0 1-1.3 2.4l-1.4 1 .4 1.1h2.8l1.4 2.4a8 8 0 0 0-.4-10.2Z"/>',
    sats: '<g transform="rotate(-45 12 12)"><rect x="9.4" y="8.6" width="5.2" height="6.8" rx="1.2"/><rect x="1.4" y="9.6" width="7" height="4.8" rx=".7"/><rect x="15.6" y="9.6" width="7" height="4.8" rx=".7"/><rect x="11.4" y="15.4" width="1.2" height="2.6"/><path d="M9.6 20.6a2.4 2.4 0 0 1 4.8 0z"/></g>',
    pasos: '<path d="M2.6 13.7 15.4 6.2l2.1 3.6-12.8 7.5z"/><path d="m16.3 4.8 2.6-1.5 2.9 5-2.6 1.5z"/><path d="M9.8 15.2 7 21.4h2.2l1.9-4.2 1.9 4.2h2.2l-2.9-6.4z"/><circle cx="6" cy="5" r="1.3"/><circle cx="10.5" cy="2.8" r=".9"/>',
    lanz: '<path fill-rule="evenodd" d="M12 1.8c3 2.2 4.6 5.6 4.6 9.6v3.3l2.3 2.7V20l-3.7-1.6H8.8L5.1 20v-2.6l2.3-2.7v-3.3C7.4 7.4 9 4 12 1.8Zm0 6.3a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"/><path d="M10.3 19.3h3.4L12 22.8z"/>',
    astro: '<path fill-rule="evenodd" d="M12 2.4a8.2 8.2 0 0 1 8.2 8.2V15a3 3 0 0 1-3 3h-.7l.7 3.6H6.8l.7-3.6h-.7a3 3 0 0 1-3-3v-4.4A8.2 8.2 0 0 1 12 2.4ZM7.6 8.4A1.6 1.6 0 0 0 6 10v2.6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10a1.6 1.6 0 0 0-1.6-1.6z"/><path d="M8.6 9.8h3.2l-2.8 3.4H8.4a.9.9 0 0 1-.9-.9v-1.4c0-.6.5-1.1 1.1-1.1z" opacity=".55"/>',
    search: '<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.5 1.5-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/>',
    menu: '<path d="M3 6h11v2H3zm16 0h2v2h-2zM3 16h2v2H3zm7 0h11v2H10zM3 11h6v2H3zm11 0h7v2h-7z"/><circle cx="16.5" cy="7" r="2.5"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="11.5" cy="12" r="2.5"/>',
    close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>',
    follow: '<path fill-rule="evenodd" d="M12 2a1 1 0 0 1 1 1v1.1A8 8 0 0 1 19.9 11H21a1 1 0 1 1 0 2h-1.1A8 8 0 0 1 13 19.9V21a1 1 0 1 1-2 0v-1.1A8 8 0 0 1 4.1 13H3a1 1 0 1 1 0-2h1.1A8 8 0 0 1 11 4.1V3a1 1 0 0 1 1-1Zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/>',
    orbit: '<path fill-rule="evenodd" d="M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm9.6-2.1c1.2 1.2.4 3.9-1.8 7.1l-1.6-1.2c1.5-2.2 2-3.8 1.9-4.4-.6-.2-2.3.3-4.6 1.9l-1.2-1.6c3.3-2.3 6.1-3 7.3-1.8ZM3.6 12.5l1.6 1.2c-1.5 2.2-2 3.8-1.9 4.4.6.2 2.3-.3 4.6-1.9l1.2 1.6c-3.3 2.3-6.1 3-7.3 1.8s-.4-3.9 1.8-7.1Z"/>',
    share: '<path d="M18 16a3 3 0 0 0-2.2 1l-7-4a3 3 0 0 0 0-2l7-4A3 3 0 1 0 15 5l-7 4a3 3 0 1 0 0 6l7 4a3 3 0 1 0 3-3Z"/>',
    bell: '<path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/>',
    pin: '<path fill-rule="evenodd" d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7Zm0 4.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    clock: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.6l3.4 2-1 1.7L11 12.7V7z"/>',
    star: '<path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/>',
    gps: '<path fill-rule="evenodd" d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm1-6v2.1A8 8 0 0 1 19.9 11H22v2h-2.1A8 8 0 0 1 13 19.9V22h-2v-2.1A8 8 0 0 1 4.1 13H2v-2h2.1A8 8 0 0 1 11 4.1V2zm-1 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/>'
  };

  // Glifos de cada tipo de satélite
  const CAT = {
    est: '<rect x="1.5" y="11" width="21" height="2" rx=".6"/><rect x="2.5" y="3.5" width="3.2" height="6.4" rx=".3"/><rect x="6.6" y="3.5" width="3.2" height="6.4" rx=".3"/><rect x="14.2" y="3.5" width="3.2" height="6.4" rx=".3"/><rect x="18.3" y="3.5" width="3.2" height="6.4" rx=".3"/><rect x="2.5" y="14.1" width="3.2" height="6.4" rx=".3"/><rect x="6.6" y="14.1" width="3.2" height="6.4" rx=".3"/><rect x="14.2" y="14.1" width="3.2" height="6.4" rx=".3"/><rect x="18.3" y="14.1" width="3.2" height="6.4" rx=".3"/><rect x="10.4" y="7.4" width="3.2" height="9.2" rx="1.2"/>',
    starlink: '<g transform="rotate(-28 12 12)"><rect x="2" y="10.2" width="20" height="4.6" rx=".9"/><rect x="8.5" y="7.4" width="7" height="2.2" rx=".6"/></g><circle cx="4" cy="4.5" r="1.1"/><circle cx="8" cy="3" r=".8"/><circle cx="20" cy="19.5" r="1.1"/>',
    net: '<path d="M3.8 8a11.6 11.6 0 0 1 16.4 0l-1.5 1.5a9.4 9.4 0 0 0-13.4 0z"/><path d="M6.8 11a7.4 7.4 0 0 1 10.4 0l-1.5 1.5a5.3 5.3 0 0 0-7.4 0z"/><circle cx="12" cy="16" r="2.4"/><rect x="5" y="20" width="14" height="1.8" rx=".9"/>',
    nav: G.pin,
    clima: '<circle cx="8.4" cy="7.6" r="3.6"/><path d="M8.2 20.5a4.6 4.6 0 0 1-.7-9.2 6.2 6.2 0 0 1 11.7 1.6 3.9 3.9 0 0 1-.6 7.6z"/>',
    tierra: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 2.4a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Z"/>',
    ciencia: '<path d="M11 1.8l2.5 6.8 6.8 2.5-6.8 2.5L11 20.4l-2.5-6.8-6.8-2.5 6.8-2.5z"/><path d="M19 15.2l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z"/>',
    com: '<path d="M3.2 8.6 15.4 20.8A8.6 8.6 0 0 1 3.2 8.6Z"/><rect x="9.6" y="9.3" width="7.6" height="1.8" rx=".9" transform="rotate(-45 13.4 10.2)"/><circle cx="17.6" cy="6.4" r="2.2"/><rect x="6" y="20.4" width="8" height="1.8" rx=".9"/>',
    edu: '<path d="M12 3.5 1.5 8.8 12 14l8.6-4.3v6.1h1.9V8.8z"/><path d="M6 12.4v3.8c0 1.8 2.7 3.3 6 3.3s6-1.5 6-3.3v-3.8l-6 3z"/>',
    mil: '<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5z"/>',
    otros: G.sats,
    all: '<circle cx="12" cy="12" r="4.2"/><path fill-rule="evenodd" d="M12 3.5c5.8 0 10.5 2.6 10.5 5.8 0 1-.5 2-1.3 2.8l-1.5-1.2c.5-.5.8-1 .8-1.6 0-2-3.9-3.8-8.5-3.8S3.5 7.3 3.5 9.3c0 .6.3 1.1.8 1.6l-1.5 1.2C2 11.3 1.5 10.3 1.5 9.3c0-3.2 4.7-5.8 10.5-5.8Z"/><circle cx="20" cy="15" r="1.4"/><circle cx="4" cy="16.5" r="1"/>'
  };

  // Estación Espacial Internacional (vista de frente, 8 alas solares doradas)
  const ISS = svg(`
    <ellipse cx="50" cy="30" rx="48" ry="28" fill="url(#g-glow)"/>
    <rect x="6" y="28.4" width="88" height="3.2" rx="1" fill="url(#g-metal)"/>
    ${[8, 19.5, 69, 80.5].map(x => `
      <rect x="${x}" y="5" width="10.5" height="21" rx=".8" fill="url(#g-panel)" stroke="#2b1a04" stroke-width=".4"/>
      <rect x="${x}" y="5" width="10.5" height="21" rx=".8" fill="url(#p-cells)"/>
      <rect x="${x}" y="34" width="10.5" height="21" rx=".8" fill="url(#g-panel)" stroke="#2b1a04" stroke-width=".4"/>
      <rect x="${x}" y="34" width="10.5" height="21" rx=".8" fill="url(#p-cells)"/>
      <rect x="${x + 4.6}" y="26" width="1.3" height="8" fill="#c9d1de"/>`).join('')}
    <rect x="33" y="20" width="4" height="20" rx="1" fill="#f1f4f9" opacity=".9"/>
    <rect x="63" y="20" width="4" height="20" rx="1" fill="#f1f4f9" opacity=".9"/>
    <rect x="40" y="22" width="20" height="16" rx="4" fill="url(#g-metal)" stroke="#5d6676" stroke-width=".5"/>
    <rect x="47.5" y="10" width="5" height="40" rx="2.5" fill="url(#g-metal)" stroke="#5d6676" stroke-width=".5"/>
    <circle cx="50" cy="30" r="2.2" fill="#9fb2cc"/>`, '0 0 100 60');

  // Estación espacial china Tiangong (forma de T, alas azules)
  const CSS = svg(`
    <ellipse cx="50" cy="30" rx="48" ry="28" fill="url(#g-glow-b)"/>
    <rect x="8" y="22" width="30" height="9" rx="1" fill="url(#g-panel-b)" stroke="#0c1a3d" stroke-width=".4"/>
    <rect x="8" y="22" width="30" height="9" rx="1" fill="url(#p-cells)"/>
    <rect x="62" y="22" width="30" height="9" rx="1" fill="url(#g-panel-b)" stroke="#0c1a3d" stroke-width=".4"/>
    <rect x="62" y="22" width="30" height="9" rx="1" fill="url(#p-cells)"/>
    <rect x="38" y="25.5" width="24" height="2" fill="#c9d1de"/>
    <rect x="44" y="16" width="12" height="22" rx="5" fill="url(#g-metal)" stroke="#5d6676" stroke-width=".5"/>
    <rect x="47" y="36" width="6" height="18" rx="3" fill="url(#g-metal)" stroke="#5d6676" stroke-width=".5"/>
    <rect x="30" y="38" width="17" height="6" rx=".8" fill="url(#g-panel-b)"/><rect x="53" y="38" width="17" height="6" rx=".8" fill="url(#g-panel-b)"/>`, '0 0 100 60');

  const COLORS = {
    est: ['#ffd166', '#fff0c2', '#d48f12'], starlink: ['#6cb8ff', '#b9dcff', '#2563eb'], net: ['#a78bfa', '#ddd2ff', '#6d3fe6'],
    nav: ['#34e0a1', '#a8f7d9', '#0b9466'], clima: ['#ff9f43', '#ffd2a6', '#e05a0c'], tierra: ['#22d3ee', '#a5f3fc', '#0789a8'],
    ciencia: ['#ff6fb5', '#ffc4e1', '#d02a78'], com: ['#ff6b5f', '#ffc0b8', '#d23a2c'], edu: ['#c6f432', '#ecffb0', '#7fa80b'],
    mil: ['#b8c4d9', '#eef2f9', '#6e7c96'], otros: ['#8b96ad', '#d6dbe6', '#556079'], all: ['#7cf4ff', '#c9fbff', '#7b5cff']
  };

  window.OrbeIcons = {
    DEFS, COLORS,
    ui: name => svg(G[name] || G.sats),
    /** Icono "3D" de tipo de satélite: azulejo con degradado, brillo y sombra. */
    cat(cat, size = 44) {
      const c = COLORS[cat] || COLORS.otros;
      return `<span class="tile3d" style="--c:${c[0]};--c1:${c[1]};--c2:${c[2]};--s:${size}px">${svg(CAT[cat] || CAT.otros)}</span>`;
    },
    glyph: cat => svg(CAT[cat] || CAT.otros),
    iss: () => ISS,
    css: () => CSS
  };
})();
