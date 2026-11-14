/* Categorías de canales de TV (a partir de las categorías de iptv-org).
   Misma interfaz que en Orbe Radio (window.Genres) para reutilizar la app.
   Se usa en la app y en tools/build-catalog.js (Node). */
(function (root) {
  // El orden importa: la primera categoría que coincide es la "principal" (color del punto).
  const GENRES = [
    { id: 'kids',        label: 'Infantiles',     color: '#9be15d', src: ['kids', 'animation', 'family'] },
    { id: 'sports',      label: 'Deportes',       color: '#ff8a3d', src: ['sports', 'outdoor', 'auto'] },
    { id: 'news',        label: 'Noticias',       color: '#e8eef7', src: ['news', 'legislative', 'weather', 'business'] },
    { id: 'music',       label: 'Música',         color: '#ff4fa3', src: ['music'] },
    { id: 'movies',      label: 'Películas',      color: '#c9a7ff', src: ['movies', 'classic'] },
    { id: 'series',      label: 'Series',         color: '#ffb000', src: ['series', 'comedy'] },
    { id: 'documentary', label: 'Documentales',   color: '#4dd0a7', src: ['documentary', 'science', 'education', 'culture', 'travel'] },
    { id: 'religious',   label: 'Religiosos',     color: '#f5d76e', src: ['religious'] },
    { id: 'entertainment', label: 'Entretenimiento', color: '#ff7ce5', src: ['entertainment', 'lifestyle', 'cooking', 'shop', 'relax', 'interactive'] },
    { id: 'general',     label: 'Generalistas',   color: '#22d3ee', src: ['general', 'public'] }
  ];
  const OTHER = { id: 'other', label: 'Otros', color: '#8fa3bf' };

  // Palabras del nombre o grupo de Free-TV que ayudan cuando no hay categoría.
  const HINTS = [
    [/kid|child|infantil|cartoon|niñ|junior|toon/i, 0],
    [/sport|deport|fútbol|futbol|football|soccer|racing|golf|tennis|nba|nfl/i, 1],
    [/news|noticia|info|24h|parlament|congres|senado|weather|clima/i, 2],
    [/music|música|musica|hits|mtv|radio|fm\b/i, 3],
    [/movie|cine|film|película|pelicula/i, 4],
    [/series|novela|comedy|comedia/i, 5],
    [/docu|science|history|histor|nature|natura|discovery|educa|cultur/i, 6],
    [/church|christ|gospel|cathol|islam|quran|iglesia|evangel|dios|god\b|bible|biblia/i, 7]
  ];

  function classify(categories, name) {
    let mask = 0;
    const cats = (categories || []).map(c => String(c).toLowerCase());
    GENRES.forEach((g, i) => { if (g.src.some(s => cats.includes(s))) mask |= (1 << i); });
    if (!mask && name) for (const [re, i] of HINTS) if (re.test(name)) mask |= (1 << i);
    return { mask, primary: primaryFromMask(mask) };
  }

  function primaryFromMask(mask) {
    if (!mask) return -1;
    for (let i = 0; i < GENRES.length; i++) if (mask & (1 << i)) return i;
    return -1;
  }

  const api = { GENRES, OTHER, classify, primaryFromMask };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Genres = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
