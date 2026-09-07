const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Compile only in memory: no generated JS, framework runtime, or API requests.
const previousHandler = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const { primaryPosition, percentileOf, passAccuracy, hexagonFor, heatScores, POSITION_COLORS } =
  require('../src/lib/scouting.ts');
if (previousHandler) require.extensions['.ts'] = previousHandler;
else delete require.extensions['.ts'];

function player(id, group = 'MID', overrides = {}) {
  return {
    playerId: id, name: `Player ${id}`, appearances: 10, secondsPlayed: 54000,
    scoutPosition: group === null ? null : { name: group, group, secondsPlayed: 54000, share: 1 },
    keeperSaves: 20, keeperSavePercentage: 0.8, keeperSavesCaughtAverage: 1,
    goalsConceded: 5, passes: 100, passesCompleted: 85, passCompletionPercentageAverage: 0.85,
    goals: 5, shots: 20, shotsOnGoal: 10, shotAccuracyPercentage: 0.5,
    shotConversionPercentage: 0.25, assists: 3, keyPasses: 5, chancesCreated: 4,
    interceptions: 10, slidingTacklesCompletedAverage: 1, fouls: 2,
    wins: 5, winPercentage: 0.5,
    ...overrides,
  };
}

function peers(group, overrides = {}) {
  return Array.from({ length: 5 }, (_, i) => player(i + 1, group, overrides));
}

function near(actual, expected) {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should equal ${expected}`);
}

test('passing uses fractions as-is, including 1 and very small fractions', () => {
  for (const value of [0.85, 1, 0.008, 0]) {
    assert.equal(passAccuracy(player(1, 'MID', { passCompletionPercentageAverage: value })), value);
  }
  assert.equal(passAccuracy(player(1, 'MID', {
    passCompletionPercentageAverage: 85, passes: 20, passesCompleted: 17,
  })), 0.85);
  for (const value of [undefined, null, NaN, Infinity, -0.1, 1.01]) {
    assert.equal(passAccuracy(player(1, 'MID', { passCompletionPercentageAverage: value })), 0.85);
  }
});

test('passing never invents a zero when attempts or valid totals are absent', () => {
  for (const passes of [0, undefined, null, NaN, Infinity, -1]) {
    assert.equal(passAccuracy(player(1, 'MID', { passes })), null);
  }
  for (const passesCompleted of [undefined, null, -1, 101, NaN, Infinity]) {
    assert.equal(passAccuracy(player(1, 'MID', {
      passCompletionPercentageAverage: 85, passesCompleted,
    })), null);
  }
  assert.equal(passAccuracy(player(1, 'MID', {
    passCompletionPercentageAverage: undefined, passesCompleted: 0,
  })), 0);
});

test('percentiles use midranks and invert only lower-is-better axes', () => {
  assert.equal(percentileOf(1, [1, 2, 3, 4, 5]), 10);
  assert.equal(percentileOf(5, [1, 2, 3, 4, 5]), 90);
  assert.equal(percentileOf(1, [1, 2, 3, 4, 5], true), 90);
  assert.equal(percentileOf(2, [1, 2, 2, 3]), 50);
  assert.equal(percentileOf(2, [1, 2, 2, 3], true), 50);
  assert.equal(percentileOf(7, [7, 7, 7]), 50);
  assert.equal(percentileOf(7, [7]), 50);
  assert.equal(percentileOf(7, [7], true), 50);
  assert.equal(percentileOf(7, []), null);
  assert.equal(percentileOf(7, [NaN, Infinity, -Infinity]), null);
  assert.equal(percentileOf(NaN, [1, 2]), null);
  assert.equal(percentileOf(Infinity, [1, 2]), null);
  assert.equal(percentileOf(2, [NaN, 1, 2, 3, Infinity]), 50);
  assert.equal(percentileOf(-100, [1, 2, 3]), 0);
  assert.equal(percentileOf(100, [1, 2, 3]), 100);
});

test('recorded position wins even when football stats suggest another role', () => {
  assert.equal(primaryPosition(player(1, 'DEF', { goals: 9999, assists: 9999 })), 'DEF');
  assert.equal(primaryPosition(player(1, 'ATT', { keeperSaves: 9999 })), 'ATT');
  assert.equal(primaryPosition(player(1, null, { keeperSaves: 9999 })), null);
  assert.equal(primaryPosition(player(1, 'GK', { scoutPosition: undefined })), null);
  assert.deepEqual(Object.keys(POSITION_COLORS).sort(), ['ATT', 'DEF', 'GK', 'MID']);
});

test('each role has six distinct axes and neutral equal-player heat', () => {
  const signatures = new Set();
  for (const group of ['GK', 'DEF', 'MID', 'ATT']) {
    const cohort = peers(group);
    const axes = hexagonFor(cohort[0], cohort);
    assert.equal(axes.length, 6);
    assert.equal(new Set(axes.map((a) => a.label)).size, 6);
    signatures.add(axes.map((a) => a.label).join(','));
    for (const axis of axes) {
      assert.equal(axis.pct, 50);
      assert.equal(typeof axis.lowerIsBetter, 'boolean');
      assert.ok(['rate', 'percent'].includes(axis.unit));
      if (axis.unit === 'percent') assert.ok(axis.raw >= 0 && axis.raw <= 1);
    }
    for (const heat of heatScores(cohort).values()) near(heat, 50);
  }
  assert.equal(signatures.size, 4);
});

test('percent axes retain fractions and GK saves/save percentage carry core weight', () => {
  const cohort = peers('GK');
  cohort[0] = player(1, 'GK', { keeperSaves: 40, keeperSavePercentage: 0.95 });
  const axes = hexagonFor(cohort[0], cohort);
  assert.equal(axes.find((a) => a.label === 'Save %').raw, 0.95);
  assert.equal(axes.find((a) => a.label === 'Passing').raw, 0.85);
  assert.equal(axes.find((a) => a.label === 'Winning').raw, 0.5);
  // Two core axes at 90 with combined weight .65; four neutral axes at 50.
  near(heatScores(cohort).get(1), 76);
});

test('peer comparison ignores every other role and player names', () => {
  const cohort = peers('MID');
  cohort[0] = player(1, 'MID', { goals: 100, keyPasses: 20 });
  const others = Array.from({ length: 20 }, (_, i) => player(100 + i, 'ATT', {
    goals: 9999, keyPasses: 9999, passesCompleted: 100, passCompletionPercentageAverage: 1,
  }));
  assert.deepEqual(hexagonFor(cohort[0], cohort), hexagonFor(cohort[0], [...cohort, ...others]));
  assert.equal(heatScores(cohort).get(1), heatScores([...cohort, ...others]).get(1));
  const renamed = cohort.map((p) => ({ ...p, name: 'Name excluded by a hypothetical search' }));
  assert.deepEqual(hexagonFor(cohort[0], cohort), hexagonFor(cohort[0], renamed));
});

test('unknown, unique and small position groups cannot gain a false percentile', () => {
  const unknown = player(100, null);
  assert.deepEqual(hexagonFor(unknown, peers('MID')), []);
  assert.equal(heatScores([...peers('MID'), unknown]).get(100), null);
  for (const count of [1, 2, 4]) {
    const small = peers('ATT').slice(0, count);
    const cohort = [...small, ...peers('DEF').map((p) => ({ ...p, playerId: p.playerId + 100 }))];
    assert.ok(hexagonFor(small[0], cohort).every((a) => a.pct === null));
    for (const p of small) assert.equal(heatScores(cohort).get(p.playerId), null);
  }
  assert.deepEqual([...heatScores([])], []);
});

test('missing observations need five valid peers per axis, not five nominal players', () => {
  const cohort = peers('MID');
  cohort[0] = player(1, 'MID', { keyPasses: undefined });
  assert.equal(hexagonFor(cohort[0], cohort).find((a) => a.label === 'Key passes').raw, null);
  assert.equal(hexagonFor(cohort[1], cohort).find((a) => a.label === 'Key passes').pct, null);
  near(heatScores(cohort).get(1), 50);
});

test('no-attempt shooting and saving percentages are missing, not zero', () => {
  const attackers = peers('ATT', { shots: 0, shotsOnGoal: 0, goals: 0,
    shotAccuracyPercentage: 0, shotConversionPercentage: 0 });
  const shooting = hexagonFor(attackers[0], attackers).filter((a) => a.unit === 'percent');
  assert.ok(shooting.every((a) => a.raw === null && a.pct === null));
  const keepers = peers('GK', { keeperSaves: 0, goalsConceded: 0, keeperSavePercentage: 0 });
  assert.equal(hexagonFor(keepers[0], keepers).find((a) => a.label === 'Save %').raw, null);
});

test('missing, invalid and zero-appearance data never produce NaN or infinity', () => {
  for (const group of ['GK', 'DEF', 'MID', 'ATT']) {
    const empty = peers(group).map((p) => ({ playerId: p.playerId, scoutPosition: p.scoutPosition }));
    assert.ok(hexagonFor(empty[0], empty).every((a) => a.raw === null && a.pct === null));
    assert.ok([...heatScores(empty).values()].every((heat) => heat === null));
    for (const invalid of [undefined, null, NaN, Infinity, -1]) {
      const cohort = peers(group).map((p) => Object.fromEntries(Object.entries(p).map(([key, value]) =>
        [key, typeof value === 'number' && key !== 'playerId' ? invalid : value])));
      for (const axis of hexagonFor(cohort[0], cohort)) {
        assert.ok(axis.raw === null || Number.isFinite(axis.raw));
        assert.ok(axis.pct === null || (Number.isFinite(axis.pct) && axis.pct >= 0 && axis.pct <= 100));
      }
      for (const heat of heatScores(cohort).values()) {
        assert.ok(heat === null || (Number.isFinite(heat) && heat >= 0 && heat <= 100));
      }
    }
    const zeroApps = peers(group, { appearances: 0 });
    assert.ok(hexagonFor(zeroApps[0], zeroApps).filter((a) => a.unit === 'rate')
      .every((a) => a.raw === null && a.pct === null));
  }
});
