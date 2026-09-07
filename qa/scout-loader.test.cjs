const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the real server flow in memory. Per-module imports are allowlisted:
// neither Next's runtime nor the real API (and therefore no network) can load.
const compiled = Object.fromEntries(['scout-data', 'scout-loader'].map(name => {
  const filename = path.resolve(__dirname, `../src/lib/${name}.ts`);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return [name, { filename, outputText }];
}));

function compile(name, imports = {}) {
  const { filename, outputText } = compiled[name];
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.require = request => {
    assert.ok(Object.hasOwn(imports, request), `Unexpected server import: ${request}`);
    return imports[request];
  };
  instance._compile(outputText, filename);
  return instance.exports;
}

// Independent expected contract: deriving this list from the implementation
// would hide a missing canonical position query.
const POSITIONS = {
  GK: 'GK',
  LWB: 'DEF', LB: 'DEF', LCB: 'DEF', SWP: 'DEF', CB: 'DEF', RCB: 'DEF', RB: 'DEF', RWB: 'DEF',
  LM: 'MID', LCM: 'MID', CDM: 'MID', CM: 'MID', CAM: 'MID', RCM: 'MID', RM: 'MID',
  LW: 'ATT', LF: 'ATT', CF: 'ATT', SS: 'ATT', ST: 'ATT', RF: 'ATT', RW: 'ATT',
};
const SCOPE = { period: 3, region: 7, minApps: 12, minRating: 80, division: 'all' };

function player(playerId, overrides = {}) {
  return {
    playerId, name: `Synthetic player ${playerId}`, steamID: null, countryId: null,
    rating: 85, appearances: 20, substituteAppearances: 2, secondsPlayed: 100,
    goals: 0, assists: 0, passes: 20, passesCompleted: 10, keeperSaves: 0,
    ...overrides,
  };
}

function paged(rows, page, pageSize = 1) {
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize,
    totalItems: rows.length, totalPages: Math.ceil(rows.length / pageSize),
    sortBy: 'SecondsPlayed', sortOrder: 'DESC', offset: (page - 1) * pageSize,
  };
}

function member(playerId, teamId, overrides = {}, positionName = 'GK') {
  return {
    appearances: 1, goals: 9999, keeperSaves: 9999,
    position: { id: 1, name: positionName },
    playerTeam: {
      playerId, player: { id: playerId, name: `Synthetic player ${playerId}`, steamID: null },
      teamId, team: null, teamRole: 0, isCurrentTeam: true, isPending: false,
      joinDate: '2026-01-01', leaveDate: null, ...overrides,
    },
  };
}

function fixture(options = {}) {
  const selected = options.selected ?? [player(1)];
  const totals = options.totals ?? selected.map(row => ({ ...row, secondsPlayed: 100 }));
  const evidence = options.evidence ?? { CB: totals };
  const calls = { statistics: [], tournaments: [], teams: [], squads: [], cache: [] };
  const api = {
    async getPlayerStatistics(request) {
      calls.statistics.push(structuredClone(request));
      const kind = Object.hasOwn(request.filters, 'minimumAppearances') ? 'selected'
        : request.filters.positionName ?? 'totals';
      const rows = kind === 'selected' ? selected : kind === 'totals' ? totals : evidence[kind] ?? [];
      const response = paged(rows, request.page, options.pageSize ?? 1);
      return options.statistics ? options.statistics({ kind, request, response }) : response;
    },
    async getCurrentTournaments() {
      calls.tournaments.push([]);
      if (options.tournamentError) throw options.tournamentError;
      return options.tournaments ?? [{ id: 501, name: 'Premier Synthetic Season', hasEnded: false }];
    },
    async getTournamentTeams(id) {
      calls.teams.push(id);
      if (options.teamError) throw options.teamError;
      return options.teams ?? [{ id: 601, name: 'Synthetic Club A' }];
    },
    async getTeamSquad(id) {
      calls.squads.push(id);
      if (options.squadError) throw options.squadError;
      return options.squads?.[id] ?? [];
    },
  };
  function unstable_cache(fn, keys, settings) {
    calls.cache.push({ keys, settings });
    if (!options.cache) return fn;
    // Deterministic per-fixture memoization tests cross-scope keying, not Next's
    // persistent cache implementation or time-based revalidation.
    const values = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (!values.has(key)) values.set(key, Promise.resolve().then(() => fn(...args)));
      return values.get(key);
    };
  }
  const data = compile('scout-data');
  const loader = compile('scout-loader', {
    'server-only': {}, 'next/cache': { unstable_cache }, './api': api, './scout-data': data,
  });
  return { ...loader, calls };
}

function role(name, secondsPlayed = 100, share = 1) {
  return { name, group: POSITIONS[name], secondsPlayed, share };
}

function assertUnknown(result, ids) {
  assert.deepEqual(result.players.map(row => row.playerId), ids);
  assert.ok(result.players.every(row => row.scoutPosition === null));
  assert.equal(result.positionWarning, ids.length > 0);
}

test('loads every selected, all-time total and canonical-position page despite an upstream page-size cap', async () => {
  const selected = [];
  const evidence = {};
  for (const name of Object.keys(POSITIONS)) {
    evidence[name] = [player(selected.length + 1), player(selected.length + 2)];
    selected.push(...evidence[name]);
  }
  const f = fixture({ selected, evidence });
  const result = await f.loadScoutPlayers(SCOPE);
  assert.deepEqual(result.players.map(row => row.playerId), selected.map(row => row.playerId));
  for (const [name, rows] of Object.entries(evidence)) {
    for (const row of rows) {
      assert.deepEqual(result.players.find(p => p.playerId === row.playerId).scoutPosition, role(name));
    }
  }
  assert.equal(result.positionWarning, false);
  assert.deepEqual(result.teamNames, {});
  assert.deepEqual(f.calls.tournaments, []);
  assert.deepEqual(f.calls.teams, []);
  assert.deepEqual(f.calls.squads, []);
  const requests = f.calls.statistics;
  const pages = rows => rows.map(row => row.page);
  const expectedPages = selected.map((_, index) => index + 1);
  assert.deepEqual(pages(requests.filter(r => Object.hasOwn(r.filters, 'minimumAppearances'))), expectedPages);
  assert.deepEqual(pages(requests.filter(r => !Object.hasOwn(r.filters, 'minimumAppearances')
    && !r.filters.positionName)), expectedPages);
  assert.deepEqual([...new Set(requests.map(r => r.filters.positionName).filter(Boolean))].sort(),
    Object.keys(POSITIONS).sort());
  for (const name of Object.keys(POSITIONS)) {
    assert.deepEqual(pages(requests.filter(r => r.filters.positionName === name)), [1, 2], name);
  }
  for (const request of requests) {
    assert.equal(request.pageSize, 1000);
    assert.equal(request.sortBy, 'SecondsPlayed');
    assert.equal(request.sortOrder, 'DESC');
    assert.equal(request.filters.includeSubstituteAppearances, true);
  }
});

test('all-time evidence is unfiltered and shared while selected statistics remain scope-specific', async () => {
  const f = fixture({ cache: true, squads: { 601: [member(1, 601)] } });
  const scopes = [SCOPE,
    { period: 1, region: null, minApps: 0, minRating: null, division: 'premier' },
    { period: 0, region: 2, minApps: 5, minRating: 90, division: 'all' }];
  for (const scope of scopes) {
    const result = await f.loadScoutPlayers({ ...scope, positionGroup: 'GK', playerName: 'No match' });
    assert.deepEqual(result.players[0].scoutPosition, role('CB'));
  }
  await f.loadScoutPlayers(SCOPE);
  const selected = f.calls.statistics.filter(r => Object.hasOwn(r.filters, 'minimumAppearances'));
  assert.equal(selected.length, scopes.length + 1, 'complete populations are fetched per request without oversized aggregate cache entries');
  assert.deepEqual(selected.map(r => r.filters), [...scopes, SCOPE].map(scope => ({
    timePeriod: scope.period, regionId: scope.region, minimumAppearances: scope.minApps,
    minimumRating: scope.minRating, includeSubstituteAppearances: true,
  })));
  const index = f.calls.statistics.filter(r => !Object.hasOwn(r.filters, 'minimumAppearances'));
  assert.equal(index.length, 1 + Object.keys(POSITIONS).length, 'one shared complete index');
  for (const request of index) {
    assert.deepEqual(request.filters, request.filters.positionName
      ? { timePeriod: 0, positionName: request.filters.positionName, includeSubstituteAppearances: true }
      : { timePeriod: 0, includeSubstituteAppearances: true });
  }
});

test('reconciles all-time seconds, selects the largest exact position, then maps its group', async () => {
  const selected = [player(1, { secondsPlayed: 7, goals: 9999, assists: 9999, keeperSaves: 9999 }),
    player(2, { secondsPlayed: 2, keeperSaves: 9999 })];
  const f = fixture({ selected, evidence: {
    CB: [player(1, { secondsPlayed: 30 })], LB: [player(1, { secondsPlayed: 30 })],
    CM: [player(1, { secondsPlayed: 40 })], ST: [player(2)],
  } });
  const result = await f.loadScoutPlayers(SCOPE);
  assert.deepEqual(result.players.map(row => row.scoutPosition), [role('CM', 40, 0.4), role('ST')]);
  assert.equal(result.players[0].secondsPlayed, 7, 'ranking statistics retain the requested period');
  assert.equal(result.players[1].keeperSaves, 9999, 'keeper statistics do not relabel an attacker');
  assert.equal(result.positionWarning, false);
});

test('tied, missing, gapped and overcounted evidence stays unknown without profile or statistical guesses', async () => {
  const selected = Array.from({ length: 5 }, (_, i) => player(i + 1, {
    position: { id: 1, name: 'GK' }, scoutPosition: role('GK'), keeperSaves: 9999, goals: 9999,
  }));
  const f = fixture({ selected, evidence: {
    CB: [player(1, { secondsPlayed: 50 }), player(2, { secondsPlayed: 99 }),
      player(3, { secondsPlayed: 101 }), player(5)],
    GK: [player(1, { secondsPlayed: 50 })],
  } });
  const result = await f.loadScoutPlayers(SCOPE);
  assert.ok(result.players.slice(0, 4).every(row => row.scoutPosition === null));
  assert.deepEqual(result.players[4].scoutPosition, role('CB'));
  assert.equal(result.positionWarning, true);
});

test('uses current division squads, excludes departed/pending/ambiguous members and ignores squad position labels', async () => {
  const selected = Array.from({ length: 8 }, (_, i) => player(i + 1));
  const f = fixture({ selected,
    tournaments: [{ id: 502, name: 'Challenger Synthetic Season' }, { id: 501, name: 'PREMIER Synthetic Season' }],
    teams: [{ id: 601, name: 'Synthetic Club A' }, { id: 602, name: 'Synthetic Club B' }],
    squads: {
      601: [member(1, 601), member(1, 601), member(2, 601, { isCurrentTeam: false }),
        member(3, 601, { isPending: true }), member(4, 601, { leaveDate: '2026-02-01' }),
        member(5, 601, { isCurrentTeam: undefined }), member(6, 601, { isPending: undefined }),
        member(7, 601, { leaveDate: undefined })],
      602: [member(8, 602, {}, 'ST')],
    },
  });
  const result = await f.loadScoutPlayers({ ...SCOPE, division: 'premier' });
  assert.deepEqual(result.players.map(row => row.playerId), [1, 8]);
  assert.deepEqual(result.teamNames, { 1: 'Synthetic Club A', 8: 'Synthetic Club B' });
  assert.ok(result.players.every(row => row.scoutPosition.name === 'CB'));
  assert.equal(result.positionWarning, false);
  assert.deepEqual(f.calls.teams, [501]);
  assert.deepEqual(f.calls.squads.sort(), [601, 602]);
  // The division must restrict the output, not the all-time position population.
  assert.equal(f.calls.statistics.filter(r => r.filters.positionName === 'CB').length, 8);
});

test('missing or unknown divisions and unavailable roster data reject instead of falling back to all players', async t => {
  for (const [name, options, division, message] of [
    ['missing current tournament', { tournaments: [] }, 'premier', /Current division unavailable/],
    ['unknown division', {}, 'not-a-division', /Current division unavailable/],
    ['tournament failure', { tournamentError: new Error('tournaments unavailable') }, 'premier', /tournaments unavailable/],
    ['team failure', { teamError: new Error('teams unavailable') }, 'premier', /teams unavailable/],
    ['squad failure', { squadError: new Error('squad unavailable') }, 'premier', /squad unavailable/],
  ]) {
    await t.test(name, async () => {
      const f = fixture(options);
      await assert.rejects(f.loadScoutPlayers({ ...SCOPE, division }), message);
      assert.ok(f.calls.statistics.every(r => Object.hasOwn(r.filters, 'minimumAppearances')));
    });
  }
});

test('failure on either page of any canonical position makes the entire index unknown', async t => {
  for (const positionName of Object.keys(POSITIONS)) {
    for (const failedPage of [1, 2]) {
      await t.test(`${positionName} page ${failedPage}`, async () => {
        const selected = [player(1, { keeperSaves: 9999 }), player(2, { goals: 9999 })];
        const f = fixture({ selected, evidence: { [positionName]: selected },
          statistics({ kind, request, response }) {
            if (kind === positionName && request.page === failedPage) throw new Error('Synthetic position outage');
            return response;
          },
        });
        assertUnknown(await f.loadScoutPlayers(SCOPE), [1, 2]);
        assert.ok(f.calls.statistics.some(r => r.filters.positionName === positionName && r.page === failedPage));
      });
    }
  }
});

test('unavailable or inconsistent all-time evidence warns without discarding selected statistics', async t => {
  for (const kind of ['totals', 'CB']) {
    for (const failure of ['outage', 'duplicate', 'changed totals', 'empty page']) {
      await t.test(`${kind}: ${failure}`, async () => {
        const f = fixture({ selected: [player(1), player(2)], statistics(input) {
          const { request, response } = input;
          if (input.kind !== kind || request.page !== 2) return response;
          if (failure === 'outage') throw new Error('Synthetic evidence outage');
          if (failure === 'duplicate') return { ...response, items: [player(1)] };
          if (failure === 'changed totals') return { ...response, totalItems: 3 };
          return { ...response, items: [] };
        } });
        assertUnknown(await f.loadScoutPlayers(SCOPE), [1, 2]);
      });
    }
  }
  await t.test('positional player absent from all-time totals invalidates the index', async () => {
    const f = fixture({ evidence: { CB: [player(1)], ST: [player(2)] } });
    assertUnknown(await f.loadScoutPlayers(SCOPE), [1]);
  });
  await t.test('selected player absent from all-time totals remains unknown', async () => {
    const f = fixture({ selected: [player(1), player(2)], totals: [player(1)] });
    const result = await f.loadScoutPlayers(SCOPE);
    assert.deepEqual(result.players[0].scoutPosition, role('CB'));
    assert.equal(result.players[1].scoutPosition, null);
    assert.equal(result.positionWarning, true);
  });
});

test('unavailable or incomplete selected population rejects instead of returning partial rankings', async t => {
  for (const failure of ['first-page outage', 'later-page outage', 'duplicate', 'changed totals', 'truncated', 'missing response']) {
    await t.test(failure, async () => {
      const f = fixture({ selected: [player(1), player(2)], statistics({ kind, request, response }) {
        if (kind !== 'selected') return response;
        if (failure === 'first-page outage') throw new Error('Synthetic population outage');
        if (failure === 'missing response') return undefined;
        if (request.page !== 2) return response;
        if (failure === 'later-page outage') throw new Error('Synthetic population outage');
        if (failure === 'duplicate') return { ...response, items: [player(1)] };
        if (failure === 'changed totals') return { ...response, totalItems: 3 };
        return { ...response, items: [] };
      } });
      await assert.rejects(f.loadScoutPlayers(SCOPE));
      assert.ok(f.calls.statistics.every(r => Object.hasOwn(r.filters, 'minimumAppearances')));
    });
  }
});

test('empty selected populations and empty current squads return no players without loading position evidence', async () => {
  for (const [options, scope] of [[{ selected: [] }, SCOPE], [{ squads: { 601: [] } }, { ...SCOPE, division: 'premier' }]]) {
    const f = fixture(options);
    const result = await f.loadScoutPlayers(scope);
    assert.deepEqual(result, { players: [], teamNames: {}, positionWarning: false });
    assert.ok(f.calls.statistics.every(r => Object.hasOwn(r.filters, 'minimumAppearances')));
  }
});
