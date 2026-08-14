/* ============================================================
   util.js — utilidades genéricas compartidas por varias páginas.
   Cárgalo antes de carrito.js.
   ============================================================ */

function extraerPrecioNumerico(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")) || 0;
}

/* ============================================================
   OPTIMIZACIÓN DE IMÁGENES CLOUDINARY
   ------------------------------------------------------------
   Inserta transformaciones f_auto/q_auto/w_ en las URLs de
   Cloudinary sin tocar el archivo original ni volver a subirlo.
   No requiere re-subir nada: la transformación se genera una
   sola vez la primera vez que se pide esa URL y luego queda
   cacheada en el CDN de Cloudinary (las visitas siguientes son
   igual de rápidas o más rápidas que antes, no más lentas).

   Se usa un set FIJO de 4 presets (no anchos arbitrarios por
   imagen) a propósito: cada combinación única de parámetros
   cuenta como 1 transformación nueva la primera vez que se
   pide. Con anchos libres se podrían generar cientos de
   variantes sin querer y consumir créditos de más. Con 4
   presets fijos, el consumo de transformaciones queda acotado
   y predecible sin importar cuántos productos o imágenes haya.
   ============================================================ */
const CLOUDINARY_PRESETS = {
  miniatura: "f_auto,q_auto,w_150", // miniaturas de galería, carrito
  tarjeta:   "f_auto,q_auto,w_400", // listados, vitrina, vistos recientes, buscador
  principal: "f_auto,q_auto,w_800", // imagen principal de producto
  zoom:      "f_auto,q_auto,w_1400" // modal de lupa/zoom
};

function optimizarImagenCloudinary(url, preset = "tarjeta") {
  // Si no es una URL de Cloudinary (o no hay URL), se devuelve tal cual —
  // así no se rompe nada si en algún momento hay imágenes de otro origen.
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/image/upload/f_auto")) return url; // ya viene optimizada, evita duplicar

  const transformacion = CLOUDINARY_PRESETS[preset] || CLOUDINARY_PRESETS.tarjeta;
  return url.replace("/image/upload/", `/image/upload/${transformacion}/`);
}

/* ------------------------------------------------------------
   Export para Node.js (usado por generar-productos.js, que arma
   el HTML de cada producto en el servidor). En el navegador
   "module" no existe con un <script src> normal, así que este
   bloque no se ejecuta ahí — el archivo funciona igual que antes.
   Así hay una sola fuente de verdad para las transformaciones,
   sin duplicar la lógica en JS de servidor y de navegador.
   ------------------------------------------------------------ */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { optimizarImagenCloudinary, CLOUDINARY_PRESETS, extraerPrecioNumerico };
}
