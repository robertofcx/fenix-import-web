/* ============================================================
   util.js — utilidades genéricas compartidas por varias páginas.
   Cárgalo antes de carrito.js.
   ============================================================ */

function extraerPrecioNumerico(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")) || 0;
}
