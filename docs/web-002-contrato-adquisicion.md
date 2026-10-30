# WEB-002: contrato de adquisición entre la landing, la webapp y Android

La landing (`auragold.io`) guarda el origen no directo que trajo a cada visitante y lo
entrega de dos formas:

- **A la webapp** (`app.auragold.io`): una cookie `aura_acq` en `.auragold.io`.
- **A la app Android**: el parámetro `referrer` del link a Google Play
  (Install Referrer).

Lo hace `src/components/analytics/AcquisitionHandoff.astro`, usando el clasificador
validado de `src/lib/acquisition/context.mjs`.

## 1. Consentimiento

Todo depende del banner de cookies (`window.auraConsent`, ver
`docs/cmp-contrato.md`):

| Elección del visitante | Qué se guarda y qué viaja |
| --- | --- |
| Todavía no eligió, o no hay banner | Nada. Los links a Play quedan como están |
| Rechazó analítica | Nada, y se borra `aura_acq` si existía |
| Aceptó analítica | UTM permitidos o fuente orgánica/referida, más contexto de entrada permitido |
| Aceptó analítica y publicidad | Los UTM permitidos y `gclid` |
| Revocó publicidad | Se quita `gclid` de la cookie |

## 2. Campos permitidos

Solo estos, leídos de la URL de la landing:

| Campo | Requiere |
| --- | --- |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | Analítica |
| `gclid` | Analítica y publicidad |

Se descarta cualquier otro parámetro y cualquier valor que:
- tenga más de 100 caracteres o saltos de línea;
- parezca un email (`@`), un teléfono (7 o más dígitos seguidos, salvo `gclid`) o
  una wallet (`0x` + hexadecimal);
- en el caso de `gclid`, tenga algo distinto de letras, números, `-` o `_`.

No se copian consultas arbitrarias, tokens, emails, teléfonos ni wallets.
Si hay etiquetas válidas, tienen prioridad sobre el referrer y `source_type` es
`tagged`; eso no certifica por sí solo que el tráfico sea pago. Si no hay etiquetas,
se puede clasificar el dominio externo del referrer como `organic` o `referral`.
Se reconocen hosts exactos de Google (incluido google.com.mx), Bing, DuckDuckGo,
Yahoo Search, Brave Search y Ecosia. Un host que no está reconocido se trata como
referencia externa, sin inventar una búsqueda orgánica.

Campos opcionales nuevos en cada touch (formato v1 compatible):

- `source_type`: `tagged`, `organic` o `referral`.
- `entry_path`: ruta pública permitida donde se capturó ese origen, sin query ni
  hash. No se conservan rutas privadas, emails, wallets o identificadores numéricos largos.
- `referrer_host`: solo el dominio externo; nunca su URL completa, consulta o fragmento.

Las visitas internas, directas o sin referrer utilizable no reemplazan el origen
existente. Sin origen previo siguen como desconocidas: no se clasifican como
orgánicas por descarte. Una etiqueta rechazada o un GCLID sin consentimiento no
provocan una reclasificación orgánica. No se obtienen palabras clave del referrer.
No se añaden UTM a enlaces internos ni se reescribe la URL para clasificar SEO.

**Experimentos:** hoy la landing no corre experimentos, así que no hay
asignación que conservar. Si se agregan, se suman a la lista permitida.

## 3. Cookie `aura_acq` (para la webapp)

| Atributo | Valor |
| --- | --- |
| Nombre | `aura_acq` |
| Dominio | `.auragold.io` (en localhost y previews, el host actual) |
| Duración | 90 días |
| Atributos | `path=/`, `SameSite=Lax`, `Secure` en https |
| Contenido | JSON codificado con `encodeURIComponent` |

```json
{
  "v": 1,
  "first_touch": { "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "rwa", "ts": 1760000000 },
  "last_non_direct": { "utm_source": "meta", "utm_medium": "paid_social", "utm_content": "video1", "ts": 1760086400 }
}
```

- `first_touch`: la primera adquisición no directa capturada. **No se pisa nunca.**
  Los valores históricos v1 ya guardados se conservan; no se reconstruye un origen
  orgánico o una página de entrada que no se haya observado.
- `last_non_direct`: la última visita etiquetada u orgánica/referida. Una visita
  directa o una navegación interna no la cambia.
- `ts`: fecha de esa visita, en segundos (Unix).
- `gclid` aparece dentro de cada objeto solo si el visitante aceptó publicidad.
- Si `v` cambia, el formato cambió: la webapp debe ignorar versiones que no conoce.

**Qué hace la webapp** (no es parte de la landing):
1. Leer `aura_acq` al registrar al usuario y guardar `first_touch` y
   `last_non_direct` asociados a ese usuario.
2. Asociarlos también a las órdenes confirmadas.
3. Si no hay cookie, o no se puede verificar, dejar la adquisición como
   "desconocida". No atribuir todos los registros a publicidad.
4. Respetar el consentimiento: leer la cookie solo si `auraConsent.get().analytics`
   es `true`.

Los campos nuevos son aditivos y no cambian los nombres de cookie, UTM o touches.
Los consumidores deben tolerar campos opcionales. Esta entrega web no demuestra
que app/backend lean `aura_acq` ni cierra la atribución del registro o compra.
OpenPanel recibe los UTM y el contexto validado de la última adquisición desde
el mismo adaptador existente; no recibe GCLID ni la URL de referencia completa.

### UTM en los links a la webapp

La webapp publicada no lee `aura_acq`: lee `utm_*` y `gclid` de su propia URL, los guarda
en `aura-attr-first` / `aura-attr-last` y los envía a `/analytics/attribution`. Por eso,
en el clic en un link a `app.auragold.io`, la landing agrega los UTM de `last_non_direct`
(y `gclid` solo con consentimiento de publicidad). No se agrega nada sin consentimiento de
analítica, sin origen guardado, o si el link ya trae UTM.

Prueba del 2026-10-21: build local servido en `auragold.io`, visita con
`utm_campaign=qa_tracking_check`, cookies aceptadas y clic en el link a la webapp real. La
webapp guardó `aura-attr-first` y `aura-attr-last` con esos UTM antes de redirigir a
`/sign-in`. No se probó el envío a `/analytics/attribution` (requiere registrarse) ni la
atribución de GA4: la redirección quita la query de la URL.

## 4. Referrer de Google Play (para Android)

Se arma en el momento del clic en cualquier link a `play.google.com`, con
`URLSearchParams`, y se pone en el link con `url.searchParams.set("referrer", …)`:
**una sola codificación**.

**Con campaña guardada** (formato nuevo):

```
utm_source=google&utm_medium=cpc&utm_campaign=rwa&aura_cta=download-header-mobile
```

- Los UTM de `last_non_direct`.
- `aura_cta`: el botón donde se hizo clic (su `data-cta`).
- `gclid` al final, solo con consentimiento de publicidad.

**Sin campaña** (el formato de siempre, para que las instalaciones directas se
sigan viendo igual en GA4):

```
utm_source=auragold.io&utm_medium=header-mobile
```

**Aviso para Android:** con campaña, las instalaciones dejan de aparecer como
`auragold.io / <botón>` y pasan a aparecer con la fuente real de la campaña (por
ejemplo `google / cpc`). El botón queda en `aura_cta`.

**Qué hace Android** (no es parte de la landing):
1. Leer el Install Referrer y asociarlo al usuario cuando se registre.
2. Respetar el consentimiento y no pisar la adquisición inicial.
3. Documentar qué pasa con instalaciones previas y reinstalaciones. No inventar
   adquisición.

**Límite conocido:** el QR del modal de escritorio se genera al compilar el
sitio, así que lleva siempre `utm_source=auragold.io&utm_medium=qr-modal` y no la
campaña del visitante.

**Un clic a Play no es una instalación**, ni un `first_open`.

**App Store (iPhone):** el link va sin campaña. El App Store no tiene un
`referrer` que llegue a la app: solo admite los "campaign links" de App Store
Connect (`pt` = proveedor, `ct` = campaña), que necesitan el `pt` de la cuenta
de Apple y se ven en App Store Connect, no en GA4. Hasta tenerlo, el clic se mide
en GA4 (`click_download` con `destination` = `app_store`) pero la instalación no
se puede atribuir desde la landing.

## 5. Verificación de la landing (12/10/2026, entorno local con el consentimiento simulado)

| Escenario | Resultado |
| --- | --- |
| Sin banner de cookies | No se crea `aura_acq`; el link a Play no cambia |
| `?utm_source=google&utm_medium=cpc&utm_campaign=rwa&gclid=…&utm_foo=x&email=a@b.com`, solo analítica | Se guarda google/cpc/rwa; se descartan `utm_foo`, `email` y `gclid` |
| Se acepta publicidad | Se suma `gclid` |
| Visita directa a otra página | La cookie no cambia |
| Otra campaña con `utm_campaign=juan@mail.com` y `utm_term=0xABCDEF…` | `last_non_direct` pasa a meta/paid_social/video1; se descartan el email y la wallet; `first_touch` sigue en google |
| Se revoca publicidad | Se quita `gclid` |
| Se revoca analítica | Se borra `aura_acq` |
| Clic en "Descargar para Android" (hero) con campaña | `utm_source=google&utm_medium=cpc&utm_campaign=rwa&aura_cta=android-hero` |
| Mismo clic sin campaña | `utm_source=auragold.io&utm_medium=hero` (antes este botón no tenía referrer) |
| Clic con el botón del medio | Arma el referrer igual |

Por separado, como pide el PDF:
- **Recepción en la landing:** verificada (tabla de arriba).
- **Vinculación en el backend:** pendiente (webapp y Android).
- **Atribución publicitaria:** pendiente (Google Ads, cuando las otras dos estén).
