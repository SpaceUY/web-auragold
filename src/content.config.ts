import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.enum(["federico-sendra", "juan-manuel-sobral"]),
    category: z.enum(["Educación", "Guías", "Mercado", "Seguridad"]),
    heroImage: z.string(),
  }),
});

export const collections = { blog };
