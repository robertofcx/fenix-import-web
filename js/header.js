/**
 * ========================================================================
 * HEADER ÚNICO — FENIX IMPORT PERÚ
 * ========================================================================
 * Inyecta el header + drawer lateral + buscador en vivo en cualquier
 * página que tenga <div id="header-placeholder"></div>.
 *
 * REQUIERE:
 *  - header.css cargado en el <head> de la página
 *  - productos.json accesible en la raíz del sitio
 *  - (Fuse.js se carga solo si la página no lo tiene ya)
 *
 * USO EN CADA PÁGINA (reemplaza el <header>...</header> y el
 * <nav class="drawer">...</nav> que tenías hardcodeados):
 *
 *   <div id="header-placeholder"></div>
 *   <script src="/header.js"></script>
 *   ... (el resto de scripts de la página va DESPUÉS de este) ...
 *
 * IMPORTANTE: NO usar el atributo "defer" en este <script>, y este
 * <script> debe ir ANTES de cualquier otro script de la página que
 * toque elementos del header (nav-whatsapp, badge-carrito, btn-tema,
 * etc.) — como producto-comun.js o el <script> propio de cada página.
 * Este archivo se ejecuta de inmediato (no espera a DOMContentLoaded)
 * precisamente para garantizar que el header ya exista en el DOM
 * antes de que cualquier otro script intente usarlo.
 *
 * Si la página quiere un mensaje de WhatsApp específico (por ejemplo,
 * la ficha de un producto), debe definir esto ANTES de cargar header.js:
 *   <script>window.FENIX_HEADER_WHATSAPP_MSG = "...";</script>
 *
 * NOVEDAD (búsqueda por código Fenix):
 *  - Si el texto buscado coincide EXACTO con un SKU, se muestra solo
 *    ese producto (sin fuzzy search).
 *  - Si el texto tiene forma de código Fenix (ej. "HOG_378", "HOG_37")
 *    pero está incompleto, se filtra por SKUs que EMPIEZAN con ese
 *    texto, en vez de usar Fuse.
 *  - Para cualquier otro texto, sigue funcionando la búsqueda difusa
 *    (Fuse.js) de siempre por nombre/sku.
 * ========================================================================
 */
(function () {
  const RUTA_PRODUCTOS = "/productos.json";
  const NUMERO_WHATSAPP = "51978821080";
  const CARRITO_KEY = "fenix_carrito";

  const HEADER_HTML = `
<header>
  <div class="header-fila">
    <div class="header-izquierda">
      <button class="btn-hamburguesa" id="btn-abrir-drawer" aria-label="Abrir menú">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a class="logo-chip" href="/index.html"><img src="/logo.webp" alt="Fenix Import Perú"></a>
    </div>

    <div class="contenedor-buscador">
      <form class="buscador-header" id="form-buscador-header" autocomplete="off">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="input-buscador-header" placeholder="Busca un producto o código Fenix...">
        <button type="submit">Buscar</button>
      </form>
      <div class="resultados-busqueda" id="resultados-busqueda"></div>
    </div>

    <div class="header-derecha">
      <button class="btn-tema" id="btn-tema" aria-label="Cambiar tema">
        <svg class="icono-sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="icono-luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button class="btn-carrito" id="btn-abrir-carrito" aria-label="Ver carrito">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21.5 8H6"/></svg>
        <span class="badge-carrito" id="badge-carrito" style="display:none;">0</span>
      </button>
      <a class="btn-nav-whatsapp" href="#" id="nav-whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.3.37-.43.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.31 2.35 1.45.29.15.46.13.63-.07.17-.2.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
      </a>
    </div>
  </div>
</header>

<div class="fondo-drawer" id="fondo-drawer"></div>
<nav class="drawer" id="drawer">
  <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
    <span class="logo-chip"><img src="/logo.webp" alt="Fenix Import Perú" style="height:26px;"></span>
    <button class="btn-cerrar-drawer" id="btn-cerrar-drawer">✕</button>
  </div>
  <a class="drawer-link" href="/index.html">Inicio</a>
  <a class="drawer-link" href="/catalogo.html">Catálogo completo</a>
  <p class="drawer-seccion-titulo">Categorías</p>
  <div class="drawer-cat-buscador">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="drawer-buscar-categoria" placeholder="Buscar categoría o subcategoría...">
  </div>
  <div id="drawer-categorias-resultado" class="drawer-cat-resultado-lista" style="display:none;"></div>
  <div id="drawer-categorias-split" class="drawer-cat-split">
    <div id="drawer-cat-izq" class="drawer-cat-col-izq"><p style="padding:10px 6px; color:var(--texto-muted); font-size:.8rem;">Cargando...</p></div>
    <div id="drawer-cat-der" class="drawer-cat-col-der"></div>
  </div>
  <div class="drawer-redes">
    <a href="https://www.instagram.com/feniximportperu/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>
    <a href="https://www.facebook.com/FenixImportPeru" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.87.24-1.46 1.5-1.46H16.6V4.36C16.3 4.32 15.3 4.24 14.15 4.24c-2.4 0-4.05 1.47-4.05 4.16V10.5H7.6v3h2.5V21h3.4z"/></svg></a>
    <a href="https://www.tiktok.com/@feniximportperu" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 0 1-3.77-4.14h-3.1v14.2a2.6 2.6 0 1 1-1.84-2.48V10.3a5.65 5.65 0 1 0 4.94 5.6V9.4a7.3 7.3 0 0 0 3.77 1.05z"/></svg></a>
    <a href="https://www.youtube.com/@feniximportperu" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.6a2.7 2.7 0 0 0-1.9-1.9C18 5.2 12 5.2 12 5.2s-6 0-7.7.5A2.7 2.7 0 0 0 2.4 7.6 28 28 0 0 0 2 12a28 28 0 0 0 .4 4.4 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.4zM10 15V9l5.2 3z"/></svg></a>
  </div>
</nav>`;

  function inyectarHeader() {
    const contenedor = document.getElementById("header-placeholder");
    if (!contenedor) {
      console.error('[header.js] Falta <div id="header-placeholder"></div> en esta página.');
      return;
    }
    contenedor.outerHTML = HEADER_HTML;

    inicializarTema();
    inicializarDrawer();
    inicializarCarritoBadge();
    inicializarWhatsapp();
    cargarProductosParaHeader();
  }

  // ---------- Tema oscuro / claro ----------
  function inicializarTema() {
    const raiz = document.documentElement;
    const btnTema = document.getElementById("btn-tema");
    const temaGuardado = localStorage.getItem("fenix-tema") || "claro";
    raiz.setAttribute("data-tema", temaGuardado);
    btnTema.addEventListener("click", () => {
      const actual = raiz.getAttribute("data-tema");
      const nuevo = actual === "claro" ? "oscuro" : "claro";
      raiz.setAttribute("data-tema", nuevo);
      localStorage.setItem("fenix-tema", nuevo);
    });
  }

  // ---------- Drawer lateral ----------
  function inicializarDrawer() {
    const drawer = document.getElementById("drawer");
    const fondoDrawer = document.getElementById("fondo-drawer");

    function abrir() {
      drawer.classList.add("abierto");
      fondoDrawer.classList.add("abierto");
      document.body.style.overflow = "hidden";
    }
    function cerrar() {
      drawer.classList.remove("abierto");
      fondoDrawer.classList.remove("abierto");
      document.body.style.overflow = "";
    }

    document.getElementById("btn-abrir-drawer").addEventListener("click", abrir);
    document.getElementById("btn-cerrar-drawer").addEventListener("click", cerrar);
    fondoDrawer.addEventListener("click", cerrar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
  }

  // ---------- Badge del carrito ----------
  function obtenerCarrito() {
    try { return JSON.parse(localStorage.getItem(CARRITO_KEY)) || []; }
    catch (e) { return []; }
  }

  function inicializarCarritoBadge() {
    // Se expone en window para que el código de carrito de cada página
    // (agregar/quitar productos) pueda refrescar el badge tras header.js.
    window.actualizarBadgeCarrito = function () {
      const carrito = obtenerCarrito();
      const total = carrito.reduce((suma, item) => suma + (item.cantidad || 0), 0);
      const badge = document.getElementById("badge-carrito");
      if (!badge) return;
      badge.textContent = total;
      badge.style.display = total > 0 ? "flex" : "none";
    };
    window.actualizarBadgeCarrito();
  }

  // ---------- Link de WhatsApp del header ----------
  function inicializarWhatsapp() {
    const nav = document.getElementById("nav-whatsapp");
    if (!nav) return;
    // Si la página definió un mensaje específico (ej. ficha de producto), se respeta.
    const mensaje = window.FENIX_HEADER_WHATSAPP_MSG ||
      "¡Hola Fenix Import Perú!\nMe gustaría más información sobre sus productos.";
    nav.href = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" + encodeURIComponent(mensaje);
  }

  // ---------- Categorías del drawer: panel de dos columnas + buscador ----------
  let categoriasDrawer = [];
  let categoriaSeleccionadaDrawer = null;

  function urlCategoria(categoria, subcategoria) {
    let url = "/catalogo.html?categoria=" + encodeURIComponent(categoria);
    if (subcategoria) url += "&subcategoria=" + encodeURIComponent(subcategoria);
    return url;
  }

  function renderColumnaIzquierdaDrawer() {
    const el = document.getElementById("drawer-cat-izq");
    if (!el) return;
    el.innerHTML = categoriasDrawer.map((cat, i) => `
      <button class="drawer-cat-item ${cat.nombre === categoriaSeleccionadaDrawer ? "activo" : ""}" data-indice="${i}">
        <span>${cat.nombre}</span>
      </button>`).join("");

    el.querySelectorAll(".drawer-cat-item").forEach(boton => {
      boton.addEventListener("click", () => {
        categoriaSeleccionadaDrawer = categoriasDrawer[Number(boton.dataset.indice)].nombre;
        renderColumnaIzquierdaDrawer();
        renderColumnaDerechaDrawer();
      });
    });
  }

  function renderColumnaDerechaDrawer() {
    const el = document.getElementById("drawer-cat-der");
    if (!el) return;

    const cat = categoriasDrawer.find(c => c.nombre === categoriaSeleccionadaDrawer);
    if (!cat) {
      el.innerHTML = `<p class="drawer-cat-vacio">Elige una categoría de la izquierda</p>`;
      return;
    }

    let html = `<a class="drawer-cat-ver-todo" href="${urlCategoria(cat.nombre)}">Ver todo en ${cat.nombre}</a>`;
    (cat.subcategorias || []).forEach(sub => {
      html += `
        <a class="drawer-cat-sub" href="${urlCategoria(cat.nombre, sub.nombre)}">
          <span>${sub.nombre}</span>
          <span class="cat-cantidad">${sub.cantidad}</span>
        </a>`;
    });
    el.innerHTML = html;
  }

  function filtrarCategoriasDrawer(texto) {
    const elResultado = document.getElementById("drawer-categorias-resultado");
    const elSplit = document.getElementById("drawer-categorias-split");
    const textoNorm = texto.trim().toLowerCase();

    if (!textoNorm) {
      elResultado.style.display = "none";
      elSplit.style.display = "flex";
      return;
    }

    elResultado.style.display = "flex";
    elSplit.style.display = "none";

    const resultados = [];
    categoriasDrawer.forEach(cat => {
      if (cat.nombre.toLowerCase().includes(textoNorm)) {
        resultados.push({ categoria: cat.nombre, subcategoria: null, cantidad: cat.cantidad });
      }
      (cat.subcategorias || []).forEach(sub => {
        if (sub.nombre.toLowerCase().includes(textoNorm)) {
          resultados.push({ categoria: cat.nombre, subcategoria: sub.nombre, cantidad: sub.cantidad });
        }
      });
    });

    if (resultados.length === 0) {
      elResultado.innerHTML = `<p class="drawer-cat-vacio">Sin resultados para "${texto}"</p>`;
      return;
    }

    elResultado.innerHTML = resultados.map(r => {
      const etiqueta = r.subcategoria ? `${r.categoria} › ${r.subcategoria}` : r.categoria;
      return `
        <a class="drawer-cat-sub" href="${urlCategoria(r.categoria, r.subcategoria)}">
          <span>${etiqueta}</span>
          <span class="cat-cantidad">${r.cantidad}</span>
        </a>`;
    }).join("");
  }

  function dibujarCategoriasDrawer(categorias) {
    categoriasDrawer = categorias || [];

    const elIzq = document.getElementById("drawer-cat-izq");
    if (!elIzq) return;

    if (categoriasDrawer.length === 0) {
      elIzq.innerHTML = `<p class="drawer-cat-vacio">No se pudieron cargar.</p>`;
      return;
    }

    renderColumnaIzquierdaDrawer();
    renderColumnaDerechaDrawer();

    const elBuscar = document.getElementById("drawer-buscar-categoria");
    if (elBuscar) {
      elBuscar.addEventListener("input", () => filtrarCategoriasDrawer(elBuscar.value));
    }
  }

  // ---------- Buscador en vivo (header) ----------
  let fuse = null;
  let listaProductosHeader = []; // copia propia de los productos, para no depender de internals de Fuse

  // Patrón de código Fenix: prefijo de letras (2 a 5) + "_" + dígitos
  // (los dígitos pueden faltar si el usuario aún está escribiendo, ej. "HOG_")
  const REGEX_CODIGO_FENIX = /^[A-Z]{2,5}_\d*$/;

  // Usa el slug real del archivo (igual que producto.js en "vistos recientemente"),
  // no el SKU: el SKU solo tiene una página-puente de redirección
  // (meta refresh), así que enlazar por SKU costaba una carga extra.
  // Si por algún motivo un producto no tuviera slug, cae de vuelta al SKU.
  function urlProducto(producto) {
    const destino = producto.slug || producto.sku;
    return "/producto/" + encodeURIComponent(destino) + ".html";
  }

  function renderizarResultados(productos, textoBuscado) {
    const elResultados = document.getElementById("resultados-busqueda");

    if (productos.length === 0) {
      elResultados.innerHTML = `<div class="resultado-estado">No encontramos productos para "${textoBuscado}"</div>`;
      elResultados.classList.add("abierto");
      return;
    }

    const filas = productos.map(p => {
      const precio = Number(String(p.precio).replace(/[^0-9.]/g, "")).toFixed(2);
      const imagenHtml = p.imagen
        ? `<img src="${p.imagen}" alt="${p.nombre}">`
        : `<span class="sin-foto">Sin foto</span>`;
      const ofertaHtml = p.oferta ? `<span class="resultado-badge-oferta">Oferta</span>` : "";

      return `
        <a class="resultado-item" href="${urlProducto(p)}" data-sku="${p.sku}">
          <div class="resultado-img">${imagenHtml}</div>
          <div class="resultado-info">
            <p class="resultado-nombre">${p.nombre}</p>
            <div class="resultado-meta">
              <span class="resultado-precio">S/ ${precio}</span>
              <span class="resultado-categoria">${p.categoria || ""}</span>
              ${ofertaHtml}
            </div>
          </div>
        </a>`;
    }).join("");

    const verTodos = `<a class="resultado-ver-todos" href="/catalogo.html?buscar=${encodeURIComponent(textoBuscado)}">Ver todos los resultados para "${textoBuscado}" →</a>`;
    elResultados.innerHTML = filas + verTodos;
    elResultados.classList.add("abierto");
  }

  function cargarProductosParaHeader() {
    fetch(RUTA_PRODUCTOS)
      .then(r => r.json())
      .then(data => {
        dibujarCategoriasDrawer(data.categorias);
        listaProductosHeader = data.productos || [];

        function iniciarBusqueda() {
          fuse = new Fuse(data.productos, { keys: ["nombre", "sku"], threshold: 0.35, ignoreLocation: true });
          activarListenersBuscador();
        }

        if (window.Fuse) {
          iniciarBusqueda();
        } else {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js";
          script.onload = iniciarBusqueda;
          document.head.appendChild(script);
        }
      })
      .catch(err => console.error("[header.js] No se pudo cargar productos.json:", err));
  }

  function activarListenersBuscador() {
    const elInput = document.getElementById("input-buscador-header");
    const elResultados = document.getElementById("resultados-busqueda");
    const elForm = document.getElementById("form-buscador-header");
    let temporizador = null;
    let indiceResaltado = -1;

    function buscarEnVivo(texto) {
      if (!fuse) return;

      const textoUpper = texto.trim().toUpperCase();

      // 1) Coincidencia EXACTA con un SKU -> un único resultado, sin fuzzy.
      const exacto = listaProductosHeader.find(p => (p.sku || "").toUpperCase() === textoUpper);
      if (exacto) {
        indiceResaltado = -1;
        renderizarResultados([exacto], texto);
        return;
      }

      // 2) Parece un código Fenix (aunque esté incompleto, ej. "HOG_37")
      //    -> filtramos por SKUs que EMPIEZAN con ese texto.
      if (REGEX_CODIGO_FENIX.test(textoUpper)) {
        const porPrefijo = listaProductosHeader
          .filter(p => (p.sku || "").toUpperCase().startsWith(textoUpper))
          .slice(0, 6);
        indiceResaltado = -1;
        renderizarResultados(porPrefijo, texto);
        return;
      }

      // 3) Caso normal: búsqueda difusa por nombre/sku.
      const resultados = fuse.search(texto).slice(0, 6).map(r => r.item);
      indiceResaltado = -1;
      renderizarResultados(resultados, texto);
    }

    function cerrarResultados() {
      elResultados.classList.remove("abierto");
      indiceResaltado = -1;
    }

    elInput.addEventListener("input", () => {
      const texto = elInput.value.trim();
      clearTimeout(temporizador);
      if (texto.length < 2) { cerrarResultados(); return; }
      temporizador = setTimeout(() => buscarEnVivo(texto), 120);
    });

    elInput.addEventListener("keydown", (evento) => {
      const items = elResultados.querySelectorAll(".resultado-item");
      if (items.length === 0) return;

      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        indiceResaltado = Math.min(indiceResaltado + 1, items.length - 1);
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        indiceResaltado = Math.max(indiceResaltado - 1, 0);
      } else if (evento.key === "Enter" && indiceResaltado >= 0) {
        evento.preventDefault();
        window.location.href = items[indiceResaltado].getAttribute("href");
        return;
      } else {
        return;
      }

      items.forEach((item, i) => item.classList.toggle("resaltado", i === indiceResaltado));
      items[indiceResaltado].scrollIntoView({ block: "nearest" });
    });

    document.addEventListener("click", (evento) => {
      if (!evento.target.closest(".contenedor-buscador")) cerrarResultados();
    });
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") cerrarResultados();
    });

    elForm.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const valor = elInput.value.trim();
      if (!valor) return;
      window.location.href = "/catalogo.html?buscar=" + encodeURIComponent(valor);
    });
  }

  // Se ejecuta de inmediato (NO se espera a DOMContentLoaded): como este
  // script va justo después de #header-placeholder y sin "defer", el
  // navegador lo corre en el momento exacto en que lo encuentra al
  // parsear el HTML — el placeholder ya existe, y el resto de scripts
  // de la página (que van después) van a encontrar el header ya listo.
  inyectarHeader();
})();
