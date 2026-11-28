// Drives the real app in headless Chromium: errors, CSP violations, broken text, layout overflow,
// accessibility basics, the dialogs and the offline cache. Needs Playwright; skipped without it.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { CHECKS } from './report.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

function serve(root) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      await stat(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  for (const id of ['playwright', 'playwright-core', '@playwright/test']) {
    try { return req(id); } catch { /* try the next */ }
  }
  return null;
}

// Records anything that went wrong on a page.
function watch(page) {
  const log = { errors: [], csp: [], failed: [] };
  page.on('pageerror', (e) => {
    const at = (String(e.stack).split('\n').find((l) => /\s+at /.test(l)) || '').trim().replace(/https?:\/\/[^/]+\//, 'docs/');
    log.errors.push('uncaught: ' + e.message + (at ? ` (${at})` : ''));
  });
  page.on('console', (m) => {
    if (m.type() === 'error') log.errors.push('console.error: ' + m.text().slice(0, 200));
  });
  page.on('requestfailed', (req) => {
    if (!/favicon|\.ics$|^blob:|^data:/.test(req.url())) log.failed.push(`${req.url()} (${req.failure()?.errorText})`);
  });
  page.on('response', (res) => { if (res.status() >= 400) log.failed.push(`${res.url()} → ${res.status()}`); });
  return log;
}

const INIT = () => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'} (${e.sourceFile || ''}:${e.lineNumber || ''})`));
};

// Visible text and markup problems, evaluated inside the page.
function pageAudit() {
  const out = { junk: [], overflow: null, a11y: [], ids: [] };
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const text = document.body.innerText;
  const re = /\b(NaN|undefined|Infinity)\b|\[object Object\]|\bnull\b/g;
  for (const m of text.matchAll(re)) {
    const i = m.index;
    out.junk.push(text.slice(Math.max(0, i - 40), i + 30).replace(/\s+/g, ' '));
  }
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) {
    const wide = [...document.querySelectorAll('body *')].filter((el) => visible(el) && el.getBoundingClientRect().right > de.clientWidth + 1)
      .slice(0, 3).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
    out.overflow = `page is ${de.scrollWidth}px wide in a ${de.clientWidth}px viewport: ${wide.join(', ')}`;
  }
  const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || el.textContent || el.title || '').trim();
  for (const b of document.querySelectorAll('button, [role=button], a[href]')) if (visible(b) && !name(b)) out.a11y.push(`${b.tagName.toLowerCase()}${b.id ? '#' + b.id : ''} has no accessible name`);
  for (const i of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
    if (!visible(i)) continue;
    const labelled = i.labels?.length || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || i.closest('label');
    if (!labelled) out.a11y.push(`${i.tagName.toLowerCase()}#${i.id || i.name} has no label`);
  }
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) out.a11y.push(`img ${img.src.split('/').pop()} has no alt`);
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  out.ids = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  for (const el of document.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')) {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
      for (const id of (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) if (!document.getElementById(id)) out.a11y.push(`${attr}="${id}" points to nothing`);
    }
  }
  return out;
}

// Trips that stress the views. Saved into storage before the page loads.
const SCENARIOS = [
  ['New York → London, with return', { home: 'code:JFK', dest: 'code:LHR', ret: true, retDurH: 7, retDurM: 0, tripDays: 7 }],
  ['Los Angeles → Singapore, 17 h, pre-adjust 3 days', { home: 'code:LAX', dest: 'code:SIN', durH: 17, durM: 30, preDays: 3 }],
  ['Sydney → London over a DST change', { home: 'code:SYD', dest: 'code:LHR', depDate: '2027-04-04', durH: 23, durM: 30 }],
  ['Short trip, stay on home time', { home: 'code:LHR', dest: 'code:NRT', tripDays: 2 }],
  ['Kathmandu (UTC+5:45) → Honolulu, night owl', { home: 'tz:Asia/Kathmandu', dest: 'code:HNL', chrono: 'owl', bed: '02:00', wake: '10:00' }],
  ['Same city', { home: 'code:CDG', dest: 'code:CDG' }],
  ['Personal water, imperial, 12-hour', { personalWater: true, weight: 180, weightUnit: 'lb', climate: 'hot', activity: 'high', volUnit: 'imperial', clock: '12', alcohol: 3 }],
  ['Return before arrival (error state)', { home: 'code:JFK', dest: 'code:LHR', ret: true, retDurH: 7, retDurM: 0, retOffset: -3 }],
];

export async function runBrowser(r, { docs, screens }) {
  r.start('Browser hunt (headless Chromium)', CHECKS.display);
  const pw = loadPlaywright();
  if (!pw) return r.skip('Browser checks (display, dialogs, odd input, offline)', 'Playwright is not installed. Install it with: npm i -g playwright && npx playwright install chromium');
  let browser;
  try { browser = await pw.chromium.launch(); } catch (e) {
    try { browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); } catch { return r.skip('Chromium would not start', e.message.split('\n')[0]); }
  }
  const server = await serve(docs);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const depDate = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  const shots = [];
  const evidenceDir = join(docs, '..', 'test-results', 'qc-evidence');
  let shotN = 0;
  /** Screenshot kept as evidence for a finding. Returns its path relative to the repository. */
  const evidence = async (page, name) => {
    mkdirSync(evidenceDir, { recursive: true });
    const file = join(evidenceDir, `${String(++shotN).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
    return 'test-results/qc-evidence/' + file.split('/').pop();
  };

  const run = async (label, ctxOpts, body) => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', ...ctxOpts });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const log = watch(page);
    try {
      await body(page, ctx, log);
    } catch (e) {
      r.fail(`${label}: the check itself crashed`, e.message.split('\n').slice(0, 4).join('\n'));
    }
    const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
    const problems = [...log.errors, ...csp.map((c) => 'CSP violation: ' + c), ...log.failed.map((f) => 'request failed: ' + f)];
    r.under(CHECKS.display);
    r.check('fail', `${label}: no errors, CSP violations or failed requests`, [...new Set(problems)], {
      where: 'Browser console', steps: `Open the app: ${label}.`, evidence: problems.length ? 'Recorded by Playwright: ' + await evidence(page, label) : '',
    });
    if (screens) {
      const file = join(screens, label.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png');
      await page.screenshot({ path: file, fullPage: true }).catch(() => {});
      shots.push(file);
    }
    await ctx.close();
  };

  // Audits the page as it is now. With `acc`, problems are collected for one combined report.
  const audit = async (page, label, acc) => {
    const a = await page.evaluate(pageAudit);
    const tag = (list) => list.map((x) => (acc ? `${label}: ` : '') + x);
    const sink = acc || { junk: [], overflow: [], a11y: [], ids: [] };
    sink.junk.push(...tag(a.junk));
    if (a.overflow) sink.overflow.push(...tag([a.overflow]));
    sink.a11y.push(...tag(a.a11y));
    sink.ids.push(...tag(a.ids));
    if (!acc) report(label, sink);
  };
  const report = (label, a, page) => {
    r.under(CHECKS.display);
    const meta = { steps: `Open the app: ${label}.`, evidence: 'Read from the rendered page in headless Chromium.' };
    r.check('fail', `${label}: no NaN, undefined or null shown to the traveler`, a.junk, meta);
    r.check('fail', `${label}: no sideways scrolling`, a.overflow, meta);
    r.check('warn', `${label}: buttons, inputs and images are labelled`, [...new Set(a.a11y)], meta);
    r.check('fail', `${label}: no duplicate ids after rendering`, [...new Set(a.ids)], meta);
  };

  const seed = async (ctx, trip) => {
    await ctx.addInitScript(([t]) => {
      if (sessionStorage.getItem('qc-seeded')) return;
      sessionStorage.setItem('qc-seeded', '1');
      localStorage.setItem('atc-disclaimer', '999');
      localStorage.setItem('atc-install-dismissed', String(Date.now()));
      if (t) localStorage.setItem('atc-state', JSON.stringify(t));
    }, [trip]);
  };

  try {
    // 1. First visit: the disclaimer must block until accepted, then a plan appears.
    await run('First visit (desktop)', { viewport: { width: 1280, height: 900 }, locale: 'en-US', timezoneId: 'America/New_York' }, async (page, ctx, log) => {
      await page.goto(url, { waitUntil: 'load' });
      const open = await page.locator('#legal-dialog').evaluate((d) => d.open).catch(() => false);
      if (open) r.pass('Disclaimer shows on first visit'); else r.fail('Disclaimer shows on first visit');
      await page.keyboard.press('Escape');
      const still = await page.locator('#legal-dialog').evaluate((d) => d.open).catch(() => false);
      if (still) r.pass('Escape does not dismiss the required disclaimer'); else r.fail('Escape does not dismiss the required disclaimer');
      await page.click('#legal-accept');
      await page.waitForSelector('#days .day, #days > *', { timeout: 5000 });
      const n = await page.locator('#days > *').count();
      if (n > 0) r.pass(`A plan renders (${n} day cards)`); else r.fail('A plan renders');
      await page.reload();
      const again = await page.locator('#legal-dialog').evaluate((d) => d.open).catch(() => false);
      if (!again) r.pass('Disclaimer stays accepted after a reload'); else r.fail('Disclaimer stays accepted after a reload');
      await audit(page, 'Default plan');

      // Every tab, the appearance panel, both dialogs and the search box.
      const tabs = await page.locator('[role=tab]:visible').all();
      const tabProblems = [];
      for (const t of tabs) {
        await t.click();
        const pane = await t.getAttribute('aria-controls');
        const shown = await page.locator('#' + pane).isVisible();
        const html = await page.locator('#' + pane).innerText();
        if (!shown || !html.trim()) tabProblems.push(`${await t.innerText()} shows an empty or hidden pane`);
      }
      r.check('fail', `All ${tabs.length} tabs open a pane with content`, tabProblems);
      await page.click('#tab-plan');
      await audit(page, 'After visiting every tab');

      await page.click('#appearance-btn');
      const modes = [];
      for (const m of ['dark', 'light', 'system']) {
        await page.check(`input[name=mode][value=${m}]`);
        modes.push(await page.evaluate(() => document.documentElement.dataset.mode || document.documentElement.className));
      }
      const swatches = await page.locator('#scheme-list input, #scheme-list button, #scheme-list [role=option]').count();
      if (swatches > 3) r.pass(`Appearance panel lists ${swatches} color choices`); else r.warn('Appearance panel lists its color choices', `only ${swatches} found`);
      await page.keyboard.press('Escape');

      r.under(CHECKS.export);
      await page.click('#ics-btn');
      await page.click('[data-cal=google]');
      const links = await page.locator('#cal-google-list a').count();
      const hrefs = await page.locator('#cal-google-list a').evaluateAll((as) => as.map((a) => a.href));
      const badLinks = hrefs.filter((h) => !h.startsWith('https://calendar.google.com/') || /NaN|undefined/.test(h));
      if (links) r.check('fail', `Google Calendar offers ${links} links, all well formed`, badLinks); else r.fail('Google Calendar lists one link per night');
      await page.click('#cal-close');

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
        (async () => { await page.click('#ics-btn'); await page.click('[data-cal=other]'); })(),
      ]);
      if (download) {
        const fs = await import('node:fs/promises');
        const text = await fs.readFile(await download.path(), 'utf8');
        if (/^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR$/.test(text) && !/NaN|undefined/.test(text)) r.pass(`.ics download is a valid calendar (${(text.match(/BEGIN:VEVENT/g) || []).length} events)`);
        else r.fail('.ics download is a valid calendar', text.slice(0, 200));
      } else r.warn('.ics download starts from Other (.ics)', 'no download event within 3 s');
      await page.keyboard.press('Escape');

      await page.click('#share-btn');
      const shareOpen = await page.locator('#share-dialog').evaluate((d) => d.open);
      if (shareOpen) r.pass('Share dialog opens'); else r.fail('Share dialog opens');
      await page.click('#share-close');

      r.under(CHECKS.data);
      await page.fill('#home', 'tromso');
      await page.waitForTimeout(250);
      const opts = await page.locator('#home-list [role=option]').allInnerTexts();
      if (opts.some((o) => /Troms/.test(o))) r.pass('Typing "tromso" offers Tromsø'); else r.fail('Typing "tromso" offers Tromsø', opts.join(' | ') || 'no options');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      const expanded = await page.getAttribute('#home', 'aria-expanded');
      if (expanded === 'false') r.pass('Choosing a search result closes the list'); else r.warn('Choosing a search result closes the list', `aria-expanded=${expanded}`);

      r.under(CHECKS.display);
      // Reset restores the defaults and still renders.
      await page.click('#reset-btn');
      await page.waitForTimeout(200);
      if ((await page.locator('#days > *').count()) > 0) r.pass('Reset still shows a plan'); else r.fail('Reset still shows a plan');

      // Typing odd values should never break the page. The form has novalidate, so min and max are not enforced.
      r.under(CHECKS.edge);
      const ODD = [['#durH', ''], ['#tripDays', '-4'], ['#durM', '999'], ['#tripDays', '0'], ['#durH', '30'], ['#tripDays', '2.5'], ['#durM', '-15']];
      for (const [sel, v] of ODD) {
        await page.click('#reset-btn');
        await page.waitForTimeout(100);
        const before = log.errors.length;
        await page.fill(sel, v);
        await page.waitForTimeout(200);
        const errs = log.errors.splice(before);
        const junk = (await page.evaluate(pageAudit)).junk;
        const name = `Typing "${v}" into ${sel} keeps the page working`;
        if (!errs.length && !junk.length) { r.pass(name); continue; }
        const crash = errs.some((e) => /reading 'bed'/.test(e));
        r.fail(crash ? `Typing "${v}" into the trip length crashes the plan` : name, '', null, {
          where: crash ? 'docs/js/ui/plan-view.js:38 (`p.days[0]` is undefined), docs/js/core/model.js:216 (`minDays` goes negative), docs/index.html:165 (`novalidate` skips min="1")' : `docs/index.html (${sel})`,
          steps: `Accept the disclaimer, press Reset, then type "${v}" into ${sel}.`,
          expected: 'The value is rejected or clamped and the plan updates, with no error.',
          actual: [...errs, ...junk.map((j) => 'page shows: ' + j)].join('\n') + (crash ? '\nThe summary stops rendering and the rest of the page keeps the previous plan.' : ''),
          evidence: 'Reproduced in headless Chromium; screenshot ' + await evidence(page, name),
        });
      }
      r.under(CHECKS.display);
      await page.click('#reset-btn');
    });

    // 2. Each tricky trip, on a phone in different regions.
    const regions = [['en-US', 'America/Los_Angeles'], ['en-GB', 'Europe/London'], ['de-DE', 'Asia/Tokyo'], ['en-AU', 'Australia/Sydney']];
    for (const [i, [label, patch]] of SCENARIOS.entries()) {
      const [locale, timezoneId] = regions[i % regions.length];
      const trip = { depDate, depTime: '18:30', durH: 7, durM: 0, ...patch };
      if (trip.ret) trip.retDate = new Date(Date.parse(depDate) + (trip.retOffset ?? 8) * 86400000).toISOString().slice(0, 10);
      delete trip.retOffset;
      await run(`${label} (phone, ${locale})`, { ...pw.devices['iPhone 13'], locale, timezoneId, colorScheme: i % 2 ? 'dark' : 'light' }, async (page, ctx) => {
        await seed(ctx, trip);
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForSelector('#days > *', { timeout: 5000 });
        if (trip.ret) {
          const hint = await page.locator('#ret-hint').innerText();
          if (!hint.trim()) r.fail(`${label}: return hint is filled in`);
        }
        const acc = { junk: [], overflow: [], a11y: [], ids: [] };
        for (const t of await page.locator('[role=tab]:visible').all()) {
          await t.click();
          await page.waitForTimeout(50);
          await audit(page, (await t.innerText()).replace(/\s+/g, ' ').replace(/PREVIEW/i, '').trim() + ' tab', acc);
        }
        report(`${label}, every tab`, acc, page);
      });
    }

    // 3. Offline: once the service worker has cached the app, a reload without a network still works.
    r.under(CHECKS.release);
    {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
      await ctx.addInitScript(INIT);
      await seed(ctx, null);
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(url, { waitUntil: 'load' });
      const sw = await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return 'unsupported';
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
        if (!reg) return 'not ready';
        const keys = await caches.keys();
        const c = await caches.open(keys[0]);
        return (await c.keys()).length;
      });
      if (typeof sw === 'number' && sw > 10) r.pass(`Service worker installs and caches ${sw} files`);
      else r.fail('Service worker installs and caches the app', String(sw));
      await ctx.setOffline(true);
      await page.reload({ waitUntil: 'load' }).catch((e) => log.errors.push('offline reload: ' + e.message));
      const ok = await page.waitForSelector('#days > *', { timeout: 5000 }).then(() => true).catch(() => false);
      if (ok) r.pass('The app loads and plans offline'); else r.fail('The app loads and plans offline');
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (shots.length) r.pass(`Saved ${shots.length} screenshots to ${screens}`);
}
