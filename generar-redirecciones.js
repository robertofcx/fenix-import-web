/**
 * generar-redirecciones.js
 * ------------------------------------------------------------
 * Redirige las fichas de la web WooCommerce anterior
 * (/producto/slug-viejo/) a la web nueva, para no perder el
 * historial que Google y los clientes tenían de esas URLs.
 *
 * Lee redirecciones.json:
 *   "slug-viejo": { "sku": "HER_172" }                          -> ficha del SKU
 *   "slug-viejo": { "sku": "HER_172", "destino": "categoria" }  -> subcategoría del SKU
 *
 * Se resuelve por SKU en cada corrida: si el producto cambia de
 * nombre/slug, la redirección sigue apuntando bien. Si el SKU ya
 * no está publicado, esa redirección no se genera (queda 404).
 *
 * Genera /producto/{slug-viejo}.html con meta refresh 0 + canonical
 * (Google lo trata como redirección permanente). Render sirve ese
 * archivo también para /producto/{slug-viejo}/ y sin la barra.
 *
 * Además redirige los productos DESCONTINUADOS que manda el Apps Script
 * (productos.json -> "descontinuados"): a su REEMPLAZO si tiene uno
 * publicado, si no a su subcategoría (o categoría) si sigue existiendo.
 *
 * Se invoca desde generar-productos.js DESPUÉS de escribir las
 * fichas reales: nunca pisa una ficha real con el mismo slug.
 * Estos archivos NO van al sitemap.
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const { slugCategoria } = require("./generar-categorias.js");

function escaparHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function urlCategoriaDe(producto, urlSitio) {
  const cat = slugCategoria(producto.categoria);
  return producto.subcategoria
    ? `${urlSitio}/categoria/${cat}/${slugCategoria(producto.subcategoria)}.html`
    : `${urlSitio}/categoria/${cat}.html`;
}

function paginaRedireccion(destino, titulo) {
  const d = escaparHtml(destino);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escaparHtml(titulo)} — Fenix Import Perú</title>
<meta http-equiv="refresh" content="0; url=${d}">
<link rel="canonical" href="${d}">
<script>location.replace(${JSON.stringify(destino).replace(/</g, "\\u003c")});</script>
</head>
<body>
<p>Este producto se movió. <a href="${d}">Ver ${escaparHtml(titulo)}</a></p>
</body>
</html>`;
}

/**
 * @param {Array}    productos      catálogo publicado
 * @param {string}   urlSitio       dominio absoluto, sin barra final
 * @param {string}   carpetaSalida  carpeta /producto
 * @param {Function} obtenerSlug    slug actual de un producto
 * @param {Set}      slugsReales    slugs que ya son ficha real (no se pisan)
 * @param {Array}    descontinuados [{ sku, slug, nombre, categoria, subcategoria, reemplazo }]
 */
function generarRedirecciones(productos, urlSitio, carpetaSalida, obtenerSlug, slugsReales, descontinuados = []) {
  const porSku = new Map();
  productos.filter(p => p.sku).forEach(p => {
    porSku.set(String(p.sku).toUpperCase(), p);
    (p.variantes || []).forEach(v => porSku.set(String(v.sku).toUpperCase(), p));
  });
  const escritos = new Set();

  generarDesdeMapa(productos, porSku, urlSitio, carpetaSalida, obtenerSlug, slugsReales, escritos);
  generarDescontinuados(descontinuados, productos, porSku, urlSitio, carpetaSalida, obtenerSlug, slugsReales, escritos);
}

function generarDesdeMapa(productos, porSku, urlSitio, carpetaSalida, obtenerSlug, slugsReales, escritos) {
  const ruta = path.join(__dirname, "redirecciones.json");
  if (!fs.existsSync(ruta)) return;

  const mapa = JSON.parse(fs.readFileSync(ruta, "utf-8")).redirecciones || {};

  let generadas = 0, sinSku = 0, omitidas = 0;

  for (const [slugViejo, regla] of Object.entries(mapa)) {
    if (!/^[a-z0-9-]+$/.test(slugViejo) || slugsReales.has(slugViejo)) { omitidas++; continue; }

    const producto = porSku.get(String(regla.sku || "").toUpperCase());
    if (!producto) { sinSku++; continue; }

    const destino = regla.destino === "categoria"
      ? urlCategoriaDe(producto, urlSitio)
      : `${urlSitio}/producto/${encodeURIComponent(obtenerSlug(producto))}.html`;
    const titulo = regla.destino === "categoria"
      ? (producto.subcategoria || producto.categoria)
      : producto.nombre;

    fs.writeFileSync(path.join(carpetaSalida, `${slugViejo}.html`), paginaRedireccion(destino, titulo), "utf-8");
    escritos.add(slugViejo);
    generadas++;
  }

  console.log(`✓ ${generadas} redirecciones de la web anterior` +
    (sinSku > 0 ? `, ${sinSku} sin generar (SKU ya no publicado)` : "") +
    (omitidas > 0 ? `, ${omitidas} omitidas (slug inválido o ya es ficha real)` : ""));
}

function generarDescontinuados(descontinuados, productos, porSku, urlSitio, carpetaSalida, obtenerSlug, slugsReales, escritos) {
  if (descontinuados.length === 0) return;

  // Solo se redirige a categorías que siguen teniendo página (algún producto publicado)
  const categorias = new Set(productos.map(p => p.categoria).filter(Boolean));
  const subcategorias = new Set(productos.filter(p => p.subcategoria).map(p => `${p.categoria}|${p.subcategoria}`));

  let aReemplazo = 0, aCategoria = 0, sinDestino = 0;

  for (const d of descontinuados) {
    const slug = String(d.slug || "");
    if (!/^[a-z0-9-]+$/.test(slug) || slugsReales.has(slug) || escritos.has(slug)) continue;

    let destino = null, titulo = "";
    const reemplazo = d.reemplazo ? porSku.get(String(d.reemplazo).toUpperCase()) : null;

    if (reemplazo) {
      destino = `${urlSitio}/producto/${encodeURIComponent(obtenerSlug(reemplazo))}.html`;
      titulo = reemplazo.nombre;
      aReemplazo++;
    } else if (d.subcategoria && subcategorias.has(`${d.categoria}|${d.subcategoria}`)) {
      destino = urlCategoriaDe(d, urlSitio);
      titulo = d.subcategoria;
      aCategoria++;
    } else if (d.categoria && categorias.has(d.categoria)) {
      destino = urlCategoriaDe({ categoria: d.categoria }, urlSitio);
      titulo = d.categoria;
      aCategoria++;
    } else {
      sinDestino++;
      continue;
    }

    fs.writeFileSync(path.join(carpetaSalida, `${slug}.html`), paginaRedireccion(destino, titulo), "utf-8");
    escritos.add(slug);
  }

  console.log(`✓ Descontinuados: ${aReemplazo} a su reemplazo, ${aCategoria} a su categoría` +
    (sinDestino > 0 ? `, ${sinDestino} sin destino (su categoría ya no existe)` : ""));
}

module.exports = { generarRedirecciones };
