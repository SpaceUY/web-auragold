import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cochinitoDestination } from '../src/lib/cochinitos/destination.mjs';

test('creator link goes to the invitation with its code and campaign', () => {
  const { code, href } = cochinitoDestination(
    '?ref=ANA123&utm_source=instagram&utm_medium=creator&utm_campaign=creadores_202611',
  );
  assert.equal(code, 'ANA123');
  assert.equal(
    href,
    'https://app.auragold.io/invite/ANA123?utm_source=instagram&utm_medium=creator&utm_campaign=creadores_202611',
  );
});

test('without a code the pig goes to sign-up, tagged as the cochinitos page', () => {
  const { code, href } = cochinitoDestination('');
  assert.equal(code, '');
  assert.equal(href, 'https://app.auragold.io/?utm_source=auragold.io&utm_medium=cochinitos');
});

test('an unsafe code or campaign value is dropped, not forwarded', () => {
  const { code, href } = cochinitoDestination('?ref=../admin&utm_source=a@b.com&utm_campaign=x');
  assert.equal(code, '');
  assert.equal(href, 'https://app.auragold.io/?utm_campaign=x&utm_source=auragold.io&utm_medium=cochinitos');
});

test('gclid and unknown parameters never travel', () => {
  const { href } = cochinitoDestination('?ref=ANA123&gclid=abc&email=x&utm_source=chainwire&utm_medium=pr');
  assert.equal(href, 'https://app.auragold.io/invite/ANA123?utm_source=chainwire&utm_medium=pr');
});

test('a visit to the cochinitos pages keeps its entry path for attribution', async () => {
  const { acquisitionTouch } = await import('../src/lib/acquisition/context.mjs');
  const consent = { analytics: true, ads: false };
  const search = '?ref=ANA123&utm_source=instagram&utm_medium=creator&utm_campaign=creadores_202611';
  assert.equal(acquisitionTouch({ consent, pathname: '/cochinitos', search }).entry_path, '/cochinitos');
  assert.equal(acquisitionTouch({ consent, pathname: '/cochinitos/bases', search }).entry_path, '/cochinitos/bases');
});
