#!/usr/bin/env node
/**
 * generar-productos.js
 * ------------------------------------------------------------
 * Lee productos.json y genera una página HTML estática por
 * cada producto en /producto/{sku}.html, con título, meta
 * description, Open Graph y JSON-LD ya "horneados" — sin
 * depender de JavaScript para que Google o WhatsApp los vean.
 *
 * También regenera sitemap.xml con todas las URLs nuevas.
 *
 * USO:
 *   1) Coloca este archivo en la raíz de tu proyecto, junto a
 *      productos.json, producto.css y producto-comun.js
 *   2) node generar-productos.js
 *
 * CONFIGURA LA URL ANTES DE CORRER (ver bloque de abajo):
 *   - Mientras pruebas: deja la de onrender.com
 *   - Cuando migres el dominio: cambia a feniximportperu.com
 *     y vuelve a correr el script una vez más.
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

// ==================== CONFIGURACIÓN ====================
const URL_SITIO = process.env.URL_SITIO || "https://fenix-import-peru.onrender.com";
const RUTA_PRODUCTOS_JSON = path.join(__dirname, "productos.json");
const CARPETA_SALIDA = path.join(__dirname, "producto");
const RUTA_SITEMAP = path.join(__dirname, "sitemap.xml");
const NUMERO_WHATSAPP = "51978821080";
// =========================================================

function limpiarPrecio(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")).toFixed(2);
}

function escaparHtml(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escaparJsonEnHtml(objeto) {
  // Evita que un </script> dentro de un texto de producto rompa la página
  return JSON.stringify(objeto).replace(/</g, "\\u003c");
}

function generarUrlWhatsApp(producto, precio, url) {
  const mensaje = `¡Hola, Fenix Import Perú!\nMe gustaría realizar el siguiente pedido:\n${producto.nombre}\nPrecio: S/ ${precio}\nSKU: ${producto.sku}\n${url}`;
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

function generarJsonLd(producto, precio, url) {
  const productoLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    sku: producto.sku,
    image: producto.imagen || undefined,
    description: producto.descripcion || producto.nombre,
    brand: producto.marca ? { "@type": "Brand", name: producto.marca } : undefined,
    offers: {
      "@type": "Offer",
      url: url,
      priceCurrency: "PEN",
      price: precio,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Fenix Import Perú" }
    }
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${URL_SITIO}/` },
      { "@type": "ListItem", position: 2, name: producto.categoria || "Catálogo", item: `${URL_SITIO}/catalogo.html` },
      { "@type": "ListItem", position: 3, name: producto.nombre, item: url }
    ]
  };

  return escaparJsonEnHtml([productoLd, breadcrumbLd]);
}

function generarHtmlProducto(producto) {
  const precio = limpiarPrecio(producto.precio);
  const url = `${URL_SITIO}/producto/${producto.sku}.html`;
  const nombreEscapado = escaparHtml(producto.nombre);
  const descripcionCorta = escaparHtml((producto.descripcion || producto.nombre).slice(0, 160));
  const imagenAbsoluta = producto.imagen || `${URL_SITIO}/logo.webp`;

  const imagenHtml = producto.imagen
    ? `<img src="${producto.imagen}" alt="${nombreEscapado}">`
    : `<span class="sin-foto">Sin foto disponible</span>`;
  const badgeOferta = producto.oferta ? `<span class="badge-oferta-producto">Oferta</span>` : "";

  const metaChips = [];
  if (producto.marca) metaChips.push(escaparHtml(producto.marca));
  if (producto.color) metaChips.push(escaparHtml(producto.color));
  metaChips.push("SKU " + escaparHtml(producto.sku));
  const metaHtml = metaChips.map(m => `<span>${m}</span>`).join("");

  const seccion = (titulo, contenido) =>
    contenido ? `<div><p class="producto-seccion-titulo">${titulo}</p><p class="producto-seccion-texto">${escaparHtml(contenido)}</p></div>` : "";

  let breadcrumbHtml = `<a href="/index.html">Inicio</a>`;
  if (producto.categoria) {
    breadcrumbHtml += ` <span class="sep">›</span> <a href="/catalogo.html?categoria=${encodeURIComponent(producto.categoria)}">${escaparHtml(producto.categoria)}</a>`;
  }
  if (producto.subcategoria) {
    breadcrumbHtml += ` <span class="sep">›</span> <a href="/catalogo.html?categoria=${encodeURIComponent(producto.categoria)}&subcategoria=${encodeURIComponent(producto.subcategoria)}">${escaparHtml(producto.subcategoria)}</a>`;
  }
  breadcrumbHtml += ` <span class="sep">›</span> <span class="actual">${nombreEscapado}</span>`;

  const jsonLd = generarJsonLd(producto, precio, url);
  const urlWhatsApp = generarUrlWhatsApp(producto, precio, url);

  // Datos mínimos que la página necesita en el navegador (carrito, WhatsApp)
  const productoActualJs = escaparJsonEnHtml({
    sku: producto.sku,
    nombre: producto.nombre,
    precio: precio,
    imagen: producto.imagen || ""
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${nombreEscapado} — Fenix Import Perú</title>
<meta name="description" content="${descripcionCorta}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/logo.webp">

<meta property="og:type" content="product">
<meta property="og:title" content="${nombreEscapado} — Fenix Import Perú">
<meta property="og:description" content="${descripcionCorta}">
<meta property="og:image" content="${imagenAbsoluta}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="es_PE">
<meta property="product:price:amount" content="${precio}">
<meta property="product:price:currency" content="PEN">
<meta name="twitter:card" content="summary_large_image">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/producto.css">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>

<header>
  <div class="header-fila">
    <div class="header-izquierda">
      <button class="btn-hamburguesa" id="btn-abrir-drawer" aria-label="Abrir menú">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a class="logo-chip" href="/index.html"><img src="/logo.webp" alt="Fenix Import Perú"></a>
    </div>
    <div class="header-derecha">
      <button class="btn-tema" id="btn-tema" aria-label="Cambiar tema">
        <svg class="icono-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
        <svg class="icono-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="btn-carrito" id="btn-abrir-carrito" aria-label="Ver carrito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21.5 8H6"/></svg>
        <span class="badge-carrito" id="badge-carrito">0</span>
      </button>
      <a class="btn-nav-whatsapp" href="#" id="nav-whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2z"/></svg>
      </a>
    </div>
  </div>
</header>

<div class="fondo-carrito" id="fondo-carrito"></div>
<div class="drawer-carrito" id="drawer-carrito">
  <div class="carrito-header"><h2>Tu pedido</h2><button class="btn-cerrar-drawer" id="btn-cerrar-carrito">✕</button></div>
  <div class="carrito-lista" id="carrito-lista"></div>
  <div class="carrito-footer" id="carrito-footer" style="display:none;">
    <div class="carrito-total"><span>Total</span><span id="carrito-total-monto">S/ 0.00</span></div>
    <button class="btn-enviar-pedido" id="btn-enviar-pedido">Finalizar pedido</button>
    <button class="btn-vaciar-carrito" id="btn-vaciar-carrito">Vaciar carrito</button>
  </div>
</div>
<div class="toast-carrito" id="toast-carrito"></div>

<div class="fondo-drawer" id="fondo-drawer"></div>
<nav class="drawer" id="drawer">
  <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
    <span class="logo-chip"><img src="/logo.webp" alt="Fenix Import Perú" style="height:26px;"></span>
    <button class="btn-cerrar-drawer" id="btn-cerrar-drawer">✕</button>
  </div>
  <a class="drawer-link" href="/index.html">Inicio</a>
  <a class="drawer-link" href="/catalogo.html">Catálogo completo</a>
  <p class="drawer-seccion-titulo">Categorías</p>
  <div id="drawer-categorias"><p style="padding:10px 0; color:var(--texto-muted); font-size:.85rem;">Cargando...</p></div>
  <div class="drawer-redes">
    <a href="https://www.instagram.com/feniximportperu/" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
    <a href="https://www.facebook.com/FenixImportPeru" target="_blank" rel="noopener" aria-label="Facebook">FB</a>
  </div>
</nav>

<nav class="breadcrumb">${breadcrumbHtml}</nav>

<main>
  <div class="producto-layout">
    <div class="producto-img">${badgeOferta}${imagenHtml}</div>
    <div>
      <p class="producto-categoria">${escaparHtml(producto.categoria || "")}${producto.subcategoria ? " · " + escaparHtml(producto.subcategoria) : ""}</p>
      <h1 class="producto-nombre">${nombreEscapado}</h1>
      <p class="producto-precio">S/ ${precio}</p>
      <div class="producto-meta">${metaHtml}</div>
      <button class="btn-agregar-carrito-producto" onclick="agregarAlCarritoActual()">+ Agregar al pedido</button>
      <a class="btn-whatsapp-producto" href="${urlWhatsApp}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
      <p class="nota-entrega">Coordinamos entrega en Lima y envíos a todo el Perú.</p>
    </div>
  </div>
  <div class="producto-secciones">
    ${seccion("Descripción", producto.descripcion)}
    ${seccion("Características", producto.caracteristicas)}
    ${seccion("Incluye", producto.incluye)}
  </div>
</main>

<footer>© <span id="anio"></span> Fenix Import Perú. Todos los derechos reservados.</footer>

<a class="whatsapp-flotante" href="#" id="whatsapp-flotante" target="_blank" rel="noopener" aria-label="WhatsApp">
  <svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2z"/></svg>
</a>

<script>window.PRODUCTO_ACTUAL = ${productoActualJs};</script>
<script src="/producto-comun.js"></script>
</body>
</html>`;
}

function generarSitemap(productos) {
  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${URL_SITIO}/`, priority: "1.0" },
    { loc: `${URL_SITIO}/catalogo.html`, priority: "0.9" },
    ...productos.filter(p => p.sku).map(p => ({ loc: `${URL_SITIO}/producto/${p.sku}.html`, priority: "0.7" }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${hoy}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  fs.writeFileSync(RUTA_SITEMAP, xml, "utf-8");
  console.log(`✓ sitemap.xml actualizado (${urls.length} URLs)`);
}

function main() {
  console.log(`Generando páginas de producto con URL_SITIO = ${URL_SITIO}\n`);

  if (!fs.existsSync(RUTA_PRODUCTOS_JSON)) {
    console.error(`✗ No se encontró productos.json en: ${RUTA_PRODUCTOS_JSON}`);
    process.exit(1);
  }

  const catalogo = JSON.parse(fs.readFileSync(RUTA_PRODUCTOS_JSON, "utf-8"));
  const productos = catalogo.productos || [];

  if (productos.length === 0) {
    console.error("✗ productos.json no tiene productos (¿la clave se llama 'productos'?)");
    process.exit(1);
  }

  if (!fs.existsSync(CARPETA_SALIDA)) fs.mkdirSync(CARPETA_SALIDA, { recursive: true });

  const skusVistos = new Set();
  let generados = 0;
  let omitidos = 0;

  for (const producto of productos) {
    if (!producto.sku) {
      console.warn(`  ⚠ Producto sin SKU, omitido: ${producto.nombre || "(sin nombre)"}`);
      omitidos++;
      continue;
    }
    if (skusVistos.has(producto.sku)) {
      console.warn(`  ⚠ SKU duplicado, omitido: ${producto.sku}`);
      omitidos++;
      continue;
    }
    skusVistos.add(producto.sku);

    try {
      const html = generarHtmlProducto(producto);
      fs.writeFileSync(path.join(CARPETA_SALIDA, `${producto.sku}.html`), html, "utf-8");
      generados++;
    } catch (err) {
      console.error(`  ✗ Error generando ${producto.sku}: ${err.message}`);
      omitidos++;
    }
  }

  console.log(`\n✓ ${generados} páginas generadas en /producto`);
  if (omitidos > 0) console.log(`⚠ ${omitidos} productos omitidos (revisa los avisos arriba)`);

  generarSitemap(productos.filter(p => p.sku && skusVistos.has(p.sku)));
}

main();
