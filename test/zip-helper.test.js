const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// Archive dependencies are not needed to exercise filesystem traversal.
const filename = path.resolve(__dirname, '../helpers/zipHelper.js');
const helperModule = new Module(filename, module);
const originalRequire = helperModule.require.bind(helperModule);
helperModule.require = (name) => {
  if (name === 'express') return () => ({});
  if (name === 'uuid/v1') return () => 'test-uuid';
  if (name === 'adm-zip' || name === 'node-zip') return function Archive() {};
  return originalRequire(name);
};
helperModule._compile(fs.readFileSync(filename, 'utf8'), filename);
const { getAllFiles } = helperModule.exports;

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nature-palette-traversal-'));
try {
  assert.deepStrictEqual(getAllFiles(root), [], 'empty folders should return no files');
  fs.mkdirSync(path.join(root, 'nested', 'deeper'), { recursive: true });
  fs.mkdirSync(path.join(root, 'empty'));
  const expected = ['root.csv', 'nested/first.csv', 'nested/deeper/second.csv']
    .map((file) => path.join(root, file));
  expected.forEach((file) => fs.writeFileSync(file, 'sample'));

  assert.deepStrictEqual(
    getAllFiles(root).sort(),
    expected.sort(),
    'all nested files should be returned without directory entries'
  );
  assert.deepStrictEqual(
    getAllFiles(path.join(root, 'empty')),
    [],
    'successive calls should not retain files from previous traversals'
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
