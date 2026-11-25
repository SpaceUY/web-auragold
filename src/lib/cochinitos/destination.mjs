// WEB-020: a dónde lleva el cochinito de /cochinitos al explotar.
// Con ?ref=<código> va a la invitación de la webapp (app.auragold.io/invite/<código>).
// Sin código válido usa el código de los cochinitos de lanzamiento (LAUNCH_CODE). Las UTM de la visita viajan en el link porque la webapp
// las lee de su propia URL; sin UTM, el origen queda como auragold.io/cochinitos.
import { UTM_FIELDS, isSafeValue } from '../acquisition/context.mjs';

const WEB_APP_URL = 'https://app.auragold.io/';
export const REFERRAL_CODE = /^[A-Za-z0-9_-]{3,32}$/;
// Código de los 100 cochinitos de lanzamiento: el del comunicado y el de quien llega sin código.
export const LAUNCH_CODE = 'T4DWH58N';

export function cochinitoDestination(search) {
  const params = new URLSearchParams(search);
  const ref = (params.get('ref') ?? '').trim();
  const code = REFERRAL_CODE.test(ref) ? ref : LAUNCH_CODE;
  const url = new URL(`invite/${encodeURIComponent(code)}`, WEB_APP_URL);
  for (const field of UTM_FIELDS) {
    const value = params.get(field);
    if (isSafeValue(field, value)) url.searchParams.set(field, value);
  }
  if (!url.searchParams.has('utm_source')) {
    url.searchParams.set('utm_source', 'auragold.io');
    url.searchParams.set('utm_medium', 'cochinitos');
  }
  return { code, launch: code.toUpperCase() === LAUNCH_CODE, href: url.toString() };
}
