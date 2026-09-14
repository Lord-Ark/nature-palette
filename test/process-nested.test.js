const assert = require('assert');
const processNested = require('../lib/processNested');

assert.deepStrictEqual(processNested({
  'metadata[title]': 'Specimens',
  'files[0][name]': 'first.csv',
  'files[1][name]': 'second.csv'
}), {
  metadata: { title: 'Specimens' },
  files: [{ name: 'first.csv' }, { name: 'second.csv' }]
});

assert.deepStrictEqual(processNested({ 'toString[title]': 'Safe' }), {
  toString: { title: 'Safe' }
});
assert.strictEqual(Object.prototype.toString.title, undefined);

for (const field of [
  '__proto__.nestedUploadPolluted',
  'constructor[prototype][nestedUploadPolluted]',
  'metadata[__proto__][nestedUploadPolluted]',
  'files[0][__proto__][nestedUploadPolluted]'
]) {
  try {
    const result = processNested({ [field]: 'unsafe', title: 'Safe' });
    assert.strictEqual({}.nestedUploadPolluted, undefined, field);
    assert.deepStrictEqual(result, { title: 'Safe' });
  } finally {
    delete Object.prototype.nestedUploadPolluted;
  }
}
