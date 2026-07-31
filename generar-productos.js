#!/usr/bin/env node
/**
 * generar-productos.js
 * ------------------------------------------------------------
 * Lee productos.json y genera una página HTML estática por
 * cada producto en /producto/{slug}.html (slug = nombre del
 * producto, estilo WordPress — así coincide con las URLs que
 * Google ya tenía indexadas de la web anterior), con título,
 * meta description, Open Graph y JSON-LD ya "horneados".
 *
 * También genera un stub de redirección en /producto/{SKU}.html
 * (la ruta vieja de este mismo sitio) apuntando al slug nuevo,
 * por si quedó algún link o localStorage de un cliente apuntando
 * ahí de antes de este cambio.
 *
 * También regenera sitemap.xml con todas las URLs nuevas.
 *
 * USO:
 *   1) Coloca este archivo en la raíz de tu proyecto, junto a
 *      productos.json, css/producto.css y js/{util,carrito,producto}.js
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

/**
 * Respaldo por si productos.json todavía no trae el campo "slug"
 * (por ejemplo, si corres este script antes de actualizar el
 * Apps Script que lo genera). Réplica de sanitize_title_with_dashes
 * de WordPress. Ojo: sin el campo "slug" no se resuelven duplicados
 * entre productos con el mismo nombre — por eso lo ideal es que
 * productos.json ya traiga el slug calculado.
 */
function generarSlugRespaldo(nombre) {
  let texto = String(nombre || "").trim();
  texto = texto.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  texto = texto.toLowerCase();
  texto = texto.replace(/&.+?;/g, "");
  texto = texto.replace(/\./g, "-");
  texto = texto.replace(/&/g, "and");
  texto = texto.replace(/[^a-z0-9 _-]/g, "");
  texto = texto.replace(/[ _]/g, "-");
  texto = texto.replace(/-+/g, "-");
  texto = texto.replace(/^-+|-+$/g, "");
  return texto;
}

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
  const nombreConColor = producto.color ? `${producto.nombre} - ${producto.color}` : producto.nombre;
  const mensaje = `¡Hola, Fenix Import Perú!\nMe gustaría realizar el siguiente pedido:\n${nombreConColor}\nPrecio: S/ ${precio}\nSKU: ${producto.sku}\n${url}`;
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Productos relacionados: prioriza misma subcategoría, completa con
 * la misma categoría si hacen falta más. Se calcula una sola vez al
 * publicar — la ficha no hace ningún fetch extra para esto.
 */
function obtenerRelacionados(producto, todosLosProductos, limite) {
  const mismaSubcategoria = [];
  const mismaCategoria = [];

  for (const p of todosLosProductos) {
    if (p.sku === producto.sku) continue;
    if (producto.subcategoria && p.subcategoria === producto.subcategoria && p.categoria === producto.categoria) {
      mismaSubcategoria.push(p);
    } else if (p.categoria === producto.categoria) {
      mismaCategoria.push(p);
    }
  }

  return mismaSubcategoria.concat(mismaCategoria).slice(0, limite);
}

function tarjetaFranja(p) {
  const precio = limpiarPrecio(p.precio);
  const nombre = escaparHtml(p.nombre);
  const slug = p.slug || generarSlugRespaldo(p.nombre);
  const imagenHtml = p.imagen
    ? `<img src="${p.imagen}" alt="${nombre}" loading="lazy">`
    : `<span class="sin-foto">Sin foto</span>`;
  const productoJson = encodeURIComponent(JSON.stringify({ sku: p.sku, slug: slug, nombre: p.nombre, precio: precio, imagen: p.imagen || "" }));

  return `
    <a class="franja-tarjeta" href="/producto/${encodeURIComponent(slug)}.html">
      <div class="franja-tarjeta-img">${imagenHtml}</div>
      <p class="franja-tarjeta-nombre">${nombre}</p>
      <p class="franja-tarjeta-precio">S/ ${precio}</p>
      <button class="franja-tarjeta-agregar" onclick="event.preventDefault(); agregarProductoAlCarritoDesdeTarjeta('${productoJson}')">+ Agregar</button>
    </a>`;
}

/**
 * Arma el HTML de la galería (imagen principal + flechas + lupa +
 * miniaturas) a partir de producto.imagenes (array) con fallback
 * a producto.imagen (singular) para SKUs aún no migrados.
 * Devuelve también el array de imágenes ya normalizado, para
 * reutilizarlo en el JSON-LD y en window.PRODUCTO_ACTUAL.
 */
function generarGaleriaHtml(producto, nombreEscapado) {
  const imagenes = (producto.imagenes && producto.imagenes.length > 0)
    ? producto.imagenes
    : (producto.imagen ? [producto.imagen] : []);

  if (imagenes.length === 0) {
    return {
      galeriaHtml: `<div class="producto-galeria"><div class="producto-img"><span class="sin-foto">Sin foto disponible</span></div></div>`,
      imagenes
    };
  }

  const flechas = imagenes.length > 1 ? `
    <button class="galeria-flecha izq" onclick="cambiarImagen(-1)" aria-label="Anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button class="galeria-flecha der" onclick="cambiarImagen(1)" aria-label="Siguiente">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <span class="galeria-contador" id="galeria-contador">1 / ${imagenes.length}</span>
  ` : "";

  const miniaturas = imagenes.length > 1 ? `
    <div class="galeria-miniaturas" id="galeria-miniaturas">
      ${imagenes.map((url, i) => `
        <div class="miniatura ${i === 0 ? "activa" : ""}" data-indice="${i}" onclick="irAImagen(${i})">
          <img src="${url}" alt="Vista ${i + 1}" loading="lazy">
        </div>`).join("")}
    </div>` : "";

  const galeriaHtml = `
    <div class="producto-galeria">
      <div class="producto-img" id="producto-img-principal">
        ${flechas}
        <button class="galeria-lupa" onclick="abrirLupa()" aria-label="Ampliar imagen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <img id="imagen-principal" src="${imagenes[0]}" alt="${nombreEscapado}">
      </div>
      ${miniaturas}
    </div>`;

  return { galeriaHtml, imagenes };
}

function generarJsonLd(producto, precio, url, imagenes) {
  const productoLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    sku: producto.sku,
    image: imagenes.length > 0 ? imagenes : undefined,
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

  if (producto.esGrupo && producto.variantes && producto.variantes.length > 1) {
    productoLd.hasVariant = producto.variantes.map(v => ({
      "@type": "Product",
      name: `${producto.nombre} - ${v.color}`,
      sku: v.sku,
      color: v.color || undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "PEN",
        price: limpiarPrecio(v.precio),
        availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
      }
    }));
  }

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

function generarHtmlProducto(producto, todosLosProductos) {
  const precio = limpiarPrecio(producto.precio);
  const slug = producto.slug || generarSlugRespaldo(producto.nombre);
  const url = `${URL_SITIO}/producto/${slug}.html`;
  const nombreEscapado = escaparHtml(producto.nombre);
  const descripcionCorta = escaparHtml((producto.descripcion || producto.nombre).slice(0, 160));
  const imagenAbsoluta = producto.imagen || `${URL_SITIO}/logo.webp`;

  const relacionados = obtenerRelacionados(producto, todosLosProductos, 10);
  const relacionadosHtml = relacionados.length > 0
    ? `<section class="franja-productos">
        <h2 class="franja-titulo">También te puede interesar</h2>
        <div class="franja-scroll">${relacionados.map(tarjetaFranja).join("")}</div>
      </section>`
    : "";

  const { galeriaHtml, imagenes } = generarGaleriaHtml(producto, nombreEscapado);
  const badgeOferta = producto.oferta ? `<span class="badge-oferta-producto">Oferta</span>` : "";

  const metaChips = [];
  if (producto.marca) metaChips.push(`<span>${escaparHtml(producto.marca)}</span>`);
  if (producto.color && !producto.esGrupo) metaChips.push(`<span>${escaparHtml(producto.color)}</span>`);
  metaChips.push(`<span id="meta-sku">SKU ${escaparHtml(producto.sku)}</span>`);
  const metaHtml = metaChips.join("");

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

  const jsonLd = generarJsonLd(producto, precio, url, imagenes);
  const urlWhatsApp = generarUrlWhatsApp(producto, precio, url);

  // Datos mínimos que la página necesita en el navegador (carrito, WhatsApp, galería)
  const productoActualJs = escaparJsonEnHtml({
    sku: producto.sku,
    slug: slug,
    nombre: producto.nombre,
    precio: precio,
    imagen: producto.imagen || "",
    imagenes: imagenes,
    variantes: (producto.esGrupo && producto.variantes) ? producto.variantes.map(v => ({
      sku: v.sku,
      color: v.color || "",
      precio: limpiarPrecio(v.precio),
      imagen: v.imagen || "",
      imagenes: (v.imagenes && v.imagenes.length > 0) ? v.imagenes : (v.imagen ? [v.imagen] : []),
      stock: v.stock || 0
    })) : null
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
<link rel="stylesheet" href="/css/variables.css">
<link rel="stylesheet" href="/css/header.css">
<link rel="stylesheet" href="/css/carrito.css">
<link rel="stylesheet" href="/css/footer.css">
<link rel="stylesheet" href="/css/producto.css">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>

<div id="header-placeholder"></div>
<script src="/js/header.js"></script>

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

<nav class="breadcrumb">${breadcrumbHtml}</nav>

<main>
  <div class="producto-layout">
    <div style="position:relative;">${badgeOferta}${galeriaHtml}</div>
    <div>
      <p class="producto-categoria">${escaparHtml(producto.categoria || "")}${producto.subcategoria ? " · " + escaparHtml(producto.subcategoria) : ""}</p>
      <h1 class="producto-nombre">${nombreEscapado}</h1>
      <p class="producto-precio" id="producto-precio">S/ ${precio}</p>
      <div class="producto-meta">${metaHtml}</div>
      ${(producto.esGrupo && producto.variantes && producto.variantes.length > 1) ? `
      <div class="producto-variantes" id="producto-variantes">
        <p class="producto-variantes-titulo">Color: <span id="variante-color-activo">${escaparHtml(producto.color || "")}</span></p>
        <div class="producto-variantes-swatches">
          ${producto.variantes.map((v, i) => `
            <button class="variante-swatch ${i === 0 ? "activo" : ""}" data-indice="${i}" title="${escaparHtml(v.color || "")}" aria-label="${escaparHtml(v.color || "")}">
              ${v.imagen ? `<img src="${v.imagen}" alt="${escaparHtml(v.color || "")}">` : `<span class="variante-swatch-sin-foto"></span>`}
            </button>`).join("")}
        </div>
      </div>` : ""}
      <button class="btn-agregar-carrito-producto" onclick="agregarAlCarritoActual()">+ Agregar al pedido</button>
      <a class="btn-whatsapp-producto" id="btn-whatsapp-producto" href="${urlWhatsApp}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
      <p class="nota-entrega">Coordinamos entrega en Lima y envíos a todo el Perú.</p>
    </div>
  </div>
  <div class="producto-secciones">
    ${seccion("Descripción", producto.descripcion)}
    ${seccion("Características", producto.caracteristicas)}
    ${seccion("Incluye", producto.incluye)}
  </div>

  ${relacionadosHtml}

  <section class="franja-productos" id="seccion-vistos" style="display:none;">
    <h2 class="franja-titulo">Vistos recientemente</h2>
    <div class="franja-scroll" id="franja-vistos"></div>
  </section>
</main>

<div id="footer-placeholder" data-variant="reducido"></div>
<script src="/js/footer.js"></script>

<a class="whatsapp-flotante" href="#" id="whatsapp-flotante" target="_blank" rel="noopener" aria-label="WhatsApp">
  <svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.3.37-.43.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.31 2.35 1.45.29.15.46.13.63-.07.17-.2.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
</a>

<div class="modal-zoom-fondo" id="modal-zoom-fondo" onclick="if(event.target===this) cerrarLupa()">
  <div class="modal-zoom-contenido">
    <button class="modal-zoom-cerrar" onclick="cerrarLupa()" aria-label="Cerrar">✕</button>
    <button class="modal-zoom-flecha izq" onclick="cambiarImagenModal(-1)" aria-label="Anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <img id="modal-zoom-imagen" src="" alt="Imagen ampliada">
    <button class="modal-zoom-flecha der" onclick="cambiarImagenModal(1)" aria-label="Siguiente">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <span class="modal-zoom-contador" id="modal-zoom-contador"></span>
  </div>
</div>

<script>window.PRODUCTO_ACTUAL = ${productoActualJs};</script>
<script src="/js/util.js"></script>
<script src="/js/carrito.js"></script>
<script src="/js/producto.js"></script>
</body>
</html>`;
}

function generarSitemap(productos) {
  const hoy = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${URL_SITIO}/`, priority: "1.0" },
    { loc: `${URL_SITIO}/catalogo.html`, priority: "0.9" },
    ...productos.filter(p => p.sku).map(p => ({ loc: `${URL_SITIO}/producto/${p.slug || generarSlugRespaldo(p.nombre)}.html`, priority: "0.7" }))
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

  if (!fs.existsSync(CARPETA_SALIDA)) {
    fs.mkdirSync(CARPETA_SALIDA, { recursive: true });
  } else {
    // Limpiar archivos .html viejos antes de regenerar — así ningún archivo
    // de una estructura anterior (SKU individual, variante ya agrupada,
    // slug que cambió, etc.) queda huérfano y accesible sin querer.
    const archivosViejos = fs.readdirSync(CARPETA_SALIDA).filter(f => f.endsWith(".html"));
    archivosViejos.forEach(f => fs.unlinkSync(path.join(CARPETA_SALIDA, f)));
    if (archivosViejos.length > 0) {
      console.log(`🧹 Se limpiaron ${archivosViejos.length} archivos .html anteriores en /producto antes de regenerar.\n`);
    }
  }

  const skusVistos = new Set();
  const slugsVistos = new Set();
  const archivosReales = new Set(); // slugs que ya son una página real (no un stub)
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

    const slugCandidato = producto.slug || generarSlugRespaldo(producto.nombre);
    if (slugsVistos.has(slugCandidato)) {
      console.warn(`  ⚠ Slug duplicado ("${slugCandidato}"), omitido: ${producto.sku}. Si productos.json ya trae "slug" del Apps Script esto no debería pasar — revisa que esté actualizado.`);
      omitidos++;
      continue;
    }
    slugsVistos.add(slugCandidato);

    try {
      const slug = producto.slug || generarSlugRespaldo(producto.nombre);
      const html = generarHtmlProducto(producto, productos);
      fs.writeFileSync(path.join(CARPETA_SALIDA, `${slug}.html`), html, "utf-8");
      archivosReales.add(slug);

      // Stub de redirección en la ruta vieja por SKU (por si quedó algún link
      // o localStorage de un cliente apuntando ahí de antes de este cambio).
      // Para un grupo de variantes, cada color tenía su propia página antes
      // de agruparse — así que TODAS sus SKU necesitan su propio stub, no
      // solo la variante principal.
      const urlNueva = `/producto/${slug}.html`;
      const htmlRedireccion = (skuViejo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${urlNueva}">
<link rel="canonical" href="${URL_SITIO}${urlNueva}">
<meta name="robots" content="noindex">
<title>Redirigiendo…</title>
</head>
<body>
<p>Este producto se movió. <a href="${urlNueva}">Haz clic aquí si no eres redirigido automáticamente</a>.</p>
</body>
</html>`;

      const skusARedirigir = new Set();
      if (slug !== producto.sku) skusARedirigir.add(producto.sku);
      if (producto.esGrupo && Array.isArray(producto.variantes)) {
        producto.variantes.forEach(v => {
          if (v.sku && v.sku !== slug) skusARedirigir.add(v.sku);
        });
      }
      skusARedirigir.forEach(skuViejo => {
        if (archivosReales.has(skuViejo)) {
          console.warn(`  ⚠ "${skuViejo}" es el slug de otra página real — no se generó su stub de redirección para evitar pisarla. Revisa si hay un SKU duplicado en el Sheet.`);
          return;
        }
        fs.writeFileSync(path.join(CARPETA_SALIDA, `${skuViejo}.html`), htmlRedireccion(skuViejo), "utf-8");
      });

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