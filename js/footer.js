/**
 * ========================================================================
 * FOOTER ÚNICO — FENIX IMPORT PERÚ
 * ========================================================================
 * Inyecta el footer en cualquier página que tenga:
 *   <div id="footer-placeholder" data-variant="completo"></div>
 *   <script src="/js/footer.js"></script>
 *
 * data-variant acepta "completo" (logo, redes, columnas de enlaces,
 * contacto — usar en index.html y catalogo.html) o "reducido" (una
 * sola línea — usar en checkout.html y producto/*.html).
 * Si se omite data-variant, se usa "completo" por defecto.
 *
 * Igual que header.js: NO usar "defer" en el <script>, y colocarlo
 * justo después del placeholder, para que #anio quede disponible
 * antes de que cualquier otro script intente tocarlo.
 * ========================================================================
 */
(function () {
  const ANIO_ACTUAL = new Date().getFullYear();

  const FOOTER_COMPLETO = `
<footer>
  <div class="footer-grilla">
    <div class="footer-col">
      <span class="logo-chip"><img src="/logo.webp" alt="Fenix Import Perú"></span>
      <p><strong style="color:var(--texto)">FENIX IMPORT PERU EIRL</strong></p>
      <p>RUC 20603834781</p>
      <div class="footer-redes">
        <a href="https://www.instagram.com/feniximportperu/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
        </a>
        <a href="https://www.facebook.com/FenixImportPeru" target="_blank" rel="noopener" aria-label="Facebook">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.87.24-1.46 1.5-1.46H16.6V4.36C16.3 4.32 15.3 4.24 14.15 4.24c-2.4 0-4.05 1.47-4.05 4.16V10.5H7.6v3h2.5V21h3.4z"/></svg>
        </a>
        <a href="https://www.tiktok.com/@feniximportperu" target="_blank" rel="noopener" aria-label="TikTok">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82a4.28 4.28 0 0 1-3.77-4.14h-3.1v14.2a2.6 2.6 0 1 1-1.84-2.48V10.3a5.65 5.65 0 1 0 4.94 5.6V9.4a7.3 7.3 0 0 0 3.77 1.05z"/></svg>
        </a>
        <a href="https://www.youtube.com/@feniximportperu" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.6a2.7 2.7 0 0 0-1.9-1.9C18 5.2 12 5.2 12 5.2s-6 0-7.7.5A2.7 2.7 0 0 0 2.4 7.6 28 28 0 0 0 2 12a28 28 0 0 0 .4 4.4 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.4zM10 15V9l5.2 3z"/></svg>
        </a>
      </div>
    </div>

    <div class="footer-col">
      <h4>Acerca de</h4>
      <ul>
        <li><a href="#">Nosotros</a></li>
        <li><a href="#">Preguntas frecuentes</a></li>
        <li><a href="#">Métodos de pago</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Enlaces importantes</h4>
      <ul>
        <li><a href="#">Términos y condiciones</a></li>
        <li><a href="#">Políticas de privacidad</a></li>
        <li><a href="#">Libro de reclamaciones</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Contacto</h4>
      <p>+51 978 821 080</p>
      <p>ventas.fenixip@gmail.com</p>
      <p>Lunes a Viernes, 9:00 AM – 5:00 PM</p>
      <p>Jirón Cajabamba 313, Independencia</p>
    </div>
  </div>

  <div class="footer-abajo">
    © <span id="anio">${ANIO_ACTUAL}</span> Fenix Import Perú. Todos los derechos reservados.
  </div>
</footer>`;

  const FOOTER_REDUCIDO = `
<footer class="footer-reducido">
  <div class="footer-abajo">© <span id="anio">${ANIO_ACTUAL}</span> Fenix Import Perú. Todos los derechos reservados.</div>
</footer>`;

  function inyectarFooter() {
    const contenedor = document.getElementById("footer-placeholder");
    if (!contenedor) {
      console.error('[footer.js] Falta <div id="footer-placeholder"></div> en esta página.');
      return;
    }
    const variante = contenedor.dataset.variant === "reducido" ? "reducido" : "completo";
    contenedor.outerHTML = variante === "reducido" ? FOOTER_REDUCIDO : FOOTER_COMPLETO;
  }

  inyectarFooter();
})();
