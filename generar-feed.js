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
 *
 * CAMBIOS 2026-10-01:
 *  - Productos con variantes (esGrupo) se publican como UN ítem por
 *    variante (id = SKU de la variante, item_group_id = SKU del grupo),
 *    con su propio color, precio, fotos y link (?v=SKU preselecciona
 *    la variante en la ficha). Antes solo salía el grupo y Google veía
 *    variantes en la página que no estaban en el feed.
 *  - Lista de exclusión: productos que Google rechaza por política
 *    (armas, defensa personal, cuchillos). Siguen en la web, solo no
 *    se envían a Google para no acumular infracciones en la cuenta.
 *  - Links con UTM para que GA4 muestre estas visitas como
 *    "Organic Shopping" y no mezcladas con Google orgánico.
 * ------------------------------------------------------------
 */

const fs = require("fs");

const MAX_TITULO = 150;
const MAX_DESCRIPCION = 5000;

// UTM de los links del feed (GA4 lo clasifica como "Organic Shopping"
// porque la campaña contiene "shopping").
const UTM_FEED = "utm_source=google&utm_medium=organic&utm_campaign=shopping_fichas_gratuitas";

// SKUs (de grupo o sueltos) que NO se envían a Google por política.
// Un SKU de grupo excluye también todas sus variantes (CAM_041 -> CAM_041_NEG).
// Para agregar otro: suma su SKU aquí.
const SKUS_EXCLUIDOS_GOOGLE = [
  "ILU_176",  // Electroshock con linterna paralizador 801
  "ILU_319",  // Electroshock tipo pistola TAC-PL6032
  "ILU_251",  // Electroshock llavero TW-1602
  "CAM_041",  // Gas pimienta 60 ml
  "CAM_052",  // Gas pimienta 110 ml
  "CAM_065",  // Gas pimienta 20 ml llavero
  "CAM_037",  // Pulsera paracord con navaja
  "CAM_125",  // Pulsera paracord con navaja, silbato, etc.
  "CAM_056",  // Navaja táctica karambit
  "CAM_047"   // Lapicero táctico rompe vidrio
];

function estaExcluido(sku) {
  const s = String(sku || "").toUpperCase();
  return SKUS_EXCLUIDOS_GOOGLE.some(x => s === x || s.startsWith(x + "_"));
}

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

function disponibilidad(item) {
  // Si declara stock explícito lo respetamos; si no trae el campo,
  // asumimos disponible (el catálogo solo publica vigentes).
  if (typeof item.stock === "number") {
    return item.stock > 0 ? "in_stock" : "out_of_stock";
  }
  return "in_stock";
}

function listaImagenes(obj) {
  if (obj.imagenes && obj.imagenes.length > 0) return obj.imagenes;
  return obj.imagen ? [obj.imagen] : [];
}

function agregarParametros(url, params) {
  return url + (url.includes("?") ? "&" : "?") + params;
}

/**
 * Arma un <item>. "datos" trae lo que cambia entre producto suelto y
 * variante (id, título, precio, imágenes, link, color, talla, grupo).
 */
function armarItem(producto, datos) {
  const precio = limpiarPrecio(datos.precio);
  if (datos.imagenes.length === 0) return null;   // Google exige imagen
  if (!(Number(precio) > 0)) return null;          // y precio válido

  const lineas = [];
  lineas.push(`    <g:id>${escaparXml(datos.id)}</g:id>`);
  if (datos.grupo) lineas.push(`    <g:item_group_id>${escaparXml(datos.grupo)}</g:item_group_id>`);
  lineas.push(`    <g:title>${escaparXml(recortar(datos.titulo, MAX_TITULO))}</g:title>`);
  lineas.push(`    <g:description>${escaparXml(construirDescripcion(producto))}</g:description>`);
  lineas.push(`    <g:link>${escaparXml(agregarParametros(datos.link, UTM_FEED))}</g:link>`);
  lineas.push(`    <g:image_link>${escaparXml(datos.imagenes[0])}</g:image_link>`);

  // Hasta 10 imágenes adicionales
  datos.imagenes.slice(1, 11).forEach((img) => {
    lineas.push(`    <g:additional_image_link>${escaparXml(img)}</g:additional_image_link>`);
  });

  lineas.push(`    <g:availability>${datos.disponibilidad}</g:availability>`);
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

  if (datos.color) lineas.push(`    <g:color>${escaparXml(datos.color)}</g:color>`);
  if (datos.talla) lineas.push(`    <g:size>${escaparXml(datos.talla)}</g:size>`);

  return `  <item>\n${lineas.join("\n")}\n  </item>`;
}

/**
 * Devuelve uno o varios <item> para un producto: uno por variante si es
 * grupo con más de una variante, o uno solo si es producto suelto.
 */
function generarItems(producto, urlSitio, slug) {
  const urlBase = `${urlSitio}/producto/${encodeURIComponent(slug)}.html`;
  const variantes = (producto.esGrupo && producto.variantes && producto.variantes.length > 1)
    ? producto.variantes
    : null;

  if (!variantes) {
    return [armarItem(producto, {
      id: producto.sku,
      titulo: producto.nombre,
      precio: producto.precio,
      imagenes: listaImagenes(producto),
      link: urlBase,
      disponibilidad: disponibilidad(producto),
      color: producto.esGrupo ? "" : producto.color,
      talla: producto.esGrupo ? "" : producto.talla
    })];
  }

  return variantes
    .filter(v => v.sku && !estaExcluido(v.sku))
    .map(v => {
      const extras = [v.color, v.talla].filter(Boolean).join(" ");
      const imagenesVariante = listaImagenes(v);
      return armarItem(producto, {
        id: v.sku,
        grupo: producto.sku,
        titulo: extras ? `${producto.nombre} - ${extras}` : producto.nombre,
        precio: v.precio != null && v.precio !== "" ? v.precio : producto.precio,
        imagenes: imagenesVariante.length > 0 ? imagenesVariante : listaImagenes(producto),
        link: `${urlBase}?v=${encodeURIComponent(v.sku)}`,
        disponibilidad: disponibilidad(v),
        color: v.color,
        talla: v.talla
      });
    });
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
  let excluidos = 0;

  for (const producto of productos) {
    if (!producto.sku) { omitidos++; continue; }
    if (estaExcluido(producto.sku)) { excluidos++; continue; }

    for (const item of generarItems(producto, urlSitio, obtenerSlug(producto))) {
      if (item) items.push(item);
      else omitidos++;
    }
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
  console.log(`✓ feed.xml generado (${items.length} ítems` +
    (omitidos > 0 ? `, ${omitidos} omitidos sin imagen o precio` : "") +
    (excluidos > 0 ? `, ${excluidos} excluidos por política de Google` : "") + ")");
}

module.exports = { generarFeed };
