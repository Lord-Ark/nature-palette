const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

let uuidCounter = 0;
let writtenArchivePath;
let archiveEntries = [];
let extractedArchivePath;

function Archive() {
  this.getEntries = () => archiveEntries.map((entryName) => ({ entryName }));
}
Archive.prototype.addLocalFile = () => {};
Archive.prototype.writeZip = (archivePath) => {
  writtenArchivePath = archivePath;
};
Archive.prototype.extractAllTo = (archivePath) => {
  extractedArchivePath = archivePath;
};

// Archive dependencies are not needed to exercise filesystem traversal.
const filename = path.resolve(__dirname, '../helpers/zipHelper.js');
const helperModule = new Module(filename, module);
const originalRequire = helperModule.require.bind(helperModule);
helperModule.require = (name) => {
  if (name === 'express') return () => ({});
  if (name === 'uuid/v1') return () => `test-uuid-${++uuidCounter}`;
  if (name === 'adm-zip' || name === 'node-zip') return Archive;
  return originalRequire(name);
};
helperModule._compile(fs.readFileSync(filename, 'utf8'), filename);
const { getAllFiles, get_files, unzip, zip } = helperModule.exports;

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nature-palette-traversal-'));
try {
  assert.deepStrictEqual(getAllFiles(root), [], 'empty folders should return no files');
  fs.mkdirSync(path.join(root, 'nested', 'deeper'), { recursive: true });
  fs.mkdirSync(path.join(root, 'empty'));
  const expected = ['root.csv', 'nested/first.csv', 'nested/deeper/second.csv']
    .map((file) => path.join(root, file));
  expected.forEach((file) => fs.writeFileSync(file, 'sample'));

  assert.deepStrictEqual(
    get_files(root).sort(),
    ['root.csv', 'nested', 'empty'].map((entry) => path.join(root, entry)).sort(),
    'top-level entries should resolve correctly without a trailing slash'
  );

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

  const firstArchive = zip([], 'ResearchData');
  assert.strictEqual(
    firstArchive,
    'downloads/ResearchData-test-uuid-1.zip',
    'download archives should include a unique suffix'
  );
  assert.strictEqual(writtenArchivePath, firstArchive);

  const secondArchive = zip([], 'ResearchData');
  assert.notStrictEqual(
    secondArchive,
    firstArchive,
    'concurrent downloads should not overwrite the same archive'
  );

  assert.strictEqual(
    zip([]),
    'downloads/ResearchData-test-uuid-3.zip',
    'unnamed archives should use a stable fallback name and unique suffix'
  );

  archiveEntries = ['metadata/data.csv', 'images/specimen.jpg'];
  const extractedPath = unzip('/tmp/safe.zip');
  assert.strictEqual(extractedArchivePath, extractedPath);

  for (const unsafeEntry of [
    '../outside.txt',
    'nested/../../outside.txt',
    '..\\outside.txt',
    '/tmp/outside.txt',
    'C:\\temp\\outside.txt'
  ]) {
    archiveEntries = [unsafeEntry];
    assert.throws(
      () => unzip('/tmp/unsafe.zip'),
      /Archive contains an unsafe file path/,
      unsafeEntry
    );
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
