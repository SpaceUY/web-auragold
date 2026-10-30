// Dispositivo del visitante, para elegir la tienda de cada botón de la app.
// Lo comparten los scripts de AppDownloadLink, AppStartLink y AppDownloadDialog.
export type Platform = "android" | "ios" | "desktop";

export function detectPlatform(): Platform {
  const userAgent = navigator.userAgent;
  if (/Android/i.test(userAgent)) return "android";
  // iPadOS se presenta como Mac; se distingue por la pantalla táctil.
  const isIpadOs = /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(userAgent) || isIpadOs) return "ios";
  return "desktop";
}
