#!/usr/bin/env node
/*
 * Genera app/src/main/assets/www/data/timezones.json: zonas horarias por país
 * (para mostrar la hora local de cada emisora).
 *   npm i --no-save countries-and-timezones && node tools/build-timezones.js
 * Opcional: pasar la ruta del paquete como argumento.
 */
const path = require('path');
const fs = require('fs');
const ct = require(process.argv[2] || 'countries-and-timezones');
const out = {};
for (const [cc, c] of Object.entries(ct.getAllCountries())) {
  const zones = (c.timezones || []).map(tz => {
    const z = ct.getTimezone(tz);
    return z ? [tz, z.utcOffset] : null;
  }).filter(Boolean);
  if (zones.length) out[cc] = zones;
}
const dest = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www', 'data', 'timezones.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(Object.keys(out).length + ' países →', dest, (fs.statSync(dest).size / 1024).toFixed(0) + ' KB');
