const NUMERO_WHATSAPP = "51978821080";
  const URL_SITIO = "https://feniximportperu.com";
  const CARRITO_KEY = "fenix_carrito";
  const FORM_DATOS_KEY = "fenix_checkout_datos";
  const DIRECCION_ALMACEN = "Jirón Cajabamba 313, Independencia, Lima";

    const URL_REGISTRO_PEDIDO = "https://script.google.com/macros/s/AKfycbyUDAx_uxcRC-_Vo22u5utS2GVrN76nAfQfvbynmajfTVu8pRCXpuOeFVs0VqUjdZTu/exec";

  // Ubigeo propio (Departamento → Provincia → Distrito), publicado desde tu Sheet
  const URL_UBIGEO = "ubigeo.json";
  // #anio ya lo escribe footer.js al inyectar el footer
  // nav-whatsapp y el tema oscuro/claro ya los maneja header.js.
  // Aquí solo re-ajustamos el mapa de Leaflet cuando cambia el tema.
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-tema") && mapaLeaflet) {
      setTimeout(() => mapaLeaflet.invalidateSize(), 200);
    }
  });
  // ---------- Carrito (lectura) ----------
  function obtenerCarrito() {
    try { return JSON.parse(localStorage.getItem(CARRITO_KEY)) || []; }
    catch (e) { return []; }
  }
  function guardarCarrito(carrito) {
    localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  }
  // ---------- Validación y filtrado de celulares/documentos ----------
  // Mientras el cliente escribe: deja pasar solo dígitos, y un "+" si va
  // al inicio (para números extranjeros con código de país).
  function filtrarSoloCelular(evento) {
    const el = evento.target;
    const tienePlusAlInicio = el.value.trim().startsWith("+");
    let limpio = el.value.replace(/[^\d]/g, "");
    el.value = tienePlusAlInicio ? "+" + limpio : limpio;
  }
  function filtrarSoloNumeros(evento) {
    evento.target.value = evento.target.value.replace(/[^\d]/g, "");
  }
  // Celular peruano válido: 9 dígitos empezando en 9 (ej. 987654321).
  // También se acepta número extranjero si el cliente lo escribe con
  // "+" y su código de país (ej. +1 555 123 4567).
  function esCelularValido(valor) {
    const limpio = valor.trim();
    if (/^9\d{8}$/.test(limpio)) return true;
    if (/^\+\d{8,15}$/.test(limpio)) return true;
    return false;
  }
  // Documento de identidad válido según su tipo.
  // DNI peruano: exactamente 8 dígitos.
  // CE (Carné de Extranjería): no tiene un formato único fijo, así que
  // se acepta un rango razonable de 6 a 12 dígitos.
  function esDocumentoValido(valor, tipo) {
    const limpio = (valor || "").trim();
    if (tipo === "CE") return /^\d{6,12}$/.test(limpio);
    return /^\d{8}$/.test(limpio); // DNI por defecto
  }
  function activarValidacionesDeCampos() {
    document.querySelectorAll(".campo-celular").forEach(el => el.addEventListener("input", filtrarSoloCelular));
    document.querySelectorAll(".campo-solo-numeros").forEach(el => el.addEventListener("input", filtrarSoloNumeros));
  }
  // actualizarBadgeCarrito ya la expone header.js como window.actualizarBadgeCarrito
  document.getElementById("btn-abrir-carrito").addEventListener("click", () => {
    window.location.href = "catalogo.html";
  });
  function extraerPrecioNumerico(precio) {
    return Number(String(precio).replace(/[^0-9.]/g, "")) || 0;
  }
  // Combina distrito + calle + número + urbanización en un solo texto,
  // igual formato para el mensaje de WhatsApp y para la columna N del Sheet.
  function armarDireccionCompleta() {
    const distrito = document.getElementById("input-distrito").value.trim();
    const calle = document.getElementById("input-calle").value.trim();
    const numero = document.getElementById("input-numero").value.trim();
    const urbanizacion = document.getElementById("input-urbanizacion").value.trim();
    let texto = [calle, numero].filter(Boolean).join(" ");
    if (urbanizacion) texto += (texto ? ", " : "") + "Urb. " + urbanizacion;
    if (distrito) texto += (texto ? " - " : "") + distrito;
    return texto;
  }
  // ---------- Estado ----------
  let productosCatalogo = [];
  let distritosLima = [];
  let mapaLeaflet = null;
  let marcadorMapa = null;
  // Ubigeo Perú (para envíos a provincia) — se carga solo si el cliente elige esa opción
  let ubigeo = {};
  let ubigeoCargado = false;
  function mostrarVacio() {
    document.getElementById("main-contenido").innerHTML = `
      <div class="estado-vacio" style="grid-column: 1 / -1;">
        <div class="icono">🛒</div>
        <p>Tu pedido está vacío.</p>
        <a href="catalogo.html">Ver catálogo →</a>
      </div>
    `;
  }
  function renderizarFormulario() {
    const elMain = document.getElementById("main-contenido");
    elMain.innerHTML = `
      <div>
        <div class="seccion-form">
          <p class="seccion-form-titulo">Tipo de entrega</p>
          <p class="seccion-form-subtitulo">Elige cómo prefieres recibir tu pedido</p>
          <div class="opciones-comprobante">
            <label class="opcion-radio">
              <input type="radio" name="tipoEntrega" value="recojo" checked>
              <span class="opcion-radio-texto"><strong>Recojo en almacén</strong><span>Sin costo — coordinamos el horario antes de ir</span></span>
            </label>
            <label class="opcion-radio">
              <input type="radio" name="tipoEntrega" value="lima">
              <span class="opcion-radio-texto"><strong>Delivery en Lima</strong><span>Entrega a domicilio, costo según distrito</span></span>
            </label>
            <label class="opcion-radio">
              <input type="radio" name="tipoEntrega" value="provincia">
              <span class="opcion-radio-texto"><strong>Envío a provincia</strong><span>Por agencia de transporte — tú eliges cuál</span></span>
            </label>
          </div>
        </div>
        <div class="seccion-form" id="seccion-recojo">
          <p class="seccion-form-titulo">Recojo en almacén</p>
          <div class="info-recojo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>
            <span>📍 ${DIRECCION_ALMACEN}<br><span style="color:var(--texto-muted); font-size:0.8rem;">Coordinamos el horario exacto por WhatsApp antes de tu visita.</span></span>
          </div>
          <div class="estimado-entrega" id="estimado-recojo"></div>
        </div>
        <div class="seccion-form" id="seccion-lima" style="display:none;">
          <p class="seccion-form-titulo">Delivery en Lima</p>
          <p class="seccion-form-subtitulo">Para calcular el envío y coordinar la entrega</p>
          <div class="estimado-entrega" id="estimado-lima"></div>
          <div class="campo" id="campo-distrito">
            <label>Distrito</label>
            <select id="input-distrito">
              <option value="">Selecciona tu distrito...</option>
            </select>
            <p class="campo-error">Selecciona tu distrito</p>
          </div>
          <div class="campo" id="campo-calle">
            <label>Calle o avenida</label>
            <input type="text" id="input-calle" placeholder="Ej. Av. Los Jazmines">
            <p class="campo-error">Ingresa la calle o avenida</p>
          </div>
          <div class="fila-2">
            <div class="campo" id="campo-numero">
              <label>Número / Mz. / Lote</label>
              <input type="text" id="input-numero" placeholder="Ej. Mz C Lote 5, o 450">
              <p class="campo-error">Ingresa el número</p>
            </div>
            <div class="campo">
              <label>Urbanización <span class="opcional">(opcional)</span></label>
              <input type="text" id="input-urbanizacion" placeholder="Ej. Los Jazmines de Naranjal">
            </div>
          </div>
          <div class="campo">
            <label>Referencia <span class="opcional">(opcional)</span></label>
            <input type="text" id="input-referencia" placeholder="Ej. frente al parque, casa de rejas negras...">
          </div>
          <div class="campo" style="margin-bottom:0;">
            <label>Marca tu ubicación exacta <span class="opcional">(arrastra el pin)</span></label>
            <div id="mapa-entrega"></div>
            <p class="mapa-nota">Toca el mapa o arrastra el marcador hasta tu ubicación exacta — como en las apps de delivery.</p>
          </div>
        </div>
        <div class="seccion-form" id="seccion-provincia" style="display:none;">
          <p class="seccion-form-titulo">Envío a provincia</p>
          <p class="seccion-form-subtitulo">El costo del envío se coordina y paga directo en la agencia</p>
          <div class="estimado-entrega" id="estimado-provincia"></div>
          <div class="fila-2">
            <div class="campo" id="campo-departamento">
              <label>Departamento</label>
              <select id="input-departamento"><option value="">Cargando...</option></select>
              <p class="campo-error">Selecciona tu departamento</p>
            </div>
            <div class="campo" id="campo-provincia">
              <label>Provincia</label>
              <select id="input-provincia" disabled><option value="">Elige un departamento primero</option></select>
              <p class="campo-error">Selecciona tu provincia</p>
            </div>
          </div>
          <div class="campo" id="campo-distrito-provincia">
            <label>Distrito</label>
            <select id="input-distrito-provincia" disabled><option value="">Elige una provincia primero</option></select>
            <p class="campo-error">Selecciona tu distrito</p>
          </div>
          <div class="campo" id="campo-agencia">
            <label>Agencia de tu preferencia</label>
            <select id="input-agencia">
              <option value="">Selecciona una agencia...</option>
              <option value="Shalom">Shalom</option>
              <option value="Olva Courier">Olva Courier</option>
              <option value="Hnos Flores">Hnos Flores</option>
              <option value="Marvisur">Marvisur</option>
              <option value="otro">Otra (especificar)</option>
            </select>
            <p class="campo-error">Selecciona una agencia</p>
          </div>
          <div class="campo" id="campo-agencia-otro" style="display:none;">
            <label>¿Cuál agencia?</label>
            <input type="text" id="input-agencia-otro" placeholder="Nombre de la agencia">
          </div>
          <p class="nota-provincia">💡 El costo de envío por agencia varía según peso/volumen y se paga directo ahí — nosotros dejamos el paquete listo en la agencia que elijas.</p>
        </div>
        <div class="seccion-form">
          <p class="seccion-form-titulo">Tus datos</p>
          <p class="seccion-form-subtitulo">Para saber a nombre de quién va el pedido</p>
          <div class="campo" id="campo-nombre">
            <label>Nombre completo</label>
            <input type="text" id="input-nombre" placeholder="Ej. María Gómez">
            <p class="campo-error">Ingresa tu nombre</p>
          </div>
          <div class="campo" id="campo-dni-comprador" style="display:none;">
            <div class="fila-2">
              <div class="campo" id="campo-dni-comprador-tipo" style="margin-bottom:0;">
                <label>Tipo de documento</label>
                <select id="input-dni-comprador-tipo">
                  <option value="DNI">DNI</option>
                  <option value="CE">Carné de Extranjería</option>
                </select>
              </div>
              <div class="campo" style="margin-bottom:0;">
                <label>N° de documento</label>
                <input type="text" id="input-dni-comprador" class="campo-solo-numeros" placeholder="8 dígitos" inputmode="numeric" maxlength="8">
                <p class="campo-error">El documento no es válido</p>
              </div>
            </div>
          </div>
          <div class="campo" id="campo-celular-comprador">
            <label>Celular</label>
            <input type="tel" id="input-celular-comprador" class="campo-celular" placeholder="9XXXXXXXX" inputmode="numeric">
            <p style="font-size:0.72rem; color:var(--texto-muted); margin:5px 0 0;">¿Número de otro país? Escríbelo con "+" y tu código (ej. +1 555...)</p>
            <p class="campo-error">Ingresa un celular válido (9 dígitos, ej. 987654321)</p>
          </div>
          <div class="campo" id="campo-correo-comprador" style="margin-top:14px;">
            <label>Correo <span class="opcional">(opcional)</span></label>
            <input type="email" id="input-correo-comprador" placeholder="tucorreo@ejemplo.com">
            <p style="font-size:0.72rem; color:var(--texto-muted); margin:5px 0 0;">Si lo dejas, te mandamos una copia del pedido apenas lo envíes.</p>
            <p class="campo-error">Ingresa un correo válido</p>
          </div>
        </div>
        <div class="seccion-form" id="seccion-contacto-general">
          <p class="seccion-form-titulo">¿Quién recibe el pedido?</p>
          <p class="seccion-form-subtitulo">Por si otra persona distinta a ti lo recibe o lo recoge</p>
          <div class="opciones-comprobante">
            <label class="opcion-radio">
              <input type="radio" name="quienRecibe" value="yo_mismo" checked>
              <span class="opcion-radio-texto"><strong>Yo mismo</strong><span>Uso mi propio nombre y celular de arriba</span></span>
            </label>
            <label class="opcion-radio">
              <input type="radio" name="quienRecibe" value="otra_persona">
              <span class="opcion-radio-texto"><strong>Otra persona</strong><span>Alguien más está autorizado a recibir/recoger</span></span>
            </label>
          </div>
          <div id="bloque-contacto1" style="display:none; margin-top:14px;">
            <div class="contacto-bloque" style="border-top:none; padding-top:0; margin-top:0;">
              <p class="contacto-bloque-titulo">Quien recibe / recoge</p>
              <div class="fila-2">
                <div class="campo" id="campo-contacto1-nombre">
                  <label>Nombre</label>
                  <input type="text" id="input-contacto1-nombre" placeholder="Nombre">
                  <p class="campo-error">Requerido</p>
                </div>
                <div class="campo" id="campo-contacto1-telefono">
                  <label>Teléfono</label>
                  <input type="tel" id="input-contacto1-telefono" class="campo-celular" placeholder="9XXXXXXXX" inputmode="numeric">
                  <p class="campo-error">Celular inválido (9 dígitos, ej. 987654321)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="seccion-form" id="seccion-destinatario-provincia" style="display:none;">
          <p class="seccion-form-titulo">Datos de quien recibe</p>
          <p class="seccion-form-subtitulo">La agencia pide DNI a quien recoja el paquete — marca todas las que apliquen</p>
          <label class="opcion-radio" style="margin-bottom:8px;">
            <input type="checkbox" id="chk-destinatario-yo-mismo" checked>
            <span class="opcion-radio-texto"><strong>Yo mismo</strong><span>Uso mis propios datos de arriba (nombre, DNI, celular)</span></span>
          </label>
          <label class="opcion-radio">
            <input type="checkbox" id="chk-destinatario-otra-persona">
            <span class="opcion-radio-texto"><strong>Otra persona</strong><span>Alguien más también puede recoger el paquete</span></span>
          </label>
          <div id="bloque-destinatario1" style="display:none; margin-top:14px;">
            <div class="contacto-bloque" style="border-top:none; padding-top:0; margin-top:0;">
              <p class="contacto-bloque-titulo">Datos de esa persona</p>
              <div class="campo" id="campo-destinatario1-nombre">
                <label>Nombre completo</label>
                <input type="text" id="input-destinatario1-nombre" placeholder="Nombre completo">
                <p class="campo-error">Requerido</p>
              </div>
              <div class="fila-2">
                <div class="campo" id="campo-destinatario1-tipo" style="margin-bottom:0;">
                  <label>Tipo de documento</label>
                  <select id="input-destinatario1-tipo">
                    <option value="DNI">DNI</option>
                    <option value="CE">Carné de Extranjería</option>
                  </select>
                </div>
                <div class="campo" id="campo-destinatario1-dni" style="margin-bottom:0;">
                  <label>N° de documento</label>
                  <input type="text" id="input-destinatario1-dni" class="campo-solo-numeros" placeholder="8 dígitos" inputmode="numeric" maxlength="8">
                  <p class="campo-error">El documento no es válido</p>
                </div>
              </div>
              <div class="campo" id="campo-destinatario1-celular" style="margin-top:14px;">
                <label>Celular</label>
                <input type="tel" id="input-destinatario1-celular" class="campo-celular" placeholder="9XXXXXXXX" inputmode="numeric">
                <p class="campo-error">Celular inválido (9 dígitos, ej. 987654321)</p>
              </div>
              <button type="button" id="btn-agregar-destinatario2" class="btn-gps" style="margin-top:4px;">+ Agregar una segunda persona</button>
              <div id="bloque-destinatario2" style="display:none; margin-top:14px;">
                <p class="contacto-bloque-titulo">Segunda persona <span class="opcional" style="text-transform:none; font-weight:400;">(opcional)</span></p>
                <div class="campo" id="campo-destinatario2-nombre">
                  <label>Nombre completo</label>
                  <input type="text" id="input-destinatario2-nombre" placeholder="Nombre completo">
                  <p class="campo-error">Requerido</p>
                </div>
                <div class="fila-2">
                  <div class="campo" id="campo-destinatario2-tipo" style="margin-bottom:0;">
                    <label>Tipo de documento</label>
                    <select id="input-destinatario2-tipo">
                      <option value="DNI">DNI</option>
                      <option value="CE">Carné de Extranjería</option>
                    </select>
                  </div>
                  <div class="campo" id="campo-destinatario2-dni" style="margin-bottom:0;">
                    <label>N° de documento</label>
                    <input type="text" id="input-destinatario2-dni" class="campo-solo-numeros" placeholder="8 dígitos" inputmode="numeric" maxlength="8">
                    <p class="campo-error">El documento no es válido</p>
                  </div>
                </div>
                <div class="campo" id="campo-destinatario2-celular" style="margin-top:14px;">
                  <label>Celular</label>
                  <input type="tel" id="input-destinatario2-celular" class="campo-celular" placeholder="9XXXXXXXX" inputmode="numeric">
                  <p class="campo-error">Celular inválido (9 dígitos, ej. 987654321)</p>
                </div>
              </div>
            </div>
          </div>
          <p class="campo-error" id="error-destinatario-general" style="display:none; margin-top:10px;">Marca al menos una opción de quién recogerá el pedido.</p>
        </div>
        <div class="seccion-form">
          <p class="seccion-form-titulo">Comprobante de pago</p>
          <p class="seccion-form-subtitulo">Si necesitas factura/boleta, se agrega el IGV (18%)</p>
          <div class="opciones-comprobante">
            <label class="opcion-radio">
              <input type="radio" name="comprobante" value="libre" checked>
              <span class="opcion-radio-texto"><strong>Precio libre</strong><span>Sin comprobante, precio tal cual se muestra</span></span>
            </label>
            <label class="opcion-radio">
              <input type="radio" name="comprobante" value="con_comprobante">
              <span class="opcion-radio-texto"><strong>Con comprobante (Boleta/Factura)</strong><span>Se agrega 18% de IGV al total</span></span>
            </label>
          </div>
          <div class="campo" id="campo-documento" style="display:none; margin-top:14px;">
            <div class="campo" id="campo-numero-documento" style="margin-bottom:0;">
              <label>Número de documento (DNI o RUC)</label>
              <input type="text" id="input-numero-documento" class="campo-solo-numeros" inputmode="numeric" placeholder="8 u 11 dígitos" maxlength="11">
              <p class="campo-error">Verifica el número (DNI: 8 dígitos, RUC: 11 dígitos)</p>
            </div>
          </div>
        </div>
        <div class="seccion-form">
          <p class="seccion-form-titulo">Notas adicionales <span class="opcional">(opcional)</span></p>
          <div class="campo">
            <textarea id="input-notas" placeholder="Cualquier detalle adicional para tu pedido..."></textarea>
          </div>
        </div>
      </div>
      <div class="resumen">
        <p class="resumen-titulo">Resumen del pedido</p>
        <a href="catalogo.html" id="link-editar-carrito" style="display:block; font-size:0.82rem; color:var(--azul); font-weight:600; margin-bottom:14px;">← Agregar o quitar productos</a>
        <div id="resumen-items"></div>
        <div class="resumen-linea"><span>Subtotal</span><span id="resumen-subtotal">S/ 0.00</span></div>
        <div class="resumen-linea" id="linea-igv" style="display:none;"><span>IGV (18%)</span><span id="resumen-igv">S/ 0.00</span></div>
        <div class="resumen-linea destacada"><span>Envío</span><span id="resumen-envio">Sin costo</span></div>
        <div class="resumen-total"><span>Total</span><span id="resumen-total">S/ 0.00</span></div>
        <button class="btn-enviar-checkout" id="btn-enviar-checkout">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.3.37-.43.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.31 2.35 1.45.29.15.46.13.63-.07.17-.2.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
          Enviar pedido por WhatsApp
        </button>
        <p class="nota-checkout">Al enviar, se abre WhatsApp con todo el detalle. La compra se confirma coordinando ahí con un asesor.</p>
      </div>
    `;
    document.querySelectorAll('input[name="comprobante"]').forEach(r => r.addEventListener("change", onCambioComprobante));
    document.querySelectorAll('input[name="tipoEntrega"]').forEach(r => r.addEventListener("change", onCambioTipoEntrega));
    document.querySelectorAll('input[name="quienRecibe"]').forEach(r => r.addEventListener("change", onCambioQuienRecibe));
    document.getElementById("chk-destinatario-yo-mismo").addEventListener("change", onCambioDestinatarios);
    document.getElementById("chk-destinatario-otra-persona").addEventListener("change", onCambioDestinatarios);
    document.getElementById("btn-agregar-destinatario2").addEventListener("click", toggleDestinatario2);
    document.getElementById("input-dni-comprador-tipo").addEventListener("change", () => ajustarCampoDocumentoPersona("input-dni-comprador-tipo", "input-dni-comprador"));
    document.getElementById("input-destinatario1-tipo").addEventListener("change", () => ajustarCampoDocumentoPersona("input-destinatario1-tipo", "input-destinatario1-dni"));
    document.getElementById("input-destinatario2-tipo").addEventListener("change", () => ajustarCampoDocumentoPersona("input-destinatario2-tipo", "input-destinatario2-dni"));
    document.getElementById("input-distrito").addEventListener("change", actualizarResumen);
    document.getElementById("input-agencia").addEventListener("change", onCambioAgencia);
    document.getElementById("btn-enviar-checkout").addEventListener("click", intentarEnviarPedido);
    poblarDistritosLima();
    renderizarResumenItems();
    onCambioQuienRecibe();
    onCambioDestinatarios();
    actualizarResumen();
    activarValidacionesDeCampos();
    actualizarEstimadosEntrega();
    restaurarDatosFormulario();
    activarGuardadoAutomatico();
  }
  function onCambioQuienRecibe() {
    const esOtraPersona = document.querySelector('input[name="quienRecibe"]:checked').value === "otra_persona";
    document.getElementById("bloque-contacto1").style.display = esOtraPersona ? "block" : "none";
  }
  function onCambioDestinatarios() {
    const yoMismo = document.getElementById("chk-destinatario-yo-mismo").checked;
    const otraPersona = document.getElementById("chk-destinatario-otra-persona").checked;
    document.getElementById("bloque-destinatario1").style.display = otraPersona ? "block" : "none";
    // No se puede desmarcar todo — siempre debe quedar al menos alguien
    document.getElementById("error-destinatario-general").style.display = (!yoMismo && !otraPersona) ? "block" : "none";
  }
  function toggleDestinatario2() {
    const el = document.getElementById("bloque-destinatario2");
    const btn = document.getElementById("btn-agregar-destinatario2");
    const abierto = el.style.display === "block";
    el.style.display = abierto ? "none" : "block";
    btn.textContent = abierto ? "+ Agregar una segunda persona" : "− Quitar segunda persona";
    if (abierto) {
      document.getElementById("input-destinatario2-nombre").value = "";
      document.getElementById("input-destinatario2-dni").value = "";
      document.getElementById("input-destinatario2-celular").value = "";
      marcarError("campo-destinatario2-nombre", false);
      marcarError("campo-destinatario2-dni", false);
      marcarError("campo-destinatario2-celular", false);
    }
  }
  // ---------- Comprobante / documento ----------
  function onCambioComprobante() {
    const conComprobante = document.querySelector('input[name="comprobante"]:checked').value === "con_comprobante";
    document.getElementById("campo-documento").style.display = conComprobante ? "block" : "none";
    actualizarResumen();
  }
  // Ajusta el placeholder/maxlength de un campo de documento de identidad
  // (comprador en provincia, destinatario1, destinatario2) según si eligieron
  // DNI o Carné de Extranjería (CE) — para soportar compradores/destinatarios extranjeros.
  function ajustarCampoDocumentoPersona(idSelectTipo, idInputDocumento) {
    const tipo = document.getElementById(idSelectTipo).value;
    const elInput = document.getElementById(idInputDocumento);
    if (tipo === "CE") {
      elInput.maxLength = 12;
      elInput.placeholder = "N° de Carné de Extranjería";
    } else {
      elInput.maxLength = 8;
      elInput.placeholder = "8 dígitos";
    }
  }
  // ---------- Tipo de entrega ----------
  function onCambioTipoEntrega() {
    const tipo = document.querySelector('input[name="tipoEntrega"]:checked').value;
    document.getElementById("seccion-recojo").style.display = tipo === "recojo" ? "block" : "none";
    document.getElementById("seccion-lima").style.display = tipo === "lima" ? "block" : "none";
    document.getElementById("seccion-provincia").style.display = tipo === "provincia" ? "block" : "none";
    document.getElementById("seccion-contacto-general").style.display = tipo === "provincia" ? "none" : "block";
    document.getElementById("seccion-destinatario-provincia").style.display = tipo === "provincia" ? "block" : "none";
    document.getElementById("campo-dni-comprador").style.display = tipo === "provincia" ? "block" : "none";
    if (tipo === "lima") {
      setTimeout(inicializarMapa, 50);
    }
    if (tipo === "provincia" && !ubigeoCargado) {
      cargarUbigeoPeru();
    }
    actualizarResumen();
  }
  function onCambioAgencia() {
    const esOtro = document.getElementById("input-agencia").value === "otro";
    document.getElementById("campo-agencia-otro").style.display = esOtro ? "block" : "none";
    actualizarEstimadosEntrega();
    actualizarResumen();
  }
  // ---------- Estimado de entrega (según hora real y horarios de corte) ----------
  const AGENCIAS_CON_CORTE = ["Shalom", "Olva Courier", "Hnos Flores", "Marvisur"];
  function pintarEstimado(idElemento, mensaje, aTiempo) {
    const el = document.getElementById(idElemento);
    if (!el) return;
    el.className = "estimado-entrega " + (aTiempo ? "a-tiempo" : "fuera-de-horario");
    el.innerHTML = `<span class="icono-estimado">${aTiempo ? "✅" : "🕐"}</span><span>${mensaje}</span>`;
  }
  function actualizarEstimadosEntrega() {
    const ahora = new Date();
    const horaDecimal = ahora.getHours() + ahora.getMinutes() / 60;
    // Recojo en almacén: hasta las 5:00 PM, sin tolerancia (no queda nadie después)
    const corteRecojo = 17;
    if (horaDecimal < corteRecojo) {
      pintarEstimado("estimado-recojo", "Puedes recogerlo <strong>hoy mismo</strong> — atendemos hasta las 5:00 PM. Coordina el horario exacto por WhatsApp.", true);
    } else {
      pintarEstimado("estimado-recojo", "El horario de atención de hoy (hasta 5:00 PM) ya terminó. Podrás recogerlo el <strong>siguiente día hábil</strong>, coordinando antes por WhatsApp.", false);
    }
    // Delivery en Lima: pedidos hasta las 10:00 AM se procesan el mismo día
    const corteLima = 10;
    if (horaDecimal < corteLima) {
      pintarEstimado("estimado-lima", "Pedido dentro de horario — se procesa para entrega <strong>hoy mismo</strong>, sujeto a confirmación de stock y coordinación de pago.", true);
    } else {
      pintarEstimado("estimado-lima", "El horario de despacho de hoy (hasta 10:00 AM) ya pasó. Tu pedido se entrega el <strong>siguiente día hábil</strong>.", false);
    }
    // Envío a provincia: hasta las 3:00 PM se deja hoy en la agencia (si es de las
    // que tienen corte diario); otras agencias necesitan coordinación previa
    const corteProvincia = 15;
    const agenciaSeleccionada = document.getElementById("input-agencia")?.value || "";
    if (!agenciaSeleccionada) {
      pintarEstimado("estimado-provincia", "Elige una agencia para ver el tiempo estimado de envío.", true);
    } else if (agenciaSeleccionada === "otro") {
      pintarEstimado("estimado-provincia", "Esta agencia requiere <strong>coordinación previa</strong> — te contactamos para definir fecha y hora exacta de envío.", true);
    } else if (horaDecimal < corteProvincia) {
      pintarEstimado("estimado-provincia", `Pedido dentro de horario — se deja <strong>hoy en la tarde</strong> en ${agenciaSeleccionada}.`, true);
    } else {
      pintarEstimado("estimado-provincia", `El horario de hoy (hasta 3:00 PM) ya pasó. Se envía a ${agenciaSeleccionada} el <strong>siguiente día hábil</strong>.`, false);
    }
  }
  // ---------- Mapa (Leaflet + OpenStreetMap, sin necesidad de API key) ----------
  function inicializarMapa() {
    if (mapaLeaflet) { mapaLeaflet.invalidateSize(); return; }
    const centroLima = [-12.0464, -77.0428];
    mapaLeaflet = L.map("mapa-entrega").setView(centroLima, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(mapaLeaflet);
    marcadorMapa = L.marker(centroLima, { draggable: true }).addTo(mapaLeaflet);
    mapaLeaflet.on("click", (e) => {
      marcadorMapa.setLatLng(e.latlng);
    });
  }
  let temporizadorGeocodificar = null;
  function intentarGeocodificar() {
    clearTimeout(temporizadorGeocodificar);
    temporizadorGeocodificar = setTimeout(async () => {
      const direccion = armarDireccionCompleta();
      if (!direccion || !mapaLeaflet) return;
      const consulta = `${direccion}, Lima, Perú`;
      try {
        const respuesta = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(consulta));
        const resultados = await respuesta.json();
        if (resultados && resultados.length > 0) {
          const lat = parseFloat(resultados[0].lat);
          const lon = parseFloat(resultados[0].lon);
          mapaLeaflet.setView([lat, lon], 16);
          marcadorMapa.setLatLng([lat, lon]);
        }
      } catch (error) {
        console.error("No se pudo geocodificar", error);
      }
    }, 900);
  }
  // ---------- Ubigeo (departamentos / provincias / distritos reales, desde tu Sheet) ----------
  async function cargarUbigeoPeru() {
    const elDepartamento = document.getElementById("input-departamento");
    try {
      const respuesta = await fetch(URL_UBIGEO);
      ubigeo = await respuesta.json();
      ubigeoCargado = true;
      const departamentos = Object.keys(ubigeo).sort();
      elDepartamento.innerHTML = '<option value="">Selecciona tu departamento...</option>' +
        departamentos.map(dep => `<option value="${dep}">${dep}</option>`).join("");
    } catch (error) {
      elDepartamento.innerHTML = '<option value="">No se pudo cargar la lista</option>';
      console.error(error);
    }
  }
  function alCambiarDepartamento() {
    const departamento = document.getElementById("input-departamento").value;
    const elProvincia = document.getElementById("input-provincia");
    const elDistrito = document.getElementById("input-distrito-provincia");
    elDistrito.innerHTML = '<option value="">Elige una provincia primero</option>';
    elDistrito.disabled = true;
    if (!departamento || !ubigeo[departamento]) {
      elProvincia.innerHTML = '<option value="">Elige un departamento primero</option>';
      elProvincia.disabled = true;
      actualizarResumen();
      return;
    }
    const provincias = Object.keys(ubigeo[departamento]).sort();
    elProvincia.disabled = false;
    elProvincia.innerHTML = '<option value="">Selecciona tu provincia...</option>' +
      provincias.map(prov => `<option value="${prov}">${prov}</option>`).join("");
    actualizarResumen();
  }
  function alCambiarProvincia() {
    const departamento = document.getElementById("input-departamento").value;
    const provincia = document.getElementById("input-provincia").value;
    const elDistrito = document.getElementById("input-distrito-provincia");
    if (!provincia || !ubigeo[departamento] || !ubigeo[departamento][provincia]) {
      elDistrito.innerHTML = '<option value="">Elige una provincia primero</option>';
      elDistrito.disabled = true;
      actualizarResumen();
      return;
    }
    const distritos = [...ubigeo[departamento][provincia]].sort();
    elDistrito.disabled = false;
    elDistrito.innerHTML = '<option value="">Selecciona tu distrito...</option>' +
      distritos.map(d => `<option value="${d}">${d}</option>`).join("");
    actualizarResumen();
  }
  // ---------- Distritos de Lima (envío calculado) ----------
  function poblarDistritosLima() {
    const elSelect = document.getElementById("input-distrito");
    distritosLima.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.nombre;
      opt.textContent = d.nombre;
      opt.dataset.costo = d.costo;
      elSelect.appendChild(opt);
    });
    document.getElementById("input-calle").addEventListener("input", intentarGeocodificar);
    document.getElementById("input-numero").addEventListener("input", intentarGeocodificar);
    document.getElementById("input-urbanizacion").addEventListener("input", intentarGeocodificar);
    document.getElementById("input-distrito").addEventListener("change", intentarGeocodificar);
    document.getElementById("input-departamento").addEventListener("change", alCambiarDepartamento);
    document.getElementById("input-provincia").addEventListener("change", alCambiarProvincia);
  }
  function renderizarResumenItems() {
    const carrito = obtenerCarrito();
    document.getElementById("resumen-items").innerHTML = carrito.map(item => {
      const precioUnit = extraerPrecioNumerico(item.precio);
      const imagenHtml = item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}">` : "";
      return `
        <div class="resumen-item">
          <div class="resumen-item-img">${imagenHtml}</div>
          <div class="resumen-item-info">
            <p class="resumen-item-nombre">${item.nombre}</p>
            <p class="resumen-item-meta">${item.cantidad} × S/ ${precioUnit.toFixed(2)}</p>
          </div>
          <p class="resumen-item-subtotal">S/ ${(precioUnit * item.cantidad).toFixed(2)}</p>
        </div>
      `;
    }).join("");
  }
  function buscarRecargoCotizarManual() {
    const carrito = obtenerCarrito();
    return carrito.some(item => {
      const p = productosCatalogo.find(pr => pr.sku === item.sku);
      return p && p.recargo === "COTIZAR";
    });
  }
  function calcularRecargoVolumen() {
    const carrito = obtenerCarrito();
    let total = 0;
    carrito.forEach(item => {
      const p = productosCatalogo.find(pr => pr.sku === item.sku);
      if (p && typeof p.recargo === "number") total += p.recargo * item.cantidad;
    });
    return total;
  }
  function actualizarResumen() {
    const carrito = obtenerCarrito();
    const subtotal = carrito.reduce((s, i) => s + extraerPrecioNumerico(i.precio) * i.cantidad, 0);
    const conComprobante = document.querySelector('input[name="comprobante"]:checked')?.value === "con_comprobante";
    document.getElementById("resumen-subtotal").textContent = "S/ " + subtotal.toFixed(2);
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked')?.value || "recojo";
    const elResumenEnvio = document.getElementById("resumen-envio");
    const requiereCotizacionManual = buscarRecargoCotizarManual();
    let envio = 0;
    let envioEsNumero = true;
    if (tipoEntrega === "recojo") {
      elResumenEnvio.textContent = "Sin costo";
      envio = 0;
    } else if (tipoEntrega === "provincia") {
      const agenciaElegidaResumen = document.getElementById("input-agencia")?.value || "";
      elResumenEnvio.innerHTML = (agenciaElegidaResumen === "Olva Courier")
        ? `<span class="valor-cotizar">Pago adelantado — se cotiza</span>`
        : `<span class="valor-cotizar">Se paga en la agencia</span>`;
      envioEsNumero = false;
    } else if (requiereCotizacionManual) {
      elResumenEnvio.innerHTML = `<span class="valor-cotizar">A cotizar</span>`;
      envioEsNumero = false;
    } else {
      const elDistrito = document.getElementById("input-distrito");
      const distritoElegido = elDistrito.value;
      if (!distritoElegido) {
        elResumenEnvio.textContent = "Elige tu distrito";
        envioEsNumero = false;
      } else {
        const costoDistrito = Number(elDistrito.selectedOptions[0].dataset.costo) || 0;
        envio = costoDistrito + calcularRecargoVolumen();
      }
    }
    // El IGV aplica sobre productos Y delivery (si el delivery tiene costo numérico)
    const baseImponible = subtotal + (envioEsNumero ? envio : 0);
    const igv = conComprobante ? baseImponible * 0.18 : 0;
    const factorIgv = conComprobante ? 1.18 : 1;
    document.getElementById("linea-igv").style.display = conComprobante ? "flex" : "none";
    document.getElementById("resumen-igv").textContent = "S/ " + igv.toFixed(2);
    if (envioEsNumero && (tipoEntrega === "lima")) {
      elResumenEnvio.textContent = "S/ " + (envio * factorIgv).toFixed(2);
    }
    const total = baseImponible + igv;
    document.getElementById("resumen-total").textContent = "S/ " + total.toFixed(2) + (envioEsNumero ? "" : " + envío");
  }
  function marcarError(idCampo, tieneError) {
    const el = document.getElementById(idCampo);
    if (el) el.classList.toggle("con-error", tieneError);
  }
  // ---------- Guardar/restaurar el formulario (para no perder datos si el cliente va al carrito) ----------
  const CAMPOS_TEXTO_A_GUARDAR = [
    "input-nombre", "input-dni-comprador", "input-celular-comprador", "input-correo-comprador",
    "input-contacto1-nombre", "input-contacto1-telefono",
    "input-destinatario1-nombre", "input-destinatario1-dni", "input-destinatario1-celular",
    "input-destinatario2-nombre", "input-destinatario2-dni", "input-destinatario2-celular",
    "input-numero-documento",
    "input-distrito", "input-calle", "input-numero", "input-urbanizacion", "input-referencia",
    "input-agencia-otro",
    "input-notas"
  ];
  function guardarDatosFormulario() {
    const datos = {};
    CAMPOS_TEXTO_A_GUARDAR.forEach(id => {
      const el = document.getElementById(id);
      if (el) datos[id] = el.value;
    });
    const comprobante = document.querySelector('input[name="comprobante"]:checked');
    if (comprobante) datos.comprobante = comprobante.value;
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked');
    if (tipoEntrega) datos.tipoEntrega = tipoEntrega.value;
    const quienRecibe = document.querySelector('input[name="quienRecibe"]:checked');
    if (quienRecibe) datos.quienRecibe = quienRecibe.value;
    const esMismoDestinatario = document.getElementById("chk-destinatario-yo-mismo");
    if (esMismoDestinatario) datos.destinatarioYoMismo = esMismoDestinatario.checked;
    const destinatarioOtraPersona = document.getElementById("chk-destinatario-otra-persona");
    if (destinatarioOtraPersona) datos.destinatarioOtraPersona = destinatarioOtraPersona.checked;
    const tipoDocComprador = document.getElementById("input-dni-comprador-tipo");
    if (tipoDocComprador) datos.tipoDocComprador = tipoDocComprador.value;
    const tipoDocDest1 = document.getElementById("input-destinatario1-tipo");
    if (tipoDocDest1) datos.tipoDocDest1 = tipoDocDest1.value;
    const tipoDocDest2 = document.getElementById("input-destinatario2-tipo");
    if (tipoDocDest2) datos.tipoDocDest2 = tipoDocDest2.value;
    localStorage.setItem(FORM_DATOS_KEY, JSON.stringify(datos));
  }
  function restaurarDatosFormulario() {
    let datos;
    try {
      datos = JSON.parse(localStorage.getItem(FORM_DATOS_KEY));
    } catch (e) {
      return;
    }
    if (!datos) return;
    CAMPOS_TEXTO_A_GUARDAR.forEach(id => {
      const el = document.getElementById(id);
      if (el && datos[id] !== undefined) el.value = datos[id];
    });
    if (datos.comprobante) {
      const el = document.querySelector(`input[name="comprobante"][value="${datos.comprobante}"]`);
      if (el) { el.checked = true; onCambioComprobante(); }
    }
    if (datos.tipoDocComprador) {
      const el = document.getElementById("input-dni-comprador-tipo");
      if (el) { el.value = datos.tipoDocComprador; ajustarCampoDocumentoPersona("input-dni-comprador-tipo", "input-dni-comprador"); }
    }
    if (datos.tipoDocDest1) {
      const el = document.getElementById("input-destinatario1-tipo");
      if (el) { el.value = datos.tipoDocDest1; ajustarCampoDocumentoPersona("input-destinatario1-tipo", "input-destinatario1-dni"); }
    }
    if (datos.tipoDocDest2) {
      const el = document.getElementById("input-destinatario2-tipo");
      if (el) { el.value = datos.tipoDocDest2; ajustarCampoDocumentoPersona("input-destinatario2-tipo", "input-destinatario2-dni"); }
    }
    if (datos.quienRecibe) {
      const el = document.querySelector(`input[name="quienRecibe"][value="${datos.quienRecibe}"]`);
      if (el) { el.checked = true; onCambioQuienRecibe(); }
    }
    if (datos.destinatarioYoMismo !== undefined) {
      document.getElementById("chk-destinatario-yo-mismo").checked = datos.destinatarioYoMismo;
    }
    if (datos.destinatarioOtraPersona !== undefined) {
      document.getElementById("chk-destinatario-otra-persona").checked = datos.destinatarioOtraPersona;
    }
    onCambioDestinatarios();
    if (datos["input-destinatario2-nombre"] || datos["input-destinatario2-celular"] || datos["input-destinatario2-dni"]) {
      document.getElementById("bloque-destinatario2").style.display = "block";
      document.getElementById("btn-agregar-destinatario2").textContent = "− Quitar segunda persona";
    }
    if (datos.tipoEntrega) {
      const el = document.querySelector(`input[name="tipoEntrega"][value="${datos.tipoEntrega}"]`);
      if (el) { el.checked = true; onCambioTipoEntrega(); }
    }
    // El distrito de Lima es un <select> poblado dinámicamente — se
    // restaura aparte, después de que poblarDistritosLima() ya corrió.
    if (datos["input-distrito"]) {
      const elDistrito = document.getElementById("input-distrito");
      if (elDistrito) elDistrito.value = datos["input-distrito"];
    }
    actualizarResumen();
  }
  function activarGuardadoAutomatico() {
    document.getElementById("main-contenido").addEventListener("input", guardarDatosFormulario);
    document.getElementById("main-contenido").addEventListener("change", guardarDatosFormulario);
  }
  function limpiarDatosFormularioGuardados() {
    localStorage.removeItem(FORM_DATOS_KEY);
  }
  // ---------- ID de pedido (referencia para el cliente, no reemplaza el correlativo interno del Sheet) ----------
  function generarIdPedido() {
    const ahora = new Date();
    const aa = String(ahora.getFullYear()).slice(-2);
    const mm = String(ahora.getMonth() + 1).padStart(2, "0");
    const dd = String(ahora.getDate()).padStart(2, "0");
    const hh = String(ahora.getHours()).padStart(2, "0");
    const min = String(ahora.getMinutes()).padStart(2, "0");
    const azar = Math.floor(100 + Math.random() * 900);
    return `FIP-${aa}${mm}${dd}-${hh}${min}-${azar}`;
  }
  function validarFormulario() {
    let valido = true;
    const nombre = document.getElementById("input-nombre").value.trim();
    marcarError("campo-nombre", !nombre);
    if (!nombre) valido = false;
    const celularComprador = document.getElementById("input-celular-comprador").value.trim();
    const celularCompradorValido = esCelularValido(celularComprador);
    marcarError("campo-celular-comprador", !celularCompradorValido);
    if (!celularCompradorValido) valido = false;
    // El correo es opcional — solo se valida el formato si el cliente escribió algo
    const correoComprador = document.getElementById("input-correo-comprador").value.trim();
    if (correoComprador) {
      const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoComprador);
      marcarError("campo-correo-comprador", !correoValido);
      if (!correoValido) valido = false;
    } else {
      marcarError("campo-correo-comprador", false);
    }
    const conComprobante = document.querySelector('input[name="comprobante"]:checked').value === "con_comprobante";
    if (conComprobante) {
      const numeroDoc = document.getElementById("input-numero-documento").value.trim();
      const docValido = /^\d{8}$/.test(numeroDoc) || /^\d{11}$/.test(numeroDoc); // DNI (8) o RUC (11)
      marcarError("campo-numero-documento", !docValido);
      if (!docValido) valido = false;
    }
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked').value;
    if (tipoEntrega === "lima") {
      const distrito = document.getElementById("input-distrito").value;
      marcarError("campo-distrito", !distrito);
      if (!distrito) valido = false;
      const calle = document.getElementById("input-calle").value.trim();
      marcarError("campo-calle", !calle);
      if (!calle) valido = false;
      const numero = document.getElementById("input-numero").value.trim();
      marcarError("campo-numero", !numero);
      if (!numero) valido = false;
    }
    if (tipoEntrega === "provincia") {
      const dniComprador = document.getElementById("input-dni-comprador").value.trim();
      const tipoDocComprador = document.getElementById("input-dni-comprador-tipo").value;
      const dniCompradorValido = esDocumentoValido(dniComprador, tipoDocComprador);
      marcarError("campo-dni-comprador", !dniCompradorValido);
      if (!dniCompradorValido) valido = false;
      const departamento = document.getElementById("input-departamento").value;
      marcarError("campo-departamento", !departamento);
      if (!departamento) valido = false;
      const provincia = document.getElementById("input-provincia").value;
      marcarError("campo-provincia", !provincia);
      if (!provincia) valido = false;
      const distritoProv = document.getElementById("input-distrito-provincia").value;
      marcarError("campo-distrito-provincia", !distritoProv);
      if (!distritoProv) valido = false;
      const agencia = document.getElementById("input-agencia").value;
      marcarError("campo-agencia", !agencia);
      if (!agencia) valido = false;
      const destYoMismo = document.getElementById("chk-destinatario-yo-mismo").checked;
      const destOtraPersona = document.getElementById("chk-destinatario-otra-persona").checked;
      const hayAlMenosUno = destYoMismo || destOtraPersona;
      document.getElementById("error-destinatario-general").style.display = hayAlMenosUno ? "none" : "block";
      if (!hayAlMenosUno) valido = false;
      if (destOtraPersona) {
        const destNombre = document.getElementById("input-destinatario1-nombre").value.trim();
        marcarError("campo-destinatario1-nombre", !destNombre);
        if (!destNombre) valido = false;
        const destDni = document.getElementById("input-destinatario1-dni").value.trim();
        const tipoDocDest1 = document.getElementById("input-destinatario1-tipo").value;
        const dniValido = esDocumentoValido(destDni, tipoDocDest1);
        marcarError("campo-destinatario1-dni", !dniValido);
        if (!dniValido) valido = false;
        const destCelular = document.getElementById("input-destinatario1-celular").value.trim();
        const destCelularValido = esCelularValido(destCelular);
        marcarError("campo-destinatario1-celular", !destCelularValido);
        if (!destCelularValido) valido = false;
      }
      // Segunda persona (destinatario2): opcional como bloque completo,
      // pero si el cliente empezó a llenarla, debe completarla —
      // incluyendo el DNI/CE, porque la agencia lo exige para entregar el paquete.
      const dest2Nombre = document.getElementById("input-destinatario2-nombre").value.trim();
      const dest2Dni = document.getElementById("input-destinatario2-dni").value.trim();
      const dest2Celular = document.getElementById("input-destinatario2-celular").value.trim();
      const dest2Iniciado = dest2Nombre || dest2Dni || dest2Celular;
      if (dest2Iniciado) {
        marcarError("campo-destinatario2-nombre", !dest2Nombre);
        if (!dest2Nombre) valido = false;
        const tipoDocDest2 = document.getElementById("input-destinatario2-tipo").value;
        const dest2DniValido = esDocumentoValido(dest2Dni, tipoDocDest2);
        marcarError("campo-destinatario2-dni", !dest2DniValido);
        if (!dest2DniValido) valido = false;
        const dest2CelularValido = esCelularValido(dest2Celular);
        marcarError("campo-destinatario2-celular", !dest2CelularValido);
        if (!dest2CelularValido) valido = false;
      }
    } else {
      const esOtraPersona = document.querySelector('input[name="quienRecibe"]:checked').value === "otra_persona";
      if (esOtraPersona) {
        const contacto1Nombre = document.getElementById("input-contacto1-nombre").value.trim();
        marcarError("campo-contacto1-nombre", !contacto1Nombre);
        if (!contacto1Nombre) valido = false;
        const contacto1Telefono = document.getElementById("input-contacto1-telefono").value.trim();
        const contacto1TelefonoValido = esCelularValido(contacto1Telefono);
        marcarError("campo-contacto1-telefono", !contacto1TelefonoValido);
        if (!contacto1TelefonoValido) valido = false;
      }
    }
    return valido;
  }
  function registrarPedidoEnSheet(datosPedido) {
    const url = URL_REGISTRO_PEDIDO + "?datos=" + encodeURIComponent(JSON.stringify(datosPedido));
    // Se usa fetch en modo "no-cors": no necesitamos LEER la respuesta
    // (esto es un envío silencioso de respaldo, el mensaje de WhatsApp es
    // la confirmación real), así que no importa si Google la bloquea para
    // lectura — el registro en el Sheet igual se ejecuta del lado del
    // servidor. Esto evita los problemas raros de sesión/cuentas de
    // Google que sí afectaban la carga de un <script> tradicional.
    return fetch(url, { mode: "no-cors", keepalive: true })
      .then(() => {
        return { exito: true };
      })
      .catch((error) => {
        console.error("No se pudo conectar con el registro del Sheet:", error);
        return { error: "conexión fallida" };
      });
  }
  async function intentarEnviarPedido() {
    if (!validarFormulario()) {
      document.querySelector(".con-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // ---------- Abrir la ventana de WhatsApp YA, en blanco ----------
    // Safari/iOS y varios navegadores in-app (Instagram, Facebook, TikTok)
    // solo permiten window.open() si ocurre de forma síncrona dentro del
    // mismo clic del usuario. Como más abajo hacemos `await` (registro en
    // el Sheet), si abriéramos la ventana después de eso el navegador ya
    // no lo reconoce como "iniciado por el usuario" y la bloquea. Por eso
    // la abrimos en blanco ACÁ MISMO, y recién le asignamos la URL real
    // de WhatsApp más abajo, cuando el mensaje ya está armado.
    let ventanaWhatsApp = null;
    try {
      ventanaWhatsApp = window.open("", "_blank");
    } catch (e) {
      ventanaWhatsApp = null;
    }

    const carrito = obtenerCarrito();
    const nombre = document.getElementById("input-nombre").value.trim();
    const celularComprador = document.getElementById("input-celular-comprador").value.trim();
    const correoComprador = document.getElementById("input-correo-comprador").value.trim();
    const conComprobante = document.querySelector('input[name="comprobante"]:checked').value === "con_comprobante";
    const tipoEntrega = document.querySelector('input[name="tipoEntrega"]:checked').value;
    const esOtraPersona = document.querySelector('input[name="quienRecibe"]:checked').value === "otra_persona";
    const tipoDocComprador = tipoEntrega === "provincia" ? document.getElementById("input-dni-comprador-tipo").value : "";
    const dniComprador = tipoEntrega === "provincia" ? document.getElementById("input-dni-comprador").value.trim() : "";
    let contacto1Nombre, contacto1Telefono;
    let listaDestinatarios = [];
    if (tipoEntrega === "provincia") {
      const destYoMismo = document.getElementById("chk-destinatario-yo-mismo").checked;
      const destOtraPersona = document.getElementById("chk-destinatario-otra-persona").checked;
      if (destYoMismo) {
        listaDestinatarios.push({ nombre: nombre, tipoDoc: tipoDocComprador, dni: dniComprador, celular: celularComprador });
      }
      if (destOtraPersona) {
        listaDestinatarios.push({
          nombre: document.getElementById("input-destinatario1-nombre").value.trim(),
          tipoDoc: document.getElementById("input-destinatario1-tipo").value,
          dni: document.getElementById("input-destinatario1-dni").value.trim(),
          celular: document.getElementById("input-destinatario1-celular").value.trim()
        });
      }
      const destinatario2Nombre = document.getElementById("input-destinatario2-nombre").value.trim();
      const destinatario2Dni = document.getElementById("input-destinatario2-dni").value.trim();
      const destinatario2Celular = document.getElementById("input-destinatario2-celular").value.trim();
      if (destinatario2Nombre || destinatario2Celular || destinatario2Dni) {
        listaDestinatarios.push({
          nombre: destinatario2Nombre,
          tipoDoc: document.getElementById("input-destinatario2-tipo").value,
          dni: destinatario2Dni,
          celular: destinatario2Celular
        });
      }
    } else {
      contacto1Nombre = esOtraPersona ? document.getElementById("input-contacto1-nombre").value.trim() : nombre;
      contacto1Telefono = esOtraPersona ? document.getElementById("input-contacto1-telefono").value.trim() : celularComprador;
    }
    const notas = document.getElementById("input-notas").value.trim();
    const idPedido = generarIdPedido();
    // Notas que van al Sheet: solo lo que escribió el cliente. Los datos
    // de quien recibe/recoge ya van limpios en columnas F/G (y en
    // provincia también J/K) — no hace falta repetirlos acá.
    const notasParaSheet = notas;
    const subtotal = carrito.reduce((s, i) => s + extraerPrecioNumerico(i.precio) * i.cantidad, 0);
    const requiereCotizacionManual = buscarRecargoCotizarManual();
    let envio = 0;
    let envioEsNumero = false;
    let envioTexto = "Sin costo (recojo en almacén)";
    if (tipoEntrega === "lima") {
      if (requiereCotizacionManual) {
        envioTexto = "A cotizar (pedido incluye artículo grande/pesado)";
      } else {
        const elDistrito = document.getElementById("input-distrito");
        const costoDistrito = Number(elDistrito.selectedOptions[0]?.dataset.costo) || 0;
        envio = costoDistrito + calcularRecargoVolumen();
        envioEsNumero = true;
      }
    } else if (tipoEntrega === "provincia") {
      const agenciaElegida = document.getElementById("input-agencia")?.value || "";
      envioTexto = (agenciaElegida === "Olva Courier")
        ? "Pago adelantado — te cotizamos el costo antes del envío"
        : "Se coordina y paga en la agencia";
    } else if (tipoEntrega === "recojo") {
      envioEsNumero = true; // envío = 0, pero sí entra en la base (no cambia nada)
    }
    // El IGV aplica sobre productos Y delivery (si el delivery tiene costo numérico)
    const baseImponible = subtotal + (envioEsNumero ? envio : 0);
    const igv = conComprobante ? baseImponible * 0.18 : 0;
    const factorIgv = conComprobante ? 1.18 : 1;
    const costoDeliveryConIgv = Number((envio * factorIgv).toFixed(2));
    if (tipoEntrega === "lima" && envioEsNumero) {
      envioTexto = "S/ " + costoDeliveryConIgv.toFixed(2);
    }
    const total = baseImponible + igv;
    let mensaje = `¡Hola, Fenix Import Perú!\nMe gustaría realizar el siguiente pedido:\nN° de pedido: ${idPedido}\n\n`;
    carrito.forEach(item => {
      const precioUnit = extraerPrecioNumerico(item.precio) * factorIgv;
      // Resuelve el slug desde el catálogo cargado (más confiable que el carrito
      // guardado en localStorage, que puede ser de antes de este cambio y no
      // tener el campo slug todavía). Si no se encuentra, cae al sku del item.
      const productoCat = productosCatalogo.find(pr => pr.sku === item.sku);
      const slugItem = (productoCat && productoCat.slug) || item.slug || item.sku;
      const link = URL_SITIO + "/producto/" + encodeURIComponent(slugItem) + ".html";
      mensaje += `${item.nombre}\nPrecio: S/ ${precioUnit.toFixed(2)} c/u — Cantidad: ${item.cantidad}\nSKU: ${item.sku}\n${link}\n\n`;
    });
    mensaje += `Subtotal: S/ ${subtotal.toFixed(2)}\n`;
    if (conComprobante) mensaje += `IGV (18%): S/ ${igv.toFixed(2)}\n`;
    mensaje += `Envío: ${envioTexto}\n`;
    mensaje += `Total: S/ ${total.toFixed(2)}${tipoEntrega === "provincia" || requiereCotizacionManual ? " + envío" : ""}\n\n`;
    mensaje += `Datos del cliente:\n`;
    mensaje += `Nombre: ${nombre}\n`;
    mensaje += `Celular: ${celularComprador}\n`;
    if (tipoEntrega === "provincia") mensaje += `${tipoDocComprador}: ${dniComprador}\n`;
    mensaje += `Comprobante: ${conComprobante ? "Con comprobante (Boleta/Factura)" : "Precio libre, sin comprobante"}\n`;
    let numeroDocumento = "";
    if (conComprobante) {
      numeroDocumento = document.getElementById("input-numero-documento").value.trim();
      mensaje += `Documento: ${numeroDocumento}\n`;
    }
    let direccionCompleta = "";
    let ubicacionGpsTexto = "";
    let distritoLima = "";
    let departamentoProvinciaTexto = "";
    let provinciaProvinciaTexto = "";
    let distritoProvinciaTexto = "";
    let agenciaTexto = "";
    if (tipoEntrega === "recojo") {
      mensaje += `Entrega: Recojo en almacén (${DIRECCION_ALMACEN})\n`;
      direccionCompleta = DIRECCION_ALMACEN;
    } else if (tipoEntrega === "lima") {
      distritoLima = document.getElementById("input-distrito").value;
      direccionCompleta = armarDireccionCompleta();
      const referencia = document.getElementById("input-referencia").value.trim();
      mensaje += `Entrega: Delivery en Lima\n`;
      mensaje += `Dirección: ${direccionCompleta}\n`;
      if (referencia) mensaje += `Referencia: ${referencia}\n`;
      if (marcadorMapa) {
        const pos = marcadorMapa.getLatLng();
        ubicacionGpsTexto = `https://maps.google.com/?q=${pos.lat},${pos.lng}`;
        mensaje += `Ubicación GPS: ${ubicacionGpsTexto}\n`;
      }
    } else if (tipoEntrega === "provincia") {
      const elDepartamento = document.getElementById("input-departamento");
      const elProvincia = document.getElementById("input-provincia");
      const elDistritoProv = document.getElementById("input-distrito-provincia");
      const agencia = document.getElementById("input-agencia").value;
      const agenciaOtro = document.getElementById("input-agencia-otro").value.trim();
      departamentoProvinciaTexto = elDepartamento.selectedOptions[0]?.textContent || "";
      provinciaProvinciaTexto = elProvincia.selectedOptions[0]?.textContent || "";
      distritoProvinciaTexto = elDistritoProv.selectedOptions[0]?.textContent || "";
      agenciaTexto = agencia === "otro" ? agenciaOtro : agencia;
      mensaje += `Entrega: Envío a provincia\n`;
      mensaje += `Departamento: ${departamentoProvinciaTexto}\n`;
      mensaje += `Provincia: ${provinciaProvinciaTexto}\n`;
      mensaje += `Distrito: ${distritoProvinciaTexto}\n`;
      mensaje += `Agencia: ${agenciaTexto}\n`;
    }
    if (tipoEntrega === "provincia") {
      mensaje += `\nPersonas autorizadas a recoger:\n`;
      listaDestinatarios.forEach(d => {
        mensaje += `- ${d.nombre}${d.dni ? " - " + d.tipoDoc + " " + d.dni : ""} - CEL ${d.celular}\n`;
      });
    } else {
      mensaje += esOtraPersona
        ? `\nQuien recibe: ${contacto1Nombre} - ${contacto1Telefono}\n`
        : `\nQuien recibe: el propio comprador\n`;
    }
    if (notas) mensaje += `\nNotas: ${notas}\n`;
    mensaje += `\n¿Me confirman disponibilidad y coordinamos la entrega?`;

    // ---------- Nombre/celular para el Sheet: si quien recibe NO es el
    // comprador, se combinan ambos en el mismo campo ("Cliente: X, Recibe: Y")
    // en vez de agregar columnas nuevas al Sheet. ----------
    let nombreParaSheet = nombre;
    let celularParaSheet = celularComprador;

    if (tipoEntrega === "provincia") {
      const esSoloElCompradorSheet = listaDestinatarios.length === 1 && listaDestinatarios[0].nombre === nombre;
      if (!esSoloElCompradorSheet && listaDestinatarios.length > 0) {
        // Si el comprador también está entre los autorizados, no se repite en la lista.
        const otros = listaDestinatarios.filter(d => !(d.nombre === nombre && d.celular === celularComprador));
        const paraListar = otros.length > 0 ? otros : listaDestinatarios;

        const partesNombre = [`Cliente: ${nombre}`];
        const partesCelular = [`Cliente: ${celularComprador}`];
        paraListar.forEach((d, i) => {
          partesNombre.push(`Destinatario ${i + 1}: ${d.nombre}`);
          partesCelular.push(`Celular ${i + 1}: ${d.celular}`);
        });
        nombreParaSheet = partesNombre.join(", ");
        celularParaSheet = partesCelular.join(", ");
      }
    } else if (esOtraPersona) {
      const etiquetaRecibe = tipoEntrega === "recojo" ? "Recoge" : "Recibe";
      nombreParaSheet = `Cliente: ${nombre}, ${etiquetaRecibe}: ${contacto1Nombre}`;
      celularParaSheet = `Cliente: ${celularComprador}, ${etiquetaRecibe}: ${contacto1Telefono}`;
    }

    // ---------- Documento PERSONAL (columnas J/K) — DNI o CE de quien recoge
    // el pedido en la agencia. Distinto del documento de FACTURACIÓN (columnas
    // H/I, ya armado más abajo en tipoDocumento/documento) — un mismo pedido a
    // provincia puede necesitar ambos a la vez, así que van en columnas separadas.
    // Solo aplica a provincia: es el único flujo que hoy pide DNI/CE personal. ----------
    let tipoDocPersonalParaSheet = tipoDocComprador; // "" si no es provincia
    let documentoPersonalParaSheet = dniComprador;

    if (tipoEntrega === "provincia") {
      const esSoloElCompradorDoc = listaDestinatarios.length === 1 && listaDestinatarios[0].nombre === nombre;
      if (!esSoloElCompradorDoc && listaDestinatarios.length > 0) {
        const otrosDoc = listaDestinatarios.filter(d => !(d.nombre === nombre && d.celular === celularComprador));
        const paraListarDoc = otrosDoc.length > 0 ? otrosDoc : listaDestinatarios;
        const partesDoc = [`Cliente ${tipoDocComprador}: ${dniComprador}`];
        paraListarDoc.forEach((d, i) => {
          partesDoc.push(`${d.tipoDoc || "DNI"} ${i + 1}: ${d.dni}`);
        });
        documentoPersonalParaSheet = partesDoc.join(", ");
      }
    }

    // ---------- Etiqueta legible del tipo de entrega, para la columna BO
    // ("RECOJO" / "DELIVERY" / "ENVIO PROVINCIA" en vez del código interno
    // "recojo" / "lima" / "provincia"). ----------
    const ETIQUETAS_TIPO_ENTREGA = { recojo: "RECOJO", lima: "DELIVERY", provincia: "ENVIO PROVINCIA" };
    const tipoEntregaTexto = ETIQUETAS_TIPO_ENTREGA[tipoEntrega] || tipoEntrega.toUpperCase();

    // ---------- Registrar el pedido en el Sheet (ALMACEN / DOMICILIO / ENVIO) ----------
    const hoy = new Date();
    const fechaTexto = String(hoy.getDate()).padStart(2, "0") + "/" + String(hoy.getMonth() + 1).padStart(2, "0") + "/" + hoy.getFullYear()
      + " " + String(hoy.getHours()).padStart(2, "0") + ":" + String(hoy.getMinutes()).padStart(2, "0");
    const datosPedido = {
      idPedido: idPedido,
      tipoEntrega: tipoEntrega,
      tipoEntregaTexto: tipoEntregaTexto,   // columna BO — "RECOJO" / "DELIVERY" / "ENVIO PROVINCIA"
      fecha: fechaTexto,
      nombre: nombreParaSheet,
      celular: celularParaSheet,
      documento: numeroDocumento,          // columna I — número de documento de FACTURACIÓN (ya no se pide el tipo)
      tipoDocumentoPersonal: tipoDocPersonalParaSheet,   // columna J — tipo de documento PERSONAL (envío)
      documentoPersonal: documentoPersonalParaSheet,     // columna K — número(s) de documento PERSONAL (envío)
      direccion: direccionCompleta,
      ubicacionGps: ubicacionGpsTexto,
      distrito: tipoEntrega === "lima" ? distritoLima : distritoProvinciaTexto,
      departamento: departamentoProvinciaTexto,
      provincia: provinciaProvinciaTexto,
      agencia: agenciaTexto,
      costoDelivery: tipoEntrega === "lima" ? costoDeliveryConIgv : 0,
      montoTotal: Number(total.toFixed(2)),
      notas: notasParaSheet,
      correo: correoComprador,       // opcional — si viene, el Sheet le manda copia por correo
      mensajeResumen: mensaje,       // mismo texto del WhatsApp, reutilizado como cuerpo del correo
      items: carrito.map(item => ({
        codigo: item.sku,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: Number((extraerPrecioNumerico(item.precio) * factorIgv).toFixed(2))
      }))
    };
    const elBotonEnviar = document.getElementById("btn-enviar-checkout");
    elBotonEnviar.disabled = true;
    elBotonEnviar.style.opacity = "0.7";
    const textoOriginalBoton = elBotonEnviar.innerHTML;
    elBotonEnviar.innerHTML = "Enviando pedido...";

    const resultadoSheet = await registrarPedidoEnSheet(datosPedido);
    const sheetGuardado = !!(resultadoSheet && resultadoSheet.exito);

    const urlWhatsApp = "https://wa.me/" + NUMERO_WHATSAPP + "?text=" + encodeURIComponent(mensaje);

    // Usamos la ventana que abrimos en blanco al inicio del clic. Si por lo
    // que sea no se pudo abrir entonces (bloqueador de pop-ups agresivo,
    // navegador in-app, etc.), intentamos una segunda vez acá — a veces
    // funciona igual porque seguimos dentro del mismo gesto async del botón.
    let whatsAppAbierto = false;
    if (ventanaWhatsApp && !ventanaWhatsApp.closed) {
      try {
        ventanaWhatsApp.location.href = urlWhatsApp;
        whatsAppAbierto = true;
      } catch (e) {
        whatsAppAbierto = false;
      }
    }
    if (!whatsAppAbierto) {
      try {
        const intento2 = window.open(urlWhatsApp, "_blank");
        whatsAppAbierto = !!intento2;
      } catch (e) {
        whatsAppAbierto = false;
      }
    }

    guardarCarrito([]);
    actualizarBadgeCarrito();
    limpiarDatosFormularioGuardados();

    mostrarPantallaConcluido({
      idPedido,
      mensaje,
      urlWhatsApp,
      whatsAppAbierto,
      sheetGuardado,
      carrito,
      subtotal,
      igv,
      total,
      conComprobante,
      envioTexto,
      tipoEntrega,
      nombre,
      celularComprador,
      correoComprador
    });
  }

  // ---------- Pantalla final: resumen completo + reenvío + respaldos ----------
  // El objetivo es que el cliente SIEMPRE se quede con la información de su
  // pedido en pantalla — no solo el N° de pedido — sin importar si el popup
  // de WhatsApp se abrió bien, se bloqueó, o si el navegador es raro. Desde
  // acá puede: reintentar abrir WhatsApp, copiar el mensaje al portapapeles,
  // mandárselo a su correo, o simplemente hacer captura de pantalla.
  function mostrarPantallaConcluido(datos) {
    const {
      idPedido, mensaje, urlWhatsApp, whatsAppAbierto, sheetGuardado,
      carrito, subtotal, igv, total, conComprobante, envioTexto,
      tipoEntrega, nombre, celularComprador, correoComprador
    } = datos;

    const etiquetaEntrega = tipoEntrega === "recojo" ? "Recojo en almacén"
      : tipoEntrega === "lima" ? "Delivery en Lima"
      : "Envío a provincia";

    const itemsHtml = carrito.map(item => {
      const precioUnit = extraerPrecioNumerico(item.precio) * (conComprobante ? 1.18 : 1);
      const imagenHtml = item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}">` : "";
      return `
        <div class="resumen-item">
          <div class="resumen-item-img">${imagenHtml}</div>
          <div class="resumen-item-info">
            <p class="resumen-item-nombre">${item.nombre}</p>
            <p class="resumen-item-meta">${item.cantidad} × S/ ${precioUnit.toFixed(2)}</p>
          </div>
          <p class="resumen-item-subtotal">S/ ${(precioUnit * item.cantidad).toFixed(2)}</p>
        </div>`;
    }).join("");

    // Aviso de WhatsApp: cambia según si se pudo abrir automáticamente o no.
    const avisoWhatsAppHtml = whatsAppAbierto
      ? `<div class="aviso-confirmacion exito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          <span>Se abrió WhatsApp en otra pestaña con tu pedido listo para enviar. Si no la ves, usa el botón de abajo.</span>
        </div>`
      : `<div class="aviso-confirmacion alerta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Tu navegador bloqueó la ventana de WhatsApp. No te preocupes — tu pedido igual quedó guardado. Toca el botón verde para abrirlo manualmente.</span>
        </div>`;

    const avisoSheetHtml = sheetGuardado
      ? `<p class="nota-confirmacion">✓ Pedido registrado en nuestro sistema${correoComprador ? " · copia enviada a " + correoComprador : ""}</p>`
      : `<p class="nota-confirmacion alerta">⚠ No pudimos confirmar el registro automático — de igual forma, envía el mensaje por WhatsApp y quedará registrado por ahí.</p>`;

    // Si el cliente ya dejó su correo, el aviso de "copia enviada" de arriba
    // ya cubre eso — el botón manual queda como respaldo extra por si ese
    // correo automático no llega (carpeta de spam, etc.) o quiere mandarlo
    // a otra dirección distinta.
    const textoBotonCorreo = correoComprador ? "Reenviar copia por correo" : "Enviarme copia";

    document.getElementById("main-contenido").innerHTML = `
      <div class="tarjeta-confirmacion" id="tarjeta-confirmacion">
        <div class="confirmacion-cabecera">
          <div class="icono-exito-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <p class="confirmacion-titulo">¡Pedido enviado!</p>
          <p class="confirmacion-subtitulo">N° de pedido: <strong>${idPedido}</strong></p>
        </div>

        ${avisoWhatsAppHtml}

        <div class="resumen" style="margin-top:16px;">
          <p class="resumen-titulo">Resumen de tu pedido</p>
          <p class="confirmacion-meta">${etiquetaEntrega} · ${nombre} · ${celularComprador}</p>
          <div id="confirmacion-items">${itemsHtml}</div>
          <div class="resumen-linea"><span>Subtotal</span><span>S/ ${subtotal.toFixed(2)}</span></div>
          ${conComprobante ? `<div class="resumen-linea"><span>IGV (18%)</span><span>S/ ${igv.toFixed(2)}</span></div>` : ""}
          <div class="resumen-linea destacada"><span>Envío</span><span>${envioTexto}</span></div>
          <div class="resumen-total"><span>Total</span><span>S/ ${total.toFixed(2)}</span></div>
        </div>

        <button class="btn-enviar-checkout" id="btn-reenviar-whatsapp" style="margin-top:14px;">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.13-4.9-4.32-.14-.19-1.17-1.56-1.17-2.98s.74-2.11 1-2.4c.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.3.37-.43.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.31 2.35 1.45.29.15.46.13.63-.07.17-.2.72-.83.91-1.11.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
          Abrir / reenviar por WhatsApp
        </button>

        <div class="fila-botones-respaldo">
          <button class="btn-respaldo-checkout" id="btn-copiar-resumen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copiar resumen
          </button>
          <button class="btn-respaldo-checkout" id="btn-correo-resumen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
            ${textoBotonCorreo}
          </button>
        </div>

        <div class="aviso-confirmacion alerta" id="aviso-correo-fallback" style="display:none; margin-top:10px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>No detectamos ninguna app de correo configurada en este dispositivo. Usa "Copiar resumen" y pégalo donde prefieras (correo, notas, etc.).</span>
        </div>

        ${avisoSheetHtml}

        <p class="nota-confirmacion">💡 También puedes tomar una captura de pantalla de este resumen como respaldo.</p>

        <a href="catalogo.html" class="link-seguir-catalogo">Seguir viendo el catálogo →</a>
      </div>
    `;

    document.getElementById("btn-reenviar-whatsapp").addEventListener("click", () => {
      // Este clic es 100% fresco (gesto directo del usuario), así que
      // window.open acá casi nunca se bloquea, incluso si el primer
      // intento automático sí falló.
      window.open(urlWhatsApp, "_blank");
    });

    document.getElementById("btn-copiar-resumen").addEventListener("click", (e) => {
      copiarTextoAlPortapapeles(mensaje, e.currentTarget);
    });

    document.getElementById("btn-correo-resumen").addEventListener("click", () => {
      abrirCorreoConResumen(idPedido, mensaje, correoComprador);
    });
  }

  // Copia el mensaje completo del pedido al portapapeles — útil como
  // respaldo si el cliente prefiere pegarlo manualmente en WhatsApp,
  // guardarlo en notas, o mandarlo por otro medio.
  function copiarTextoAlPortapapeles(texto, botonOrigen) {
    const marcarExito = () => {
      if (!botonOrigen) return;
      const original = botonOrigen.textContent;
      botonOrigen.textContent = "✓ Copiado";
      setTimeout(() => { botonOrigen.textContent = original; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(marcarExito).catch(() => {
        copiarConTextareaTemporal(texto, marcarExito);
      });
    } else {
      copiarConTextareaTemporal(texto, marcarExito);
    }
  }
  // Respaldo para navegadores viejos o contextos donde el Clipboard API
  // moderno no está disponible (algunos navegadores in-app).
  function copiarConTextareaTemporal(texto, alExito) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      if (alExito) alExito();
    } catch (e) {
      alert("No se pudo copiar automáticamente. Mantén presionado el resumen para seleccionar y copiar el texto manualmente.");
    }
  }

  // Abre el cliente de correo del cliente con el resumen ya redactado —
  // así puede mandárselo a sí mismo (o a quien quiera) como respaldo,
  // sin depender de que WhatsApp haya abierto bien.
  function abrirCorreoConResumen(idPedido, mensaje, correoDestino) {
    const asunto = `Mi pedido Fenix Import Perú — ${idPedido}`;
    const cuerpo = mensaje + "\n\n(Copia de tu pedido — guárdala como respaldo)";
    const destino = correoDestino ? encodeURIComponent(correoDestino) : "";
    const mailto = `mailto:${destino}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

    // No hay forma 100% confiable de saber si el sistema operativo abrió
    // una app de correo o no (los navegadores no lo informan). Como
    // heurística: si el usuario NO cambió de pestaña/app en ~1.2s, lo más
    // probable es que no había ninguna app de correo configurada por
    // defecto — en ese caso avisamos y sugerimos usar "Copiar resumen"
    // en su lugar, en vez de dejar al cliente sin ninguna señal.
    const yaEstabaOculto = document.visibilityState === "hidden";
    window.location.href = mailto;
    if (!yaEstabaOculto) {
      setTimeout(() => {
        if (document.visibilityState === "visible") {
          mostrarAvisoCorreoNoDisponible();
        }
      }, 1200);
    }
  }

  function mostrarAvisoCorreoNoDisponible() {
    const contenedor = document.getElementById("aviso-correo-fallback");
    if (contenedor) {
      contenedor.style.display = "block";
      contenedor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  // ---------- Carga inicial ----------
  async function iniciar() {
    actualizarBadgeCarrito();
    const carrito = obtenerCarrito();
    if (carrito.length === 0) {
      mostrarVacio();
      return;
    }
    try {
      const [respuestaProductos, respuestaDistritos] = await Promise.all([
        fetch("productos.json"),
        fetch("distritos.json")
      ]);
      const datosProductos = await respuestaProductos.json();
      const datosDistritos = await respuestaDistritos.json();
      productosCatalogo = datosProductos.productos || [];
      distritosLima = datosDistritos.distritos || [];
    } catch (error) {
      console.error(error);
    }
    renderizarFormulario();
  }
  iniciar();