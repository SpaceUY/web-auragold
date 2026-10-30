# WEB-001: mapa de botones y cambios en GTM

La landing deja dos eventos en `dataLayer` cuando alguien hace clic de verdad en
un botón (lo hace `src/components/analytics/CtaTracking.astro`, con un solo
escuchador para todo el sitio):

| Evento | Cuándo |
| --- | --- |
| `click_download` | Clic en un link a Google Play (`play.google.com`) o al App Store (`apps.apple.com`) |
| `click_open_web` | Clic en un link a la web app (`app.auragold.io`) |

Los dos llevan los mismos parámetros:

| Parámetro | Qué es | Ejemplo |
| --- | --- | --- |
| `cta_id` | Identificador fijo del botón (`data-cta`) | `download-header-mobile` |
| `cta_position` | Dónde está el botón (`data-cta-position`) | `header-mobile` |
| `destination` | `google_play`, `app_store` o `web_app` | `google_play` |
| `landing_path` | Página donde se hizo el clic, sin query ni hash | `/invertir-en-oro-mexico` |

Reglas que cumple:
- **Un solo evento por clic**, aunque se haga clic en el ícono o el texto de adentro.
- **Abrir o cerrar el modal "Descargar app" no manda nada.** En escritorio,
  "Descargar app" abre el modal con los QR y no lleva a ninguna tienda, así que
  no cuenta como descarga.
- **El botón del medio** (abrir en otra pestaña) cuenta. El botón derecho, no.
- **Si la medición falla, el link navega igual.**
- **Un clic a una tienda no es una instalación ni una compra.**

## Mapa de botones

| Página | Botón (texto) | `cta_id` | `cta_position` | Android | iPhone | Escritorio |
| --- | --- | --- | --- | --- | --- | --- |
| Todas (header escritorio) | Iniciar sesión | `webapp-header` | `header` | — | — | `click_open_web` |
| Todas (header escritorio) | Descargar app | `download-header` | `header` | — | `click_download` (iPad) | Abre el modal |
| Todas (header móvil) | Descargar app | `download-header-mobile` | `header-mobile` | `click_download` | `click_download` | — |
| Todas (menú móvil) | Descargar app | `download-menu` | `menu` | `click_download` | `click_download` | — |
| Todas (menú móvil) | Iniciar sesión | `webapp-menu` | `menu` | `click_open_web` | `click_open_web` | — |
| Modal "Descargar app" (escritorio) | Usa Aura desde la web | `webapp-desktop-modal` | `modal` | — | — | `click_open_web` |
| `/` y `/invertir-en-oro-mexico` (hero) | Empieza ahora | `webapp-hero` | `hero` | `click_open_web` | `click_open_web` | `click_open_web` |
| `/` y `/invertir-en-oro-mexico` (hero) | Descargar para Android | `android-hero` | `hero` | `click_download` | `click_download` | `click_download` |
| `/` y `/invertir-en-oro-mexico` (hero) | Descargar para iPhone | `ios-hero` | `hero` | `click_download` | `click_download` | `click_download` |
| `/` (cierre) | Abrir mi bóveda | `start-cta-final-home` | `cta-final-home` | `click_download` | `click_download` | `click_open_web` |
| `/invertir-en-oro-mexico` (cierre) | Abrir mi bóveda | `start-cta-final-invertir` | `cta-final-invertir` | `click_download` | `click_download` | `click_open_web` |
| `/precio-del-oro-hoy` (cierre) | Abrir mi bóveda | `start-cta-final-precio` | `cta-final-precio` | `click_download` | `click_download` | `click_open_web` |
| `/calculadora-inflacion-oro` (resultado) | Empieza a invertir en oro | `start-calculadora` | `calculadora` | `click_download` | `click_download` | `click_open_web` |
| `/calculadora-inflacion-oro` (cierre) | Empieza ahora | `start-calculadora-final` | `calculadora-final` | `click_download` | `click_download` | `click_open_web` |
| `/calculadora-inflacion-oro` (FAQ) | abre tu cuenta | `webapp-faq-calculadora` | `faq` | `click_open_web` | `click_open_web` | `click_open_web` |
| Posts del blog (columna lateral) | Empieza ahora | `webapp-blog-banner` | `blog-sidebar` | `click_open_web` | `click_open_web` | `click_open_web` |

- **Footer:** no tiene botones a Play ni a la web app.
- **QR del modal (escritorio):** hay uno por tienda. Se escanean con el celular,
  no se hace clic, así que no se pueden medir desde la landing.
- **"Abrir mi bóveda" y los demás `start-*`** van a Play en Android, al App Store
  en iPhone y a la web app en escritorio. Por eso el mismo `cta_id` puede dar
  `click_download` o `click_open_web`, y `destination` dice cuál fue.
- **"Descargar app"** va a Play en Android y al App Store en iPhone y iPad; en
  escritorio abre el modal.
- **App Store en GTM:** usa el mismo evento `click_download`, así que no hace
  falta tocar GTM ni GA4; se distingue por `destination` = `app_store`.

## Cambios exactos en GTM (`GTM-N6SBJSSC`)

Los aplica quien administre el contenedor. Hoy la etiqueta `click_download` se
dispara solo si el link contiene `framer.com/downloads` (la web vieja), así que
nunca se dispara.

1. **Variables** → Nueva → *Variable de capa de datos* (versión 2), una por cada una:
   `cta_id`, `cta_position`, `destination`, `landing_path`.
2. **Activadores** → Nuevo → *Evento personalizado*:
   - Nombre del evento `click_download`, se activa en todos los eventos personalizados.
   - Nombre del evento `click_open_web`, igual.
3. **Etiqueta GA4 `click_download`** (la que ya existe, con ID `G-110QJJ64VW`):
   - Activador: reemplazar el de `framer.com/downloads` por el nuevo `click_download`.
   - Parámetros del evento: `cta_id`, `cta_position`, `destination` y `landing_path`,
     cada uno con su variable del paso 1. Se pueden quitar `button_text` y
     `page_location` (GA4 ya recoge la página).
4. **Etiqueta GA4 nueva `click_open_web`**: evento de GA4, ID `G-110QJJ64VW`,
   nombre del evento `click_open_web`, los mismos 4 parámetros y el activador
   `click_open_web`.
5. **Borrar** el activador de `framer.com/downloads` y la etiqueta *Click Listener*
   (escuchador de clics), que solo lo alimentaba. El PDF pide no duplicar escuchadores.
6. **No marcar** `click_download` ni `click_open_web` como eventos clave: son de
   diagnóstico. La conversión principal es `first_purchase` (WEB-004).
7. **Vista previa** → probar un clic de cada tipo → **Publicar** con el nombre
   "WEB-001".

## Cambios en GA4 (propiedad "Aura Web + App")

Hay que hacerlos **antes** de publicar GTM, porque las dimensiones no son
retroactivas. Son de toda la propiedad, así que se avisa a Juan antes.

Admin → Data display → Custom definitions → Create custom dimension, ámbito
*Event*:

| Nombre | Parámetro |
| --- | --- |
| CTA id | `cta_id` |
| CTA posición | `cta_position` |
| CTA destino | `destination` |
| Página de origen | `landing_path` |

## Verificación

Probado en el entorno local, leyendo `dataLayer` (con la navegación frenada solo
para la prueba):

| Escenario | Resultado |
| --- | --- |
| Escritorio: Iniciar sesión | 1 `click_open_web` (`webapp-header` / `header`) |
| Escritorio: Descargar app | Se abre el modal, 0 eventos |
| Modal: Usa Aura desde la web | 1 `click_open_web` (`modal`) |
| Cerrar el modal | 0 eventos |
| Clic en el ícono de "Empieza ahora" | 1 `click_open_web` |
| Hero: Descargar para Android | 1 `click_download` |
| Botón del medio / botón derecho | 1 evento / 0 eventos |
| Link interno (Transparencia) | 0 eventos |
| Android: Descargar app, menú, Abrir mi bóveda | 1 `click_download` cada uno |
| Android: Iniciar sesión (menú) | 1 `click_open_web` |
| `/invertir-en-oro-mexico`, `/calculadora-inflacion-oro` (incluida la FAQ), `/precio-del-oro-hoy`, un post del blog | 1 evento por botón, con el `landing_path` de cada página |

**No verificado (sin acceso a GTM):** la Vista previa de GTM, DebugView y la
llegada a GA4. Se verifica cuando se apliquen los cambios de arriba: GA4 →
Reports → Realtime, hacer clic en un botón de la landing publicada y ver
`click_download` o `click_open_web`.

**iPhone:** no se pudo emular el navegador de iPhone en local. El camino es el
mismo que en escritorio (el modal frena la navegación), que sí está probado.

**Con el banner de cookies:** si el visitante no aceptó analítica ni publicidad,
GTM no se carga y estos eventos quedan en `dataLayer` sin enviarse. Es lo esperado.
