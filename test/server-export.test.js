const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
