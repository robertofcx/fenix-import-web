/* ============================================================
   reclamos.js — lógica del formulario de Libro de Reclamaciones.
   Al enviar, arma un correo (mailto:) dirigido a
   ventas.fenixip@gmail.com con todos los datos, ya que mailto
   no permite adjuntar archivos por sí solo — si el cliente
   necesita adjuntar comprobantes, se le pide responder al correo
   de confirmación (ver aviso en la propia página).

   NOTA PARA UNA MEJORA FUTURA: si se quiere que estos reclamos
   queden registrados de forma persistente (como ya se hace con
   los pedidos, vía Apps Script + Google Sheet), este es el lugar
   para agregar ese fetch — mismo patrón que
   registrarPedidoEnSheet() en checkout.js.
   ============================================================ */

const EMAIL_RECLAMOS = "ventas.fenixip@gmail.com";

function marcarErrorReclamo(idCampo, tieneError) {
  const el = document.getElementById(idCampo);
  if (el) el.classList.toggle("con-error", tieneError);
}

function esCelularValidoReclamo(valor) {
  const limpio = (valor || "").trim();
  return /^9\d{8}$/.test(limpio) || /^\+\d{8,15}$/.test(limpio);
}

function validarFormularioReclamo() {
  let valido = true;

  const nombres = document.getElementById("rl-nombres").value.trim();
  marcarErrorReclamo("campo-nombres", !nombres);
  if (!nombres) valido = false;

  const correo = document.getElementById("rl-correo").value.trim();
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  marcarErrorReclamo("campo-correo", !correoValido);
  if (!correoValido) valido = false;

  const numDoc = document.getElementById("rl-num-doc").value.trim();
  marcarErrorReclamo("campo-num-doc", !numDoc);
  if (!numDoc) valido = false;

  const telefono = document.getElementById("rl-telefono").value.trim();
  const telefonoValido = esCelularValidoReclamo(telefono);
  marcarErrorReclamo("campo-telefono", !telefonoValido);
  if (!telefonoValido) valido = false;

  const direccion = document.getElementById("rl-direccion").value.trim();
  marcarErrorReclamo("campo-direccion", !direccion);
  if (!direccion) valido = false;

  const detalle = document.getElementById("rl-detalle").value.trim();
  const elDetalle = document.getElementById("rl-detalle");
  const detalleCampo = elDetalle.closest(".campo");
  if (detalleCampo) detalleCampo.classList.toggle("con-error", !detalle);
  if (!detalle) valido = false;

  return valido;
}

function enviarReclamo() {
  if (!validarFormularioReclamo()) {
    document.querySelector(".con-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const datos = {
    nombres: document.getElementById("rl-nombres").value.trim(),
    correo: document.getElementById("rl-correo").value.trim(),
    tipoDoc: document.getElementById("rl-tipo-doc").value,
    numDoc: document.getElementById("rl-num-doc").value.trim(),
    telefono: document.getElementById("rl-telefono").value.trim(),
    menorEdad: document.getElementById("rl-menor").value,
    direccion: document.getElementById("rl-direccion").value.trim(),
    departamento: document.getElementById("rl-departamento").value.trim(),
    provincia: document.getElementById("rl-provincia").value.trim(),
    distrito: document.getElementById("rl-distrito").value.trim(),
    concepto: document.getElementById("rl-concepto").value,
    tipoReclamo: document.getElementById("rl-tipo-reclamo").value,
    fechaAdquisicion: document.getElementById("rl-fecha-adquisicion").value,
    monto: document.getElementById("rl-monto").value.trim(),
    detalle: document.getElementById("rl-detalle").value.trim(),
  };

  const hoy = new Date();
  const fechaReclamo = String(hoy.getDate()).padStart(2, "0") + "/" +
    String(hoy.getMonth() + 1).padStart(2, "0") + "/" + hoy.getFullYear();

  const asunto = `${datos.tipoReclamo} — Libro de Reclamaciones — ${datos.nombres}`;

  let cuerpo = `LIBRO DE RECLAMACIONES — FENIX IMPORT PERU EIRL\n`;
  cuerpo += `Fecha de reclamo: ${fechaReclamo}\n\n`;
  cuerpo += `DATOS DEL RECLAMANTE\n`;
  cuerpo += `Nombres y apellidos: ${datos.nombres}\n`;
  cuerpo += `Correo: ${datos.correo}\n`;
  cuerpo += `Documento: ${datos.tipoDoc} ${datos.numDoc}\n`;
  cuerpo += `Celular: ${datos.telefono}\n`;
  cuerpo += `¿Menor de edad?: ${datos.menorEdad}\n`;
  cuerpo += `Dirección: ${datos.direccion}\n`;
  if (datos.departamento || datos.provincia || datos.distrito) {
    cuerpo += `Ubicación: ${[datos.departamento, datos.provincia, datos.distrito].filter(Boolean).join(" / ")}\n`;
  }
  cuerpo += `\nDETALLE DEL RECLAMO\n`;
  cuerpo += `Concepto adquirido: ${datos.concepto}\n`;
  cuerpo += `Tipo: ${datos.tipoReclamo}\n`;
  if (datos.fechaAdquisicion) cuerpo += `Fecha de adquisición: ${datos.fechaAdquisicion}\n`;
  if (datos.monto) cuerpo += `Monto del reclamo: ${datos.monto}\n`;
  cuerpo += `\nDetalle:\n${datos.detalle}\n`;

  const mailtoUrl = "mailto:" + EMAIL_RECLAMOS +
    "?subject=" + encodeURIComponent(asunto) +
    "&body=" + encodeURIComponent(cuerpo);

  window.location.href = mailtoUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-enviar-reclamo");
  if (btn) btn.addEventListener("click", enviarReclamo);

  document.querySelectorAll(".campo-celular").forEach(el => {
    el.addEventListener("input", (e) => {
      const tienePlus = e.target.value.trim().startsWith("+");
      let limpio = e.target.value.replace(/[^\d]/g, "");
      e.target.value = tienePlus ? "+" + limpio : limpio;
    });
  });
  document.querySelectorAll(".campo-solo-numeros").forEach(el => {
    el.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/[^\d]/g, ""); });
  });
});
