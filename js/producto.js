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

  // ---------- Inicializar galería con los datos de la página ----------
  if (window.PRODUCTO_ACTUAL && window.PRODUCTO_ACTUAL.imagenes) {
    imagenesProductoActual = window.PRODUCTO_ACTUAL.imagenes;
    activarSwipeGaleria();
  }
});

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
