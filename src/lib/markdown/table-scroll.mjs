// Envuelve cada <table> del Markdown (posts del blog) en un contenedor con scroll
// horizontal propio. Sin esto, en celular las tablas comparativas anchas empujaban
// toda la página hacia el costado. Se envuelve en lugar de cambiarle el display a
// la tabla: así conserva su semántica de tabla para los lectores de pantalla.
// role="region" + aria-label + tabindex="0" permiten desplazarla con el teclado.
// Es un plugin HAST de Sätteri, el procesador de Markdown de Astro 7.
const WRAPPER =
  '<div class="table-scroll" role="region" aria-label="Tabla: desliza de lado para ver todas las columnas" tabindex="0"></div>';

export const tableScrollPlugin = {
  name: "table-scroll",
  element: {
    filter: ["table"],
    visit(node, ctx) {
      ctx.wrapNode(node, { raw: WRAPPER });
    },
  },
};
