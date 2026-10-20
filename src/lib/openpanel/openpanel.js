// Anexo B del PDF de pedidos de ingeniería (WEB-012A, págs. 19-21). WEB-012B
// admite visitas con UTM en el replay y quita query y hash de sus URLs.
// Bundle with @openpanel/web@1.4.1. Instantiate once in the browser.
import { isSafeValue, UTM_FIELDS, CLICK_ID_FIELD } from '../acquisition/context.mjs';
const API_URL = 'https://openpanel-api.1930.dev';
const HOSTS = new Set(['auragold.io', 'www.auragold.io', 'app.auragold.io']);
const REPLAY_PATHS = new Set(['/', '/invertir-en-oro-mexico']);
const REPLAY_QUERY_FIELDS = new Set([...UTM_FIELDS, CLICK_ID_FIELD]);
const ABSOLUTE_URL_WITH_QUERY = /^https?:\/\/[^?#\s]*[?#]/i;
const EVENTS = new Set([
  'experiment_exposure', 'click_open_web', 'click_download',
  'faq_open', 'scroll_depth', 'sign_up', 'kyc_completed', 'begin_checkout',
]);
const FIELDS = new Set([
  'experiment_id', 'variant_id', 'assignment_id', 'exposure_id',
  'cta_id', 'cta_position', 'destination', 'landing_path',
  'faq_position', 'scroll_percent', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_content', 'utm_term', 'environment',
  'entry_path', 'source_type', 'referrer_host',
]);
function safeFields(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) =>
    FIELDS.has(key) && (typeof value === 'number' ||
      (typeof value === 'string' && value.length <= 200 && !/[\r\n]/.test(value)))));
}
// Only validated campaign labels may appear in a replayed visit's query.
function isReplaySafeQuery(search) {
  return [...new URLSearchParams(search)].every(([key, value]) =>
    REPLAY_QUERY_FIELDS.has(key) && isSafeValue(key, value));
}
// rrweb stores the page href and link attributes, such as the Play referrer
// that carries gclid. Keep origin and path only.
function withoutUrlQuery(key, value) {
  return typeof value === 'string' && ABSOLUTE_URL_WITH_QUERY.test(value)
    ? value.replace(/[?#][\s\S]*$/, '') : value;
}
function sanitizeReplayChunk(chunk) {
  try {
    chunk.payload = JSON.stringify(JSON.parse(chunk.payload, withoutUrlQuery));
    return true;
  } catch {
    return false; // An unreadable chunk is dropped, never sent unsanitized.
  }
}
export function createAuraAnalytics({
  clientId, enabled = false, replayReady = false, getContext = () => ({}),
  loadSdk = () => import('@openpanel/web'), browser = window,
}) {
  let op = null, active = false, generation = 0;
  let consent = { analytics: false, replay: false };
  let replayStarted = false;
  const eligible = () => enabled && Boolean(clientId) &&
    browser.location.protocol === 'https:' && HOSTS.has(browser.location.hostname);
  const canReplay = () => replayReady && consent.replay &&
    browser.location.hostname !== 'app.auragold.io' &&
    REPLAY_PATHS.has(browser.location.pathname.replace(/\/$/, '') || '/') &&
    isReplaySafeQuery(browser.location.search) && !browser.location.hash;
  function allowPayload(request) {
    if (!active || !consent.analytics) return false;
    if (request.type === 'replay') {
      return replayStarted && consent.replay && sanitizeReplayChunk(request.payload);
    }
    if (request.type !== 'track') return false;
    const props = request.payload.properties || {};
    request.payload.properties = {
      ...safeFields(props), __path: browser.location.pathname,
      __referrer: '', // Do not collect the full incoming referrer URL.
    };
    return true;
  }
  async function setConsent(next) {
    const revision = ++generation;
    const previous = consent;
    consent = { analytics: next.analytics === true, replay: next.replay === true };
    if (op && (!consent.analytics || previous.replay !== consent.replay)) {
      active = false;
      op.queue.length = 0;
      // This SDK has no public recorder-destroy method. CMP must persist first.
      browser.location.reload();
      return;
    }
    if (op || !eligible() || !consent.analytics) return;
    try {
      const { OpenPanel } = await loadSdk();
      if (revision !== generation || !consent.analytics || !eligible()) return;
      replayStarted = canReplay();
      active = true;
      op = new OpenPanel({
        apiUrl: API_URL, clientId, trackScreenViews: false,
        trackOutgoingLinks: false, trackAttributes: false, filter: allowPayload,
        sessionReplay: {
          enabled: replayStarted, sampleRate: 1,
          maskAllInputs: true, maskAllText: true,
          unmaskTextSelector: '[data-openpanel-unmask]',
          blockSelector: '[data-openpanel-replay-block], form, [data-sensitive]',
          ignoreSelector: '[data-openpanel-replay-block], form, [data-sensitive]',
          flushIntervalMs: 10000,
        },
      });
      op.screenView(browser.location.pathname, safeFields(getContext()));
    } catch {
      active = false; op = null;
      // Analytics must never prevent navigation or purchase.
    }
  }
  function track(name, properties = {}) {
    if (!active || !consent.analytics || !EVENTS.has(name)) return;
    return op.track(name, safeFields({ ...getContext(), ...properties }));
  }
  function pageView() {
    if (!active || !consent.analytics) return;
    // Hard navigation is required before leaving the replay-safe landing.
    if (replayStarted && !canReplay()) {
      active = false; op.queue.length = 0; browser.location.reload(); return;
    }
    op.screenView(browser.location.pathname, safeFields(getContext()));
  }
  return { setConsent, track, pageView };
}
