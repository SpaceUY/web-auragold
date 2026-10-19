// Additive context for aura_acq v1. No full URL, query, search terms or user data.
export const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
export const CLICK_ID_FIELD = 'gclid';

const MAX_VALUE_LENGTH = 100;
const SEARCH_HOSTS = new Map([
  ['google.com', 'google'], ['google.com.mx', 'google'], ['google.es', 'google'],
  ['google.com.ar', 'google'], ['google.com.uy', 'google'],
  ['bing.com', 'bing'], ['duckduckgo.com', 'duckduckgo'],
  ['search.yahoo.com', 'yahoo'], ['search.brave.com', 'brave'], ['ecosia.org', 'ecosia'],
]);
const PUBLIC_PATH = /^\/(?:|invertir-en-oro-mexico|precio-del-oro-hoy|calculadora-inflacion-oro|transparencia|terminos-y-condiciones|politicas-de-privacidad|blog(?:\/[a-z0-9-]+)?|categorias\/[a-z0-9-]+|autores\/[a-z0-9-]+)\/?$/;

export function isSafeValue(field, value) {
  if (typeof value !== 'string' || !value || value.length > MAX_VALUE_LENGTH) return false;
  if (/[\r\n\t@]/.test(value) || /0x[0-9a-f]{8,}/i.test(value)) return false;
  return field === CLICK_ID_FIELD ? /^[\w-]+$/.test(value) : !/\d{7,}/.test(value);
}

function entryPath(pathname) {
  if (typeof pathname !== 'string' || pathname.length > 200) return undefined;
  if (/\d{7,}|0x[0-9a-f]{8,}/i.test(pathname)) return undefined;
  return PUBLIC_PATH.test(pathname) ? pathname : undefined;
}

function referringSource(referrer) {
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'auragold.io' || host.endsWith('.auragold.io')) return null;
    // Keep a domain only. Never store the referrer's path, query or fragment.
    if (!/^[a-z0-9.-]+$/.test(host) || !isSafeValue('referrer_host', host)) return null;
    const engine = SEARCH_HOSTS.get(host);
    return {
      utm_source: engine ?? host,
      utm_medium: engine ? 'organic' : 'referral',
      source_type: engine ? 'organic' : 'referral',
      referrer_host: host,
    };
  } catch {
    return null;
  }
}

export function acquisitionTouch({ search = '', pathname = '', referrer = '', consent }) {
  if (consent?.analytics !== true) return null;
  const params = new URLSearchParams(search);
  const fields = consent.ads === true ? [...UTM_FIELDS, CLICK_ID_FIELD] : UTM_FIELDS;
  const tagged = {};
  for (const field of fields) {
    const value = params.get(field)?.trim();
    if (isSafeValue(field, value)) tagged[field] = value;
  }
  const hasTaggedQuery = [...UTM_FIELDS, CLICK_ID_FIELD].some((field) => params.has(field));
  const touch = Object.keys(tagged).length
    ? { ...tagged, source_type: 'tagged' }
    // An invalid or unconsented campaign is unknown, not an inferred organic visit.
    : hasTaggedQuery ? null : referringSource(referrer);
  if (!touch) return null;
  const path = entryPath(pathname);
  return path ? { ...touch, entry_path: path } : touch;
}

export function panelAcquisitionContext(stored) {
  if (stored?.v !== 1) return {};
  const touch = stored.last_non_direct;
  if (!touch || typeof touch !== 'object') return {};
  const context = {};
  for (const field of UTM_FIELDS) {
    if (isSafeValue(field, touch[field])) context[field] = touch[field];
  }
  if (['tagged', 'organic', 'referral'].includes(touch.source_type)) context.source_type = touch.source_type;
  const path = entryPath(touch.entry_path);
  if (path) context.entry_path = path;
  if (typeof touch.referrer_host === 'string' && /^[a-z0-9.-]+$/.test(touch.referrer_host) &&
      isSafeValue('referrer_host', touch.referrer_host)) context.referrer_host = touch.referrer_host;
  return context;
}
