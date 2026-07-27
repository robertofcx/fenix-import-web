/* ============================================================
   producto-comun.js — lógica compartida por TODAS las páginas
   estáticas de producto. Se carga una sola vez por sesión de
   navegación y el navegador la cachea entre productos.
   Cada página de producto define window.PRODUCTO_ACTUAL antes
   de cargar este script.
   ============================================================ */

const RUTA_PRODUCTOS = "/productos.json";
const NUMERO_WHATSAPP = "51978821080";

// ---------- Estado de la galería / carrusel ----------
let imagenesProductoActual = [];
let indiceImagenActual = 0;

document.addEventListener("DOMContentLoaded", () => {
  const anio = document.getElementById("anio");
  if (anio) anio.textContent = new Date().getFullYear();

  // ---------- Tema oscuro / claro ----------
  const raiz = document.documentElement;
  function aplicarTema(tema) {
    raiz.setAttribute("data-tema", tema);
    localStorage.setItem("fenix-tema", tema);
  }
  aplicarTema(localStorage.getItem("fenix-tema") || "claro");
  const btnTema = document.getElementById("btn-tema");
  if (btnTema) {
    btnTema.addEventListener("click", () => {
      aplicarTema(raiz.getAttribute("data-tema") === "claro" ? "oscuro" : "claro");
    });
  }

  // ---------- Menú lateral ----------
  const drawer = document.getElementById("drawer");
  const fondoDrawer = document.getElementById("fondo-drawer");
  const btnAbrirDrawer = document.getElementById("btn-abrir-drawer");
  const btnCerrarDrawer = document.getElementById("btn-cerrar-drawer");
  function abrirDrawer() { drawer.classList.add("abierto"); fondoDrawer.classList.add("abierto"); document.body.style.overflow = "hidden"; }
  function cerrarDrawer() { drawer.classList.remove("abierto"); fondoDrawer.classList.remove("abierto"); document.body.style.overflow = ""; }
  if (btnAbrirDrawer) btnAbrirDrawer.addEventListener("click", abrirDrawer);
  if (btnCerrarDrawer) btnCerrarDrawer.addEventListener("click", cerrarDrawer);
  if (fondoDrawer) fondoDrawer.addEventListener("click", cerrarDrawer);

  // ---------- Cargar categorías + habilitar WhatsApp genérico ----------
  const urlWhatsAppGenerico = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" +
    encodeURIComponent("¡Hola Fenix Import Perú!\nMe gustaría más información sobre sus productos.");
  ["nav-whatsapp", "whatsapp-flotante"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = urlWhatsAppGenerico;
  });

  fetch(RUTA_PRODUCTOS)
    .then(r => r.json())
    .then(catalogo => dibujarDrawerCategorias(catalogo.categorias || []))
    .catch(err => console.error("No se pudieron cargar las categorías:", err));

  actualizarBadgeCarrito();

  // ---------- Inicializar galería con los datos de la página ----------
  if (window.PRODUCTO_ACTUAL && window.PRODUCTO_ACTUAL.imagenes) {
    imagenesProductoActual = window.PRODUCTO_ACTUAL.imagenes;
    activarSwipeGaleria();
  }
});

function dibujarDrawerCategorias(categorias) {
  const el = document.getElementById("drawer-categorias");
  if (!el) return;

  el.innerHTML = categorias.map((cat, i) => {
    const tieneSub = cat.subcategorias && cat.subcategorias.length > 0;
    if (!tieneSub) {
      return `<a class="drawer-categoria-sola" href="/catalogo.html?categoria=${encodeURIComponent(cat.nombre)}"><span>${cat.nombre}</span><span class="cantidad">${cat.cantidad}</span></a>`;
    }
    const subHtml = cat.subcategorias.map(sub => `
      <a class="drawer-subcategoria" href="/catalogo.html?categoria=${encodeURIComponent(cat.nombre)}&subcategoria=${encodeURIComponent(sub.nombre)}">
        <span>${sub.nombre}</span><span class="n">${sub.cantidad}</span>
      </a>`).join("");
    return `
      <div class="drawer-item" id="drawer-item-${i}">
        <button class="drawer-categoria-fila" data-indice="${i}">
          <span>${cat.nombre}</span><span class="cantidad">${cat.cantidad}</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div class="drawer-subcategorias">
          <a class="drawer-subcategoria" href="/catalogo.html?categoria=${encodeURIComponent(cat.nombre)}" style="font-weight:600; color:var(--texto);"><span>Ver todo en ${cat.nombre}</span></a>
          ${subHtml}
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".drawer-categoria-fila").forEach(boton => {
    boton.addEventListener("click", () => {
      document.getElementById("drawer-item-" + boton.dataset.indice).classList.toggle("abierto");
    });
  });
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

// ==================== CARRITO DE WHATSAPP ====================
const CARRITO_KEY = "fenix_carrito";

function obtenerCarrito() {
  try { return JSON.parse(localStorage.getItem(CARRITO_KEY)) || []; }
  catch (e) { return []; }
}

function guardarCarrito(carrito) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  actualizarBadgeCarrito();
}

function actualizarBadgeCarrito() {
  const carrito = obtenerCarrito();
  const total = carrito.reduce((s, i) => s + i.cantidad, 0);
  const badge = document.getElementById("badge-carrito");
  if (!badge) return;
  if (total > 0) { badge.textContent = total; badge.style.display = "flex"; }
  else { badge.style.display = "none"; }
}

function mostrarToast(mensaje) {
  const toast = document.getElementById("toast-carrito");
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.add("visible");
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function extraerPrecioNumerico(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")) || 0;
}

// Cada página de producto estática define window.PRODUCTO_ACTUAL
// (objeto con sku, nombre, precio, imagen, imagenes) antes de llamar a esta función.
function agregarAlCarritoActual() {
  const producto = window.PRODUCTO_ACTUAL;
  if (!producto) return;
  const carrito = obtenerCarrito();
  const existente = carrito.find(item => item.sku === producto.sku);
  if (existente) existente.cantidad += 1;
  else carrito.push({ sku: producto.sku, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen, cantidad: 1 });
  guardarCarrito(carrito);
  mostrarToast("✓ Agregado a tu pedido");
}

function quitarDelCarrito(sku) {
  guardarCarrito(obtenerCarrito().filter(i => i.sku !== sku));
  renderizarCarrito();
}

function cambiarCantidad(sku, delta) {
  const carrito = obtenerCarrito();
  const item = carrito.find(i => i.sku === sku);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) return quitarDelCarrito(sku);
  guardarCarrito(carrito);
  renderizarCarrito();
}

function renderizarCarrito() {
  const carrito = obtenerCarrito();
  const lista = document.getElementById("carrito-lista");
  const footer = document.getElementById("carrito-footer");
  if (!lista || !footer) return;

  if (carrito.length === 0) {
    lista.innerHTML = `<div class="carrito-vacio">Tu pedido está vacío.<br>Agrega productos desde el catálogo.</div>`;
    footer.style.display = "none";
    return;
  }
  footer.style.display = "block";
  lista.innerHTML = carrito.map(item => {
    const precioUnit = extraerPrecioNumerico(item.precio);
    const img = item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}">` : "";
    return `
      <div class="carrito-item">
        <div class="carrito-item-img">${img}</div>
        <div class="carrito-item-info">
          <p class="carrito-item-nombre">${item.nombre}</p>
          <p class="carrito-item-precio">S/ ${precioUnit.toFixed(2)} c/u</p>
          <div class="carrito-item-controles">
            <button onclick="cambiarCantidad('${item.sku}', -1)">−</button>
            <span class="carrito-item-cantidad">${item.cantidad}</span>
            <button onclick="cambiarCantidad('${item.sku}', 1)">+</button>
            <button class="carrito-item-quitar" onclick="quitarDelCarrito('${item.sku}')">Quitar</button>
          </div>
        </div>
      </div>`;
  }).join("");
  const total = carrito.reduce((s, i) => s + extraerPrecioNumerico(i.precio) * i.cantidad, 0);
  document.getElementById("carrito-total-monto").textContent = "S/ " + total.toFixed(2);
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAbrir = document.getElementById("btn-abrir-carrito");
  const btnCerrar = document.getElementById("btn-cerrar-carrito");
  const fondo = document.getElementById("fondo-carrito");
  const btnEnviar = document.getElementById("btn-enviar-pedido");
  const btnVaciar = document.getElementById("btn-vaciar-carrito");

  function abrirCarrito() {
    renderizarCarrito();
    document.getElementById("drawer-carrito").classList.add("abierto");
    fondo.classList.add("abierto");
    document.body.style.overflow = "hidden";
  }
  function cerrarCarrito() {
    document.getElementById("drawer-carrito").classList.remove("abierto");
    fondo.classList.remove("abierto");
    document.body.style.overflow = "";
  }

  if (btnAbrir) btnAbrir.addEventListener("click", abrirCarrito);
  if (btnCerrar) btnCerrar.addEventListener("click", cerrarCarrito);
  if (fondo) fondo.addEventListener("click", cerrarCarrito);
  if (btnEnviar) btnEnviar.addEventListener("click", () => {
    if (obtenerCarrito().length === 0) return;
    window.location.href = "/checkout.html";
  });
  if (btnVaciar) btnVaciar.addEventListener("click", () => {
    if (confirm("¿Vaciar todo tu pedido?")) { guardarCarrito([]); renderizarCarrito(); }
  });
});