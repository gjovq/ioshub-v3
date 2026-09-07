const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/rating-history.ts');
const Module = require('node:module');
const instance = new Module(filename, module);
instance.filename = filename;
instance.paths = Module._nodeModulePaths(path.dirname(filename));
instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { ratingPoint, configuredRatingStore } = instance.exports;

test('rating snapshots are validated and timestamped', () => {
  assert.deepEqual(ratingPoint({ id: 42, rating: 7.5 }, '2026-09-07T00:00:00.000Z'), {
    playerId: 42, rating: 7.5, observedAt: '2026-09-07T00:00:00.000Z',
  });
  for (const player of [{ id: 0, rating: 7 }, { id: 1, rating: 0 }, { id: 1, rating: NaN }, { id: 1, rating: Infinity }]) {
    assert.equal(ratingPoint(player), null);
  }
});

test('no durable rating store is enabled accidentally on serverless disk', () => {
  assert.equal(configuredRatingStore(), null);
});
