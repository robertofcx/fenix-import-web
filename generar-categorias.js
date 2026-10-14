/**
 * generar-categorias.js
 * ------------------------------------------------------------
 * Genera páginas ESTÁTICAS por categoría y subcategoría:
 *   /categoria/<categoria>.html
 *   /categoria/<categoria>/<subcategoria>.html
 *
 * Por qué: catalogo.html?categoria=... se arma con JavaScript y
 * Google casi no lo posiciona. Estas páginas traen el título, un
 * texto corto y TODOS los productos ya escritos en el HTML, así
 * Google puede indexarlas para búsquedas tipo "linternas
 * recargables por mayor Lima".
 *
 * Se invoca desde generar-productos.js (mismo momento que el
 * sitemap y el feed). Devuelve la lista de URLs creadas para que
 * el sitemap las incluya.
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const { optimizarImagenCloudinary } = require("./js/util.js");

const NUMERO_WHATSAPP = "51978821080";

// Debe ser IDÉNTICA a slugCategoria() de js/header.js (el menú arma
// los links con esa función).
function slugCategoria(texto) {
  return String(texto || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "otros";
}

function escaparHtml(texto) {
  return String(texto == null ? "" : texto)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function limpiarPrecio(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")).toFixed(2);
}

function escaparJsonEnHtml(objeto) {
  return JSON.stringify(objeto).replace(/</g, "\\u003c");
}

const ICONO_WA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.3.37-.43.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.31 2.35 1.45.29.15.46.13.63-.07.17-.2.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>`;

function tarjetaProducto(p, urlSitio, slugProducto) {
  const precio = limpiarPrecio(p.precio);
  const nombre = escaparHtml(p.nombre);
  const slug = slugProducto(p);
  const urlFicha = `/producto/${encodeURIComponent(slug)}.html`;
  const imagenHtml = p.imagen
    ? `<img src="${optimizarImagenCloudinary(p.imagen, "tarjeta")}" alt="${nombre}" loading="lazy" width="300" height="300">`
    : `<span class="sin-foto">Sin foto</span>`;
  const badge = p.oferta ? `<span class="badge-oferta">Oferta</span>` : "";
  const productoJson = encodeURIComponent(JSON.stringify({ sku: p.sku, slug, nombre: p.nombre, precio, imagen: p.imagen || "" }));
  const mensaje = `¡Hola, Fenix Import Perú!\nMe gustaría realizar el siguiente pedido:\n${p.nombre}\nPrecio: S/ ${precio}\nSKU: ${p.sku}\n${urlSitio}${urlFicha}`;
  const urlWa = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

  return `
      <a class="tarjeta" href="${urlFicha}">
        <div class="tarjeta-img">${badge}${imagenHtml}</div>
        <div class="tarjeta-body">
          <p class="tarjeta-categoria">${escaparHtml(p.marca || p.subcategoria || "")}</p>
          <h3 class="tarjeta-nombre" title="${nombre}">${nombre}</h3>
          <p class="tarjeta-precio">S/ ${precio}</p>
          <div class="tarjeta-acciones">
            <button class="btn-agregar-carrito" onclick="event.preventDefault(); agregarProductoAlCarritoDesdeTarjeta('${productoJson}')">+ Agregar</button>
            <span class="btn-consultar-icono" role="link" aria-label="Consultar por WhatsApp" onclick="event.preventDefault(); window.open('${escaparHtml(urlWa)}', '_blank')">${ICONO_WA}</span>
          </div>
        </div>
      </a>`;
}

/**
 * Texto de introducción. Solo usa datos reales del catálogo y de cómo
 * trabaja Fenix (recojo en Independencia, delivery propio en Lima,
 * envíos a provincia por Shalom, venta a empresas con factura).
 */
function textoIntro(nombre, productos, padre) {
  const marcas = [...new Set(productos.map(p => p.marca).filter(m => m && !/gen[eé]rico/i.test(m)))].slice(0, 5);
  const precios = productos.map(p => Number(limpiarPrecio(p.precio))).filter(n => n > 0);
  const desde = precios.length ? Math.min(...precios).toFixed(2) : null;
  const que = padre ? `${nombre.toLowerCase()} (${padre.toLowerCase()})` : nombre.toLowerCase();

  let t = `Encuentra ${productos.length} productos de ${escaparHtml(que)} en Fenix Import Perú`;
  if (desde) t += `, desde S/ ${desde}`;
  t += ".";
  if (marcas.length) t += ` Marcas como ${escaparHtml(marcas.join(", "))}.`;
  t += ` Vendemos por unidad y por mayor a empresas y negocios, con boleta o factura. Recojo en tienda en Independencia (Lima), delivery en Lima y envíos a todo el Perú por Shalom.`;
  return t;
}

function paginaHtml(o) {
  const { titulo, descripcion, urlCanonica, breadcrumbHtml, h1, intro, chipsHtml, tarjetas, linkCatalogo, jsonLd, imagenOg } = o;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escaparHtml(titulo)}</title>
<meta name="description" content="${escaparHtml(descripcion)}">
<link rel="canonical" href="${urlCanonica}">
<link rel="icon" type="image/x-icon" href="/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">

<meta property="og:type" content="website">
<meta property="og:title" content="${escaparHtml(titulo)}">
<meta property="og:description" content="${escaparHtml(descripcion)}">
<meta property="og:image" content="${escaparHtml(imagenOg)}">
<meta property="og:url" content="${urlCanonica}">
<meta property="og:locale" content="es_PE">
<meta name="twitter:card" content="summary_large_image">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/variables.css">
<link rel="stylesheet" href="/css/header.css">
<link rel="stylesheet" href="/css/carrito.css">
<link rel="stylesheet" href="/css/footer.css">
<link rel="stylesheet" href="/css/catalogo.css">
<link rel="stylesheet" href="/css/categoria-seo.css">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>

<div id="header-placeholder"></div>
<script src="/js/util.js"></script>
<script src="/js/productos-store.js"></script>
<script src="/js/header.js"></script>

<div class="fondo-carrito" id="fondo-carrito"></div>
<div class="drawer-carrito" id="drawer-carrito">
  <div class="carrito-header">
    <h2>Tu pedido</h2>
    <button class="btn-cerrar-drawer" id="btn-cerrar-carrito" aria-label="Cerrar carrito">✕</button>
  </div>
  <div class="carrito-lista" id="carrito-lista"></div>
  <div class="carrito-footer" id="carrito-footer" style="display:none;">
    <div class="carrito-total"><span>Total</span><span id="carrito-total-monto">S/ 0.00</span></div>
    <button class="btn-enviar-pedido" id="btn-enviar-pedido">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      Finalizar pedido
    </button>
    <button class="btn-vaciar-carrito" id="btn-vaciar-carrito">Vaciar carrito</button>
  </div>
</div>
<div class="toast-carrito" id="toast-carrito"></div>

<main class="cat-seo">
  <div class="barra-titulo">
    <nav class="breadcrumb" aria-label="Ruta">${breadcrumbHtml}</nav>
    <h1 class="titulo-catalogo">${escaparHtml(h1)}</h1>
    <p class="cat-seo-intro">${intro}</p>
    ${chipsHtml}
  </div>

  <div class="cat-seo-contenido">
    <div class="cat-seo-toolbar">
      <span class="contador">${tarjetas.length} productos</span>
      <a class="cat-seo-filtros" href="${linkCatalogo}">Filtrar por precio y marca →</a>
    </div>
    <div class="grilla">${tarjetas.join("")}
    </div>
  </div>
</main>

<div id="footer-placeholder" data-variant="completo"></div>
<script src="/js/footer.js"></script>

<a class="whatsapp-flotante" href="https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent("¡Hola Fenix Import Perú!\nQuiero información sobre " + h1)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICONO_WA.replace('fill="currentColor"', "")}</a>

<script src="/js/carrito.js"></script>
</body>
</html>`;
}

/**
 * @param {Array}    productos   productos publicados
 * @param {string}   urlSitio    dominio sin barra final
 * @param {string}   carpetaRaiz carpeta del proyecto
 * @param {Function} slugProducto  p => slug de la ficha
 * @returns {Array<string>} URLs absolutas generadas
 */
function generarPaginasCategoria(productos, urlSitio, carpetaRaiz, slugProducto) {
  const carpeta = path.join(carpetaRaiz, "categoria");
  // Limpiar lo anterior (categorías renombradas no deben quedar huérfanas)
  if (fs.existsSync(carpeta)) fs.rmSync(carpeta, { recursive: true, force: true });
  fs.mkdirSync(carpeta, { recursive: true });

  // Árbol: categoría -> { productos, subs: Map(sub -> productos) }
  // Se agrupa por SLUG para que variantes de escritura ("Multímetros" /
  // "Multimetros") caigan en la misma página. Se muestra el nombre con
  // tilde si existe (el que tenga más caracteres no ASCII).
  const nombreVisible = (actual, nuevo) =>
    (!actual || (nuevo.match(/[^\x00-\x7F]/g) || []).length > (actual.match(/[^\x00-\x7F]/g) || []).length) ? nuevo : actual;

  const arbolSlug = new Map();
  for (const p of productos) {
    if (!p.categoria) continue;
    const kc = slugCategoria(p.categoria);
    if (!arbolSlug.has(kc)) arbolSlug.set(kc, { nombre: "", productos: [], subs: new Map() });
    const nodo = arbolSlug.get(kc);
    nodo.nombre = nombreVisible(nodo.nombre, p.categoria);
    nodo.productos.push(p);
    if (p.subcategoria) {
      const ks = slugCategoria(p.subcategoria);
      if (!nodo.subs.has(ks)) nodo.subs.set(ks, { nombre: "", productos: [] });
      const s = nodo.subs.get(ks);
      s.nombre = nombreVisible(s.nombre, p.subcategoria);
      s.productos.push(p);
    }
  }
  // Mismo formato que antes: Map(nombreCategoria -> { productos, subs: Map(nombreSub -> productos) })
  const arbol = new Map();
  for (const nodo of arbolSlug.values()) {
    const subs = new Map();
    for (const s of nodo.subs.values()) subs.set(s.nombre, s.productos);
    arbol.set(nodo.nombre, { productos: nodo.productos, subs });
  }

  const urls = [];
  const migaInicio = `<a href="/">Inicio</a><span class="sep">›</span>`;

  function jsonLdDe(nombre, url, lista, migas) {
    return escaparJsonEnHtml([
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: nombre,
        url,
        isPartOf: { "@type": "WebSite", name: "Fenix Import Perú", url: urlSitio + "/" },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: lista.length,
          itemListElement: lista.slice(0, 100).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${urlSitio}/producto/${encodeURIComponent(slugProducto(p))}.html`,
            name: p.nombre
          }))
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: migas.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nombre, item: m.url }))
      }
    ]);
  }

  // Ofertas primero, luego por nombre: orden estable entre publicaciones
  const ordenar = lista => lista.slice().sort((a, b) => (b.oferta ? 1 : 0) - (a.oferta ? 1 : 0) || String(a.nombre).localeCompare(String(b.nombre), "es"));

  for (const [cat, nodo] of [...arbol.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    const slugCat = slugCategoria(cat);
    const urlCat = `${urlSitio}/categoria/${slugCat}.html`;
    const lista = ordenar(nodo.productos);
    const subsOrdenadas = [...nodo.subs.entries()].sort((a, b) => b[1].length - a[1].length);

    const chips = subsOrdenadas.length
      ? `<div class="cat-seo-chips">${subsOrdenadas.map(([sub, ps]) =>
          `<a class="cat-seo-chip" href="/categoria/${slugCat}/${slugCategoria(sub)}.html">${escaparHtml(sub)} <span>${ps.length}</span></a>`).join("")}</div>`
      : "";

    fs.writeFileSync(path.join(carpeta, `${slugCat}.html`), paginaHtml({
      titulo: `${cat} en Lima — venta por mayor y menor | Fenix Import Perú`,
      descripcion: `${lista.length} productos de ${cat.toLowerCase()} con precios desde S/ ${Math.min(...lista.map(p => Number(limpiarPrecio(p.precio)) || Infinity)).toFixed(2)}. Venta a empresas con factura, delivery en Lima y envíos a todo el Perú.`,
      urlCanonica: urlCat,
      breadcrumbHtml: `${migaInicio}<span class="actual">${escaparHtml(cat)}</span>`,
      h1: cat,
      intro: textoIntro(cat, lista, null),
      chipsHtml: chips,
      tarjetas: lista.map(p => tarjetaProducto(p, urlSitio, slugProducto)),
      linkCatalogo: `/catalogo.html?categoria=${encodeURIComponent(cat)}`,
      jsonLd: jsonLdDe(cat, urlCat, lista, [{ nombre: "Inicio", url: urlSitio + "/" }, { nombre: cat, url: urlCat }]),
      imagenOg: (lista.find(p => p.imagen) || {}).imagen || `${urlSitio}/logo.webp`
    }), "utf-8");
    urls.push(urlCat);

    if (subsOrdenadas.length) fs.mkdirSync(path.join(carpeta, slugCat), { recursive: true });

    for (const [sub, ps] of subsOrdenadas) {
      const slugSub = slugCategoria(sub);
      const urlSub = `${urlSitio}/categoria/${slugCat}/${slugSub}.html`;
      const listaSub = ordenar(ps);
      const hermanas = subsOrdenadas.filter(([s]) => s !== sub);
      const chipsSub = hermanas.length
        ? `<div class="cat-seo-chips"><span class="cat-seo-chips-titulo">También en ${escaparHtml(cat)}:</span>${hermanas.map(([s, l]) =>
            `<a class="cat-seo-chip" href="/categoria/${slugCat}/${slugCategoria(s)}.html">${escaparHtml(s)} <span>${l.length}</span></a>`).join("")}</div>`
        : "";
      const minimo = Math.min(...listaSub.map(p => Number(limpiarPrecio(p.precio)) || Infinity));

      fs.writeFileSync(path.join(carpeta, slugCat, `${slugSub}.html`), paginaHtml({
        titulo: `${sub} — ${cat} en Lima | Fenix Import Perú`,
        descripcion: `${listaSub.length} productos de ${sub.toLowerCase()}${isFinite(minimo) ? ` desde S/ ${minimo.toFixed(2)}` : ""}. Venta por unidad y por mayor, delivery en Lima y envíos a todo el Perú.`,
        urlCanonica: urlSub,
        breadcrumbHtml: `${migaInicio}<a href="/categoria/${slugCat}.html">${escaparHtml(cat)}</a><span class="sep">›</span><span class="actual">${escaparHtml(sub)}</span>`,
        h1: sub,
        intro: textoIntro(sub, listaSub, cat),
        chipsHtml: chipsSub,
        tarjetas: listaSub.map(p => tarjetaProducto(p, urlSitio, slugProducto)),
        linkCatalogo: `/catalogo.html?categoria=${encodeURIComponent(cat)}&subcategoria=${encodeURIComponent(sub)}`,
        jsonLd: jsonLdDe(sub, urlSub, listaSub, [
          { nombre: "Inicio", url: urlSitio + "/" },
          { nombre: cat, url: urlCat },
          { nombre: sub, url: urlSub }
        ]),
        imagenOg: (listaSub.find(p => p.imagen) || {}).imagen || `${urlSitio}/logo.webp`
      }), "utf-8");
      urls.push(urlSub);
    }
  }

  console.log(`✓ ${urls.length} páginas de categoría generadas en /categoria`);
  return urls;
}

module.exports = { generarPaginasCategoria, slugCategoria };
