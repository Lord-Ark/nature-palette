const assert = require('assert');
const fs = require('fs');
const path = require('path');
const isEligibleRequest = require('../lib/isEligibleRequest');

const repoDir = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(repoDir, 'server.js'), 'utf8');
const wwwSource = fs.readFileSync(path.join(repoDir, 'bin/www'), 'utf8');

assert.match(
  serverSource,
  /if \(require\.main === module\) \{/,
  'server.js should only bind a listener when executed directly'
);

assert.match(
  wwwSource,
  /require\('\.\.\/server'\)/,
  'bin/www should create its HTTP server from server.js'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'content-length': '12'
    }
  }),
  false,
  'requests without a content-type header should be skipped safely'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'content-length': '12',
      'content-type': 'multipart/form-data; boundary=abc123'
    }
  }),
  true,
  'multipart POST requests with a body should remain eligible'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'content-length': '12',
      'content-type': 'multipart/form-data ; boundary=abc123'
    }
  }),
  true,
  'multipart headers with optional whitespace before parameters should remain eligible'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'content-length': '12',
      'content-type': 'multipart/form-data'
    }
  }),
  false,
  'multipart requests without a boundary should be skipped before upload parsing'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'content-length': '12',
      'content-type': 'multipart/form-data; charset=utf-8; boundary=\"abc123\"'
    }
  }),
  true,
  'multipart requests with quoted boundaries should remain eligible'
);
