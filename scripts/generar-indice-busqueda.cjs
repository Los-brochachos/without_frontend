// Uso (desde without_frontend):  node scripts/generar-indice-busqueda.cjs
// Genera src/app/core/busqueda/indice-busqueda.ts a partir de las plantillas públicas.
// Secciones = títulos h1/h2; textos = {{ '...' | t }} y los datos de los @for (titulo/nombre/descripcion/ejemplos del .ts).
const fs = require('fs');
const app = require('path').resolve(__dirname, '../src/app');
const paginas = [
  ['inicio', '/inicio', 'Inicio', 'pi pi-home'],
  ['nosotros', '/nosotros', 'Nosotros', 'pi pi-building'],
  ['productos', '/productos', 'Productos', 'pi pi-box'],
  ['contacto', '/contacto', 'Contacto', 'pi pi-envelope'],
];
const salida = [];
for (const [carpeta, ruta, nombre, icono] of paginas) {
  const html = fs.readFileSync(`${app}/features/${carpeta}/${carpeta}.html`, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const ts = fs.readFileSync(`${app}/features/${carpeta}/${carpeta}.ts`, 'utf8');
  const secciones = [];
  let actual = { titulo: nombre, textos: [] }, esperandoTitulo = false;
  secciones.push(actual);
  const agregar = t => { if (t && !actual.textos.includes(t) && t !== actual.titulo) actual.textos.push(t); };
  for (const m of html.matchAll(/<h([12])\b[^>]*>|\{\{ '([^']+)' \| t \}\}|@for \((\w+) of (\w+)/g)) {
    if (m[1]) { esperandoTitulo = true; continue; }
    if (m[2]) {
      if (esperandoTitulo) { actual = { titulo: m[2], textos: [] }; secciones.push(actual); esperandoTitulo = false; }
      else agregar(m[2]);
      continue;
    }
    // @for: textos del arreglo en el .ts
    const arr = ts.match(new RegExp(`${m[4]}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
    if (arr) for (const c of arr[1].matchAll(/(?:titulo|nombre|descripcion|ejemplos):\s*'([^']+)'/g)) agregar(c[1]);
  }
  salida.push({ ruta, pagina: nombre, icono, secciones: secciones.filter(s => s.textos.length || s !== secciones[0]) });
}
const total = salida.reduce((n, p) => n + p.secciones.reduce((k, s) => k + 1 + s.textos.length, 0), 0);
fs.mkdirSync(`${app}/core/busqueda`, { recursive: true });
fs.writeFileSync(`${app}/core/busqueda/indice-busqueda.ts`,
`// ARCHIVO GENERADO: no editar a mano. Regenerar tras cambiar textos de las páginas públicas:
//   node scripts/generar-indice-busqueda.cjs   (desde without_frontend)
// Contiene ${total} textos en español; la búsqueda los muestra traducidos con el idioma activo.
import { PaginaIndice } from './busqueda';

export const INDICE_BUSQUEDA: PaginaIndice[] = ${JSON.stringify(salida, null, 2)};
`);
console.log('índice generado:', salida.map(p => `${p.pagina}=${p.secciones.length} secciones`).join(', '), '| textos:', total);
