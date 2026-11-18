import { getCollection } from "astro:content";

/**
 * Posts del blog visibles en el sitio.
 *
 * Un post con `pubDate` futuro se puede mergear a main con anticipación: queda
 * fuera de listados, rutas, sitemap y relacionados hasta que llega su día. El
 * sitio es estático, así que el post aparece en el primer build posterior a esa
 * fecha (el workflow redeploy-programado.yml dispara ese build cada mañana).
 *
 * En `astro dev` se muestran todos, para poder previsualizar lo programado.
 */
export async function getPublishedPosts() {
  const now = new Date();
  return getCollection("blog", ({ data }) => import.meta.env.DEV || data.pubDate <= now);
}
