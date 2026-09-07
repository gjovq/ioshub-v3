const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  const module = new Module(filename, moduleParent);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText, filename);
  return module.exports;
}
const moduleParent = module;
const { ScoutHeatmap } = load('../src/components/scout-heatmap.tsx');
const { HexagonChart } = load('../src/components/hexagon.tsx');
const { RECORDED_POSITIONS } = load('../src/lib/scout-data.ts');
const axes = [{ label: 'Passing', raw: 0.85, pct: 50, unit: 'percent', lowerIsBetter: false }];
const heatmap = (name, metrics = axes) => renderToStaticMarkup(React.createElement(ScoutHeatmap, {
  p: { scoutPosition: name === null ? null : { name } }, axes: metrics,
}));

test('every canonical recorded position has an explicitly illustrative pitch template', () => {
  for (const name of Object.keys(RECORDED_POSITIONS)) {
    const html = heatmap(name);
    assert.match(html, /<svg/);
    assert.match(html, /not tracked coordinates or actual movement/);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('unknown roles and unavailable percentiles do not produce a pitch map', () => {
  for (const name of [null, 'GOALKEEPER', 'gk', 'constructor', 'Unknown']) {
    assert.doesNotMatch(heatmap(name), /<svg/);
  }
  for (const pct of [null, NaN, Infinity]) {
    assert.doesNotMatch(heatmap('GK', [{ ...axes[0], pct }]), /<svg/);
  }
});

test('radar renders missing observations as gaps rather than a zero-filled polygon', () => {
  const html = renderToStaticMarkup(React.createElement(HexagonChart, {
    axes: [
      { label: 'Passing', value: 0.85 }, { label: 'Goals', value: null },
      { label: 'Chances', value: NaN }, { label: 'Assists', value: Infinity },
      { label: 'Interceptions', value: 0 }, { label: 'Fouls', value: 0.5 },
    ],
  }));
  assert.match(html, /Passing: 85 of 100/);
  assert.match(html, /Goals: unavailable/);
  assert.match(html, /Interceptions: 0 of 100/);
  assert.equal((html.match(/<polygon/g) ?? []).length, 4, 'Only the four grid rings are filled');
  assert.equal((html.match(/<circle/g) ?? []).length, 3);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('complete radar profiles retain their filled shape', () => {
  const html = renderToStaticMarkup(React.createElement(HexagonChart, {
    axes: Array.from({ length: 6 }, (_, i) => ({ label: `Axis ${i + 1}`, value: 0.5 })),
  }));
  assert.equal((html.match(/<polygon/g) ?? []).length, 5);
});
