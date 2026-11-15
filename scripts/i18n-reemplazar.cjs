// Uso (desde without_frontend): node scripts/i18n-reemplazar.cjs <archivo.html> <mapa.json>
// mapa = { "txt": {es: clave} | [es...], "attr": {es: clave} | [es...] }  (en la forma de lista, la clave es el propio texto español)
// Además envuelve {{ x.titulo|descripcion|nombre|ejemplos|label }} con el pipe t.
const fs = require('fs');
const [f, mapa] = process.argv.slice(2);
const norm = m => Array.isArray(m) ? Object.fromEntries(m.map(t => [t, t])) : (m || {});
const j = JSON.parse(fs.readFileSync(mapa, 'utf8'));
const txt = norm(j.txt), attr = norm(j.attr);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
let s = fs.readFileSync(f, 'utf8'), n = 0;
for (const [es, k] of Object.entries(txt)) {
  let c = 0; s = s.replace(new RegExp('(>\\s*)' + esc(es) + '(\\s*<)', 'g'), (_, a, b) => (c++, `${a}{{ '${k}' | t }}${b}`)); n += c;
  if (!c) console.log('SIN COINCIDENCIA', es);
}
for (const [es, k] of Object.entries(attr)) {
  let c = 0; s = s.replace(new RegExp('\\b(placeholder|aria-label|title|alt)="' + esc(es) + '"', 'g'), (_, a) => (c++, `[attr.${a}]="'${k}' | t"`)); n += c;
  if (!c) console.log('SIN COINCIDENCIA attr', es);
}
s = s.replace(/\{\{ (\w+\.(?:titulo|descripcion|nombre|ejemplos|label)) \}\}/g, (_, e) => (n++, `{{ ${e} | t }}`));
fs.writeFileSync(f, s); console.log(f, n, 'reemplazos');
