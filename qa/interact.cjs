const { chromium } = require('playwright');
const BASE = 'http://localhost:3100';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  // --- search dialog (Cmd/Ctrl+K) ---
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  const dialogOpen = await page.isVisible('input[placeholder*="Search"]');
  check('search opens with Ctrl+K', dialogOpen);

  await page.fill('input[placeholder*="Search"]', 'nuno');
  await page.waitForTimeout(1500);
  const resultCount = await page.locator('a[href^="/players/"], a[href^="/teams/"]').count();
  check('search returns results', resultCount > 0, `${resultCount} rows`);

  // keyboard nav + enter should navigate
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  const navigated = /\/(players|teams)\/\d+/.test(page.url());
  check('search Enter navigates', navigated, page.url().replace(BASE, ''));

  // Escape closes
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closed = !(await page.isVisible('input[placeholder*="Search"]'));
  check('Escape closes search', closed);

  // --- filter pills drive the querystring & results ---
  await page.goto(BASE + '/players', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const firstBefore = (await page.locator('tbody tr td:nth-child(2)').first().innerText()).trim();
  await page.click('a:has-text("Last week")');
  await page.waitForURL(/period=7/, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const urlHasPeriod = page.url().includes('period=7');
  const firstAfter = (await page.locator('tbody tr td:nth-child(2)').first().innerText()).trim();
  check('player period filter updates URL', urlHasPeriod, page.url().replace(BASE, ''));
  check('player period filter changes data', firstBefore !== firstAfter, `${firstBefore} -> ${firstAfter}`);

  // --- column sort ---
  await page.goto(BASE + '/players', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('thead th a').filter({ hasText: /^A$/ }).first().click();
  // stat queries can take several seconds upstream; wait for the URL, not a fixed delay
  await page
    .waitForURL(/sort=Assists/, { timeout: 60000 })
    .catch(() => {});
  check('sortable column works', page.url().includes('sort=Assists'), page.url().replace(BASE, ''));

  // --- matches tab switching ---
  await page.goto(BASE + '/matches', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('a:has-text("Fixtures")');
  await page.waitForURL(/view=upcoming/, { timeout: 60000 }).catch(() => {});
  check('matches tab switches', page.url().includes('view=upcoming'));

  // --- pagination ---
  const pageLink = page.locator('nav a', { hasText: /^2$/ }).first();
  if (await pageLink.count()) {
    await pageLink.click();
    await page.waitForTimeout(3000);
    check('pagination works', page.url().includes('page=2'), page.url().replace(BASE, ''));
  } else {
    check('pagination works', false, 'no page-2 link found');
  }

  // --- drill down from a list into a detail page ---
  await page.goto(BASE + '/teams', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('tbody a[href^="/teams/"]').first().click();
  await page.waitForTimeout(4000);
  const onTeam = /\/teams\/\d+/.test(page.url());
  const hasSquad = await page.locator('text=Squad').count();
  check('team drill-down renders', onTeam && hasSquad > 0, page.url().replace(BASE, ''));

  // --- mobile nav menu ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.click('button[aria-label="Menu"]');
  await page.waitForTimeout(500);
  const menuOpen = await page.locator('header nav a:has-text("Leaderboards")').last().isVisible();
  check('mobile menu opens', menuOpen);

  check('no uncaught page errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
