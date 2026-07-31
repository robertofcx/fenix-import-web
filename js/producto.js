/* ============================================================
   producto.js — lógica específica de las páginas de producto
   (/producto/*.html): galería/carrusel de imágenes, swipe táctil
   y modal de zoom. El tema oscuro/claro, el menú lateral y las
   categorías del drawer ya los maneja header.js.

   Cada página de producto define window.PRODUCTO_ACTUAL antes de
   cargar este script.
   ============================================================ */

const NUMERO_WHATSAPP = "51978821080";

// ---------- Estado de la galería / carrusel ----------
let imagenesProductoActual = [];
let indiceImagenActual = 0;

document.addEventListener("DOMContentLoaded", () => {
  // #anio ya lo escribe footer.js al inyectar el footer

  // nav-whatsapp ya lo asigna header.js; aquí solo el flotante propio de esta página.
  const elFlotante = document.getElementById("whatsapp-flotante");
  if (elFlotante) {
    elFlotante.href = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" +
      encodeURIComponent("¡Hola Fenix Import Perú!\nMe gustaría más información sobre sus productos.");
  }

  // ---------- Vistos recientemente ----------
  if (window.PRODUCTO_ACTUAL) {
    renderizarVistos(window.PRODUCTO_ACTUAL.sku);
    registrarVisto(window.PRODUCTO_ACTUAL);
  }

  // ---------- Inicializar galería con los datos de la página ----------
  if (window.PRODUCTO_ACTUAL && window.PRODUCTO_ACTUAL.imagenes) {
    imagenesProductoActual = window.PRODUCTO_ACTUAL.imagenes;
    activarSwipeGaleria();
  }

  // ---------- Selector de color (variantes) ----------
  if (window.PRODUCTO_ACTUAL && window.PRODUCTO_ACTUAL.variantes && window.PRODUCTO_ACTUAL.variantes.length > 0) {
    inicializarVariantes();
  }
});

// ==================== VARIANTES (SELECTOR DE COLOR) ====================
let varianteActivaIndice = 0;

function inicializarVariantes() {
  document.querySelectorAll(".variante-swatch").forEach(boton => {
    boton.addEventListener("click", () => {
      seleccionarVariante(Number(boton.dataset.indice));
    });
  });
}

function seleccionarVariante(indice) {
  const variantes = window.PRODUCTO_ACTUAL.variantes;
  const variante = variantes[indice];
  if (!variante) return;

  varianteActivaIndice = indice;

  document.querySelectorAll(".variante-swatch").forEach((boton, i) => {
    boton.classList.toggle("activo", i === indice);
  });

  const elColor = document.getElementById("variante-color-activo");
  if (elColor) elColor.textContent = variante.color || "";

  const elPrecio = document.getElementById("producto-precio");
  if (elPrecio) elPrecio.textContent = "S/ " + Number(String(variante.precio).replace(/[^0-9.]/g, "")).toFixed(2);

  const elSku = document.getElementById("meta-sku");
  if (elSku) elSku.textContent = "SKU " + variante.sku;

  renderizarGaleriaVariante(variante);
}

// Usada por carrito.js: si esta página tiene variantes, el botón
// "Agregar al pedido" debe sumar la variante elegida, no el grupo.
function obtenerVarianteActiva() {
  const variantes = window.PRODUCTO_ACTUAL && window.PRODUCTO_ACTUAL.variantes;
  if (variantes && variantes.length > 0) return variantes[varianteActivaIndice];
  return null;
}

/**
 * Reconstruye la galería completa (imagen principal + flechas + contador +
 * miniaturas) para la variante elegida — hace falta reconstruirla entera
 * (no solo la imagen) porque cada color puede tener una cantidad distinta
 * de fotos.
 */
function renderizarGaleriaVariante(variante) {
  const imagenes = (variante.imagenes && variante.imagenes.length > 0)
    ? variante.imagenes
    : (variante.imagen ? [variante.imagen] : []);

  imagenesProductoActual = imagenes;
  indiceImagenActual = 0;

  const contenedor = document.querySelector(".producto-galeria");
  if (!contenedor) return;

  if (imagenes.length === 0) {
    contenedor.innerHTML = `<div class="producto-img"><span class="sin-foto">Sin foto disponible</span></div>`;
    return;
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

  contenedor.innerHTML = `
    <div class="producto-img" id="producto-img-principal">
      ${flechas}
      <button class="galeria-lupa" onclick="abrirLupa()" aria-label="Ampliar imagen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <img id="imagen-principal" src="${imagenes[0]}" alt="">
    </div>
    ${miniaturas}
  `;

  activarSwipeGaleria();
}

// ==================== VISTOS RECIENTEMENTE ====================
const VISTOS_KEY = "fenix_vistos";
const MAX_VISTOS = 20;

function obtenerVistos() {
  try { return JSON.parse(localStorage.getItem(VISTOS_KEY)) || []; }
  catch (e) { return []; }
}

function registrarVisto(producto) {
  if (!producto || !producto.sku) return;
  let vistos = obtenerVistos().filter(p => p.sku !== producto.sku);
  vistos.unshift({ sku: producto.sku, slug: producto.slug || producto.sku, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen });
  if (vistos.length > MAX_VISTOS) vistos = vistos.slice(0, MAX_VISTOS);
  localStorage.setItem(VISTOS_KEY, JSON.stringify(vistos));
}

function renderizarVistos(skuActual) {
  const elSeccion = document.getElementById("seccion-vistos");
  const elFranja = document.getElementById("franja-vistos");
  if (!elSeccion || !elFranja) return;

  const vistos = obtenerVistos().filter(p => p.sku !== skuActual).slice(0, 10);
  if (vistos.length === 0) return;

  elFranja.innerHTML = vistos.map(p => {
    const precio = Number(String(p.precio).replace(/[^0-9.]/g, "")).toFixed(2);
    const slug = p.slug || p.sku;
    const imagenHtml = p.imagen
      ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">`
      : `<span class="sin-foto">Sin foto</span>`;
    const productoJson = encodeURIComponent(JSON.stringify({ sku: p.sku, slug: slug, nombre: p.nombre, precio: p.precio, imagen: p.imagen || "" }));
    return `
      <a class="franja-tarjeta" href="/producto/${encodeURIComponent(slug)}.html">
        <div class="franja-tarjeta-img">${imagenHtml}</div>
        <p class="franja-tarjeta-nombre">${p.nombre}</p>
        <p class="franja-tarjeta-precio">S/ ${precio}</p>
        <button class="franja-tarjeta-agregar" onclick="event.preventDefault(); agregarProductoAlCarritoDesdeTarjeta('${productoJson}')">+ Agregar</button>
      </a>`;
  }).join("");

  elSeccion.style.display = "block";
}

// ==================== GALERÍA / CARRUSEL DE IMÁGENES ====================

function irAImagen(indice) {
  indiceImagenActual = indice;
  const imgPrincipal = document.getElementById("imagen-principal");
  if (imgPrincipal) imgPrincipal.src = imagenesProductoActual[indice];

  const contador = document.getElementById("galeria-contador");
  if (contador) contador.textContent = `${indice + 1} / ${imagenesProductoActual.length}`;

  document.querySelectorAll(".miniatura").forEach((min, i) => min.classList.toggle("activa", i === indice));

  const modal = document.getElementById("modal-zoom-fondo");
  if (modal && modal.classList.contains("abierto")) {
    document.getElementById("modal-zoom-imagen").src = imagenesProductoActual[indice];
    actualizarContadorModal();
  }
}

function cambiarImagen(delta) {
  if (imagenesProductoActual.length === 0) return;
  let nuevo = indiceImagenActual + delta;
  if (nuevo < 0) nuevo = imagenesProductoActual.length - 1;
  if (nuevo >= imagenesProductoActual.length) nuevo = 0;
  irAImagen(nuevo);
}

function activarSwipeGaleria() {
  const contenedor = document.getElementById("producto-img-principal");
  if (!contenedor) return;
  let xInicio = 0;

  contenedor.addEventListener("touchstart", (e) => { xInicio = e.touches[0].clientX; }, { passive: true });
  contenedor.addEventListener("touchend", (e) => {
    const diferencia = e.changedTouches[0].clientX - xInicio;
    if (Math.abs(diferencia) < 40) return;
    cambiarImagen(diferencia > 0 ? -1 : 1);
  }, { passive: true });
}

// ==================== MODAL DE ZOOM (LUPA) ====================

function actualizarContadorModal() {
  const contador = document.getElementById("modal-zoom-contador");
  if (contador) contador.textContent = `${indiceImagenActual + 1} / ${imagenesProductoActual.length}`;
}

function abrirLupa() {
  if (imagenesProductoActual.length === 0) return;
  document.getElementById("modal-zoom-imagen").src = imagenesProductoActual[indiceImagenActual];
  actualizarContadorModal();
  document.getElementById("modal-zoom-fondo").classList.add("abierto");
  document.body.style.overflow = "hidden";
}

function cerrarLupa() {
  const modal = document.getElementById("modal-zoom-fondo");
  if (modal) modal.classList.remove("abierto");
  document.body.style.overflow = "";
}

function cambiarImagenModal(delta) {
  cambiarImagen(delta);
  document.getElementById("modal-zoom-imagen").src = imagenesProductoActual[indiceImagenActual];
  actualizarContadorModal();
}

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("modal-zoom-fondo");
  if (!modal || !modal.classList.contains("abierto")) return;
  if (e.key === "Escape") cerrarLupa();
  if (e.key === "ArrowLeft") cambiarImagenModal(-1);
  if (e.key === "ArrowRight") cambiarImagenModal(1);
});
