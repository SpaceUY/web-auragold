# WEB-002: contrato de adquisición entre la landing, la webapp y Android

La landing (`auragold.io`) guarda la campaña que trajo a cada visitante y la
entrega de dos formas:

- **A la webapp** (`app.auragold.io`): una cookie `aura_acq` en `.auragold.io`.
- **A la app Android**: el parámetro `referrer` del link a Google Play
  (Install Referrer).

Lo hace `src/components/analytics/AcquisitionHandoff.astro`.

## 1. Consentimiento

Todo depende del banner de cookies (`window.auraConsent`, ver
`docs/cmp-contrato.md`):

| Elección del visitante | Qué se guarda y qué viaja |
| --- | --- |
| Todavía no eligió, o no hay banner | Nada. Los links a Play quedan como están |
| Rechazó analítica | Nada, y se borra `aura_acq` si existía |
| Aceptó analítica | Los UTM permitidos |
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

No se copian consultas arbitrarias, tokens, emails, teléfonos ni wallets. El
referrer del navegador tampoco se usa: una visita cuenta como "con campaña" solo
si trae alguno de estos campos.

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

- `first_touch`: la primera visita con campaña. **No se pisa nunca.**
- `last_non_direct`: la última visita con campaña. Una visita directa (sin
  campos) no la cambia.
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
