#!/usr/bin/env node
/*
 * Datos fijos de Orbe Sismos (se incluyen en la app):
 *   data/volcanes.json   1.200+ volcanes del Holoceno (Smithsonian GVP)
 *   data/historicos.json terremotos más grandes desde 1900 (USGS): mundo M8+ y Latinoamérica M7+
 *   data/radios.json     emisoras de noticias por país (del catálogo de Orbe Radio)
 *   data/lugares.json    ciudades para elegir tu ubicación y números de emergencia por país
 * Los sismos, tsunamis, volcanes activos y noticias se piden EN VIVO desde la app.
 *
 *   node tools/build-data.js
 */
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www', 'data');
const RADIO = path.join(__dirname, '..', '..', 'RadioOrbe', 'app', 'src', 'main', 'assets', 'www', 'data', 'stations.json');
const UA = { 'User-Agent': 'OrbeSismos/1.0 (datos públicos)' };
const r2 = n => Math.round(n * 100) / 100;
const save = (name, obj) => {
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(obj));
  console.log('  ->', name, (fs.statSync(path.join(DATA, name)).size / 1024).toFixed(0), 'KB');
};
async function json(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
  return r.json();
}

// Países de habla hispana (y vecinos) para radios y números de emergencia
const LATAM = ['CO', 'MX', 'AR', 'CL', 'PE', 'EC', 'VE', 'BO', 'PY', 'UY', 'CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'DO', 'CU', 'PR', 'ES', 'US', 'BR'];

// Números de emergencia (verificados en fuentes oficiales; la app recuerda confirmarlos localmente)
const EMERGENCIAS = {
  CO: [['Línea única de emergencias', '123'], ['Cruz Roja', '132'], ['Defensa Civil', '144'], ['Bomberos', '119']],
  MX: [['Emergencias', '911'], ['Cruz Roja', '065']],
  AR: [['Emergencias', '911'], ['Ambulancia (SAME)', '107'], ['Bomberos', '100'], ['Defensa Civil', '103']],
  CL: [['Ambulancia (SAMU)', '131'], ['Bomberos', '132'], ['Carabineros', '133']],
  PE: [['Policía', '105'], ['Bomberos', '116'], ['Ambulancia (SAMU)', '106']],
  EC: [['ECU 911', '911']],
  VE: [['VEN 911', '911']],
  BO: [['Policía', '110'], ['Bomberos', '119'], ['Ambulancia', '118']],
  PY: [['Emergencias', '911']],
  UY: [['Emergencias', '911']],
  CR: [['Emergencias', '911']],
  PA: [['Emergencias', '911']],
  GT: [['Policía', '110'], ['Bomberos', '122'], ['Cruz Roja', '125']],
  SV: [['Emergencias', '911']],
  HN: [['Emergencias', '911']],
  NI: [['Policía', '118'], ['Bomberos', '115'], ['Cruz Roja', '128']],
  DO: [['Emergencias', '911']],
  CU: [['Ambulancia', '104'], ['Bomberos', '105'], ['Policía', '106']],
  PR: [['Emergencias', '911']],
  ES: [['Emergencias', '112']],
  US: [['Emergencias', '911']],
  BR: [['SAMU', '192'], ['Bombeiros', '193'], ['Defesa Civil', '199']],
};

// Ciudades principales (para elegir la ubicación sin GPS)
const CIUDADES = [
  ['Bogotá', 'CO', 4.711, -74.072], ['Medellín', 'CO', 6.244, -75.581], ['Cali', 'CO', 3.452, -76.532],
  ['Barranquilla', 'CO', 10.964, -74.796], ['Cartagena', 'CO', 10.391, -75.479], ['Bucaramanga', 'CO', 7.119, -73.122],
  ['Pereira', 'CO', 4.813, -75.696], ['Manizales', 'CO', 5.070, -75.517], ['Armenia', 'CO', 4.534, -75.681],
  ['Cúcuta', 'CO', 7.893, -72.508], ['Ibagué', 'CO', 4.438, -75.232], ['Pasto', 'CO', 1.213, -77.281],
  ['Popayán', 'CO', 2.444, -76.614], ['Neiva', 'CO', 2.927, -75.282], ['Villavicencio', 'CO', 4.142, -73.627],
  ['Santa Marta', 'CO', 11.241, -74.199], ['Tumaco', 'CO', 1.807, -78.765], ['Buenaventura', 'CO', 3.883, -77.031],
  ['Ciudad de México', 'MX', 19.433, -99.133], ['Guadalajara', 'MX', 20.659, -103.349], ['Monterrey', 'MX', 25.686, -100.316],
  ['Acapulco', 'MX', 16.853, -99.882], ['Oaxaca', 'MX', 17.073, -96.726],
  ['Buenos Aires', 'AR', -34.604, -58.382], ['Mendoza', 'AR', -32.889, -68.845], ['San Juan', 'AR', -31.537, -68.537],
  ['Salta', 'AR', -24.782, -65.423],
  ['Santiago', 'CL', -33.449, -70.669], ['Valparaíso', 'CL', -33.047, -71.613], ['Concepción', 'CL', -36.827, -73.050],
  ['Antofagasta', 'CL', -23.650, -70.400], ['Arica', 'CL', -18.479, -70.312],
  ['Lima', 'PE', -12.046, -77.043], ['Arequipa', 'PE', -16.409, -71.537], ['Trujillo', 'PE', -8.112, -79.029],
  ['Quito', 'EC', -0.181, -78.468], ['Guayaquil', 'EC', -2.170, -79.922], ['Manta', 'EC', -0.967, -80.709],
  ['Caracas', 'VE', 10.481, -66.904], ['Maracaibo', 'VE', 10.654, -71.645], ['Mérida', 'VE', 8.590, -71.144],
  ['La Paz', 'BO', -16.490, -68.119], ['Santa Cruz', 'BO', -17.784, -63.181], ['Asunción', 'PY', -25.264, -57.576],
  ['Montevideo', 'UY', -34.901, -56.164], ['San José', 'CR', 9.928, -84.091], ['Ciudad de Panamá', 'PA', 8.983, -79.517],
  ['Ciudad de Guatemala', 'GT', 14.634, -90.507], ['San Salvador', 'SV', 13.692, -89.218], ['Tegucigalpa', 'HN', 14.072, -87.192],
  ['Managua', 'NI', 12.115, -86.236], ['Santo Domingo', 'DO', 18.486, -69.931], ['La Habana', 'CU', 23.113, -82.366],
  ['San Juan (PR)', 'PR', 18.466, -66.106], ['Madrid', 'ES', 40.417, -3.704], ['Barcelona', 'ES', 41.385, 2.173],
  ['Granada', 'ES', 37.177, -3.599], ['Miami', 'US', 25.762, -80.192], ['Los Ángeles', 'US', 34.052, -118.244],
  ['Nueva York', 'US', 40.713, -74.006], ['São Paulo', 'BR', -23.551, -46.633],
];

(async () => {
  fs.mkdirSync(DATA, { recursive: true });

  console.log('Volcanes (Smithsonian GVP)…');
  const gvp = await json('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json');
  const volc = gvp.features.filter(f => f.geometry && f.geometry.coordinates).map(f => {
    const p = f.properties, [lon, lat] = f.geometry.coordinates;
    return [p.Volcano_Number, p.Volcano_Name, p.Country, r2(lat), r2(lon), p.Primary_Volcano_Type || '', p.Last_Eruption_Year ?? null, p.Elevation ?? null];
  });
  save('volcanes.json', { fields: ['id', 'name', 'country', 'lat', 'lon', 'type', 'lastEruption', 'elevation'], rows: volc });

  console.log('Terremotos históricos (USGS)…');
  const q = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=magnitude&starttime=1900-01-01';
  const world = await json(q + '&minmagnitude=8.3&limit=40');
  const latam = await json(q + '&minmagnitude=7&minlatitude=-56&maxlatitude=33&minlongitude=-118&maxlongitude=-34&limit=80');
  const seen = new Set();
  const hist = [];
  for (const f of [...world.features, ...latam.features]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const p = f.properties, [lon, lat, depth] = f.geometry.coordinates;
    hist.push([f.id, p.time, p.mag, r2(lat), r2(lon), Math.round(depth || 0), p.place || '', p.tsunami || 0]);
  }
  hist.sort((a, b) => b[2] - a[2]);
  save('historicos.json', { fields: ['id', 'time', 'mag', 'lat', 'lon', 'depth', 'place', 'tsunami'], rows: hist });

  console.log('Radios de noticias (Orbe Radio)…');
  const rad = JSON.parse(fs.readFileSync(RADIO, 'utf8'));
  const F = Object.fromEntries(rad.fields.map((f, i) => [f, i]));
  const NEWS_BIT = 1 << 2;   // "Noticias" en los géneros de Orbe Radio
  const byCc = {};
  for (const r of rad.rows) {
    const cc = r[F.cc];
    if (!LATAM.includes(cc) || !(r[F.genres] & NEWS_BIT)) continue;
    (byCc[cc] = byCc[cc] || []).push(r);
  }
  const radios = [];
  for (const cc of LATAM) {
    (byCc[cc] || []).sort((a, b) => b[F.votes] - a[F.votes]).slice(0, 30).forEach(r =>
      radios.push([r[F.id], r[F.name], r[F.url], cc, r[F.favicon] || '', r[F.hls] ? 1 : 0, r[F.tags] || '']));
  }
  save('radios.json', { fields: ['id', 'name', 'url', 'cc', 'favicon', 'hls', 'tags'], rows: radios });

  save('lugares.json', { ciudades: CIUDADES, emergencias: EMERGENCIAS });
  console.log('Listo.');
})().catch(e => { console.error(e); process.exit(1); });
