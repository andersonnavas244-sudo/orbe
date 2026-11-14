#!/usr/bin/env node
/*
 * Genera app/src/main/assets/www/data/stations.json para Orbe TV: todos los canales de TV
 * gratuitos que se pueden ver, de dos listas abiertas:
 *   - iptv-org (https://github.com/iptv-org/iptv)  — canales, señales y logos
 *   - Free-TV/IPTV (https://github.com/Free-TV/IPTV) — canales gratuitos en abierto
 * Quita canales para adultos, cerrados y los que pidieron ser retirados (blocklist),
 * une duplicados y PRUEBA cada señal. Se quedan:
 *   - los que responden bien (ok=1)
 *   - los que el servidor niega desde aquí (403/451: suele ser bloqueo por país) marcados ok=0
 *
 *   node tools/build-catalog.js [ruta/a/stations.json de Orbe Radio para ubicar mejor]
 *   (sin esa ruta usa tools/anchors.json: puntos de referencia por país)
 */
const fs = require('fs');
const path = require('path');

const WWW = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const Genres = require(path.join(WWW, 'js', 'genres.js'));
const API = 'https://iptv-org.github.io/api/';
const FREETV = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 OrbeTV/1.0';
const CONCURRENCY = 96;
const TIMEOUT = 12000;
const CC_FIX = { UK: 'GB' };

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return r.text();
}

function parseM3U(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('#EXTINF')) continue;
    const attr = k => { const m = l.match(new RegExp(k + '="([^"]*)"')); return m ? m[1] : ''; };
    let j = i + 1;
    while (j < lines.length && (lines[j].startsWith('#') || !lines[j].trim())) j++;
    const url = (lines[j] || '').trim();
    const name = l.slice(l.lastIndexOf(',') + 1).replace(/[Ⓐ-ⓩ]/g, '').trim();
    out.push({ id: attr('tvg-id'), name, logo: attr('tvg-logo'), country: attr('tvg-country'), group: attr('group-title'), url,
      geo: /Ⓖ/.test(l) });
  }
  return out;
}

const playable = url => /^https?:\/\//i.test(url) && !/youtube\.com|youtu\.be|twitch\.tv|dailymotion\.com|facebook\.com/i.test(url);

// FNV-1a -> generador pseudoaleatorio determinista
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- prueba de señales ----------
async function check(s) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const headers = { 'User-Agent': s.ua || UA };
    if (s.ref) { headers.Referer = s.ref; headers.Origin = s.ref.replace(/\/$/, ''); }
    const res = await fetch(s.url, { headers, signal: ctl.signal, redirect: 'follow' });
    if (res.status === 403 || res.status === 451) { ctl.abort(); return 'geo'; }
    if (!res.ok) { ctl.abort(); return 'fail'; }
    const ct = res.headers.get('content-type') || '';
    const reader = res.body.getReader();
    const { value } = await reader.read();
    ctl.abort();
    const head = Buffer.from(value || []).toString('utf8', 0, 400);
    if (/\.m3u8?(\?|$)/i.test(s.url) || /mpegurl/i.test(ct)) return head.includes('#EXTM3U') ? 'ok' : 'fail';
    if (/\.mpd(\?|$)/i.test(s.url)) return head.includes('<MPD') ? 'ok' : 'fail';
    return /video|octet|mp2t|mpegurl/i.test(ct) ? 'ok' : 'fail';
  } catch (e) {
    return 'fail';
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, worker, onProgress) {
  let i = 0, done = 0;
  const run = async () => {
    while (i < items.length) {
      const k = i++;
      await worker(items[k]);
      done++;
      if (onProgress && done % 250 === 0) onProgress(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
}

(async () => {
  console.log('Descargando listas…');
  const [channels, streams, logos, blocklist, ftv] = await Promise.all([
    getJson(API + 'channels.json'), getJson(API + 'streams.json'), getJson(API + 'logos.json'),
    getJson(API + 'blocklist.json'), getText(FREETV)
  ]);
  const blocked = new Set(blocklist.map(b => b.channel));
  const logoOf = {};
  for (const l of logos) {
    if (!l.in_use || l.feed) continue;
    const cur = logoOf[l.channel];
    if (!cur || (l.width >= cur.width && l.width <= 600)) logoOf[l.channel] = l;
  }

  const map = new Map();
  for (const c of channels) {
    if (c.is_nsfw || c.closed || blocked.has(c.id)) continue;
    map.set(c.id, {
      id: c.id, name: c.name, alt: (c.alt_names || []).join(' '), cc: CC_FIX[c.country] || c.country,
      cats: c.categories || [], web: c.website || '', logo: logoOf[c.id] ? logoOf[c.id].url : '', streams: []
    });
  }
  const addStream = (ch, s) => { if (playable(s.url) && !ch.streams.some(x => x.url === s.url)) ch.streams.push(s); };
  for (const s of streams) {
    const ch = s.channel && map.get(s.channel);
    if (ch) addStream(ch, { url: s.url, ua: s.user_agent || '', ref: s.referrer || '', q: parseInt(s.quality) || 0 });
  }
  // Free-TV: suma señales a canales conocidos y canales nuevos
  const GROUP_CATS = { news: 'news', sports: 'sports', music: 'music', kids: 'kids', movies: 'movies', documentary: 'documentary' };
  let ftvNew = 0;
  for (const e of parseM3U(ftv)) {
    if (!playable(e.url) || /^VOD/i.test(e.group)) continue;
    let ch = e.id && map.get(e.id);
    if (!ch && e.id && (blocked.has(e.id))) continue;
    if (!ch) {
      const id = e.id || ('ftv:' + e.name);
      ch = map.get(id);
      if (!ch) {
        ch = { id, name: e.name, alt: '', cc: CC_FIX[e.country] || e.country || '', cats: GROUP_CATS[e.group.toLowerCase()] ? [GROUP_CATS[e.group.toLowerCase()]] : [],
          web: '', logo: e.logo, streams: [] };
        map.set(id, ch); ftvNew++;
      }
    }
    if (!ch.logo && e.logo) ch.logo = e.logo;
    addStream(ch, { url: e.url, ua: '', ref: '', q: 0, ftv: 1 });
  }
  const list = [...map.values()].filter(c => c.streams.length);
  list.forEach(c => c.streams.sort((a, b) => b.q - a.q));
  console.log(`  ${channels.length} canales en iptv-org, ${ftvNew} nuevos de Free-TV → ${list.length} con señal para probar.`);

  console.log('Probando señales (varios minutos)…');
  const t0 = Date.now();
  await pool(list, async ch => {
    ch.status = 'fail';
    for (const s of ch.streams.slice(0, 3)) {
      const r = await check(s);
      s.st = r;
      if (r === 'ok') { ch.status = 'ok'; break; }
      if (r === 'geo') ch.status = ch.status === 'ok' ? 'ok' : 'geo';
    }
    // las señales que funcionan van primero
    ch.streams.sort((a, b) => (b.st === 'ok') - (a.st === 'ok'));
  }, (d, n) => process.stdout.write(`\r  ${d}/${n} canales probados (${Math.round((Date.now() - t0) / 1000)} s)   `));
  process.stdout.write('\n');

  const keep = list.filter(c => c.status !== 'fail');
  const okN = keep.filter(c => c.status === 'ok').length;

  // ---------- ubicación en el globo ----------
  const geo = JSON.parse(fs.readFileSync(path.join(WWW, 'lib', 'countries.geojson'), 'utf8'));
  const shapes = {};
  for (const f of geo.features) {
    const p = f.properties;
    let cc = p.ISO_A2 !== '-99' ? p.ISO_A2 : ({ France: 'FR', Norway: 'NO', Kosovo: 'XK' })[p.ADMIN];
    if (!cc) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    for (const poly of polys) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    shapes[cc] = { polys, bbox: [x0, y0, x1, y1] };
  }
  // Anclas: coordenadas reales de emisoras de Orbe Radio (siguen la densidad de población)
  const anchors = {};
  const radioPath = process.argv[2] || path.join(__dirname, '..', '..', 'RadioOrbe', 'app', 'src', 'main', 'assets', 'www', 'data', 'stations.json');
  if (fs.existsSync(radioPath)) {
    const r = JSON.parse(fs.readFileSync(radioPath, 'utf8'));
    const F = Object.fromEntries(r.fields.map((f, i) => [f, i]));
    for (const row of r.rows) if (row[F.lat] !== null && !row[F.approx]) (anchors[row[F.cc]] = anchors[row[F.cc]] || []).push([row[F.lat], row[F.lng]]);
    console.log('  Ubicando con', Object.keys(anchors).length, 'países de referencia de Orbe Radio');
  }
  else if (fs.existsSync(path.join(__dirname, 'anchors.json'))) {
    // Puntos de referencia guardados (para la tarea semanal en GitHub, sin Orbe Radio al lado)
    Object.assign(anchors, JSON.parse(fs.readFileSync(path.join(__dirname, 'anchors.json'), 'utf8')));
    console.log('  Ubicando con', Object.keys(anchors).length, 'países de referencia (tools/anchors.json)');
  }
  for (const c of keep) {
    const rnd = seeded(c.id);
    const a = anchors[c.cc];
    c.lat = c.lng = null;
    if (a && a.length >= 3) {
      const p = a[Math.floor(rnd() * a.length)];
      c.lat = Math.max(-89, Math.min(89, p[0] + (rnd() - 0.5) * 0.7)); c.lng = p[1] + (rnd() - 0.5) * 0.7;
    } else if (shapes[c.cc]) {
      const { polys, bbox: [x0, y0, x1, y1] } = shapes[c.cc];
      for (let i = 0; i < 300 && c.lat === null; i++) {
        const lng = x0 + rnd() * (x1 - x0), lat = y0 + rnd() * (y1 - y0);
        if (polys.some(p => pointInRing(lng, lat, p[0]))) { c.lat = lat; c.lng = lng; }
      }
    } else if (a && a.length) {
      c.lat = a[0][0] + (rnd() - 0.5) * 0.4; c.lng = a[0][1] + (rnd() - 0.5) * 0.4;
    }
  }

  // ---------- salida compacta ----------
  const countryNames = {};
  try {
    const cs = await getJson(API + 'countries.json');
    for (const c of cs) countryNames[CC_FIX[c.code] || c.code] = c.name;
  } catch (e) { /* opcional */ }
  const r4 = n => n === null ? null : Math.round(n * 1e4) / 1e4;
  const FIELDS = ['id', 'name', 'url', 'lat', 'lng', 'approx', 'cc', 'genres', 'tags', 'codec', 'bitrate', 'hls', 'votes', 'favicon', 'lang', 'home', 'streams', 'ok', 'alt'];
  const rows = keep.map(c => {
    const { mask } = Genres.classify(c.cats, c.name);
    const best = c.streams.reduce((m, s) => Math.max(m, s.q || 0), 0);
    return [
      c.id, c.name.slice(0, 80), c.streams[0].url, r4(c.lat), r4(c.lng), 1, c.cc, mask,
      c.cats.join(', '), best ? best + 'p' : '', 0, 1, c.status === 'ok' ? 1 : 0, c.logo, '', c.web,
      c.streams.slice(0, 3).map(s => [s.url, s.ua || '', s.ref || '']), c.status === 'ok' ? 1 : 0, c.alt.slice(0, 80)
    ];
  });
  // Primero los que funcionan desde aquí, luego los limitados por país
  rows.sort((a, b) => b[17] - a[17]);
  const out = {
    v: 1, kind: 'tv', generated: new Date().toISOString(),
    source: 'iptv-org y Free-TV/IPTV (listas abiertas de canales gratuitos)',
    apiTotal: keep.length, fields: FIELDS, countries: countryNames, rows
  };
  const dest = path.join(WWW, 'data', 'stations.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log(`Listo: ${keep.length} canales (${okN} funcionan desde aquí, ${keep.length - okN} limitados a su país) en ` +
    `${new Set(keep.map(c => c.cc)).size} países → ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
  console.log(`  Descartados por no responder: ${list.length - keep.length}`);
})().catch(e => { console.error(e); process.exit(1); });
