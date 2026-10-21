# WEB-012A: OpenPanel en la landing

## Qué se integró

| Pieza | Archivo | Origen |
| --- | --- | --- |
| SDK | `@openpanel/web@1.4.1` (versión exacta, con `package-lock.json`) | Lo pide el PDF |
| Módulo de Aura | `src/lib/openpanel/openpanel.js` | Anexo B del PDF, págs. 19-21, transcrito tal cual (verificado contra el texto del PDF) |
| Arranque | `src/lib/openpanel/bootstrap.js` | Anexo B del PDF, pág. 18, tal cual |
| Adaptadores | `src/components/analytics/OpenPanelAnalytics.astro` | Conecta el módulo con el banner de cookies y con la campaña de WEB-002 |
| Carga en el sitio | `src/components/layout/Footer.astro` | El Footer está en todas las páginas |
| Pruebas | `tests/openpanel.test.mjs` (`npm test`) | Rechazo, permiso, revocación durante la carga, caída de la API |

No tuvimos el zip `openpanel-integration-source.zip`. El código sale del Anexo B.

## Cómo funciona

- **API:** `https://openpanel-api.1930.dev` (fijada en el módulo del PDF).
- **Client ID:** variable de entorno pública `PUBLIC_OPENPANEL_CLIENT_ID`. Es público
  por diseño. **El `CLIENT_SECRET` no se usa en la landing:** es solo para un
  servidor (por ejemplo, el backend de la webapp para `purchase`).
- **Consentimiento:** se lee del banner (`window.auraConsent`, ver `docs/cmp-contrato.md`).
  - El SDK se importa **recién** cuando el visitante acepta analítica. Vite lo deja en
    un archivo aparte (unos 8 KB), que no se descarga sin consentimiento.
  - Al revocar: el banner guarda la elección, el módulo vacía la cola, deja de enviar
    y recarga la página.
  - Sin el banner (hoy, en `main`), OpenPanel no hace nada.
- **Dónde se activa:** solo en el build de producción, en https y en `auragold.io`,
  `www.auragold.io` o `app.auragold.io`. En local y en las previews de Vercel no se activa.
- **Qué se envía:**
  - Una vista de página al cargar.
  - `click_download` y `click_open_web`, desde el mismo escuchador de WEB-001 (sin
    escuchadores nuevos ni otro contenedor de GTM).
  - Solo campos de la lista del PDF (`cta_id`, `cta_position`, `destination`,
    `landing_path`, UTM, `environment`, etc.). Sin datos personales y sin la URL de
    referencia completa.
  - Contexto: `environment: "production"` y los UTM de la última campaña que guardó
    WEB-002 (cookie `aura_acq`), si existe.
- **Grabación de sesiones:** encendida (`replayReady=true`) desde WEB-012C, solo
  para quien acepta grabación en el banner. Ver abajo.

### WEB-012B: preparación del replay

- **Visitas con campaña:** antes se excluía cualquier visita con query, y por eso
  quedaba afuera todo el tráfico de anuncios. Ahora se graba si la query solo trae
  UTM y `gclid` válidos (la misma validación de WEB-002) y los parámetros que Google
  Ads agrega a cada clic (`gad_source`, `gad_campaignid`, `gbraid`, `wbraid`, cada uno
  con su formato). Un parámetro distinto, un valor rechazado o un hash dejan la visita
  sin grabación.
- **URLs sin query:** rrweb guarda la URL de la página y los atributos de los
  links, como el `referrer` de Play que lleva `gclid`. Antes de enviar cada
  fragmento se quitan la query y el hash de toda URL absoluta. Un fragmento
  ilegible se descarta.
- **Sin cambios:** consentimiento de grabación, páginas permitidas (`/` y
  `/invertir-en-oro-mexico`), bloqueo de formularios y exclusión de
  `app.auragold.io`.

### WEB-012C: grabación encendida

- `replayReady=true`. Se graba solo con permiso de grabación (el botón "Aceptar"
  del banner lo incluye) y solo en `/` y `/invertir-en-oro-mexico`.
- Se graba el texto de la página, que es contenido público. Los inputs siguen
  enmascarados y los formularios bloqueados.
- Prueba del 2026-10-20: build local servido en el dominio `auragold.io` desde un
  navegador aislado, con `utm_campaign=qa_tracking_check` y un `gclid` de prueba.
  OpenPanel guardó 9 fragmentos y 102 eventos en `session_replay_chunks` del
  proyecto `aura-gold`, en la misma sesión que la vista de página. Ningún
  fragmento tenía URLs con query, UTM ni `gclid`, y el texto se leía.

## Pruebas (`npm test`)

| Prueba | Resultado |
| --- | --- |
| Rechazo: sin analítica no se carga el SDK | Pasa |
| Permiso: se carga una vez, con la API y el Client ID correctos, sin grabación, y manda la vista | Pasa |
| Revocación durante la carga: no se activa | Pasa |
| Revocación después: vacía la cola, deja de enviar y recarga | Pasa |
| Caída de la API (el import falla): no rompe y queda inactivo | Pasa |
| Eventos y campos: solo los permitidos; se descartan email, teléfono y eventos fuera de la lista | Pasa |
| Entorno: no se activa sin https, fuera de los dominios de Aura, sin Client ID o fuera de producción | Pasa |
| Replay: enmascara los inputs y graba el texto de la página | Pasa |
| Replay: graba visitas con UTM y `gclid` válidos en las páginas permitidas | Pasa |
| Replay: no graba con otros parámetros, valores rechazados, hash u otras páginas | Pasa |
| Replay: los fragmentos no llevan query ni hash de ninguna URL | Pasa |
| Replay: un fragmento ilegible se descarta | Pasa |
| Replay: sin consentimiento de grabación no se envían fragmentos | Pasa |

**Las pruebas usan un navegador y un SDK simulados: no alcanzan para decir que
funciona en producción**, como aclara el PDF.

Verificado además:
- El servidor responde y su estado es sano (`/healthcheck`: redis, db y ClickHouse listos).
- Acepta pedidos desde `https://auragold.io` (CORS).
- En local, aun simulando el consentimiento completo, no hay pedidos a OpenPanel.
- No hay CSP en `vercel.json`, así que no hay nada que habilitar.

## Pendiente afuera de la landing

1. **Cargar `PUBLIC_OPENPANEL_CLIENT_ID` en Vercel** (Production y Preview).
2. **Acceso al panel** (`openpanel.1930.dev`) para:
   - confirmar que el Client ID es de un proyecto **solo de Aura**, como pide el PDF;
   - verificar que llegan la vista de página, `click_download` y `click_open_web`.
3. **Mergear el banner (#42)**: sin él, OpenPanel no se activa.
4. **`purchase` y `first_purchase`**: los manda el backend de la webapp con el
   `CLIENT_SECRET`, a partir de órdenes confirmadas. No es parte de la landing.
