# Banner de cookies (CMP): contrato entre auragold.io y app.auragold.io

La landing y la webapp usan **el mismo archivo** de consentimiento. La elección
del visitante se guarda en una cookie del dominio `.auragold.io`, así que quien
acepta o rechaza en un sitio no vuelve a ver el banner en el otro.

## 1. Cómo se carga

En el `<head>` de la webapp, antes de cualquier herramienta de medición:

```html
<script src="https://auragold.io/consent/consent.js" defer></script>
```

- No hace falta copiar el código: si se corrige algo, se corrige una sola vez.
- El banner trae su propio CSS. La tipografía la hereda de la webapp.
- **Si el archivo no carga, se trata como "sin consentimiento"**: no se mide nada.

Opcional: si la webapp usa Google Tag Manager, se le pasa el ID y el archivo lo
carga solo cuando el visitante acepta analítica o publicidad:

```html
<script src="https://auragold.io/consent/consent.js" data-gtm-id="GTM-XXXXXXX" defer></script>
```

## 2. La cookie

| Campo | Valor |
| --- | --- |
| Nombre | `aura_consent` |
| Dominio | `.auragold.io` (en localhost y en previews queda en el host actual) |
| Duración | 180 días |
| Atributos | `path=/`, `SameSite=Lax`, `Secure` en https |
| Contenido | JSON codificado: `{"v":1,"analytics":true,"ads":false,"replay":false,"ts":1760000000}` |

Si `v` cambia (por ejemplo, porque cambió la política de privacidad), el banner
vuelve a preguntar. No hay que leer ni escribir la cookie a mano: se usa la API.

## 3. Categorías

| Categoría | Qué cubre | Señales de Google Consent Mode |
| --- | --- | --- |
| `analytics` | Google Analytics, OpenPanel | `analytics_storage` |
| `ads` | Google Ads | `ad_storage`, `ad_user_data`, `ad_personalization` |
| `replay` | Grabación de sesiones (Clarity, grabación de OpenPanel) | Ninguna: se lee con la API o desde `dataLayer` |

"Necesarias" (la propia cookie de consentimiento) está siempre activa.

## 4. API: `window.auraConsent`

```js
auraConsent.get();
// → { analytics: boolean, ads: boolean, replay: boolean }, o null si todavía no eligió

const unsubscribe = auraConsent.subscribe((choice) => {
  // Se llama DESPUÉS de guardar la cookie, cada vez que la elección cambia.
});

auraConsent.open(); // abre las preferencias
```

- Cualquier elemento con el atributo `data-aura-consent-open` abre las preferencias
  al hacer clic (por ejemplo, un link "Configurar cookies" en el pie de la webapp).
- Como el archivo se carga con `defer`, la API está lista cuando se dispara el
  evento `auraconsent:ready`:

```js
function whenConsentReady(callback) {
  if (window.auraConsent) callback(window.auraConsent);
  else window.addEventListener("auraconsent:ready", () => callback(window.auraConsent), { once: true });
}
```

- Si el visitante **revoca** algo que había aceptado, el archivo guarda la
  cookie, avisa a los suscriptores y recarga la página: lo que ya se cargó no se
  puede descargar.
- Si la elección cambia en el otro sitio (otra pestaña), se toma al volver a la
  pestaña.

## 5. Adaptadores para OpenPanel (WEB-012A)

El módulo del PDF pide `readConsent` y `subscribeConsent`:

```js
const readConsent = () => {
  const choice = window.auraConsent?.get();
  return { analytics: choice?.analytics === true, replay: choice?.replay === true };
};

const subscribeConsent = (callback) =>
  window.auraConsent.subscribe((choice) => callback({ analytics: choice.analytics, replay: choice.replay }));
```

## 6. Qué hace cada sitio

- **Landing (auragold.io):** carga GTM recién con consentimiento, mide los clics
  de los botones y, más adelante, OpenPanel en la home y en `/invertir-en-oro-mexico`.
- **Webapp (app.auragold.io):** carga sus herramientas solo según `auraConsent`.
  Sin grabación de sesiones en la webapp (lo prohíbe el PDF, WEB-012B).

## 7. Cambio pendiente en GTM (`GTM-N6SBJSSC`)

Lo aplica quien administre el contenedor. Hasta que se aplique, **Clarity corre
cada vez que GTM carga**, o sea cuando el visitante acepta analítica o publicidad,
aunque haya rechazado la grabación.

1. Variables → Nueva → Variable de capa de datos: `aura_consent_replay`.
2. Activadores → Nuevo → Evento personalizado, con el nombre de evento que
   coincida con la regex `^aura_consent_(ready|update)$` y la condición
   `aura_consent_replay` igual a `true`.
3. Etiqueta de Microsoft Clarity: reemplazar su activador actual por el del paso 2.
4. Vista previa, verificar y publicar.

Los eventos que el archivo deja en `dataLayer`:

| Evento | Cuándo |
| --- | --- |
| `aura_consent_ready` | Al cargar GTM, con la elección vigente |
| `aura_consent_update` | Cada vez que el visitante cambia su elección |

Los dos llevan `aura_consent_analytics`, `aura_consent_ads` y `aura_consent_replay`.

Nota sobre Google Ads: si el visitante acepta analítica pero rechaza publicidad,
GTM carga y la etiqueta de Ads manda avisos **sin cookies** con la señal
`ad_storage` denegada. Es el comportamiento estándar de Google Consent Mode. Si se
quiere que Ads no mande nada en ese caso, en GTM hay que exigir el consentimiento
`ad_storage` en las etiquetas de Google Ads (Configuración avanzada → Configuración
de consentimiento → Requerir consentimiento adicional).

## 8. Pruebas en conjunto (en producción)

1. Aceptar en la landing → entrar a la webapp → el banner no aparece.
2. Rechazar → ninguno de los dos sitios hace pedidos a Google ni a OpenPanel.
3. Cambiar la elección en un sitio → el otro la respeta al volver a la pestaña.
4. GA4 → Admin → Consent settings → las señales de AURA WEB aparecen activas.
