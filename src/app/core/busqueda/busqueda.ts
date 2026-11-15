/** Búsqueda en el contenido del sitio público (sin backend): índice estático + puntuación por relevancia. */

export interface SeccionIndice { titulo: string; textos: string[] }
export interface PaginaIndice { ruta: string; pagina: string; icono: string; secciones: SeccionIndice[] }

/** Trozo del fragmento mostrado; `marca` = coincide con la búsqueda (se resalta). */
export interface Trozo { texto: string; marca: boolean }
export interface Coincidencia { seccion: string; textoCompleto: string; fragmento: Trozo[]; puntos: number }
export interface ResultadoPagina { ruta: string; pagina: string; icono: string; puntos: number; coincidencias: Coincidencia[] }

/** Minúsculas y sin tildes: «Energía» y «energia» coinciden. Conserva la longitud del texto (necesario para resaltar). */
export const normalizar = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'en', 'un', 'una', 'para', 'con', 'por', 'del', 'al', 'que', 'su', 'sus', 'se', 'o', 'a']);
const LARGO_FRAGMENTO = 170;

/**
 * Puntuación de un texto para los términos buscados:
 * - palabra completa 3 · inicio de palabra 2 · dentro de una palabra 1 (por término);
 * - +4 si aparece la frase completa; ×1.6 si el texto es el título de la sección.
 * Un texto debe contener todos los términos (como Google) para contar.
 */
function puntuar(texto: string, terminos: string[], frase: string, esTitulo: boolean): number {
  const n = normalizar(texto);
  let puntos = 0;
  for (const t of terminos) {
    const i = n.indexOf(t);
    if (i < 0) return 0;
    const antes = i === 0 || /[^a-z0-9ñ]/.test(n[i - 1]);
    const despues = i + t.length >= n.length || /[^a-z0-9ñ]/.test(n[i + t.length]);
    puntos += antes && despues ? 3 : antes ? 2 : 1;
  }
  if (terminos.length > 1 && n.includes(frase)) puntos += 4;
  return esTitulo ? puntos * 1.6 : puntos;
}

/** Recorta el texto alrededor de la primera coincidencia y separa los trozos a resaltar. */
function fragmentar(texto: string, terminos: string[]): Trozo[] {
  const n = normalizar(texto);
  const primera = Math.min(...terminos.map(t => n.indexOf(t)).filter(i => i >= 0));
  let ini = 0, fin = texto.length;
  if (texto.length > LARGO_FRAGMENTO) {
    ini = Math.max(0, primera - 50);
    fin = Math.min(texto.length, ini + LARGO_FRAGMENTO);
    ini = Math.max(0, fin - LARGO_FRAGMENTO);
  }
  // Marca de caracteres que pertenecen a algún término.
  const marca = new Array(texto.length).fill(false);
  for (const t of terminos) for (let i = n.indexOf(t); i >= 0; i = n.indexOf(t, i + 1)) for (let k = i; k < i + t.length; k++) marca[k] = true;
  const trozos: Trozo[] = [];
  if (ini > 0) trozos.push({ texto: '…', marca: false });
  for (let i = ini; i < fin; i++) {
    const ultimo = trozos[trozos.length - 1];
    if (ultimo && ultimo.marca === marca[i] && ultimo.texto !== '…') ultimo.texto += texto[i];
    else trozos.push({ texto: texto[i], marca: marca[i] });
  }
  if (fin < texto.length) trozos.push({ texto: '…', marca: false });
  return trozos;
}

/**
 * Busca en el índice. `traducir` devuelve el texto en el idioma activo: se busca en lo que el usuario ve
 * y también en el español original (así «agua» funciona aunque la página esté en quechua).
 * Las páginas se ordenan por relevancia: la mejor coincidencia pesa más, y cada coincidencia extra suma un poco.
 */
export function buscarEnSitio(consulta: string, indice: PaginaIndice[], traducir: (s: string) => string, maxPorPagina = 3): ResultadoPagina[] {
  const frase = normalizar(consulta.trim()).replace(/\s+/g, ' ');
  let terminos = frase.split(' ').filter(t => t.length >= 2 && !PALABRAS_VACIAS.has(t));
  if (!terminos.length) terminos = frase.length >= 2 ? [frase] : [];
  if (!terminos.length) return [];

  const resultados: ResultadoPagina[] = [];
  for (const p of indice) {
    const coincidencias: Coincidencia[] = [];
    for (const s of p.secciones) {
      const tituloVisible = traducir(s.titulo);
      for (const [original, esTitulo] of [[s.titulo, true], ...s.textos.map(t => [t, false] as const)] as [string, boolean][]) {
        const visible = traducir(original);
        const puntos = Math.max(puntuar(visible, terminos, frase, esTitulo), visible === original ? 0 : puntuar(original, terminos, frase, esTitulo) * 0.9);
        if (!puntos) continue;
        // Si solo coincide el español (página en otro idioma), se muestra el español para que se vea el resaltado.
        const mostrado = puntuar(visible, terminos, frase, esTitulo) ? visible : original;
        coincidencias.push({ seccion: tituloVisible, textoCompleto: visible, fragmento: fragmentar(mostrado, terminos), puntos });
      }
    }
    if (!coincidencias.length) continue;
    coincidencias.sort((a, b) => b.puntos - a.puntos);
    const puntos = coincidencias[0].puntos + coincidencias.slice(1, 6).reduce((suma, c) => suma + c.puntos * 0.25, 0);
    resultados.push({ ruta: p.ruta, pagina: traducir(p.pagina), icono: p.icono, puntos, coincidencias: coincidencias.slice(0, maxPorPagina) });
  }
  return resultados.sort((a, b) => b.puntos - a.puntos);
}

/** Tras navegar, desplaza la vista hasta el texto encontrado y lo resalta un momento. */
export function irAlTexto(texto: string, intentos = 20) {
  if (typeof document === 'undefined') return;
  const buscado = normalizar(texto.trim());
  const recorrido = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    if (normalizar(nodo.textContent?.trim() ?? '') !== buscado) continue;
    const el = nodo.parentElement;
    if (!el || el.closest('app-navbar, app-footer')) continue;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('resaltado-busqueda'); void el.offsetWidth; el.classList.add('resaltado-busqueda');
    setTimeout(() => el.classList.remove('resaltado-busqueda'), 2600);
    return;
  }
  // La página puede estar cargando todavía (carga diferida): reintenta unos instantes.
  if (intentos > 0) setTimeout(() => irAlTexto(texto, intentos - 1), 100);
}
