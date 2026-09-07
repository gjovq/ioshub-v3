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

const { parseLiveServerSnapshot } = load('live-server');

function snapshot() {
  const side = (name) => ({
    stats: {
      score: 2, ball_possession: 6, corner_kicks: 1, goal_kicks: 4,
      passes: 79, interceptions: 47, free_kicks: 2, penalties: 0,
      saves: 14, offsides: 0,
    },
    players: [{ id: `${name}-1`, name: 'Synthetic', goals: 1, assists: 0, field_position: 1 }],
  });
  return {
    home: side('home'), away: side('away'),
    server: { timestamp: 1788802586, match_state: 'EBaseMatchStates_Ended' },
    goals_and_assists: { home_goals: {}, away_goals: {}, home_assists: {}, away_assists: {} },
  };
}

test('normalizes the linked server snapshot without throwing or logging it', () => {
  const result = parseLiveServerSnapshot(snapshot());
  assert.equal(result.home.stats.passes, 79);
  assert.equal(result.away.players[0].field_position, 1);
  assert.equal(result.server.match_state, 'EBaseMatchStates_Ended');
});

test('rejects malformed snapshots and non-finite values', () => {
  for (const value of [null, {}, [], { ...snapshot(), home: null },
    { ...snapshot(), away: { ...snapshot().away, stats: { ...snapshot().away.stats, passes: NaN } } },
    { ...snapshot(), home: { ...snapshot().home, players: [{ id: 'x' }] } },
    { ...snapshot(), goals_and_assists: { home_goals: [] } }]) {
    assert.equal(parseLiveServerSnapshot(value), null);
  }
});

test('does not accept unsupported role-shaped fields as a server snapshot', () => {
  assert.equal(parseLiveServerSnapshot({ home: { stats: {}, players: [] }, away: {}, server: {} }), null);
});
