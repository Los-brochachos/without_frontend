// Uso (desde without_frontend): node scripts/i18n-extraer.cjs src/app/features/x/x.html
// Lista textos visibles (nodos de texto y placeholder/aria-label/title/alt) de un HTML Angular.
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/data:[^"')]+/g, '');
  const txt = new Set(), attr = new Set();
  for (const m of s.matchAll(/>([^<>]+)</g)) {
    const t = m[1].replace(/\s+/g, ' ').trim();
    if (/[A-Za-zÁÉÍÓÚáéíóúÑñ¿]{2,}/.test(t) && !t.includes('{{') && !/^[@}{]/.test(t) && !t.includes('=>')) txt.add(t);
  }
  for (const m of s.matchAll(/\s(placeholder|aria-label|title|alt)="([^"{]*[A-Za-zÁÉÍÓÚáéíóú]{2,}[^"]*)"/g)) attr.add(m[2]);
  console.log('== ' + f + '\nTXT ' + JSON.stringify([...txt]) + '\nATTR ' + JSON.stringify([...attr]));
}
