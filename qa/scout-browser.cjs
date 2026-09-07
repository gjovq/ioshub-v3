// Local-only synthetic UI harness. Uses the real ScoutList and production CSS.
// Run after npm run build: node qa/scout-browser.cjs
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-ui-'));
const file = (name, content) => { const dest = path.join(scratch, name); fs.writeFileSync(dest, content); return dest; };
const loader = file('loader.cjs', `module.exports = function(source) {
  return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source, {
    fileName: this.resourcePath, compilerOptions: { jsx: ${ts.JsxEmit.ReactJSX}, target: ${ts.ScriptTarget.ES2020}, module: ${ts.ModuleKind.ESNext} }
  }).outputText;
};`);
const link = file('link.cjs', `const React = require('react'); module.exports = function Link(props) {return React.createElement('a',props);};`);
const players = [];
for (const [group, name] of [['GK', 'GK'], ['DEF', 'CB'], ['MID', 'CM'], ['ATT', 'CF']]) {
  for (let i = 0; i < 15; i++) players.push({
    playerId: players.length + 1, name: `${group} Synthetic ${String(i + 1).padStart(2, '0')}`,
    appearances: 10, secondsPlayed: 54000, rating: 7,
    scoutPosition: { name, group, secondsPlayed: 43200, share: 0.8 },
    keeperSaves: 20 + i, keeperSavePercentage: 0.8, keeperSavesCaughtAverage: 1,
    goalsConceded: 5, passes: 100, passesCompleted: 85, passCompletionPercentageAverage: 0.85,
    goals: 5 + i, shots: 20 + i, shotsOnGoal: 10, shotAccuracyPercentage: 0.5,
    shotConversionPercentage: 0.25, assists: 3 + i, keyPasses: 5 + i, chancesCreated: 4,
    interceptions: 10 + i, slidingTacklesCompletedAverage: 1, fouls: 2,
    wins: 5, winPercentage: 0.5, yellowCards: 1, redCards: 0, distanceCoveredAverage: 8000,
  });
}
players.push({ ...players[0], playerId: 999, name: 'Unknown Synthetic', scoutPosition: null, passes: 0 });
const entry = file('entry.tsx', `import React from 'react'; import {createRoot} from 'react-dom/client';
import {ScoutList} from ${JSON.stringify(path.join(root, 'src/components/scout-list.tsx'))};
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-[1100px] px-4 py-8"><h1>Scouting synthetic UI test</h1><ScoutList players={${JSON.stringify(players)}} /></main>);`);
const compiler = webpack({ mode: 'development', entry, devtool: false,
  output: { path: scratch, filename: 'bundle.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js', '.cjs'], modules: [path.join(root, 'node_modules')],
    alias: { '@': path.join(root, 'src'), 'next/link': link } },
  module: { rules: [{ test: /\.tsx?$/, use: loader }] },
});
compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  const cssFiles = fs.readdirSync(path.join(root, '.next/static'), { recursive: true })
    .filter(name => name.endsWith('.css')).map(name => path.join(root, '.next/static', name));
  const css = cssFiles.map(name => fs.readFileSync(name, 'utf8')).join('\n');
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(path.join(scratch, 'bundle.js'))); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scouting synthetic UI test</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  server.listen(3102, '127.0.0.1', () => console.log('Synthetic scouting UI: http://127.0.0.1:3102'));
  const cleanup = () => { server.close(); fs.rmSync(scratch, { recursive: true, force: true }); process.exit(0); };
  process.on('SIGTERM', cleanup); process.on('SIGINT', cleanup);
});
