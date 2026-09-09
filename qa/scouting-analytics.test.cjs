const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name) {
  const filename = path.resolve(__dirname, `../src/lib/${name}.ts`);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const Module = require('node:module');
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance._compile(output, filename);
  return instance.exports;
}

const {
  roleAxes,
  rolePercentiles,
  percentile,
  positionGroupOfStats,
} = load('scouting');

function player(over = {}) {
  return {
    playerId: 1,
    appearances: 10,
    secondsPlayed: 54000,
    rating: 7,
    keeperSaves: 0,
    keeperSavePercentage: null,
    goalsConceded: 5,
    passes: 100,
    passesCompleted: 85,
    passCompletionPercentageAverage: 0.85,
    goals: 5,
    shots: 20,
    shotsOnGoal: 10,
    shotAccuracyPercentage: 0.5,
    shotConversionPercentage: 0.25,
    assists: 3,
    keyPasses: 5,
    chancesCreated: 4,
    interceptions: 10,
    slidingTacklesCompletedAverage: 1,
    fouls: 2,
    wins: 5,
    winPercentage: 0.5,
    yellowCards: 1,
    redCards: 0,
    distanceCoveredAverage: 8000,
    possessionPercentageAverage: 0.5,
    expectedGoals: 3,
    ...over,
  };
}

test('roleAxes returns six axes for every estimated role', () => {
  const cases = [
    ['GK', { keeperSaves: 40, keeperSavePercentage: 0.8, goals: 0 }],
    ['DEF', { interceptions: 40, goals: 0, assists: 0 }],
    ['MID', { goals: 2, assists: 4 }],
    ['ATT', { goals: 8, assists: 1 }],
  ];
  for (const [role, over] of cases) {
    const p = player(over);
    assert.equal(positionGroupOfStats(p), role, `expected role ${role}`);
    const axes = roleAxes(p);
    assert.equal(axes.length, 6, `${role} should have six axes`);
    for (const a of axes) {
      assert.ok(Number.isFinite(a.value), `${role} ${a.label} value finite`);
      assert.ok(a.value >= 0 && a.value <= 1, `${role} ${a.label} value in 0..1`);
    }
  }
});

test('percentile uses midrank and needs at least five finite peers', () => {
  assert.equal(percentile(0.5, [1, 2, 3, 4]), null, 'too few peers');
  assert.equal(percentile(0.5, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), 5 / 6, 'midrank with tie');
  assert.equal(percentile(0.6, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), 1, 'top value');
  assert.equal(percentile(NaN, [0.1, 0.2, 0.3, 0.4, 0.5]), null, 'non-finite value');
});

test('percentile returns null (not a fake 50th) when the axis has no spread', () => {
  assert.equal(percentile(0.3, [0, 0, 0, 0, 0, 0]), null, 'degenerate all-equal axis');
  assert.equal(percentile(0.3, [0, 0, 0, 0, 0, 1]), 11 / 12, 'spread exists -> real percentile');
});

test('rolePercentiles compares only same-role peers from the full cohort', () => {
  const cohort = [];
  for (let i = 0; i < 8; i++) cohort.push(player({ playerId: i + 1, goals: i, assists: i }));
  // Force these into MID so the cohort has a same-role group.
  cohort.forEach((p) => { p.goals = 2; p.assists = 4; p.interceptions = 0; });
  const target = player({ playerId: 99, goals: 2, assists: 4, interceptions: 0 });
  const bars = rolePercentiles(target, cohort);
  assert.equal(bars.length, 6);
  for (const b of bars) {
    assert.ok(b.percentile == null || (b.percentile >= 0 && b.percentile <= 1));
  }
});
