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
  }),
});

export const collections = { blog };
