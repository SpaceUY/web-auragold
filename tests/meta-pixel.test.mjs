import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync('public/consent/consent.js', 'utf8');
function boot(choice) {
  const tags = [];
  const document = {
    cookie: choice ? 'aura_consent=' + encodeURIComponent(JSON.stringify({v:1,...choice})) : '',
    currentScript: {getAttribute: name => name === 'data-meta-pixel-id' ? '1443891431238168' : null},
    head: {appendChild: tag => tags.push(tag)},
    createElement: () => ({}), addEventListener() {}, readyState: 'loading',
  };
  const window = {};
  vm.runInNewContext(source, {window, document, location:{hostname:'auragold.io',protocol:'https:'}});
  return {window,tags};
}
test('Meta is absent without advertising consent, including analytics-only consent', () => {
  for (const choice of [null, {ads:false}, {ads:false,analytics:true}]) {
    const {window,tags} = boot(choice);
    assert.equal(window.fbq, undefined);
    assert.equal(tags.length,0);
  }
});
test('Advertising consent loads one Meta library and one pixel-specific PageView', () => {
  const {window,tags} = boot({ads:true});
  assert.equal(tags.length,1);
  assert.equal(tags[0].src,'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(Array.from(window.fbq.queue, args => Array.from(args)), [
    ['consent','grant'], ['init','1443891431238168'], ['trackSingle','1443891431238168','PageView'],
  ]);
});
