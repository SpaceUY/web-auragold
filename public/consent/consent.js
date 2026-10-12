/*!
 * Aura Gold: banner de consentimiento de cookies (CMP).
 *
 * Lo cargan auragold.io y app.auragold.io. La elección se guarda en la cookie
 * `aura_consent` del dominio .auragold.io, así quien acepta en un sitio no
 * vuelve a ver el banner en el otro. Contrato completo: docs/cmp-contrato.md
 *
 * Sin respuesta no se carga nada: GTM (GA4, Google Ads, Clarity) se inyecta
 * recién cuando el visitante acepta analítica o publicidad.
 */
(function () {
  "use strict";

  if (window.auraConsent) return;

  var COOKIE_NAME = "aura_consent";
  // Subir la versión obliga a volver a preguntar (por ejemplo, si cambia la política).
  var COOKIE_VERSION = 1;
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
  var POLICY_URL = "https://auragold.io/politicas-de-privacidad#cookies";
  var CATEGORIES = ["analytics", "ads", "replay"];

  var script = document.currentScript;
  var gtmId = script ? script.getAttribute("data-gtm-id") : null;

  window.dataLayer = window.dataLayer || [];
  // Consent Mode exige el objeto `arguments`, no un array.
  function gtag() {
    window.dataLayer.push(arguments);
  }

  function normalize(choice) {
    return {
      analytics: Boolean(choice && choice.analytics === true),
      ads: Boolean(choice && choice.ads === true),
      replay: Boolean(choice && choice.replay === true),
    };
  }

  function sameChoice(first, second) {
    if (!first || !second) return first === second;
    return CATEGORIES.every(function (key) {
      return first[key] === second[key];
    });
  }

  function anyGranted(choice) {
    return Boolean(choice) && CATEGORIES.some(function (key) {
      return choice[key];
    });
  }

  // ---------------------------------------------------------------- cookie

  function readCookie() {
    var match = document.cookie.match(/(?:^|;\s*)aura_consent=([^;]*)/);
    if (!match) return null;
    try {
      var stored = JSON.parse(decodeURIComponent(match[1]));
      if (!stored || stored.v !== COOKIE_VERSION) return null;
      return normalize(stored);
    } catch (error) {
      return null;
    }
  }

  // En localhost y en las previews de Vercel la cookie queda en el host actual.
  function cookieDomain() {
    var host = location.hostname;
    var isAuraDomain = host === "auragold.io" || /\.auragold\.io$/.test(host);
    return isAuraDomain ? "; domain=.auragold.io" : "";
  }

  function writeCookie(choice) {
    var payload = {
      v: COOKIE_VERSION,
      analytics: choice.analytics,
      ads: choice.ads,
      replay: choice.replay,
      ts: Math.floor(Date.now() / 1000),
    };
    document.cookie =
      COOKIE_NAME +
      "=" +
      encodeURIComponent(JSON.stringify(payload)) +
      "; path=/; max-age=" +
      COOKIE_MAX_AGE +
      "; SameSite=Lax" +
      cookieDomain() +
      (location.protocol === "https:" ? "; Secure" : "");
  }

  // Al revocar, se borran las cookies que ya dejó cada herramienta.
  var TRACKING_COOKIES = {
    analytics: /^(_ga|_gid|_gat)/,
    ads: /^(_gcl|_gac)/,
    replay: /^(_clck|_clsk)$/,
  };

  function clearCookies(pattern) {
    var host = location.hostname;
    var domains = ["", "; domain=" + host, "; domain=." + host, cookieDomain()];
    document.cookie.split(";").forEach(function (pair) {
      var name = pair.split("=")[0].trim();
      if (!pattern.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie = name + "=; path=/; max-age=0" + domain;
      });
    });
  }

  // ------------------------------------------------- Google Consent Mode + GTM

  function googleConsent(choice) {
    var adsState = choice && choice.ads ? "granted" : "denied";
    return {
      analytics_storage: choice && choice.analytics ? "granted" : "denied",
      ad_storage: adsState,
      ad_user_data: adsState,
      ad_personalization: adsState,
    };
  }

  // Variables para GTM: la etiqueta de Clarity usa aura_consent_replay.
  function pushConsentEvent(eventName, choice) {
    window.dataLayer.push({
      event: eventName,
      aura_consent_analytics: choice.analytics,
      aura_consent_ads: choice.ads,
      aura_consent_replay: choice.replay,
    });
  }

  var gtmLoaded = false;

  function loadGtm(choice) {
    if (gtmLoaded || !gtmId || !choice || !(choice.analytics || choice.ads)) return;
    gtmLoaded = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(gtmId);
    document.head.appendChild(tag);
    pushConsentEvent("aura_consent_ready", choice);
  }

  // ------------------------------------------------------------- estado + API

  var current = readCookie();
  var listeners = [];

  var defaults = googleConsent(current);
  defaults.wait_for_update = 500;
  gtag("consent", "default", defaults);

  function notify(choice) {
    listeners.slice().forEach(function (listener) {
      try {
        listener(normalize(choice));
      } catch (error) {
        // Un suscriptor que falla no puede frenar a los demás ni la navegación.
      }
    });
  }

  function revoked(previous, next) {
    return (
      Boolean(previous) &&
      CATEGORIES.some(function (key) {
        return previous[key] && !next[key];
      })
    );
  }

  // Orden pedido por el PDF: primero se guarda, después se avisa.
  function apply(previous, next) {
    gtag("consent", "update", googleConsent(next));
    pushConsentEvent("aura_consent_update", next);
    notify(next);
    // Lo que ya se cargó (GTM, Clarity, OpenPanel) no se puede descargar: se recarga.
    if (revoked(previous, next)) {
      CATEGORIES.forEach(function (key) {
        if (previous[key] && !next[key]) clearCookies(TRACKING_COOKIES[key]);
      });
      location.reload();
      return;
    }
    loadGtm(next);
  }

  function save(choice) {
    var previous = current;
    var next = normalize(choice);
    current = next;
    writeCookie(next);
    hide();
    if (sameChoice(previous, next)) return;
    apply(previous, next);
  }

  // Si la elección cambió en el otro sitio (otra pestaña), se toma al volver.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    var stored = readCookie();
    if (sameChoice(stored, current)) return;
    var previous = current;
    current = stored;
    if (!stored) {
      if (anyGranted(previous)) location.reload();
      else show(false);
      return;
    }
    hide();
    apply(previous, stored);
  });

  window.auraConsent = {
    get: function () {
      return current ? normalize(current) : null;
    },
    subscribe: function (listener) {
      if (typeof listener !== "function") return function () {};
      listeners.push(listener);
      return function () {
        listeners = listeners.filter(function (item) {
          return item !== listener;
        });
      };
    },
    open: function () {
      show(true);
    },
  };

  loadGtm(current);

  // ----------------------------------------------------------------- interfaz

  var STYLES =
    ".acb{position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;color:#fff;font-family:var(--font-body,inherit);-webkit-font-smoothing:antialiased}" +
    "@media (min-width:810px){.acb{left:24px;right:auto;bottom:24px;width:28rem}}" +
    ".acb[hidden],.acb [hidden]{display:none!important}" +
    ".acb *{box-sizing:border-box}" +
    ".acb-card{max-height:calc(100vh - 32px);overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:#101010;padding:24px;box-shadow:0 24px 60px -16px rgba(0,0,0,.8)}" +
    ".acb-title{margin:0;font-family:var(--font-display,inherit);font-size:16px;font-weight:600;line-height:24px;letter-spacing:-.01em;color:#fff}" +
    ".acb-text{margin:8px 0 0;font-size:13px;line-height:20px;color:rgba(255,255,255,.7)}" +
    ".acb-link{color:#f2b334;text-decoration:underline;text-underline-offset:2px}" +
    ".acb-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}" +
    ".acb-btn{margin:0;cursor:pointer;border-radius:999px;padding:10px 16px;font:inherit;font-size:14px;font-weight:500;line-height:20px;transition:background-color .15s,opacity .15s}" +
    ".acb-btn--gold{border:1px solid #f2b334;background:#f2b334;color:#090909}" +
    ".acb-btn--gold:hover{opacity:.9}" +
    ".acb-btn--ghost{border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff}" +
    ".acb-btn--ghost:hover{background:rgba(255,255,255,.1)}" +
    ".acb-text-btn{display:block;margin:8px auto 0;cursor:pointer;border:0;background:none;padding:4px 8px;font:inherit;font-size:13px;line-height:20px;color:rgba(255,255,255,.7);text-decoration:underline;text-underline-offset:2px}" +
    ".acb-text-btn:hover{color:#fff}" +
    ".acb-list{margin:16px 0 0;padding:0;list-style:none}" +
    ".acb-item{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-top:1px solid rgba(255,255,255,.1);padding:12px 0;cursor:pointer}" +
    ".acb-item--fixed{cursor:default}" +
    ".acb-item-name{display:block;font-size:14px;font-weight:500;line-height:20px;color:#fff}" +
    ".acb-item-text{display:block;margin-top:2px;font-size:12px;line-height:18px;color:rgba(255,255,255,.6)}" +
    ".acb-switch{position:relative;flex:none;width:40px;height:24px;margin:0;cursor:pointer;appearance:none;-webkit-appearance:none;border-radius:999px;background:rgba(255,255,255,.2);transition:background-color .15s}" +
    ".acb-switch::before{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s}" +
    ".acb-switch:checked{background:#f2b334}" +
    ".acb-switch:checked::before{transform:translateX(16px);background:#090909}" +
    ".acb-badge{flex:none;font-size:12px;font-weight:500;line-height:20px;color:#f2b334}" +
    ".acb-prefs-actions{margin-top:16px}" +
    ".acb-prefs-actions .acb-btn{width:100%}" +
    ".acb :focus-visible{outline:2px solid #f2b334;outline-offset:2px}" +
    "@media (prefers-reduced-motion:no-preference){.acb-card{animation:acb-in .35s cubic-bezier(.16,1,.3,1)}" +
    "@keyframes acb-in{from{opacity:0;transform:translateY(12px)}}}";

  // Todo el contenido es fijo (no hay datos del visitante): innerHTML es seguro acá.
  var MARKUP =
    '<div class="acb-card">' +
    '<div data-acb-view="main">' +
    '<h2 class="acb-title" id="acb-title">Tu privacidad</h2>' +
    '<p class="acb-text" id="acb-text">Usamos cookies para medir cómo se usa el sitio y mejorar nuestras campañas. ' +
    "Solo las activamos si aceptas, y puedes cambiar tu elección cuando quieras. " +
    '<a class="acb-link" href="' + POLICY_URL + '">Más información</a></p>' +
    '<div class="acb-actions">' +
    '<button type="button" class="acb-btn acb-btn--ghost" data-acb-action="reject">Rechazar</button>' +
    '<button type="button" class="acb-btn acb-btn--gold" data-acb-action="accept">Aceptar</button>' +
    "</div>" +
    '<button type="button" class="acb-text-btn" data-acb-action="configure">Configurar</button>' +
    "</div>" +
    '<div data-acb-view="prefs" hidden>' +
    '<h2 class="acb-title" id="acb-prefs-title">Configurar cookies</h2>' +
    '<p class="acb-text">Elige qué cookies aceptas. Puedes cambiarlo cuando quieras desde "Configurar cookies", al pie de la página.</p>' +
    '<ul class="acb-list">' +
    '<li class="acb-item acb-item--fixed"><span><span class="acb-item-name">Necesarias</span>' +
    '<span class="acb-item-text">Guardan tu elección de cookies.</span></span>' +
    '<span class="acb-badge">Siempre activas</span></li>' +
    '<li><label class="acb-item"><span><span class="acb-item-name">Analítica</span>' +
    '<span class="acb-item-text">Nos ayudan a entender cómo se usa el sitio (Google Analytics).</span></span>' +
    '<input type="checkbox" class="acb-switch" data-acb-category="analytics"></label></li>' +
    '<li><label class="acb-item"><span><span class="acb-item-name">Publicidad</span>' +
    '<span class="acb-item-text">Miden el resultado de nuestros anuncios (Google Ads).</span></span>' +
    '<input type="checkbox" class="acb-switch" data-acb-category="ads"></label></li>' +
    '<li><label class="acb-item"><span><span class="acb-item-name">Grabación de sesiones</span>' +
    '<span class="acb-item-text">Graban cómo navegas el sitio para encontrar problemas de diseño (Microsoft Clarity).</span></span>' +
    '<input type="checkbox" class="acb-switch" data-acb-category="replay"></label></li>' +
    "</ul>" +
    '<div class="acb-prefs-actions">' +
    '<button type="button" class="acb-btn acb-btn--gold" data-acb-action="save">Guardar selección</button>' +
    '<button type="button" class="acb-text-btn" data-acb-action="cancel" hidden>Cancelar</button>' +
    "</div>" +
    "</div>" +
    "</div>";

  var root = null;
  // Al pasar a "Configurar", "Guardar selección" queda casi donde estaba el botón
  // anterior: un doble toque no puede guardar sin que el visitante lo vea.
  var SWITCH_GUARD_MS = 400;
  var lastViewSwitch = 0;

  function build() {
    if (root) return root;

    var style = document.createElement("style");
    style.id = "aura-consent-style";
    style.textContent = STYLES;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.className = "acb";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "false");
    root.setAttribute("aria-labelledby", "acb-title");
    root.setAttribute("aria-describedby", "acb-text");
    root.hidden = true;
    root.innerHTML = MARKUP;
    // Primero en el documento: con teclado (Tab) es lo primero que se alcanza.
    document.body.prepend(root);

    root.addEventListener("click", function (event) {
      var button = event.target.closest("[data-acb-action]");
      if (!button) return;
      var action = button.getAttribute("data-acb-action");
      var justSwitched = Date.now() - lastViewSwitch < SWITCH_GUARD_MS;
      if ((action === "save" || action === "cancel") && justSwitched) return;
      if (action === "accept") save({ analytics: true, ads: true, replay: true });
      else if (action === "reject") save({ analytics: false, ads: false, replay: false });
      else if (action === "configure") showView("prefs", true);
      else if (action === "save") save(readSwitches());
      else if (action === "cancel") hide();
    });

    return root;
  }

  function readSwitches() {
    var choice = {};
    root.querySelectorAll("[data-acb-category]").forEach(function (input) {
      choice[input.getAttribute("data-acb-category")] = input.checked;
    });
    return choice;
  }

  function showView(view, moveFocus) {
    var isPrefs = view === "prefs";
    lastViewSwitch = Date.now();
    root.querySelector('[data-acb-view="main"]').hidden = isPrefs;
    root.querySelector('[data-acb-view="prefs"]').hidden = !isPrefs;
    root.setAttribute("aria-labelledby", isPrefs ? "acb-prefs-title" : "acb-title");
    if (isPrefs) {
      root.removeAttribute("aria-describedby");
      var choice = current || normalize(null);
      root.querySelectorAll("[data-acb-category]").forEach(function (input) {
        input.checked = choice[input.getAttribute("data-acb-category")];
      });
      // Sin elección previa no hay nada que cancelar: hay que guardar algo.
      root.querySelector('[data-acb-action="cancel"]').hidden = !current;
    } else {
      root.setAttribute("aria-describedby", "acb-text");
    }
    if (moveFocus) {
      var target = root.querySelector(isPrefs ? "[data-acb-category]" : "[data-acb-action]");
      if (target) target.focus();
    }
  }

  // `fromVisitor`: lo abrió el visitante (footer o "Configurar"), se le lleva el foco.
  // Al aparecer solo en la primera visita no se roba el foco: el banner no es modal.
  function show(fromVisitor) {
    build();
    root.hidden = false;
    showView(fromVisitor ? "prefs" : "main", fromVisitor);
  }

  function hide() {
    if (root) root.hidden = true;
  }

  // Cualquier elemento con data-aura-consent-open abre las preferencias (footer, webapp).
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest && event.target.closest("[data-aura-consent-open]");
    if (!trigger) return;
    event.preventDefault();
    show(true);
  });

  function start() {
    if (!current) show(false);
    window.dispatchEvent(new CustomEvent("auraconsent:ready", { detail: window.auraConsent.get() }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
