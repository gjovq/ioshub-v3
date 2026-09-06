const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
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
];

const AUDIT = () => {
  const problems = [];
  const rectOf = (el) => el.getBoundingClientRect();

  // 1. invisible / near-invisible text (contrast against nearest opaque bg)
  const parseRGB = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parseRGB(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.85) return c;
      n = n.parentElement;
    }
    return { r: 5, g: 7, b: 10, a: 1 };
  };

  const textNodes = [...document.querySelectorAll('body *')].filter((el) => {
    if (!el.childNodes.length) return false;
    const direct = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
    );
    if (!direct) return false;
    const r = rectOf(el);
    return r.width > 0 && r.height > 0;
  });

  let lowContrast = 0;
  for (const el of textNodes) {
    const cs = getComputedStyle(el);
    const fg = parseRGB(cs.color);
    if (!fg || fg.a < 0.1) continue;
    const bg = bgOf(el);
    const l1 = lum(fg) + 0.05;
    const l2 = lum(bg) + 0.05;
    const ratio = l1 > l2 ? l1 / l2 : l2 / l1;
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 600;
    const large = size >= 24 || (size >= 18.66 && bold);
    const min = large ? 3 : 4.5;
    if (ratio < min) {
      lowContrast++;
      if (problems.filter((p) => p.type === 'contrast').length < 6) {
        problems.push({
          type: 'contrast',
          ratio: +ratio.toFixed(2),
          need: min,
          size,
          color: cs.color,
          text: el.textContent.trim().slice(0, 45),
        });
      }
    }
  }

  // 2. elements overflowing their parent horizontally
  let overflowing = 0;
  for (const el of document.querySelectorAll('main *')) {
    const p = el.parentElement;
    if (!p) continue;
    const a = rectOf(el);
    const b = rectOf(p);
    if (a.width === 0 || b.width === 0) continue;
    const ps = getComputedStyle(p);
    if (ps.overflowX !== 'visible') continue;
    if (a.right > b.right + 2 || a.left < b.left - 2) {
      overflowing++;
      if (problems.filter((x) => x.type === 'overflow').length < 5) {
        problems.push({
          type: 'overflow',
          tag: el.tagName,
          cls: (el.className || '').toString().slice(0, 60),
          text: el.textContent.trim().slice(0, 40),
        });
      }
    }
  }

  // 3. broken images
  const imgs = [...document.images];
  const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0);

  // 4. tap-target size on interactive elements
  const small = [...document.querySelectorAll('a,button')].filter((el) => {
    const r = rectOf(el);
    return r.width > 0 && r.height > 0 && r.height < 22;
  });

  return {
    lowContrast,
    overflowing,
    images: imgs.length,
    brokenImages: broken.length,
    brokenSrc: broken.slice(0, 3).map((i) => i.src),
    smallTargets: small.length,
    problems,
  };
};

(async () => {
  const browser = await chromium.launch();
  for (const [name, url] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(AUDIT);
    console.log(
      `\n### ${name}  contrast=${r.lowContrast} overflow=${r.overflowing} imgs=${r.images} broken=${r.brokenImages} smallTargets=${r.smallTargets}`,
    );
    if (r.brokenSrc.length) console.log('   broken:', r.brokenSrc);
    for (const p of r.problems) console.log('   -', JSON.stringify(p));
    await ctx.close();
  }
  await browser.close();
})();
