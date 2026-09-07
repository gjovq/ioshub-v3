const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const previous = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText, filename);
const { recordedPrimaryPosition, completePlayerPages, currentSquadIds, RECORDED_POSITIONS } =
  require('../src/lib/scout-data.ts');
if (previous) require.extensions['.ts'] = previous;
else delete require.extensions['.ts'];

test('position comes from the largest individual recorded time, not combined groups', () => {
  assert.deepEqual(recordedPrimaryPosition({ CB: 30, LB: 30, CM: 40 }, 100), {
    name: 'CM', group: 'MID', secondsPlayed: 40, share: 0.4,
  });
  assert.equal(recordedPrimaryPosition({ GK: 10, CB: 90 }, 100).group, 'DEF');
  assert.equal(Object.keys(RECORDED_POSITIONS).length, 23);
});

test('unknown, missing, invalid, unreconciled and tied position evidence stays unknown', () => {
  for (const [values, total] of [
    [{ CB: 50, GK: 50 }, 100], [{ CB: 50 }, 100], [{ CB: 110 }, 100],
    [{ Mystery: 100 }, 100], [{ CB: -10, GK: 110 }, 100], [{ CB: NaN }, 100],
    [{}, 0], [{ CB: 100 }, Infinity], [{ constructor: 100 }, 100],
  ]) assert.equal(recordedPrimaryPosition(values, total), null);
});

const page = (n, ids, totalItems = 3, totalPages = 2) => ({
  page: n, items: ids.map(playerId => ({ playerId })), totalItems, totalPages,
});

test('population follows every page, respecting the effective upstream page size', async () => {
  const calls = [];
  const result = await completePlayerPages(async n => {
    calls.push(n);
    return n === 1 ? page(1, [1, 2]) : page(2, [3]);
  });
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(result.map(p => p.playerId), [1, 2, 3]);
  assert.deepEqual(await completePlayerPages(async () => page(1, [], 0, 0)), []);
});

test('truncated, shifting, duplicate and failed population pages are not ranked', async () => {
  await assert.rejects(completePlayerPages(async n => n === 1 ? page(1, [1, 2]) : page(2, [])));
  await assert.rejects(completePlayerPages(async n => n === 1 ? page(1, [1, 2]) : page(2, [2])));
  await assert.rejects(completePlayerPages(async n => n === 1 ? page(1, [1, 2]) : page(2, [3], 4)));
  await assert.rejects(completePlayerPages(async () => page(1, [1], 3, 1)));
  await assert.rejects(completePlayerPages(async () => page(1, [1], 1000, 101)));
  await assert.rejects(completePlayerPages(async n => {
    if (n === 2) throw new Error('unavailable');
    return page(1, [1, 2]);
  }));
});

test('division membership excludes former, pending and ambiguous squad entries', () => {
  const member = (id, extra = {}) => ({ playerTeam: {
    playerId: id, isCurrentTeam: true, isPending: false, leaveDate: null, ...extra,
  } });
  assert.deepEqual(currentSquadIds([
    member(1), member(1), member(2, { isCurrentTeam: false }),
    member(3, { isPending: true }), member(4, { leaveDate: '2025-01-01' }),
    member(5, { isCurrentTeam: undefined }),
  ]), [1]);
});
