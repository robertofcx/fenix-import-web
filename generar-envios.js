/**
 * generar-envios.js
 * ------------------------------------------------------------
 * Genera /envios.html (página "Envíos a todo el Perú") con las
 * tarifas de delivery de distritos.json ya escritas en el HTML,
 * para que Google y los asistentes de IA puedan leerlas.
 *
 * Se invoca desde generar-productos.js. Para cambiar tarifas basta
 * con editar distritos.json; para cambiar agencias o textos, edita
 * la CONFIGURACIÓN de abajo.
 * ------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

// ==================== CONFIGURACIÓN ====================
const AGENCIAS_SIN_RECARGO = ["Shalom", "Olva Courier", "Urbano", "Hnos Flores", "Marvisur"];
const DIRECCION_ALMACEN = "Jr. Cajabamba 313, Independencia, Lima";
const NUMERO_WHATSAPP = "51978821080";

const PREGUNTAS = [
  {
    p: "¿Cuánto demora el envío a provincia?",
    r: "Dejamos tu pedido en la agencia por la tarde; los pedidos confirmados hasta las 3:00 p. m. salen el mismo día. Suele llegar en 48 horas, pero puede tardar más según la agencia y el destino."
  },
  {
    p: "¿Qué agencias usan para provincia?",
    r: `${AGENCIAS_SIN_RECARGO.join(", ")}, sin costo adicional por llevar tu paquete a la agencia. Otras agencias, previa evaluación.`
  },
  {
    p: "¿Quién paga el flete a provincia?",
    r: "Lo pagas en la agencia al recoger tu paquete. En Olva Courier el flete se paga por adelantado."
  },
  {
    p: "¿Cuánto cuesta el delivery en Lima?",
    r: "Desde S/ 10 según el distrito. Los pedidos confirmados antes de las 10:00 a. m. se entregan el mismo día. Puede haber recargo por volumen del producto o pedido."
  },
  {
    p: "¿Puedo recoger mi pedido?",
    r: `Sí, el recojo en almacén es gratis y con cita previa, de lunes a viernes hasta las 5:00 p. m. Estamos en ${DIRECCION_ALMACEN}.`
  },
  {
    p: "¿Los precios incluyen IGV?",
    r: "No. Los precios publicados son sin IGV; si necesitas boleta o factura se agrega el 18 %."
  }
];
// =========================================================

function escaparHtml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function leerDistritos(dirRaiz) {
  const ruta = path.join(dirRaiz, "distritos.json");
  if (!fs.existsSync(ruta)) return [];
  const datos = JSON.parse(fs.readFileSync(ruta, "utf-8"));
  return (datos.distritos || []).filter(d => d.nombre && Number(d.costo) > 0);
}

function tablaTarifas(distritos) {
  const porCosto = new Map();
  distritos.forEach(d => {
    const c = Number(d.costo);
    if (!porCosto.has(c)) porCosto.set(c, []);
    porCosto.get(c).push(d.nombre);
  });
  return [...porCosto.keys()].sort((a, b) => a - b).map(c => `
        <div class="tarifa-fila" data-distritos="${escaparHtml(porCosto.get(c).join("|").toLowerCase())}">
          <span class="tarifa-precio">S/ ${c}</span>
          <span class="tarifa-distritos">${porCosto.get(c).sort((a, b) => a.localeCompare(b, "es")).map(escaparHtml).join(", ")}</span>
        </div>`).join("");
}

function generarPaginaEnvios(urlSitio, dirRaiz) {
  const distritos = leerDistritos(dirRaiz);
  const costos = distritos.map(d => Number(d.costo));
  const desde = costos.length ? Math.min(...costos) : null;
  const url = `${urlSitio}/envios.html`;
  const titulo = "Envíos a todo el Perú — delivery en Lima y provincias | Fenix Import Perú";
  const descripcion = `Recojo gratis en almacén, delivery en Lima${desde ? ` desde S/ ${desde}` : ""} y envíos a provincias por ${AGENCIAS_SIN_RECARGO.join(", ")}.`;

  const jsonLd = JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: PREGUNTAS.map(q => ({
        "@type": "Question",
        name: q.p,
        acceptedAnswer: { "@type": "Answer", text: q.r }
      }))
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${urlSitio}/` },
        { "@type": "ListItem", position: 2, name: "Envíos", item: url }
      ]
    }
  ]).replace(/</g, "\\u003c");

  const mensajeWa = encodeURIComponent("¡Hola, Fenix Import Perú! Quiero consultar por un envío.");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escaparHtml(titulo)}</title>
<meta name="description" content="${escaparHtml(descripcion)}">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/x-icon" href="/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">

<meta property="og:type" content="website">
<meta property="og:title" content="${escaparHtml(titulo)}">
<meta property="og:description" content="${escaparHtml(descripcion)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${urlSitio}/logo.webp">
<meta property="og:locale" content="es_PE">

<script type="application/ld+json">${jsonLd}</script>

<link rel="stylesheet" href="/css/variables.css">
<link rel="stylesheet" href="/css/header.css">
<link rel="stylesheet" href="/css/carrito.css">
<link rel="stylesheet" href="/css/footer.css">
<link rel="stylesheet" href="/css/paginas.css">
</head>
<body>

  <div id="header-placeholder"></div>
  <script src="/js/util.js"></script>
  <script src="/js/productos-store.js"></script>
  <script src="/js/header.js"></script>

  <nav class="breadcrumb"><a href="/">Inicio</a><span class="sep">›</span><span class="actual">Envíos</span></nav>

  <section class="pagina-contenido">
    <div class="contenedor-angosto">
      <h1 class="pagina-titulo">Envíos a todo el Perú</h1>
      <p class="pagina-intro">Elige cómo recibir tu pedido.</p>

      <div class="grilla-3">
        <div class="tarjeta-destacada">
          <h3>Recojo en almacén</h3>
          <p><strong>Gratis</strong>, con cita previa.</p>
          <p>Lunes a viernes, hasta las 5:00 p. m.</p>
          <p>${escaparHtml(DIRECCION_ALMACEN)}</p>
        </div>
        <div class="tarjeta-destacada">
          <h3>Delivery en Lima</h3>
          <p>${desde ? `<strong>Desde S/ ${desde}</strong> según distrito.` : "Costo según distrito."}</p>
          <p>Pedidos confirmados antes de las 10:00 a. m. llegan el mismo día.</p>
        </div>
        <div class="tarjeta-destacada">
          <h3>Envío a provincia</h3>
          <p>Por la agencia que elijas.</p>
          <p>Pedidos confirmados hasta las 3:00 p. m. salen el mismo día.</p>
        </div>
      </div>

      <div class="pagina-seccion">
        <h2>Delivery en Lima por distrito</h2>
        <input type="search" id="buscar-distrito" class="buscar-distrito" placeholder="Busca tu distrito" aria-label="Buscar distrito">
        <div id="tarifas">${tablaTarifas(distritos)}
        </div>
        <p id="sin-distrito" class="sin-distrito" hidden>No hacemos delivery a ese distrito. Elige envío a provincia por agencia.</p>
        <div class="aviso-cita-previa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <span>Puede haber recargo por volumen del producto o pedido.</span>
        </div>
      </div>

      <div class="pagina-seccion">
        <h2>Envío a provincia</h2>
        <div class="grilla-2">
          <div class="tarjeta-destacada">
            <h3>Sin recargo</h3>
            <div class="chips-agencias">${AGENCIAS_SIN_RECARGO.map(a => `<span class="chip-agencia">${escaparHtml(a)}</span>`).join("")}</div>
          </div>
          <div class="tarjeta-destacada">
            <h3>Otras agencias</h3>
            <p>Previa evaluación.</p>
          </div>
        </div>
        <ol class="pasos-envio">
          <li>Pagas tu pedido.</li>
          <li>Lo dejamos en la agencia por la tarde.</li>
          <li>Llega en 48 horas o más, según la agencia y el destino.</li>
        </ol>
        <p>El flete se paga en la agencia al recoger. En Olva Courier se paga por adelantado.</p>
      </div>

      <div class="pagina-seccion">
        <h2>Preguntas frecuentes</h2>
${PREGUNTAS.map(q => `        <details class="faq-item">
          <summary>${escaparHtml(q.p)}</summary>
          <p class="faq-respuesta">${escaparHtml(q.r)}</p>
        </details>`).join("\n")}
      </div>

      <div class="hero-botones">
        <a class="btn btn-whatsapp" href="https://wa.me/${NUMERO_WHATSAPP}?text=${mensajeWa}" target="_blank" rel="noopener">Consultar por WhatsApp</a>
        <a class="btn btn-principal" href="/catalogo.html">Ver catálogo</a>
      </div>
    </div>
  </section>

  <div id="footer-placeholder" data-variant="completo"></div>
  <script src="/js/footer.js"></script>

  <script>
  (function () {
    var input = document.getElementById("buscar-distrito");
    var filas = document.querySelectorAll(".tarifa-fila");
    var vacio = document.getElementById("sin-distrito");
    function normalizar(t) { return t.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); }
    input.addEventListener("input", function () {
      var q = normalizar(input.value.trim());
      var visibles = 0;
      filas.forEach(function (f) {
        var ok = !q || normalizar(f.dataset.distritos).indexOf(q) !== -1;
        f.hidden = !ok;
        if (ok) visibles++;
      });
      vacio.hidden = visibles > 0;
    });
  })();
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(dirRaiz, "envios.html"), html, "utf-8");
  console.log(`✓ envios.html generado (${distritos.length} distritos)`);
}

module.exports = { generarPaginaEnvios };
