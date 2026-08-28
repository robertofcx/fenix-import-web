const NUMERO_WHATSAPP = "51978821080";
const URL_SITIO = "https://fenix-import-peru.onrender.com";
const POR_PAGINA = 24;
let fuse = null;

// Usa optimizarImagenCloudinary de util.js si esta página lo carga (recomendado
// agregar <script src="/js/util.js"></script> antes de categoria.js); si no
// está presente, devuelve la URL tal cual — no rompe nada, solo no optimiza.
function _optImg(url, preset) {
  return (typeof optimizarImagenCloudinary === "function")
    ? optimizarImagenCloudinary(url, preset)
    : url;
}

// #anio ya lo escribe footer.js al inyectar el footer

const mensajeGenerico = "¡Hola Fenix Import Perú!\nMe gustaría más información sobre sus productos.";
const urlWhatsAppGenerico = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" + encodeURIComponent(mensajeGenerico);
// nav-whatsapp ya lo asigna header.js; aquí solo queda el flotante propio de esta página.
document.getElementById("whatsapp-flotante").href = urlWhatsAppGenerico;

// Tema oscuro/claro y menú lateral (drawer) ya los maneja header.js

const parametrosUrl = new URLSearchParams(window.location.search);

let todosLosProductos = [];
let categoriasArbol = [];
let productosFiltrados = [];
let categoriaActiva = parametrosUrl.get("categoria") || "Todos";
let subcategoriaActiva = parametrosUrl.get("subcategoria") || null;
let marcasActivas = new Set((parametrosUrl.get("marca") || "").split(",").filter(Boolean));
let tallasActivas = new Set((parametrosUrl.get("talla") || "").split(",").filter(Boolean));
let ordenActivo = parametrosUrl.get("orden") || "predeterminado";
let paginaActual = Number(parametrosUrl.get("pagina")) || 1;

const elEstadoCarga = document.getElementById("estado-carga");
const elContenido = document.getElementById("contenido");
const elGrilla = document.getElementById("grilla");
const elContador = document.getElementById("contador");
const elCategorias = document.getElementById("lista-categorias");
const elMarcas = document.getElementById("lista-marcas");
const elTallas = document.getElementById("lista-tallas");
const elBuscar = document.getElementById("input-buscar");
const elPrecioMin = document.getElementById("input-precio-min");
const elPrecioMax = document.getElementById("input-precio-max");
const elSoloOfertas = document.getElementById("input-solo-ofertas");
const elOrden = document.getElementById("select-orden");
const elPaginacion = document.getElementById("paginacion");
const elBtnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");
const elBreadcrumb = document.getElementById("breadcrumb");

// ---------- Panel de filtros en móvil ----------
const elSidebar = document.getElementById("sidebar-filtros");
const elFondoFiltros = document.getElementById("fondo-filtros");
const elBtnAbrirFiltros = document.getElementById("btn-abrir-filtros");
const elBtnCerrarFiltros = document.getElementById("btn-cerrar-filtros");
const elBadgeFiltrosActivos = document.getElementById("badge-filtros-activos");

function abrirPanelFiltros() {
  elSidebar.classList.add("abierto");
  elFondoFiltros.classList.add("abierto");
  document.body.style.overflow = "hidden";
}
function cerrarPanelFiltros() {
  elSidebar.classList.remove("abierto");
  elFondoFiltros.classList.remove("abierto");
  document.body.style.overflow = "";
}
elBtnAbrirFiltros.addEventListener("click", abrirPanelFiltros);
elBtnCerrarFiltros.addEventListener("click", cerrarPanelFiltros);
elFondoFiltros.addEventListener("click", cerrarPanelFiltros);

function actualizarBadgeFiltrosActivos() {
  let total = 0;
  if (categoriaActiva !== "Todos") total++;
  if (marcasActivas.size > 0) total++;
  if (tallasActivas.size > 0) total++;
  if (elPrecioMin.value !== "" || elPrecioMax.value !== "") total++;
  if (elSoloOfertas.checked) total++;
  elBadgeFiltrosActivos.textContent = total;
  elBadgeFiltrosActivos.style.display = total > 0 ? "inline-flex" : "none";
}

// ---------- Sincronizar el estado de filtros en la URL (compartible, sin recargar) ----------
function sincronizarUrl() {
  const params = new URLSearchParams();
  if (categoriaActiva !== "Todos") params.set("categoria", categoriaActiva);
  if (subcategoriaActiva) params.set("subcategoria", subcategoriaActiva);
  if (marcasActivas.size > 0) params.set("marca", [...marcasActivas].join(","));
  if (tallasActivas.size > 0) params.set("talla", [...tallasActivas].join(","));
  if (elBuscar.value.trim()) params.set("buscar", elBuscar.value.trim());
  if (ordenActivo !== "predeterminado") params.set("orden", ordenActivo);
  if (paginaActual > 1) params.set("pagina", paginaActual);
  const query = params.toString();
  const nuevaUrl = window.location.pathname + (query ? "?" + query : "");
  history.replaceState(null, "", nuevaUrl);
}

function actualizarBreadcrumb() {
  let html = `<a href="index.html">Inicio</a>`;
  if (categoriaActiva !== "Todos") {
    if (subcategoriaActiva) {
      html += ` <span class="sep">›</span> <a href="catalogo.html?categoria=${encodeURIComponent(categoriaActiva)}">${categoriaActiva}</a>`;
      html += ` <span class="sep">›</span> <span class="actual">${subcategoriaActiva}</span>`;
    } else {
      html += ` <span class="sep">›</span> <span class="actual">${categoriaActiva}</span>`;
    }
  } else {
    html += ` <span class="sep">›</span> <span class="actual">Catálogo</span>`;
  }
  elBreadcrumb.innerHTML = html;
}

function mostrarError(mensaje) {
  elEstadoCarga.innerHTML = `<div class="estado-icono">⚠️</div><p class="estado-titulo">No se pudo cargar el catálogo</p><p class="estado-texto">${mensaje}</p>`;
}

function mostrarVacio() {
  elGrilla.innerHTML = `<div class="estado" style="grid-column: 1 / -1;"><div class="estado-icono">🔦</div><p class="estado-titulo">No encontramos productos</p><p class="estado-texto">Prueba con otra palabra o quita algún filtro.</p></div>`;
  elPaginacion.innerHTML = "";
}

function urlWhatsApp(producto) {
  const precio = Number(String(producto.precio).replace(/[^0-9.]/g, "")).toFixed(2);
  // Usa el slug real (no el SKU): el SKU solo tiene página-puente de redirección
  const link = URL_SITIO + "/producto/" + encodeURIComponent(producto.slug || producto.sku) + ".html";
  const mensaje = `¡Hola, Fenix Import Perú!\nMe gustaría realizar el siguiente pedido:\n${producto.nombre}\nPrecio: S/ ${precio}\nSKU: ${producto.sku}\n${link}`;
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

function crearTarjeta(producto) {
  const precio = Number(String(producto.precio).replace(/[^0-9.]/g, "")).toFixed(2);
  const imagenHtml = producto.imagen
    ? `<img src="${_optImg(producto.imagen, 'tarjeta')}" alt="${producto.nombre}" loading="lazy">`
    : `<span class="sin-foto">Sin foto</span>`;
  const badge = producto.oferta ? `<span class="badge-oferta">Oferta</span>` : "";
  const productoJson = encodeURIComponent(JSON.stringify({ sku: producto.sku, slug: producto.slug, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen }));

  return `
    <a class="tarjeta" href="/producto/${encodeURIComponent(producto.slug || producto.sku)}.html">
      <div class="tarjeta-img">${badge}${imagenHtml}</div>
      <div class="tarjeta-body">
        <p class="tarjeta-categoria">${producto.categoria || ""}</p>
        <p class="tarjeta-nombre" title="${producto.nombre}">${producto.nombre}</p>
        <p class="tarjeta-precio">S/ ${precio}</p>
        <div class="tarjeta-acciones">
          <button class="btn-agregar-carrito" onclick="event.preventDefault(); agregarAlCarritoDesdeTarjeta('${productoJson}')">
            + Agregar
          </button>
          <span class="btn-consultar-icono" onclick="event.preventDefault(); window.open('${urlWhatsApp(producto)}', '_blank')" aria-label="Consultar por WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.3.37-.43.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.31 2.35 1.45.29.15.46.13.63-.07.17-.2.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
          </span>
        </div>
      </div>
    </a>
  `;
}

// ---------- Paginación ----------

function construirPaginacion(totalPaginas) {
  if (totalPaginas <= 1) {
    elPaginacion.innerHTML = "";
    return;
  }

  function botonPagina(numero, etiqueta, deshabilitado, activo) {
    return `<button class="pagina-boton ${activo ? "activo" : ""}" data-pagina="${numero}" ${deshabilitado ? "disabled" : ""}>${etiqueta}</button>`;
  }

  // Rango de números a mostrar alrededor de la página actual, con "…" si hay huecos.
  const paginas = [];
  const ventana = 1;
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || (i >= paginaActual - ventana && i <= paginaActual + ventana)) {
      paginas.push(i);
    } else if (paginas[paginas.length - 1] !== "…") {
      paginas.push("…");
    }
  }

  let html = botonPagina(paginaActual - 1, "‹", paginaActual === 1, false);
  paginas.forEach(p => {
    html += p === "…" ? `<span class="pagina-puntos">…</span>` : botonPagina(p, p, false, p === paginaActual);
  });
  html += botonPagina(paginaActual + 1, "›", paginaActual === totalPaginas, false);

  elPaginacion.innerHTML = html;

  elPaginacion.querySelectorAll(".pagina-boton:not([disabled])").forEach(boton => {
    boton.addEventListener("click", () => {
      paginaActual = Number(boton.dataset.pagina);
      renderizarPagina();
      sincronizarUrl();
      elContenido.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  });
}

function renderizarPagina() {
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const productosDePagina = productosFiltrados.slice(inicio, inicio + POR_PAGINA);

  elGrilla.innerHTML = productosDePagina.map(crearTarjeta).join("");

  const totalPaginas = Math.ceil(productosFiltrados.length / POR_PAGINA);
  construirPaginacion(totalPaginas);

  elContador.textContent = `${productosFiltrados.length} producto${productosFiltrados.length === 1 ? "" : "s"} encontrado${productosFiltrados.length === 1 ? "" : "s"}`;
}

// ---------- Orden ----------

function extraerPrecio(producto) {
  return Number(String(producto.precio).replace(/[^0-9.]/g, "")) || 0;
}

function ordenarProductos(lista) {
  const copia = lista.slice();
  switch (ordenActivo) {
    case "precio-asc":
      return copia.sort((a, b) => extraerPrecio(a) - extraerPrecio(b));
    case "precio-desc":
      return copia.sort((a, b) => extraerPrecio(b) - extraerPrecio(a));
    case "nombre-asc":
      return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
    case "ofertas":
      return copia.sort((a, b) => (b.oferta === true) - (a.oferta === true));
    default:
      return copia;
  }
}

// ---------- Filtros ----------

function aplicarFiltros(reiniciarPagina = true) {
  const texto = elBuscar.value.trim();
  const precioMin = elPrecioMin.value !== "" ? Number(elPrecioMin.value) : null;
  const precioMax = elPrecioMax.value !== "" ? Number(elPrecioMax.value) : null;
  const soloOfertas = elSoloOfertas.checked;

  const candidatos = (texto && fuse) ? fuse.search(texto).map(r => r.item) : todosLosProductos;

  productosFiltrados = candidatos.filter(p => {
    const coincideCategoria = categoriaActiva === "Todos" || p.categoria === categoriaActiva;
    const coincideSubcategoria = !subcategoriaActiva || p.subcategoria === subcategoriaActiva;
    const coincideMarca = marcasActivas.size === 0 || marcasActivas.has(p.marca);
    const coincideTalla = tallasActivas.size === 0 || tallasActivas.has(p.talla);
    const precio = extraerPrecio(p);
    const coincidePrecioMin = precioMin === null || precio >= precioMin;
    const coincidePrecioMax = precioMax === null || precio <= precioMax;
    const coincideOferta = !soloOfertas || p.oferta;
    return coincideCategoria && coincideSubcategoria && coincideMarca && coincideTalla && coincidePrecioMin && coincidePrecioMax && coincideOferta;
  });

  productosFiltrados = ordenarProductos(productosFiltrados);

  if (reiniciarPagina) paginaActual = 1;

  construirMarcas();
  construirTallas();
  actualizarBadgeFiltrosActivos();
  sincronizarUrl();

  if (productosFiltrados.length === 0) {
    mostrarVacio();
    elContador.textContent = "0 productos encontrados";
    return;
  }

  renderizarPagina();
}

// ---------- Categorías (sidebar, con subcategorías desplegables) ----------

function construirCategorias() {
  let html = `<button class="cat-fila ${categoriaActiva === "Todos" ? "activo" : ""}" data-cat="Todos">
    <span>Todos los productos</span>
  </button>`;

  categoriasArbol.forEach((cat, indice) => {
    const activo = cat.nombre === categoriaActiva;
    const tieneSubcategorias = cat.subcategorias && cat.subcategorias.length > 0;

    html += `<div class="cat-item ${activo ? "abierto" : ""}" id="cat-item-${indice}">
      <button class="cat-fila ${activo && !subcategoriaActiva ? "activo" : ""}" data-cat="${cat.nombre}">
        <span>${cat.nombre}</span>
        <span class="cat-cantidad">${cat.cantidad}</span>
        ${tieneSubcategorias ? `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>` : ""}
      </button>`;

    if (tieneSubcategorias) {
      html += `<div class="cat-subcategorias">`;
      cat.subcategorias.forEach(sub => {
        const subActivo = activo && sub.nombre === subcategoriaActiva;
        html += `<button class="cat-fila cat-fila-sub ${subActivo ? "activo" : ""}" data-cat="${cat.nombre}" data-subcat="${sub.nombre}">
          <span>${sub.nombre}</span>
          <span class="cat-cantidad">${sub.cantidad}</span>
        </button>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });

  elCategorias.innerHTML = html;

  elCategorias.querySelectorAll(".cat-fila").forEach(boton => {
    boton.addEventListener("click", () => {
      const cat = boton.dataset.cat;
      const subcat = boton.dataset.subcat || null;

      // Clic en una categoría que ya está activa (sin tocar su subcategoría): solo abre/cierra el desplegable.
      if (!subcat && cat === categoriaActiva && cat !== "Todos") {
        const item = boton.closest(".cat-item");
        if (item) item.classList.toggle("abierto");
        return;
      }

      categoriaActiva = cat;
      subcategoriaActiva = subcat;
      actualizarBreadcrumb();
      construirCategorias();
      aplicarFiltros();
    });
  });
}

// ---------- Marca (checkboxes con conteo, según la categoría activa) ----------

function construirMarcas() {
  // El universo de marcas se calcula sobre productos ya filtrados por categoría/subcategoría/precio/oferta/búsqueda,
  // pero SIN aplicar el propio filtro de marca — así el conteo de cada marca sigue siendo útil aunque ya tengas una elegida.
  const texto = elBuscar.value.trim();
  const precioMin = elPrecioMin.value !== "" ? Number(elPrecioMin.value) : null;
  const precioMax = elPrecioMax.value !== "" ? Number(elPrecioMax.value) : null;
  const soloOfertas = elSoloOfertas.checked;
  const candidatos = (texto && fuse) ? fuse.search(texto).map(r => r.item) : todosLosProductos;

  const universoMarcas = candidatos.filter(p => {
    const coincideCategoria = categoriaActiva === "Todos" || p.categoria === categoriaActiva;
    const coincideSubcategoria = !subcategoriaActiva || p.subcategoria === subcategoriaActiva;
    const precio = extraerPrecio(p);
    const coincidePrecioMin = precioMin === null || precio >= precioMin;
    const coincidePrecioMax = precioMax === null || precio <= precioMax;
    const coincideOferta = !soloOfertas || p.oferta;
    return coincideCategoria && coincideSubcategoria && coincidePrecioMin && coincidePrecioMax && coincideOferta;
  });

  const conteoMarcas = {};
  universoMarcas.forEach(p => {
    if (!p.marca) return;
    conteoMarcas[p.marca] = (conteoMarcas[p.marca] || 0) + 1;
  });

  const marcasOrdenadas = Object.keys(conteoMarcas).sort((a, b) => conteoMarcas[b] - conteoMarcas[a]);

  if (marcasOrdenadas.length === 0) {
    elMarcas.innerHTML = `<p class="sin-marcas">No hay marcas para este filtro.</p>`;
    return;
  }

  elMarcas.innerHTML = marcasOrdenadas.map(marca => `
    <label class="marca-fila">
      <input type="checkbox" data-marca="${marca}" ${marcasActivas.has(marca) ? "checked" : ""}>
      <span>${marca}</span>
      <span class="marca-cantidad">${conteoMarcas[marca]}</span>
    </label>
  `).join("");

  elMarcas.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener("change", () => {
      const marca = chk.dataset.marca;
      if (chk.checked) marcasActivas.add(marca);
      else marcasActivas.delete(marca);
      aplicarFiltros();
    });
  });
}

// ---------- Talla (chips con conteo, según el resto de filtros activos) ----------

// Orden "natural" de tallas de prenda. Lo que no aparezca aquí (tallas
// numéricas de calzado, "Único", etc.) se ordena aparte al final,
// numérico si son números, alfabético si no.
const ORDEN_TALLAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

function compararTallas(a, b) {
  const ia = ORDEN_TALLAS.indexOf(a.toUpperCase());
  const ib = ORDEN_TALLAS.indexOf(b.toUpperCase());
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}

function construirTallas() {
  // Mismo criterio que construirMarcas(): universo filtrado por todo
  // MENOS el propio filtro de talla, así el conteo sigue siendo útil
  // aunque ya tengas una talla elegida.
  const texto = elBuscar.value.trim();
  const precioMin = elPrecioMin.value !== "" ? Number(elPrecioMin.value) : null;
  const precioMax = elPrecioMax.value !== "" ? Number(elPrecioMax.value) : null;
  const soloOfertas = elSoloOfertas.checked;
  const candidatos = (texto && fuse) ? fuse.search(texto).map(r => r.item) : todosLosProductos;

  const universoTallas = candidatos.filter(p => {
    const coincideCategoria = categoriaActiva === "Todos" || p.categoria === categoriaActiva;
    const coincideSubcategoria = !subcategoriaActiva || p.subcategoria === subcategoriaActiva;
    const coincideMarca = marcasActivas.size === 0 || marcasActivas.has(p.marca);
    const precio = extraerPrecio(p);
    const coincidePrecioMin = precioMin === null || precio >= precioMin;
    const coincidePrecioMax = precioMax === null || precio <= precioMax;
    const coincideOferta = !soloOfertas || p.oferta;
    return coincideCategoria && coincideSubcategoria && coincideMarca && coincidePrecioMin && coincidePrecioMax && coincideOferta;
  });

  const conteoTallas = {};
  universoTallas.forEach(p => {
    if (!p.talla) return;
    conteoTallas[p.talla] = (conteoTallas[p.talla] || 0) + 1;
  });

  const tallasOrdenadas = Object.keys(conteoTallas).sort(compararTallas);

  if (tallasOrdenadas.length === 0) {
    elTallas.innerHTML = `<p class="sin-tallas">No hay tallas para este filtro.</p>`;
    return;
  }

  elTallas.innerHTML = tallasOrdenadas.map(talla => `
    <button type="button" class="talla-chip ${tallasActivas.has(talla) ? "activo" : ""}" data-talla="${talla}">
      ${talla}<span class="talla-cantidad">${conteoTallas[talla]}</span>
    </button>
  `).join("");

  elTallas.querySelectorAll(".talla-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const talla = chip.dataset.talla;
      if (tallasActivas.has(talla)) tallasActivas.delete(talla);
      else tallasActivas.add(talla);
      aplicarFiltros();
    });
  });
}

// dibujarDrawerCategorias ya no hace falta aquí: header.js llena el
// drawer de categorías, ambos leyendo del mismo window.FenixProductos.

async function cargarCatalogo() {
  try {
    // window.FenixProductos lo define /js/productos-store.js (debe cargar
    // antes que header.js y antes que categoria.js). Un solo fetch real
    // aunque header.js, esta página y el store lo pidan cada uno por su lado.
    const datos = await window.FenixProductos.obtener();

    todosLosProductos = datos.productos || [];
    categoriasArbol = datos.categorias || [];

    if (todosLosProductos.length === 0) {
      mostrarError("El catálogo está vacío por ahora. Vuelve a intentarlo más tarde.");
      return;
    }

    fuse = new Fuse(todosLosProductos, {
      keys: ["nombre", "sku"],
      threshold: 0.35,
      ignoreLocation: true
    });

    elEstadoCarga.style.display = "none";
    elContenido.style.display = "block";

    const buscarUrl = parametrosUrl.get("buscar");
    if (buscarUrl) elBuscar.value = buscarUrl;
    elOrden.value = ordenActivo;

    construirCategorias();
    actualizarBreadcrumb();
    aplicarFiltros(false); // respeta la página inicial si vino en la URL

  } catch (error) {
    mostrarError("Ocurrió un problema al conectar con el catálogo. Intenta recargar la página en unos minutos.");
    console.error(error);
  }
}

elBuscar.addEventListener("input", () => aplicarFiltros());
elPrecioMin.addEventListener("input", () => aplicarFiltros());
elPrecioMax.addEventListener("input", () => aplicarFiltros());
elSoloOfertas.addEventListener("change", () => aplicarFiltros());
elOrden.addEventListener("change", () => {
  ordenActivo = elOrden.value;
  aplicarFiltros();
});
elBtnLimpiarFiltros.addEventListener("click", () => {
  elBuscar.value = "";
  elPrecioMin.value = "";
  elPrecioMax.value = "";
  elSoloOfertas.checked = false;
  elOrden.value = "predeterminado";
  ordenActivo = "predeterminado";
  categoriaActiva = "Todos";
  subcategoriaActiva = null;
  marcasActivas = new Set();
  tallasActivas = new Set();
  actualizarBreadcrumb();
  construirCategorias();
  aplicarFiltros();
  cerrarPanelFiltros();
});

// ========================================================================
// CARRITO DE WHATSAPP
// ========================================================================
const CARRITO_KEY = "fenix_carrito";

function obtenerCarrito() {
  try {
    return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function guardarCarrito(carrito) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  actualizarBadgeCarrito();
}

// actualizarBadgeCarrito ya la expone header.js como window.actualizarBadgeCarrito

function mostrarToast(mensaje) {
  const elToast = document.getElementById("toast-carrito");
  elToast.textContent = mensaje;
  elToast.classList.add("visible");
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => elToast.classList.remove("visible"), 2200);
}

function agregarAlCarrito(producto, mostrarConfirmacion = true) {
  const carrito = obtenerCarrito();
  const existente = carrito.find(item => item.sku === producto.sku);

  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({ sku: producto.sku, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen, cantidad: 1 });
  }

  guardarCarrito(carrito);
  if (mostrarConfirmacion) mostrarToast("✓ Agregado a tu pedido");
}

// Usada desde el onclick de cada tarjeta (recibe el producto codificado en la URL)
function agregarAlCarritoDesdeTarjeta(productoJsonCodificado) {
  const producto = JSON.parse(decodeURIComponent(productoJsonCodificado));
  agregarAlCarrito(producto);
}

function quitarDelCarrito(sku) {
  const carrito = obtenerCarrito().filter(item => item.sku !== sku);
  guardarCarrito(carrito);
  renderizarCarrito();
}

function cambiarCantidad(sku, delta) {
  const carrito = obtenerCarrito();
  const item = carrito.find(i => i.sku === sku);
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    quitarDelCarrito(sku);
    return;
  }

  guardarCarrito(carrito);
  renderizarCarrito();
}

function extraerPrecioNumerico(precio) {
  return Number(String(precio).replace(/[^0-9.]/g, "")) || 0;
}

function renderizarCarrito() {
  const carrito = obtenerCarrito();
  const elLista = document.getElementById("carrito-lista");
  const elFooter = document.getElementById("carrito-footer");

  if (carrito.length === 0) {
    elLista.innerHTML = `<div class="carrito-vacio">Tu pedido está vacío.<br>Agrega productos desde el catálogo.</div>`;
    elFooter.style.display = "none";
    return;
  }

  elFooter.style.display = "block";

  elLista.innerHTML = carrito.map(item => {
    const precioUnit = extraerPrecioNumerico(item.precio);
    const imagenHtml = item.imagen
      ? `<img src="${_optImg(item.imagen, 'miniatura')}" alt="${item.nombre}">`
      : "";

    return `
      <div class="carrito-item">
        <div class="carrito-item-img">${imagenHtml}</div>
        <div class="carrito-item-info">
          <p class="carrito-item-nombre">${item.nombre}</p>
          <p class="carrito-item-precio">S/ ${precioUnit.toFixed(2)} c/u</p>
          <div class="carrito-item-controles">
            <button onclick="cambiarCantidad('${item.sku}', -1)" aria-label="Quitar uno">−</button>
            <span class="carrito-item-cantidad">${item.cantidad}</span>
            <button onclick="cambiarCantidad('${item.sku}', 1)" aria-label="Agregar uno">+</button>
            <button class="carrito-item-quitar" onclick="quitarDelCarrito('${item.sku}')">Quitar</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const total = carrito.reduce((suma, item) => suma + extraerPrecioNumerico(item.precio) * item.cantidad, 0);
  document.getElementById("carrito-total-monto").textContent = "S/ " + total.toFixed(2);
}

function abrirCarrito() {
  renderizarCarrito();
  document.getElementById("drawer-carrito").classList.add("abierto");
  document.getElementById("fondo-carrito").classList.add("abierto");
  document.body.style.overflow = "hidden";
}

function cerrarCarrito() {
  document.getElementById("drawer-carrito").classList.remove("abierto");
  document.getElementById("fondo-carrito").classList.remove("abierto");
  document.body.style.overflow = "";
}

function irAlCheckout() {
  const carrito = obtenerCarrito();
  if (carrito.length === 0) return;
  window.location.href = "checkout.html";
}

document.getElementById("btn-abrir-carrito").addEventListener("click", abrirCarrito);
document.getElementById("btn-cerrar-carrito").addEventListener("click", cerrarCarrito);
document.getElementById("fondo-carrito").addEventListener("click", cerrarCarrito);
document.getElementById("btn-enviar-pedido").addEventListener("click", irAlCheckout);
document.getElementById("btn-vaciar-carrito").addEventListener("click", () => {
  if (confirm("¿Vaciar todo tu pedido?")) {
    guardarCarrito([]);
    renderizarCarrito();
  }
});

actualizarBadgeCarrito();

cargarCatalogo();
