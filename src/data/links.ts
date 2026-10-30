// Enlaces externos que aparecen en más de un lugar del sitio.
// Las fichas de Play Store y del App Store se usan en el header, en los botones
// del hero y en el sameAs del JSON-LD: conviene que existan una sola vez.
export const ANDROID_APP_URL = "https://play.google.com/store/apps/details?id=com.space.aura";

// Ficha de la tienda de México (el mercado principal). El App Store no tiene
// un equivalente al `referrer` de Play: el link va sin parámetros.
export const IOS_APP_URL = "https://apps.apple.com/mx/app/aura-gold-invertir-en-oro/id6812486466";

// La raíz de la web app decide sola a dónde mandar: al login/registro (un
// único flujo) si no hay sesión, o directo a /home si el usuario ya entró
// antes. Por eso se enlaza la raíz y no /sign-in.
export const WEB_APP_URL = "https://app.auragold.io/";

// Play Store reenvía el parámetro `referrer` a la app al instalarse (Install
// Referrer API): así se puede medir qué botón del sitio trajo cada descarga.
export function playStoreUrl(medium: string): string {
  const referrer = new URLSearchParams({ utm_source: "auragold.io", utm_medium: medium }).toString();
  return `${ANDROID_APP_URL}&referrer=${encodeURIComponent(referrer)}`;
}
