const RUTA_PRODUCTOS = "productos.json";
    const NUMERO_WHATSAPP = "51978821080";
    const URL_SITIO = "https://fenix-import-peru.onrender.com";
    const LOTE = 24;
    let fuse = null;

    // #anio ya lo escribe footer.js al inyectar el footer

    const mensajeGenerico = "¡Hola Fenix Import Perú!\nMe gustaría más información sobre sus productos.";
    const urlWhatsAppGenerico = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" + encodeURIComponent(mensajeGenerico);
    // nav-whatsapp ya lo asigna header.js; aquí solo queda el flotante propio de esta página.
    document.getElementById("whatsapp-flotante").href = urlWhatsAppGenerico;

    // Tema oscuro/claro y menú lateral (drawer) ya los maneja header.js

    let todosLosProductos = [];
    let productosFiltrados = [];
    let categoriaActiva = new URLSearchParams(window.location.search).get("categoria") || "Todos";
    let subcategoriaActiva = new URLSearchParams(window.location.search).get("subcategoria") || null;
    let cantidadMostrada = 0;

    const elEstadoCarga = document.getElementById("estado-carga");
    const elContenido = document.getElementById("contenido");
    const elGrilla = document.getElementById("grilla");
    const elContador = document.getElementById("contador");
    const elCategorias = document.getElementById("lista-categorias");
    const elBuscar = document.getElementById("input-buscar");
    const elBtnCargarMas = document.getElementById("btn-cargar-mas");
    const elPrecioMin = document.getElementById("input-precio-min");
    const elPrecioMax = document.getElementById("input-precio-max");
    const elSoloOfertas = document.getElementById("input-solo-ofertas");
    const elBtnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");
    const elBreadcrumb = document.getElementById("breadcrumb");

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
      elGrilla.innerHTML = `<div class="estado" style="grid-column: 1 / -1;"><div class="estado-icono">🔦</div><p class="estado-titulo">No encontramos productos</p><p class="estado-texto">Prueba con otra palabra o revisa otra categoría.</p></div>`;
      elBtnCargarMas.style.display = "none";
    }

    function urlWhatsApp(producto) {
      const precio = Number(String(producto.precio).replace(/[^0-9.]/g, "")).toFixed(2);
      const link = URL_SITIO + "/producto/" + encodeURIComponent(producto.sku) + ".html";
      const mensaje = `¡Hola, Fenix Import Perú!\nMe gustaría realizar el siguiente pedido:\n${producto.nombre}\nPrecio: S/ ${precio}\nSKU: ${producto.sku}\n${link}`;
      return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
    }

    function crearTarjeta(producto) {
      const precio = Number(String(producto.precio).replace(/[^0-9.]/g, "")).toFixed(2);
      const imagenHtml = producto.imagen
        ? `<img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy">`
        : `<span class="sin-foto">Sin foto</span>`;
      const badge = producto.oferta ? `<span class="badge-oferta">Oferta</span>` : "";
      const productoJson = encodeURIComponent(JSON.stringify({ sku: producto.sku, nombre: producto.nombre, precio: producto.precio, imagen: producto.imagen }));

      return `
        <a class="tarjeta" href="/producto/${encodeURIComponent(producto.sku)}.html">
          <div class="tarjeta-img">${badge}${imagenHtml}</div>
          <div class="tarjeta-body">
            <p class="tarjeta-categoria">${producto.categoria || ""}</p>
            <p class="tarjeta-nombre">${producto.nombre}</p>
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

    function renderizarLote() {
      const siguienteLote = productosFiltrados.slice(cantidadMostrada, cantidadMostrada + LOTE);
      elGrilla.insertAdjacentHTML("beforeend", siguienteLote.map(crearTarjeta).join(""));
      cantidadMostrada += siguienteLote.length;
      elBtnCargarMas.style.display = cantidadMostrada < productosFiltrados.length ? "block" : "none";
      elContador.textContent = `${productosFiltrados.length} producto${productosFiltrados.length === 1 ? "" : "s"} encontrado${productosFiltrados.length === 1 ? "" : "s"}`;
    }

    function extraerPrecio(producto) {
      return Number(String(producto.precio).replace(/[^0-9.]/g, "")) || 0;
    }

    function aplicarFiltros() {
      const texto = elBuscar.value.trim();
      const precioMin = elPrecioMin.value !== "" ? Number(elPrecioMin.value) : null;
      const precioMax = elPrecioMax.value !== "" ? Number(elPrecioMax.value) : null;
      const soloOfertas = elSoloOfertas.checked;

      const candidatos = (texto && fuse) ? fuse.search(texto).map(r => r.item) : todosLosProductos;

      productosFiltrados = candidatos.filter(p => {
        const coincideCategoria = categoriaActiva === "Todos" || p.categoria === categoriaActiva;
        const coincideSubcategoria = !subcategoriaActiva || p.subcategoria === subcategoriaActiva;
        const precio = extraerPrecio(p);
        const coincidePrecioMin = precioMin === null || precio >= precioMin;
        const coincidePrecioMax = precioMax === null || precio <= precioMax;
        const coincideOferta = !soloOfertas || p.oferta;
        return coincideCategoria && coincideSubcategoria && coincidePrecioMin && coincidePrecioMax && coincideOferta;
      });

      elGrilla.innerHTML = "";
      cantidadMostrada = 0;

      if (productosFiltrados.length === 0) {
        mostrarVacio();
        elContador.textContent = "0 productos encontrados";
        return;
      }

      renderizarLote();
    }

    function construirCategorias() {
      const categoriasUnicas = ["Todos", ...new Set(todosLosProductos.map(p => p.categoria).filter(Boolean))];

      elCategorias.innerHTML = categoriasUnicas.map(cat => {
        const activo = cat === categoriaActiva ? "activo" : "";
        return `<button class="chip ${activo}" data-cat="${cat}">${cat}</button>`;
      }).join("");

      elCategorias.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
          categoriaActiva = chip.dataset.cat;
          subcategoriaActiva = null;
          elCategorias.querySelectorAll(".chip").forEach(c => c.classList.remove("activo"));
          chip.classList.add("activo");
          actualizarBreadcrumb();
          aplicarFiltros();
        });
      });
    }

    // dibujarDrawerCategorias ya no hace falta aquí: header.js llena el
    // drawer de categorías con su propio fetch de productos.json.

    async function cargarCatalogo() {
      try {
        const respuesta = await fetch(RUTA_PRODUCTOS);
        if (!respuesta.ok) throw new Error("No se pudo cargar productos.json (" + respuesta.status + ")");

        const datos = await respuesta.json();

        todosLosProductos = datos.productos || [];
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

        construirCategorias();

        const buscarUrl = new URLSearchParams(window.location.search).get("buscar");
        if (buscarUrl) elBuscar.value = buscarUrl;

        actualizarBreadcrumb();
        aplicarFiltros();

      } catch (error) {
        mostrarError("Ocurrió un problema al conectar con el catálogo. Intenta recargar la página en unos minutos.");
        console.error(error);
      }
    }

    elBuscar.addEventListener("input", aplicarFiltros);
    elBtnCargarMas.addEventListener("click", renderizarLote);
    elPrecioMin.addEventListener("input", aplicarFiltros);
    elPrecioMax.addEventListener("input", aplicarFiltros);
    elSoloOfertas.addEventListener("change", aplicarFiltros);
    elBtnLimpiarFiltros.addEventListener("click", () => {
      elBuscar.value = "";
      elPrecioMin.value = "";
      elPrecioMax.value = "";
      elSoloOfertas.checked = false;
      categoriaActiva = "Todos";
      subcategoriaActiva = null;
      elCategorias.querySelectorAll(".chip").forEach(c => c.classList.remove("activo"));
      elCategorias.querySelector('.chip[data-cat="Todos"]')?.classList.add("activo");
      actualizarBreadcrumb();
      aplicarFiltros();
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
          ? `<img src="${item.imagen}" alt="${item.nombre}">`
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
