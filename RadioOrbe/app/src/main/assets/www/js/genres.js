/* Clasificación de géneros a partir de las etiquetas de Radio Browser.
   Se usa en la app (navegador / WebView) y en tools/build-catalog.js (Node). */
(function (root) {
  // El orden importa: el primer género que coincide es el "principal" (color del punto).
  const GENRES = [
    { id: 'religion',   label: 'Religiosa',    color: '#f5d76e', re: /christ|gospel|cathol|religi|worship|church|islam|quran|coran|bible|biblia|cristian|evangel|iglesia|kirche|sermon|praise|devotion|bhajan|spiritual/ },
    { id: 'sports',     label: 'Deportes',     color: '#ff8a3d', re: /sport|deporte|futbol|fútbol|football|soccer|cricket|baseball|basketball/ },
    { id: 'news',       label: 'Noticias',     color: '#e8eef7', re: /news|noticia|talk|informa|public radio|politic|nachricht|actualit|journal|hablad|community|comunitar|culture|cultura|education/ },
    { id: 'classical',  label: 'Clásica',      color: '#c9a7ff', re: /classical|clásica|clasica|klassik|classique|opera|ópera|orchestr|baroque|barroc|symphon|sinfon|chamber|piano/ },
    { id: 'metal',      label: 'Metal',        color: '#ff3b3b', re: /metal|hardcore|grindcore|thrash/ },
    { id: 'latin',      label: 'Latina',       color: '#ff4fa3', re: /latin|salsa|reggaeton|reguet|cumbia|bachata|merengue|vallenato|ranchera|regional mex|mariachi|tropical|banda|norteñ|norten|tango|bolero|samba|sertanej|forró|forro|pagode|mpb|axé|bossa|urbano|corrido/ },
    { id: 'hiphop',     label: 'Hip-Hop / R&B',color: '#ffb000', re: /hip ?hop|rap\b|rap |r&b|rnb|r'n'b|urban|trap|grime|drill/ },
    { id: 'electronic', label: 'Electrónica',  color: '#00e5ff', re: /electr|dance|house|techno|trance|edm|club|dubstep|drum and bass|drum&bass|dnb|d&b|breakbeat|disco|synth|hardstyle|psy|eurodance|minimal/ },
    { id: 'jazz',       label: 'Jazz / Blues', color: '#4dd0a7', re: /jazz|blues|swing|soul|funk|motown|big band|bebop/ },
    { id: 'country',    label: 'Country / Folk', color: '#d4a373', re: /country|folk|bluegrass|americana|traditional|tradicional|folklor|celtic|schlager|volksmusik|polka|flamenco|fado|chanson/ },
    { id: 'chill',      label: 'Chill / Lounge', color: '#7fb3ff', re: /chill|lounge|ambient|lo-?fi|relax|easy listening|smooth|meditat|sleep|spa\b|new age|downtempo|instrumental|nature/ },
    { id: 'rock',       label: 'Rock',         color: '#ff6b4a', re: /rock|alternative|alternativ|indie|punk|grunge|britpop|garage|emo/ },
    { id: 'oldies',     label: 'Clásicos / Retro', color: '#b38b6d', re: /oldies|retro|classic hits|\b[5-9]0'?s\b|\b[5-9]0er|años [5-9]0|anni [5-9]0|décadas|decades|vintage|nostalg|evergreen|goldies/ },
    { id: 'pop',        label: 'Pop / Éxitos', color: '#ff7ce5', re: /pop|top ?40|hits|chart|chr\b|mainstream|adult contemporary|\bac\b|kpop|k-pop|jpop|j-pop|variety|variedad|music|música|musica/ },
    { id: 'world',      label: 'Mundo / Étnica', color: '#9be15d', re: /world|ethnic|étnic|african|afro|reggae|dancehall|ska|arab|oriental|bollywood|indian|hindi|desi|turk|greek|persian|kurd|balkan|asian|chinese|japan|korea|bhangra|highlife|bongo|zouk|kompa/ }
  ];
  const OTHER = { id: 'other', label: 'Otras', color: '#8fa3bf' };

  function classify(tagString, name) {
    const text = ((tagString || '') + ' ' + (name || '')).toLowerCase();
    let mask = 0, primary = -1;
    for (let i = 0; i < GENRES.length; i++) {
      if (GENRES[i].re.test(text)) {
        mask |= (1 << i);
        if (primary < 0) primary = i;
      }
    }
    // La etiqueta genérica "music" no debe ganarle a un género específico.
    return { mask, primary };
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
