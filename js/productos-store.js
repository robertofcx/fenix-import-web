/**
 * ========================================================================
 * PRODUCTOS-STORE — FENIX IMPORT PERÚ
 * ========================================================================
 * Fuente única de productos-index.json (versión LIVIANA del catálogo,
 * sin descripción/características/incluye/galería/variantes — esos
 * campos ya vienen horneados en cada /producto/{slug}.html por
 * generar-productos.js, así que ninguna página los necesita por fetch).
 *
 * Evita que header.js, app.js, catalogo.js, etc. hagan cada uno su
 * propio fetch del mismo archivo.
 *
 * Dos niveles de caché:
 *  1) MEMORIA (una sola promesa por carga de página): si dos scripts
 *     piden los datos en la misma página, solo se hace UN fetch.
 *  2) sessionStorage (entre páginas, misma pestaña/sesión): si el
 *     visitante navega de index.html a catalogo.html, no se vuelve a
 *     descargar productos.json si todavía está "fresco" (TTL_MS).
 *
 * TTL_MS está alineado al s-maxage=300 que ya devuelve Cloudflare en el
 * header Cache-Control — si cambias ese valor en el CDN, cámbialo aquí
 * también para que no queden desincronizados.
 *
 * USO EN CADA PÁGINA:
 *   <script src="/productos-store.js"></script>
 *   <script src="/header.js"></script>
 *   ... resto de scripts de la página ...
 *
 * (Debe cargar ANTES que header.js y antes que cualquier script de
 * página que use productos.json — igual que exige hoy header.js.)
 *
 * API:
 *   window.FenixProductos.obtener() -> Promise<{ productos, categorias }>
 * ========================================================================
 */
(function () {
  const RUTA_PRODUCTOS = "/productos-index.json";
  const CLAVE_CACHE = "fenix_productos_index_cache";
  const TTL_MS = 5 * 60 * 1000; // 5 min, igual al s-maxage de Cloudflare

  let promesaMemoria = null;

  function leerCacheSesion() {
    try {
      const crudo = sessionStorage.getItem(CLAVE_CACHE);
      if (!crudo) return null;
      const { guardadoEn, datos } = JSON.parse(crudo);
      if (!datos || Date.now() - guardadoEn > TTL_MS) return null;
      return datos;
    } catch (e) {
      // sessionStorage bloqueado, cuota excedida, JSON corrupto, etc.
      // No es crítico: simplemente seguimos sin caché de sesión.
      return null;
    }
  }

  function guardarCacheSesion(datos) {
    try {
      sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({
        guardadoEn: Date.now(),
        datos
      }));
    } catch (e) {
      // Cuota de sessionStorage excedida (raro con ~2.4MB, pero por si acaso)
      // no rompemos nada, solo no cacheamos para la siguiente página.
    }
  }

  function obtener() {
    if (promesaMemoria) return promesaMemoria;

    const enSesion = leerCacheSesion();
    if (enSesion) {
      promesaMemoria = Promise.resolve(enSesion);
      return promesaMemoria;
    }

    promesaMemoria = fetch(RUTA_PRODUCTOS)
      .then(function (r) {
        if (!r.ok) throw new Error("No se pudo cargar productos.json (" + r.status + ")");
        return r.json();
      })
      .then(function (datos) {
        guardarCacheSesion(datos);
        return datos;
      })
      .catch(function (err) {
        // Si falla, no dejamos la promesa "envenenada" para siempre:
        // el próximo obtener() vuelve a intentar el fetch.
        promesaMemoria = null;
        throw err;
      });

    return promesaMemoria;
  }

  window.FenixProductos = { obtener: obtener };
})();
