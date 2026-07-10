// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Prioridades y frecuencia de cambio por tipo de URL para el sitemap.
// El sitemap de Framer no incluía lastmod/priority/changefreq ni todas las páginas.
/**
 * @param {string} url
 */
function sitemapMeta(url) {
  // Sin barra final (trailingSlash: 'never'). Normalizamos por las dudas.
  const path = new URL(url).pathname.replace(/\/$/, '') || '/';
  if (path === '/') return { priority: 1.0, changefreq: 'weekly' };
  if (path === '/precio-del-oro-hoy') return { priority: 0.9, changefreq: 'daily' };
  if (path === '/invertir-en-oro-mexico') return { priority: 0.9, changefreq: 'weekly' };
  if (path === '/blog') return { priority: 0.8, changefreq: 'weekly' };
  if (path.startsWith('/blog/')) return { priority: 0.7, changefreq: 'monthly' };
  if (path === '/transparencia') return { priority: 0.6, changefreq: 'monthly' };
  if (path.startsWith('/autores/')) return { priority: 0.5, changefreq: 'monthly' };
  if (path === '/terminos-y-condiciones' || path === '/politicas-de-privacidad')
    return { priority: 0.3, changefreq: 'yearly' };
  return { priority: 0.5, changefreq: 'monthly' };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://auragold.io',
  output: 'static',
  trailingSlash: 'never',
  adapter: vercel(),
  integrations: [
    sitemap({
      serialize(item) {
        const { priority, changefreq } = sitemapMeta(item.url);
        item.priority = priority;
        item.changefreq = /** @type {any} */ (changefreq);
        item.lastmod = new Date().toISOString();
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
