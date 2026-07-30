const RUTA_PRODUCTOS = "productos.json";
    const NUMERO_WHATSAPP = "51978821080";
    const URL_SITIO = "https://fenix-import-peru.onrender.com";
    let catalogoCompleto = null;
    let fuse = null;

    // #anio ya lo escribe footer.js al inyectar el footer

    const mensajeWhatsApp = "¡Hola Fenix Import Perú!\nMe gustaría más información sobre sus productos.";
    const urlWhatsApp = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" + encodeURIComponent(mensajeWhatsApp);
    // nav-whatsapp ya lo asigna header.js; aquí solo quedan los propios de esta página.
    ["hero-whatsapp", "whatsapp-flotante"].forEach(id => {
      document.getElementById(id).href = urlWhatsApp;
    });

    // Tema oscuro/claro y menú lateral (drawer) ya los maneja header.js

    // ---------- Categorías (desde el catálogo estático ya cargado) ----------

    function dibujarCategorias(categorias) {
      const elEstado = document.getElementById("estado-categorias");
      const elGrilla = document.getElementById("grilla-categorias");

      if (!categorias || categorias.length === 0) {
        elEstado.textContent = "No se pudieron cargar las categorías. Puedes ir directo al catálogo completo.";
        return;
      }

      elEstado.style.display = "none";

      elGrilla.innerHTML = categorias.map(cat => `
        <a class="tarjeta-categoria" href="catalogo.html?categoria=${encodeURIComponent(cat.nombre)}">
          <span class="nombre">${cat.nombre}</span>
          <span class="cantidad">${cat.cantidad} producto${cat.cantidad === 1 ? "" : "s"}</span>
        </a>
      `).join("");

      // El drawer de categorías (menú lateral) ya lo llena header.js con su propio fetch.
    }

    async function cargarCatalogoCompleto() {
      const elEstado = document.getElementById("estado-categorias");
      try {
        const respuesta = await fetch(RUTA_PRODUCTOS);
        if (!respuesta.ok) throw new Error("No se pudo cargar productos.json (" + respuesta.status + ")");

        catalogoCompleto = await respuesta.json();

        fuse = new Fuse(catalogoCompleto.productos, {
          keys: ["nombre", "sku"],
          threshold: 0.35,
          ignoreLocation: true
        });

        dibujarCategorias(catalogoCompleto.categorias);
        dibujarVitrina(catalogoCompleto.productos);

      } catch (error) {
        elEstado.textContent = "No se pudieron cargar las categorías. Puedes ir directo al catálogo completo.";
        console.error(error);
      }
    }

    function dibujarVitrina(productos) {
      const elPista = document.getElementById("vitrina-pista");
      if (!productos || productos.length === 0) return;

      // Muestra al azar (se ve distinto cada vez que alguien entra)
      const muestra = [...productos].sort(() => Math.random() - 0.5).slice(0, 18);

      const tarjetas = muestra.map(p => {
        const precio = Number(String(p.precio).replace(/[^0-9.]/g, "")).toFixed(2);
        const imagenHtml = p.imagen
          ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy">`
          : `<span class="sin-foto">Sin foto</span>`;
        const badge = p.oferta ? `<span class="vitrina-badge-oferta">Oferta</span>` : "";

        return `
          <a class="vitrina-tarjeta" href="/producto/${encodeURIComponent(p.sku)}.html">
            <div class="vitrina-img">${badge}${imagenHtml}</div>
            <div class="vitrina-body">
              <p class="vitrina-nombre">${p.nombre}</p>
              <p class="vitrina-precio">S/ ${precio}</p>
            </div>
          </a>
        `;
      }).join("");

      // Se duplica la tira para que el loop sea perfecto (sin salto visible)
      elPista.innerHTML = tarjetas + tarjetas;
    }

    // El buscador del header (dropdown, teclado, submit) ya lo maneja header.js

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

    function extraerPrecioNumerico(precio) {
      return Number(String(precio).replace(/[^0-9.]/g, "")) || 0;
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

    cargarCatalogoCompleto();
