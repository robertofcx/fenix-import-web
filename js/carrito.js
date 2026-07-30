/* ============================================================
   carrito.js — carrito de WhatsApp (agregar/quitar/renderizar
   productos) y apertura/cierre del panel lateral "Tu pedido".

   Requiere:
   - util.js cargado antes (usa extraerPrecioNumerico)
   - header.js cargado antes (expone window.actualizarBadgeCarrito)
   - que la página tenga el panel #drawer-carrito, #fondo-carrito,
     #carrito-lista, #carrito-footer, #toast-carrito, #btn-abrir-carrito

   agregarAlCarritoActual() depende de window.PRODUCTO_ACTUAL, así que
   solo tiene efecto en páginas de producto que definan esa variable.
   ============================================================ */

const CARRITO_KEY = "fenix_carrito";

function obtenerCarrito() {
  try { return JSON.parse(localStorage.getItem(CARRITO_KEY)) || []; }
  catch (e) { return []; }
}

function guardarCarrito(carrito) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  if (window.actualizarBadgeCarrito) window.actualizarBadgeCarrito();
}

function mostrarToast(mensaje) {
  const toast = document.getElementById("toast-carrito");
  if (!toast) return;
  toast.textContent = mensaje;
  toast.classList.add("visible");
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2200);
}

// Cada página de producto estática define window.PRODUCTO_ACTUAL
// (objeto con sku, nombre, precio, imagen, imagenes) antes de cargar este script.
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
