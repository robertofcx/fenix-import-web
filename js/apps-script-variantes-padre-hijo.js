/**
 * ========================================================================
 * VARIANTES DE PRODUCTO (PADRE / HIJO / SOLTERO)
 * ========================================================================
 * Agregar "situacion: 'SITUACION'" a COLUMNAS_POR_NOMBRE (junto a color,
 * stock, estado), y reemplazar construirCatalogoCompleto() completa por
 * la versión de abajo. El resto del script (construirMapaImagenes,
 * construirDistritos, construirUbigeo, subirArchivoAGitHub, etc.) no
 * cambia.
 * ========================================================================
 */

// En COLUMNAS_POR_NOMBRE, agregar la línea "situacion":
//
// const COLUMNAS_POR_NOMBRE = {
//   color: "COLOR",
//   stock: "STOCK",
//   estado: "ESTADO",
//   situacion: "SITUACION"   // <-- agregar esta línea
// };

/**
 * A partir del SKU de una fila HIJO, obtiene el SKU de su fila PADRE
 * quitando el último segmento (el sufijo de color).
 * Ej: "CAM_088_AMA" -> "CAM_088"
 */
function obtenerGrupoIdDesdeSku(sku) {
  const texto = String(sku || "").trim();
  const idx = texto.lastIndexOf("_");
  if (idx === -1) return texto;
  return texto.substring(0, idx);
}

/**
 * Arma el objeto completo, agrupando variantes de color (PADRE + HIJO)
 * en una sola entrada por grupo, y dejando los SOLTERO tal cual.
 */
function construirCatalogoCompleto(datos, indices, mapaImagenes) {
  const conteoCategorias = {};
  const conteoSubcategorias = {};

  const padresPorSku = {};       // sku del padre -> datos de esa fila
  const hijosPorGrupo = {};      // grupoId -> [ variantes publicadas ]
  const productosSueltos = [];   // productos SOLTERO, tal cual antes

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    if (!fila[indices.sku]) continue;

    const situacion = String(fila[indices.situacion] || "SOLTERO").trim().toUpperCase();
    const skuActual = String(fila[indices.sku]).trim();

    if (situacion === "PADRE") {
      // El padre no se publica como producto propio: solo aporta el
      // contenido compartido (nombre base, descripción, características).
      padresPorSku[skuActual] = {
        nombre: fila[indices.nombre] || "",
        categoria: fila[indices.categoria] || "",
        subcategoria: fila[indices.subcategoria] || "",
        marca: fila[indices.marca] || "",
        descripcion: fila[indices.descripcion] || "",
        caracteristicas: fila[indices.caracteristicas] || "",
        incluye: fila[indices.incluye] || ""
      };
      continue;
    }

    if (situacion === "HIJO") {
      if (!estaPublicado(fila, indices)) continue; // variante sin stock/no publicada: se omite, no rompe el grupo

      const grupoId = obtenerGrupoIdDesdeSku(skuActual);
      const imagenesDelSku = mapaImagenes[skuActual] || [];
      const imagenPrincipal = imagenesDelSku.length > 0 ? imagenesDelSku[0] : (fila[indices.imagen] || "");

      if (!hijosPorGrupo[grupoId]) hijosPorGrupo[grupoId] = [];
      hijosPorGrupo[grupoId].push({
        sku: skuActual,
        color: fila[indices.color] || "",
        precio: fila[indices.precio],
        imagen: imagenPrincipal,
        imagenes: imagenesDelSku,
        stock: Number(fila[indices.stock]) || 0,
        oferta: esOferta(fila[indices.estado])
      });
      continue;
    }

    // situacion === "SOLTERO" (o vacío, por seguridad)
    if (!estaPublicado(fila, indices)) continue;

    const categoria = fila[indices.categoria] || "";
    const subcategoria = fila[indices.subcategoria] || "";
    const imagenesDelSku = mapaImagenes[skuActual] || [];
    const imagenPrincipal = imagenesDelSku.length > 0 ? imagenesDelSku[0] : (fila[indices.imagen] || "");

    productosSueltos.push({
      sku: skuActual,
      nombre: fila[indices.nombre] || "",
      precio: fila[indices.precio],
      categoria: categoria,
      subcategoria: subcategoria,
      imagen: imagenPrincipal,
      imagenes: imagenesDelSku,
      marca: fila[indices.marca] || "",
      color: fila[indices.color] || "",
      oferta: esOferta(fila[indices.estado]),
      descripcion: fila[indices.descripcion] || "",
      caracteristicas: fila[indices.caracteristicas] || "",
      incluye: fila[indices.incluye] || "",
      recargo: parsearRecargo(fila[indices.recargo]),
      esGrupo: false
    });
  }

  // ---------- Armar una entrada por grupo (PADRE + sus HIJO publicados) ----------
  const productosDeGrupos = [];
  Object.keys(hijosPorGrupo).forEach(grupoId => {
    const variantes = hijosPorGrupo[grupoId];
    if (variantes.length === 0) return; // ninguna variante publicada: no se genera el grupo

    const padre = padresPorSku[grupoId];
    if (!padre) {
      // No debería pasar (ya lo confirmamos), pero por seguridad no se pierde el producto:
      // se usa la primera variante como base.
      Logger.log("⚠ No se encontró fila PADRE para el grupo: " + grupoId);
    }

    const principal = variantes[0];
    const base = padre || {
      nombre: "", categoria: "", subcategoria: "", marca: "",
      descripcion: "", caracteristicas: "", incluye: ""
    };

    productosDeGrupos.push({
      sku: principal.sku,
      nombre: base.nombre,
      precio: principal.precio,
      categoria: base.categoria,
      subcategoria: base.subcategoria,
      imagen: principal.imagen,
      imagenes: principal.imagenes,
      marca: base.marca,
      color: principal.color,
      oferta: principal.oferta,
      descripcion: base.descripcion,
      caracteristicas: base.caracteristicas,
      incluye: base.incluye,
      recargo: 0,
      esGrupo: true,
      variantes: variantes
    });
  });

  const productos = productosDeGrupos.concat(productosSueltos);

  // ---------- Asignar slug único a cada producto (estilo WordPress) ----------
  // (Esto es lo mismo que ya tenías agregado antes — se reinserta aquí porque
  // esta función reemplaza la versión anterior completa.)
  const conteoSlugs = {};
  productos.forEach(p => {
    const slugBase = generarSlug(p.nombre);
    let slug = slugBase;
    if (conteoSlugs[slugBase] !== undefined) {
      conteoSlugs[slugBase]++;
      slug = slugBase + "-" + conteoSlugs[slugBase];
    } else {
      conteoSlugs[slugBase] = 1;
    }
    p.slug = slug;
  });

  // ---------- Categorías / subcategorías (ya cuenta grupos, no variantes sueltas) ----------
  productos.forEach(p => {
    if (p.categoria) {
      conteoCategorias[p.categoria] = (conteoCategorias[p.categoria] || 0) + 1;
      if (p.subcategoria) {
        if (!conteoSubcategorias[p.categoria]) conteoSubcategorias[p.categoria] = {};
        conteoSubcategorias[p.categoria][p.subcategoria] = (conteoSubcategorias[p.categoria][p.subcategoria] || 0) + 1;
      }
    }
  });

  const categorias = Object.keys(conteoCategorias)
    .map(nombreCat => {
      const subcategorias = conteoSubcategorias[nombreCat]
        ? Object.keys(conteoSubcategorias[nombreCat])
            .map(sub => ({ nombre: sub, cantidad: conteoSubcategorias[nombreCat][sub] }))
            .sort((a, b) => b.cantidad - a.cantidad)
        : [];
      return { nombre: nombreCat, cantidad: conteoCategorias[nombreCat], subcategorias: subcategorias };
    })
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    generadoEn: new Date().toISOString(),
    totalProductos: productos.length,
    productos: productos,
    categorias: categorias
  };
}
