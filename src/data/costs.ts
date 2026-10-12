// Costos de Aura Gold (WEB-005). Fuente única para el bloque de costos de la
// home, Transparencia, /invertir-en-oro-mexico y las FAQs.
// Comisión confirmada el 12/10/2026: 1% al comprar y 1% al vender, sobre el
// precio internacional de referencia. Es la vigente, no una tarifa garantizada:
// si cambia, se cambia acá.
export const COMMISSION_PERCENT = 1;
export const COMMISSION_LABEL = `${COMMISSION_PERCENT}%`;

// Cargo de un tercero: el canje por lingotes físicos lo cobra Tether Gold, el
// emisor del token, según sus condiciones publicadas (gold.tether.to/faq).
export const REDEMPTION_FEE_LABEL = "0.25% + envío";
export const REDEMPTION_TERMS_URL = "https://gold.tether.to/faq";

// Ejemplo ilustrativo (no es un precio real): se calcula con la comisión vigente.
export const EXAMPLE_PRICE_MXN = 1500;
export const exampleBuyPrice = (price = EXAMPLE_PRICE_MXN) => price * (1 + COMMISSION_PERCENT / 100);
export const exampleSellPrice = (price = EXAMPLE_PRICE_MXN) => price * (1 - COMMISSION_PERCENT / 100);
export const formatMxn = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
