// Pruebas de WEB-012A sobre el módulo del Anexo B (src/lib/openpanel/openpanel.js),
// con un navegador y un SDK simulados. Cubren lo que pide el PDF: rechazo, permiso,
// revocación durante la carga y caída de la API. Las pruebas simuladas no alcanzan
// para decir que funciona en producción: eso se verifica en el panel de OpenPanel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuraAnalytics } from "../src/lib/openpanel/openpanel.js";

const CLIENT_ID = "cliente-de-prueba";

function fakeBrowser({ protocol = "https:", hostname = "auragold.io", pathname = "/", search = "", hash = "" } = {}) {
  return {
    location: {
      protocol, hostname, pathname, search, hash,
      reloads: 0,
      reload() { this.reloads += 1; },
    },
  };
}

// SDK simulado: guarda lo que pasa el filtro del módulo, como haría el SDK real.
function fakeSdk() {
  const instances = [];
  class OpenPanel {
    constructor(options) {
      this.options = options;
      this.queue = [];
      this.sent = [];
      instances.push(this);
    }
    send(request) {
      this.queue.push(request);
      if (this.options.filter(request)) this.sent.push(request);
    }
    screenView(path, properties) {
      this.send({ type: "track", payload: { name: "screen_view", properties: { ...properties, __path: path } } });
    }
    track(name, properties) {
      this.send({ type: "track", payload: { name, properties } });
    }
  }
  return { instances, loadSdk: async () => ({ OpenPanel }) };
}

function setup({ browser = fakeBrowser(), sdk = fakeSdk(), enabled = true, clientId = CLIENT_ID, getContext, replayReady } = {}) {
  const analytics = createAuraAnalytics({ clientId, enabled, replayReady, loadSdk: sdk.loadSdk, browser, getContext });
  return { analytics, sdk, browser };
}

test("rechazo: sin consentimiento de analítica no se carga el SDK", async () => {
  const { analytics, sdk } = setup();
  await analytics.setConsent({ analytics: false, replay: false });
  assert.equal(sdk.instances.length, 0);
});

test("permiso: con analítica se carga una vez y manda una vista de página", async () => {
  const { analytics, sdk } = setup();
  await analytics.setConsent({ analytics: true, replay: false });
  await analytics.setConsent({ analytics: true, replay: false });
  assert.equal(sdk.instances.length, 1);
  const [op] = sdk.instances;
  assert.equal(op.options.apiUrl, "https://openpanel-api.1930.dev");
  assert.equal(op.options.clientId, CLIENT_ID);
  assert.equal(op.options.sessionReplay.enabled, false, "replayReady=false: sin grabación");
  assert.equal(op.sent.length, 1);
  assert.equal(op.sent[0].payload.name, "screen_view");
});

test("revocación durante la carga: si se revoca antes de que termine el import, no se activa", async () => {
  let release;
  const sdk = fakeSdk();
  const slowSdk = { instances: sdk.instances, loadSdk: () => new Promise((resolve) => { release = () => resolve(sdk.loadSdk()); }) };
  const { analytics } = setup({ sdk: slowSdk });
  const loading = analytics.setConsent({ analytics: true, replay: false });
  await analytics.setConsent({ analytics: false, replay: false });
  release();
  await loading;
  assert.equal(sdk.instances.length, 0);
});

test("revocación después de cargar: vacía la cola, deja de enviar y recarga la página", async () => {
  const { analytics, sdk, browser } = setup();
  await analytics.setConsent({ analytics: true, replay: false });
  const [op] = sdk.instances;
  await analytics.setConsent({ analytics: false, replay: false });
  assert.equal(op.queue.length, 0);
  assert.equal(browser.location.reloads, 1);
  const before = op.sent.length;
  analytics.track("click_download", { cta_id: "download-header" });
  assert.equal(op.sent.length, before, "después de revocar no se envía nada");
});

test("caída de la API: si el import falla, no rompe y queda inactivo", async () => {
  const brokenSdk = { instances: [], loadSdk: async () => { throw new Error("API caída"); } };
  const { analytics } = setup({ sdk: brokenSdk });
  await assert.doesNotReject(analytics.setConsent({ analytics: true, replay: false }));
  assert.equal(analytics.track("click_download", { cta_id: "x" }), undefined);
});

test("eventos y campos: solo se mandan los permitidos, sin datos personales", async () => {
  const { analytics, sdk } = setup({ getContext: () => ({ environment: "production", email: "a@b.com" }) });
  await analytics.setConsent({ analytics: true, replay: false });
  const [op] = sdk.instances;
  analytics.track("click_download", {
    cta_id: "download-header-mobile", cta_position: "header-mobile", destination: "google_play",
    landing_path: "/", phone: "5512345678", utm_source: "google",
  });
  analytics.track("evento_no_permitido", { cta_id: "x" });
  const clicks = op.sent.filter((request) => request.payload.name === "click_download");
  assert.equal(clicks.length, 1);
  const properties = clicks[0].payload.properties;
  assert.equal(properties.cta_id, "download-header-mobile");
  assert.equal(properties.utm_source, "google");
  assert.equal(properties.environment, "production");
  assert.equal(properties.email, undefined);
  assert.equal(properties.phone, undefined);
  assert.equal(properties.__referrer, "", "no se manda la URL de referencia completa");
  assert.equal(op.sent.some((request) => request.payload.name === "evento_no_permitido"), false);
});

test("entorno: no se activa fuera de https, fuera de los dominios de Aura, sin Client ID o fuera de producción", async () => {
  for (const options of [
    { browser: fakeBrowser({ protocol: "http:" }) },
    { browser: fakeBrowser({ hostname: "localhost" }) },
    { browser: fakeBrowser({ hostname: "auragold-preview.vercel.app" }) },
    { clientId: "" },
    { enabled: false },
  ]) {
    const { analytics, sdk } = setup(options);
    await analytics.setConsent({ analytics: true, replay: false });
    assert.equal(sdk.instances.length, 0, JSON.stringify(options));
  }
});

// WEB-012B: el replay sigue apagado en producción (replayReady=false). Estas pruebas
// lo encienden en el módulo para comprobar qué visitas graba y qué URLs manda.
async function replaySession(location) {
  const { analytics, sdk } = setup({ browser: fakeBrowser(location), replayReady: true });
  await analytics.setConsent({ analytics: true, replay: true });
  return sdk.instances[0];
}

function sendReplayChunk(op, events) {
  op.send({ type: "replay", payload: { chunk_index: 0, payload: typeof events === "string" ? events : JSON.stringify(events) } });
  return op.sent.filter((request) => request.type === "replay");
}

test("replay: graba visitas con UTM válidos y gclid en las páginas permitidas", async () => {
  for (const search of ["", "?utm_source=google&utm_medium=cpc&utm_campaign=qa", "?utm_campaign=qa&gclid=QA_LOCAL_ONLY"]) {
    const op = await replaySession({ pathname: "/invertir-en-oro-mexico", search });
    assert.equal(op.options.sessionReplay.enabled, true, search);
  }
});

test("replay: no graba con otros parámetros, valores rechazados, hash o páginas fuera de la lista", async () => {
  for (const location of [
    { search: "?utm_campaign=qa&token=secreto" },
    { search: "?utm_campaign=persona%40example.org" },
    { search: "?utm_term=5512345678" },
    { search: "?utm_campaign=" },
    { search: "?utm_campaign=qa", hash: "#faq" },
    { pathname: "/blog/oro-vs-cetes", search: "?utm_campaign=qa" },
  ]) {
    const op = await replaySession(location);
    assert.equal(op.options.sessionReplay.enabled, false, JSON.stringify(location));
  }
});

test("replay: los fragmentos no llevan query ni hash de ninguna URL", async () => {
  const op = await replaySession({ search: "?utm_campaign=qa&gclid=QA_LOCAL_ONLY" });
  const [sent] = sendReplayChunk(op, [
    { type: 4, data: { href: "https://auragold.io/?utm_campaign=qa&gclid=QA_LOCAL_ONLY", width: 390, height: 844 } },
    { type: 3, data: { source: 0, attributes: [{ id: 7, attributes: {
      href: "https://play.google.com/store/apps/details?id=com.space.aura&referrer=gclid%3DQA_LOCAL_ONLY",
      class: "cta",
    } }] } },
  ]);
  const events = JSON.parse(sent.payload.payload);
  assert.equal(events[0].data.href, "https://auragold.io/");
  assert.equal(events[0].data.width, 390);
  assert.equal(events[1].data.attributes[0].attributes.href, "https://play.google.com/store/apps/details");
  assert.equal(events[1].data.attributes[0].attributes.class, "cta");
  assert.equal(sent.payload.payload.includes("QA_LOCAL_ONLY"), false);
});

test("replay: un fragmento ilegible se descarta y no se envía", async () => {
  const op = await replaySession({});
  assert.equal(sendReplayChunk(op, "{no es json").length, 0);
});

test("replay: sin consentimiento de grabación no se envían fragmentos", async () => {
  const { analytics, sdk } = setup({ replayReady: true });
  await analytics.setConsent({ analytics: true, replay: false });
  const [op] = sdk.instances;
  assert.equal(op.options.sessionReplay.enabled, false);
  assert.equal(sendReplayChunk(op, [{ type: 4, data: { href: "https://auragold.io/" } }]).length, 0);
});
