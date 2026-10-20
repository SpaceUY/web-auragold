import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { acquisitionTouch, panelAcquisitionContext, UTM_FIELDS, CLICK_ID_FIELD } from '../src/lib/acquisition/context.mjs';

const allowed = { analytics: true, ads: true };
const visit = (values = {}) => acquisitionTouch({
  consent: allowed, pathname: '/invertir-en-oro-mexico', ...values,
});

test('Google search arrival stores domain and public entry path, without search query', () => {
  const touch = visit({ referrer: 'https://www.google.com.mx/search?q=private-search#fragment' });
  assert.deepEqual(touch, {
    utm_source: 'google', utm_medium: 'organic', source_type: 'organic',
    referrer_host: 'google.com.mx', entry_path: '/invertir-en-oro-mexico',
  });
  assert.equal(JSON.stringify(touch).includes('private-search'), false);
});

test('Search engine matching uses exact hosts, not lookalikes', () => {
  assert.equal(visit({ referrer: 'https://www.bing.com/search?q=private' }).utm_medium, 'organic');
  const lookalike = visit({ referrer: 'https://google.com.example.org/' });
  assert.equal(lookalike.utm_medium, 'referral');
  assert.equal(lookalike.utm_source, 'google.com.example.org');
});

test('Explicit campaign takes precedence over search referrer', () => {
  const touch = visit({ search: '?utm_source=google&utm_medium=cpc&utm_campaign=qa&gclid=QA_LOCAL_ONLY', referrer: 'https://google.com/' });
  assert.equal(touch.source_type, 'tagged');
  assert.equal(touch.utm_medium, 'cpc');
  assert.equal(touch.gclid, 'QA_LOCAL_ONLY');
  assert.equal(touch.referrer_host, undefined);
});

test('Ordinary external referrals store only the domain', () => {
  const touch = visit({ referrer: 'https://www.example.org/private/path?email=person@example.org#secret' });
  assert.equal(touch.utm_source, 'example.org');
  assert.equal(touch.utm_medium, 'referral');
  assert.equal(JSON.stringify(touch).includes('person'), false);
  assert.equal(JSON.stringify(touch).includes('private'), false);
});

test('Absent referrer, internal navigation and unsafe referrers do not invent acquisition', () => {
  for (const referrer of ['', 'not a URL', 'https://auragold.io/blog', 'https://app.auragold.io/home',
    'https://www.auragold.io/', 'javascript:alert(1)', 'https://user:password@example.org/']) {
    assert.equal(visit({ referrer }), null, referrer);
  }
});

test('No acquisition is captured without analytics consent', () => {
  for (const consent of [undefined, null, { analytics: false, ads: true }]) {
    assert.equal(visit({ consent, search: '?utm_campaign=qa', referrer: 'https://google.com/' }), null);
  }
});

test('Ads denial drops GCLID, and a click-ID-only visit stays unknown', () => {
  const consent = { analytics: true, ads: false };
  assert.equal(visit({ consent, search: '?utm_source=google&gclid=QA_LOCAL_ONLY' }).gclid, undefined);
  assert.equal(visit({ consent, search: '?gclid=QA_LOCAL_ONLY', referrer: 'https://google.com/' }), null);
});

test('Rejected campaign values never fall back to inferred organic acquisition', () => {
  for (const search of ['?utm_campaign=person%40example.org', '?utm_term=5512345678', '?utm_content=0xABCDEF123456', '?utm_source=qa%0Aevil']) {
    assert.equal(visit({ search, referrer: 'https://google.com/' }), null);
  }
});

test('Arbitrary queries and non-public or sensitive paths are not stored', () => {
  for (const pathname of ['/sign-in', '/users/person@example.org', '/blog/order-123456789', '/blog/post?token=secret']) {
    const touch = visit({ pathname, search: '?utm_campaign=qa&token=secret&email=person@example.org' });
    assert.equal(touch.token, undefined);
    assert.equal(touch.email, undefined);
    assert.equal(touch.entry_path, undefined);
  }
  assert.equal(visit({ pathname: '/blog/oro-vs-cetes', search: '?utm_campaign=qa' }).entry_path, '/blog/oro-vs-cetes');
});

test('OpenPanel context supports old v1 touches and validates additive metadata', () => {
  assert.deepEqual(panelAcquisitionContext({ v: 1, last_non_direct: { utm_source: 'google', utm_medium: 'cpc' } }), { utm_source: 'google', utm_medium: 'cpc' });
  assert.deepEqual(panelAcquisitionContext({ v: 2, last_non_direct: { utm_source: 'google' } }), {});
  const touch = visit({ referrer: 'https://google.com/' });
  const context = panelAcquisitionContext({ v: 1, last_non_direct: { ...touch, gclid: 'QA_LOCAL_ONLY', email: 'person@example.org' } });
  assert.deepEqual(context, touch);
  assert.equal(context.gclid, undefined);
  assert.equal(panelAcquisitionContext({ v: 1, last_non_direct: { source_type: 'untrusted', entry_path: '/account', referrer_host: 'person@example.org' } }).source_type, undefined);
});

// Exercise the real component script against a cookie jar and consent callbacks.
const component = readFileSync(new URL('../src/components/analytics/AcquisitionHandoff.astro', import.meta.url), 'utf8');
const script = component.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*;$/m, '');
const executable = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export\s*\{\s*\};?/, '');

function runComponent({ cookie, search = '', referrer = '', consent = allowed } = {}) {
  const jar = new Map();
  if (cookie) jar.set('aura_acq', encodeURIComponent(JSON.stringify(cookie)));
  const listeners = [];
  const document = {
    referrer,
    get cookie() { return [...jar].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      if (/max-age=0(?:;|$)/.test(value)) jar.delete(name);
      else jar.set(name, pair.slice(separator + 1));
    },
    addEventListener() {},
  };
  vm.runInNewContext(executable, {
    window: { auraConsent: { get: () => consent, subscribe: (listener) => listeners.push(listener) } },
    location: { hostname: 'auragold.io', protocol: 'https:', pathname: '/blog/oro-vs-cetes', search },
    document, URL, URLSearchParams, acquisitionTouch, UTM_FIELDS, CLICK_ID_FIELD,
  });
  return {
    read: () => jar.has('aura_acq') ? JSON.parse(decodeURIComponent(jar.get('aura_acq'))) : null,
    change: (choice) => listeners.forEach((listener) => listener(choice)),
  };
}

test('Component preserves organic first touch across internal/direct visits and later campaign', () => {
  const first = runComponent({ referrer: 'https://google.com/' }).read();
  assert.equal(first.v, 1);
  assert.equal(first.first_touch.utm_medium, 'organic');
  assert.equal(typeof first.first_touch.ts, 'number');
  assert.deepEqual(runComponent({ cookie: first, referrer: 'https://auragold.io/' }).read(), first);
  assert.deepEqual(runComponent({ cookie: first }).read(), first);
  const later = runComponent({ cookie: first, search: '?utm_source=google&utm_medium=cpc&utm_campaign=qa' }).read();
  assert.deepEqual(later.first_touch, first.first_touch);
  assert.equal(later.last_non_direct.utm_campaign, 'qa');
});

test('Existing v1 campaign acquisition is preserved when organic traffic arrives', () => {
  const previous = { v: 1, first_touch: { utm_campaign: 'original', ts: 1 }, last_non_direct: { utm_campaign: 'original', ts: 1 } };
  const next = runComponent({ cookie: previous, referrer: 'https://www.google.com.mx/' }).read();
  assert.deepEqual(next.first_touch, previous.first_touch);
  assert.equal(next.last_non_direct.utm_medium, 'organic');
});

test('New organic visits wait for consent and are removed on revocation', () => {
  const browser = runComponent({ referrer: 'https://google.com/', consent: null });
  assert.equal(browser.read(), null);
  browser.change({ analytics: true, ads: false });
  assert.equal(browser.read().first_touch.utm_medium, 'organic');
  browser.change({ analytics: false, ads: false });
  assert.equal(browser.read(), null);
});
