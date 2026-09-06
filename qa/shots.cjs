const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3100';
const OUT = process.env.SHOTDIR || path.join(process.env.LOCALAPPDATA, 'Temp', 'ioprobe', 'shots');

const PAGES = [
  ['home', '/'],
  ['live', '/live'],
  ['matches', '/matches'],
  ['match-detail', '/matches/314365'],
  ['teams', '/teams'],
  ['team-detail', '/teams/727'],
  ['players', '/players'],
  ['player-detail', '/players/17803'],
  ['tournaments', '/tournaments'],
  ['tournament-detail', '/tournaments/111'],
  ['leaders', '/leaders'],
  ['notfound', '/players/999999999'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];

  for (const [name, url] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + e.message.slice(0, 200)));

    try {
      const resp = await page.goto(BASE + url, {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await page.waitForTimeout(2500);
      const status = resp ? resp.status() : 0;

      // detect layout overflow (horizontal scrollbar on body)
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth - d.clientWidth;
      });

      await page.screenshot({
        path: path.join(OUT, name + '.png'),
        fullPage: true,
      });

      // mobile shot
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(600);
      const mobileOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      await page.screenshot({ path: path.join(OUT, name + '-mobile.png'), fullPage: false });

      console.log(
        `${name.padEnd(20)} ${status} overflow=${overflow} mobileOverflow=${mobileOverflow} ${
          pageErrors.length ? 'CONSOLE:' + pageErrors.slice(0, 2).join(' | ') : ''
        }`,
      );
      if (pageErrors.length) errors.push([name, pageErrors]);
    } catch (e) {
      console.log(`${name.padEnd(20)} FAILED ${e.message.slice(0, 120)}`);
      errors.push([name, [e.message]]);
    }
    await ctx.close();
  }

  await browser.close();
  console.log('\nScreenshots in', OUT);
  if (errors.length) {
    console.log('\n=== ERRORS ===');
    for (const [n, e] of errors) console.log(n, e);
  }
})();
