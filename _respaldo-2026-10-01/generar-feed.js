/**
 * generar-feed.js
 * ------------------------------------------------------------
 * Genera feed.xml — el feed de productos para Google Merchant
 * Center (fichas gratuitas de Shopping) y Meta Catalog.
 *
 * Se invoca desde generar-productos.js, así que se regenera
 * automáticamente cada vez que se publica el catálogo.
 *
 * Formato: RSS 2.0 + namespace de Google Shopping.
 * ------------------------------------------------------------
 */

const fs = require("fs");

const MAX_TITULO = 150;
const MAX_DESCRIPCION = 5000;

function escaparXml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function limpiarPrecio(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")).toFixed(2);
}

function recortar(texto, max) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim();
  return limpio.length > max ? limpio.slice(0, max - 1).trim() + "…" : limpio;
}

/**
 * Google exige que la descripción no sea idéntica al título. Si el
 * producto no trae descripción propia, se compone con los campos que
 * haya, para no mandar el nombre repetido.
 */
function construirDescripcion(producto) {
  const partes = [];
  if (producto.descripcion) partes.push(producto.descripcion);
  if (producto.caracteristicas) partes.push(producto.caracteristicas);
  if (producto.incluye) partes.push("Incluye: " + producto.incluye);

  if (partes.length === 0) {
    const contexto = [producto.marca, producto.categoria, producto.subcategoria]
      .filter(Boolean)
      .join(" · ");
    partes.push(contexto ? `${producto.nombre}. ${contexto}.` : producto.nombre);
  }

  return recortar(partes.join(" "), MAX_DESCRIPCION);
}

function disponibilidad(producto) {
  // Si el producto declara stock explícito lo respetamos; si no trae
  // el campo, asumimos disponible (el catálogo solo publica vigentes).
  if (typeof producto.stock === "number") {
    return producto.stock > 0 ? "in_stock" : "out_of_stock";
  }
  return "in_stock";
}

function generarItem(producto, urlSitio, slug) {
  const precio = limpiarPrecio(producto.precio);

  const imagenes = (producto.imagenes && producto.imagenes.length > 0)
    ? producto.imagenes
    : (producto.imagen ? [producto.imagen] : []);

  if (imagenes.length === 0) return null;   // Google exige imagen
  if (!(Number(precio) > 0)) return null;   // y precio válido

  const url = `${urlSitio}/producto/${encodeURIComponent(slug)}.html`;

  const lineas = [];
  lineas.push(`    <g:id>${escaparXml(producto.sku)}</g:id>`);
  lineas.push(`    <g:title>${escaparXml(recortar(producto.nombre, MAX_TITULO))}</g:title>`);
  lineas.push(`    <g:description>${escaparXml(construirDescripcion(producto))}</g:description>`);
  lineas.push(`    <g:link>${escaparXml(url)}</g:link>`);
  lineas.push(`    <g:image_link>${escaparXml(imagenes[0])}</g:image_link>`);

  // Hasta 10 imágenes adicionales
  imagenes.slice(1, 11).forEach((img) => {
    lineas.push(`    <g:additional_image_link>${escaparXml(img)}</g:additional_image_link>`);
  });

  lineas.push(`    <g:availability>${disponibilidad(producto)}</g:availability>`);
  lineas.push(`    <g:price>${precio} PEN</g:price>`);
  lineas.push(`    <g:condition>new</g:condition>`);

  if (producto.marca) {
    lineas.push(`    <g:brand>${escaparXml(producto.marca)}</g:brand>`);
  }

  // Sin códigos de barras (GTIN/MPN) propios: se lo declaramos a Google
  // explícitamente para que no rechace los productos por falta de ellos.
  lineas.push(`    <g:identifier_exists>no</g:identifier_exists>`);

  const tipoProducto = [producto.categoria, producto.subcategoria].filter(Boolean).join(" > ");
  if (tipoProducto) {
    lineas.push(`    <g:product_type>${escaparXml(tipoProducto)}</g:product_type>`);
  }

  if (producto.color && !producto.esGrupo) {
    lineas.push(`    <g:color>${escaparXml(producto.color)}</g:color>`);
  }

  return `  <item>\n${lineas.join("\n")}\n  </item>`;
}

/**
 * @param {Array}    productos    catálogo ya filtrado por el generador
 * @param {string}   urlSitio     dominio absoluto, sin barra final
 * @param {string}   rutaSalida   ruta del feed.xml a escribir
 * @param {Function} obtenerSlug  función que devuelve el slug de un producto
 */
function generarFeed(productos, urlSitio, rutaSalida, obtenerSlug) {
  const items = [];
  let omitidos = 0;

  for (const producto of productos) {
    if (!producto.sku) { omitidos++; continue; }
    const item = generarItem(producto, urlSitio, obtenerSlug(producto));
    if (item) items.push(item);
    else omitidos++;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Fenix Import Perú</title>
  <link>${escaparXml(urlSitio)}/</link>
  <description>Catálogo de productos de Fenix Import Perú</description>
${items.join("\n")}
</channel>
</rss>`;

  fs.writeFileSync(rutaSalida, xml, "utf-8");
  console.log(`✓ feed.xml generado (${items.length} productos${omitidos > 0 ? `, ${omitidos} omitidos sin imagen o precio` : ""})`);
}

module.exports = { generarFeed };
