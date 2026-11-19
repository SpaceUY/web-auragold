import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Metadata SEO para el <head>. Si no se define, cae al title/description de arriba.
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    pubDate: z.coerce.date(),
    // Solo completar si el contenido se edita de verdad después de publicado
    // (no tocar en cada deploy solo para "parecer" actualizado).
    updatedDate: z.coerce.date().optional(),
    author: z.enum(["federico-sendra", "juan-manuel-sobral"]),
    category: z.enum(["Educación", "Guías", "Mercado", "Seguridad"]),
    heroImage: z.string(),
    // Describe la imagen, no el artículo: es el texto que oye quien no puede verla.
    // Solo se usa en el hero del post; en las cards la portada es decorativa
    // (el título va al lado como texto) y ahí el alt va vacío a propósito.
    // Si no se define, cae al title, que es peor pero no deja la imagen sin alt.
    heroImageAlt: z.string().optional(),
    // Video del canal de YouTube sobre el mismo tema. Se muestra debajo de la portada
    // y se declara como VideoObject para que Google lo asocie al post.
    video: z
      .object({
        youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "ID de YouTube de 11 caracteres"),
        title: z.string(),
        description: z.string(),
        uploadDate: z.coerce.date(),
        // Duración ISO 8601, por ejemplo PT3M25S.
        duration: z.string().regex(/^PT(\d+M)?(\d+S)?$/),
        // Imagen que se ve antes de reproducir (un cuadro limpio del video). Si falta, se usa la
        // miniatura automática de YouTube, que a veces cae en medio de una animación.
        poster: z.string().optional(),
      })
      .optional(),
  }),
});

export const collections = { blog };
