const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const isEligibleRequest = require('../lib/isEligibleRequest');
const { uriDecodeFileName } = require('../lib/utilities');

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
    method: 'POST'
  }),
  false,
  'requests without a headers object should be skipped safely'
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
      'content-length': ['12'],
      'content-type': ['multipart/form-data; boundary=abc123']
    }
  }),
  true,
  'multipart requests with array header values should remain eligible'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'content-length': '0 ',
      'content-type': 'multipart/form-data; boundary=abc123'
    }
  }),
  false,
  'multipart requests with a zero content-length should be skipped even with trailing whitespace'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'transfer-encoding': '',
      'content-type': 'multipart/form-data; boundary=abc123'
    }
  }),
  false,
  'multipart requests without a meaningful transfer-encoding value should be skipped safely'
);

assert.strictEqual(
  isEligibleRequest({
    method: 'POST',
    headers: {
      'transfer-encoding': ['', 'chunked'],
      'content-type': ['text/plain', 'multipart/form-data; boundary=abc123']
    }
  }),
  true,
  'multipart requests should accept meaningful values from repeated header arrays'
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

assert.strictEqual(
  isEligibleRequest({
    method: 'get',
    headers: {
      'content-length': '12',
      'content-type': 'multipart/form-data; boundary=abc123'
    }
  }),
  false,
  'multipart GET requests should be rejected regardless of method casing'
);

assert.strictEqual(
  uriDecodeFileName(
    { uriDecodeFileNames: true },
    'field%20notes.csv'
  ),
  'field notes.csv',
  'valid URI-encoded filenames should still be decoded'
);

assert.doesNotThrow(
  () => uriDecodeFileName(
    { uriDecodeFileNames: true },
    'field%2-notes.csv'
  ),
  'malformed URI-encoded filenames should not crash request processing'
);

assert.strictEqual(
  uriDecodeFileName(
    { uriDecodeFileNames: true },
    'field%2-notes.csv'
  ),
  'field%2-notes.csv',
  'malformed URI-encoded filenames should fall back to the original filename'
);

const stubsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nature-palette-stubs-'));
const expressStubDir = path.join(stubsDir, 'express');
fs.mkdirSync(expressStubDir);
fs.writeFileSync(
  path.join(expressStubDir, 'index.js'),
  'module.exports = function express() { return {}; };'
);

const originalNodePath = process.env.NODE_PATH || '';
const nodePathEntries = originalNodePath ? `${stubsDir}${path.delimiter}${originalNodePath}` : stubsDir;
process.env.NODE_PATH = nodePathEntries;
Module._initPaths();

const verificationHelper = require('../helpers/dataVerificationModified');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nature-palette-meta-'));

const blankFilenameMetaFile = path.join(tempDir, 'blank-filename.csv');
fs.writeFileSync(
  blankFilenameMetaFile,
  [
    'filename,datasource,uniqueid,genus,specificepithet,patch,lightangle1,lightangle2,probeangle1,probeangle2,replicate',
    ',F,U1,Genus,species,patch,1,2,3,4,1'
  ].join('\n')
);

const rowError = {};
let rowResult;
assert.doesNotThrow(
  () => {
    rowResult = verificationHelper.verifyAndGetMetaDataRows(blankFilenameMetaFile, rowError);
  },
  'blank filename metadata rows should return a validation error instead of throwing'
);
assert.strictEqual(
  rowResult,
  false,
  'blank filename metadata rows should fail validation'
);
assert.match(
  rowError.details,
  /filename in line\s*:?\s*2/i,
  'blank filename validation should identify the affected row'
);

const blankFilenameModifyMetaFile = path.join(tempDir, 'blank-filename-modify.csv');
fs.writeFileSync(
  blankFilenameModifyMetaFile,
  [
    'oldfilename,filename,datasource,uniqueid,institutioncode,cataloguenumber,genus,specificepithet,patch,lightangle1,lightangle2,probeangle1,probeangle2,replicate',
    'old.csv,,F,U1,INST,1,Genus,species,patch,1,2,3,4,1'
  ].join('\n')
);

const modifyError = {};
let modifyResult;
assert.doesNotThrow(
  () => {
    modifyResult = verificationHelper.modifyVerifyAndGetMetaDataRows(blankFilenameModifyMetaFile, modifyError);
  },
  'blank filename modification rows should return a validation error instead of throwing'
);
assert.strictEqual(
  modifyResult,
  false,
  'blank filename modification rows should fail validation'
);
assert.match(
  modifyError.details,
  /filename in line\s*:?\s*2/i,
  'blank filename modification validation should identify the affected row'
);

const spacedFilenameMetaFile = path.join(tempDir, 'spaced-filename.csv');
fs.writeFileSync(
  spacedFilenameMetaFile,
  [
    'filename,datasource,uniqueid,genus,specificepithet,patch,lightangle1,lightangle2,probeangle1,probeangle2,replicate',
    '  field-notes.csv  ,F,U1,Genus,species,patch,1,2,3,4,1'
  ].join('\n')
);

const spacedFilenameError = {};
const spacedFilenameRows = verificationHelper.verifyAndGetMetaDataRows(
  spacedFilenameMetaFile,
  spacedFilenameError
);
assert.ok(
  Array.isArray(spacedFilenameRows),
  'new submission metadata with padded filenames should still validate'
);
assert.strictEqual(
  spacedFilenameRows[0].filename,
  'field-notes.csv',
  'new submission metadata should trim filename values before saving'
);

const spacedModifyMetaFile = path.join(tempDir, 'spaced-filename-modify.csv');
fs.writeFileSync(
  spacedModifyMetaFile,
  [
    'oldfilename,filename,datasource,uniqueid,institutioncode,cataloguenumber,genus,specificepithet,patch,lightangle1,lightangle2,probeangle1,probeangle2,replicate',
    '  old.csv  ,  new.csv  ,F,U1,INST,1,Genus,species,patch,1,2,3,4,1'
  ].join('\n')
);

const spacedModifyError = {};
const spacedModifyRows = verificationHelper.modifyVerifyAndGetMetaDataRows(
  spacedModifyMetaFile,
  spacedModifyError
);
assert.ok(
  Array.isArray(spacedModifyRows),
  'modification metadata with padded filenames should still validate'
);
assert.strictEqual(
  spacedModifyRows[0].oldfilename,
  'old.csv',
  'modification metadata should trim oldfilename values before branching on them'
);
assert.strictEqual(
  spacedModifyRows[0].filename,
  'new.csv',
  'modification metadata should trim filename values before saving'
);
