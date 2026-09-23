// Enlaces externos que aparecen en más de un lugar del sitio.
// La ficha de Play Store se usa en el header, en el par de botones del hero y
// en el sameAs del JSON-LD: conviene que exista una sola vez.
export const ANDROID_APP_URL = "https://play.google.com/store/apps/details?id=com.space.aura";

// La raíz de la web app decide sola a dónde mandar: al login/registro (un
// único flujo) si no hay sesión, o directo a /home si el usuario ya entró
// antes. Por eso se enlaza la raíz y no /sign-in.
export const WEB_APP_URL = "https://app.auragold.io/";
