# WEB-008B: custodia, LBMA y auditorías

Qué pide el PDF: revisar todo lo que la landing dice sobre custodia, LBMA, auditorías y respaldo del oro.
Cada frase tiene que tener una fuente, y tiene que quedar claro quién es quién:

- el estándar del metal;
- quién emite el token;
- quién guarda el oro;
- qué hace Aura Gold.

No se puede presentar una auditoría del emisor como si fuera de Aura. Lo que no tiene evidencia queda como
pendiente de validar, sin inventar nada.

Fuentes revisadas el 2026-10-12:

- [gold.tether.to](https://gold.tether.to/) y [gold.tether.to/faq](https://gold.tether.to/faq)
- [gold.tether.to/reports](https://gold.tether.to/reports), con el último informe de BDO Italia, al
  30/06/2026: `ISAE_3000R_-_Opinion_TGRR_30.06.2026_RC187322026DV0170.pdf`

Los datos están en un solo lugar: `src/data/custody.ts`.

## Quién es quién

| Rol | Quién | Fuente |
| --- | --- | --- |
| Token | Tether Gold (XAUT). 1 XAUT = 1 onza troy de oro fino | FAQ de gold.tether.to |
| Emisor | TG Commodities, S.A. de C.V. (El Salvador) | FAQ y el informe de BDO |
| Custodio | Uno o más custodios en Suiza, sin nombre público, que guardan el oro en nombre de quienes tienen XAUT | Informe de BDO |
| Estándar del metal | London Good Delivery de la LBMA | FAQ y el informe de BDO |
| Revisión de reservas | BDO Italia, ISAE 3000 Revised, cada trimestre. Revisa las reservas de Tether Gold, **no a Aura Gold** | gold.tether.to/reports |
| Aura Gold | La app con la que compras y vendes. No emite el token ni guarda el oro | Producto |

## Tabla de afirmaciones

Estado: **Con fuente** (la fuente lo dice), **Corregida** (estaba mal atribuida y se cambió),
**Pendiente** (sin evidencia pública; no se tocó y espera evidencia del cliente).

| Afirmación | Dónde | Fuente | Emisor de la evidencia | Alcance | Estado |
| --- | --- | --- | --- | --- | --- |
| El oro está en bóvedas en Suiza | Home, invertir, Transparencia, blog | Informe de BDO al 30/06/2026 | TG Commodities (aseveración), revisada por BDO Italia | Reservas de XAUT | Con fuente |
| Las barras cumplen London Good Delivery de la LBMA | Home, invertir, Transparencia, JsonLD, blog | FAQ e informe de BDO | TG Commodities / BDO Italia | Barras de las reservas de XAUT | Con fuente |
| "Oro certificado LBMA", "certificación LBMA", "Custodia certificada LBMA", "Bóveda certificada" | Home (4), invertir (3), JsonLD, blog (8) | Ninguna: la LBMA fija un estándar para las barras; no certifica a Aura ni a la custodia | — | — | Corregida a "barras con estándar LBMA" |
| "Realizamos auditorías trimestrales con BDO" | Transparencia | gold.tether.to/reports | BDO Italia, para TG Commodities | Reservas de Tether Gold, no Aura | Corregida: es el informe de Tether Gold |
| BDO verifica que el oro "corresponde al total vendido a usuarios" | Transparencia (FAQ) | El informe compara el oro con los XAUT emitidos, no con los usuarios de Aura | BDO Italia | Todos los XAUT | Corregida |
| BDO verifica el seguro | Transparencia | El informe de BDO no menciona seguros | — | — | Corregida: se quitó esa frase |
| "Los informes de auditoría serán públicos" | Transparencia (compromisos) | Aura no tiene auditorías propias publicadas | — | — | Corregida: enlazamos los informes de Tether Gold |
| "Auditorías trimestrales" en la meta description y el H1 | Transparencia | Igual que arriba | — | — | Corregida a "informes de reservas" |
| Muestreo físico de barras por un tercero independiente | Transparencia | Informe de BDO | TG Commodities / BDO Italia | Muestra trimestral | Con fuente |
| Más de 20 toneladas de oro | Transparencia | gold.tether.to (25,735 kg al 2026-10-12) | TG Commodities | Total de XAUT | Con fuente |
| "El token de oro más grande del mundo" | Transparencia | Sin fuente comparativa | — | — | Corregida: se quitó |
| Canje: lingotes completos, entrega en Suiza, 0.25% más el envío, cuenta verificada | Home, Transparencia, blog | FAQ de gold.tether.to | TG Commodities | Quien tenga XAUT | Con fuente |
| "Puedes pedir tu oro en físico cuando quieras" / "envío a tu domicilio" | Home | Contradice la FAQ: solo lingotes completos y entrega en Suiza | — | — | Corregida: canje con Tether Gold, sin fecha fija, coordinado con el equipo (dato de producto) |
| Consultar las barras de una dirección (wallet) | Transparencia, invertir, blog | gold.tether.to (lookup por dirección) | TG Commodities | Direcciones con XAUT | Con fuente para XAUT. **Pendiente** si el usuario de Aura tiene una dirección propia |
| Sin comisión de custodia | Varios | FAQ: Tether Gold no cobra custodia | TG Commodities | XAUT | Con fuente para Tether. Lo de Aura lo cubre WEB-005 |
| Pureza 99,99% / "24k" | Transparencia, blog, home | Good Delivery exige un mínimo de 99,5%, y la FAQ habla de "onza de oro fino" | — | — | 99,99% se quitó donde se reescribió. **Pendiente**: el "24k" del resto del sitio |
| Seguro "completo" contra robo y daños | Home, Transparencia | Sin fuente pública | — | — | **Pendiente** |
| "Activo segregado", "a tu nombre", "bajo tu titularidad", "separado del balance de Aura" | Home, invertir, Transparencia, blog | BDO dice que el oro es de quienes tienen XAUT, no de TG Commodities. No dice nada de Aura ni de cómo tiene los tokens de sus usuarios | — | — | **Pendiente**: hace falta saber si Aura tiene los XAUT a nombre de cada usuario o en una cuenta común |
| Chainlink Proof of Reserve | Transparencia, glosario | Sin verificar un feed de XAUT | — | — | **Pendiente** |
| "Auditorías externas" y "proveedores certificados LBMA" en lo que cubre la comisión | Transparencia | Sin evidencia de Aura | — | — | **Pendiente** (líneas que toca WEB-005) |
| Definición de LBMA en el glosario | Glosario | Explica el término; no acredita nada | — | — | Sin cambios (el PDF lo aclara) |

## Antes y después

| Dónde | Antes | Después |
| --- | --- | --- |
| Home, paso 1 | oro 24k certificado (con respaldo LBMA) | oro 24k en barras con estándar LBMA |
| Home, beneficios | Oro Certificado LBMA: "con certificación LBMA, el estándar global más alto" | Oro con Estándar LBMA: "barras que cumplen el estándar Good Delivery de la LBMA, según Tether Gold" |
| Home, respaldo | Puedes pedir tu oro en físico cuando quieras | Si reúnes un lingote completo, puedes canjearlo con Tether Gold |
| Home, confianza | Puedes Pedirlo en Físico: envío a tu domicilio | Canje por Lingotes: lingote completo con Tether Gold, entrega en Suiza, sin fecha fija, coordinado con el equipo |
| Home, confianza | (no había fuentes) | Párrafo "Quién es quién" con un link a los informes de Tether Gold y a Transparencia |
| Home, FAQ | certificado bajo estándares LBMA / certificado LBMA | barras con estándar Good Delivery de la LBMA / estándar LBMA |
| Invertir | LBMA "Oro certificado"; "Bóveda certificada"; "barras acreditadas"; "certificado LBMA" | "Estándar de las barras"; "Bóveda en Suiza"; "estándar Good Delivery"; "barras con estándar LBMA" |
| JsonLD | Referencia LBMA | Oro de Tether Gold (XAUT) en barras con estándar Good Delivery de la LBMA |
| Transparencia, H1 y meta | custodia, spread y auditorías / Cómo custodiamos tu oro | informes de reservas / Quién custodia tu oro |
| Transparencia, sección 3 | Realizamos auditorías con BDO; BDO verifica el seguro; 99,99%; "el más grande del mundo" | Lista de quién es quién; informe de Tether Gold revisado por BDO; links a gold.tether.to, /faq y /reports |
| Transparencia, FAQ | auditor verifica "el total vendido a usuarios" | informe de Tether Gold: oro suficiente para los XAUT emitidos; no es una auditoría de Aura |
| Transparencia, compromisos | Auditorías publicadas: "serán públicos" | Informes de reservas de Tether Gold, revisados por BDO Italia |
| Blog (9 posts) | bóvedas certificadas / certificado LBMA / auditorías de Aura | Tether Gold (XAUT), barras con estándar LBMA, bóvedas en Suiza, informes del emisor |

## Fuera de este PR

- **Tres frases que siguen diciendo "certificada" o "certificado (LBMA)"**:
  - `invertir-en-oro-mexico.astro`, nota de la tabla comparativa: "Custodia certificada LBMA".
  - `invertir-en-oro-mexico.astro`, subtítulo del hero: "custodia certificada".
  - `calculadora-inflacion-oro.astro`, FAQ: "certificado (LBMA)".

  Están en las mismas líneas que cambian WEB-007 (#45) y WEB-001 (#44), o en las de al lado. Si las cambio
  acá, los PRs chocan. Van en un PR chico después de mergear #44 y #45.
- **Pendientes de evidencia del cliente**: seguro, activo segregado y titularidad, dirección (wallet) del
  usuario, Chainlink, "24k", y lo que cubre la comisión. Hasta tener la evidencia, esas frases no se tocan.
