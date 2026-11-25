// Browser tests for the app's screens, run in headless Chromium.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';
import { startServer, openApp, NY_LONDON } from './helpers.js';

let server, browser;
before(async () => { server = await startServer(); browser = await chromium.launch(); });
after(async () => { await browser.close(); await server.close(); });

// The app waits briefly after each change before redrawing (so sliders stay smooth); let it settle.
const settle = (page) => page.waitForTimeout(250);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

test('first visit requires accepting the disclaimer', async () => {
  const { page, ctx, errors } = await openApp(browser, server.url, { accept: false });
  await page.waitForSelector('#legal-dialog[open]');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#legal-dialog', (d) => d.open), true, 'Escape must not dismiss it');
  await page.click('#legal-accept');
  await page.reload(); await page.waitForSelector('.day');
  assert.equal(await page.$eval('#legal-dialog', (d) => d.open), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('search box picks airports by keyboard and mouse', async () => {
  const { page, ctx, errors } = await openApp(browser, server.url, { trip: NY_LONDON });
  await page.click('#dest'); await page.keyboard.type('tok'); await page.keyboard.press('Enter'); await settle(page);
  assert.equal(await page.inputValue('#dest'), 'Tokyo (HND)');
  assert.match(await page.textContent('#summary h3'), /New York → Tokyo/);
  await page.click('#home'); await page.keyboard.type('syd');
  await page.click('#home-list [role=option] >> nth=0'); await settle(page);
  assert.equal(await page.inputValue('#home'), 'Sydney (SYD)');
  await page.click('#home'); await page.keyboard.type('zzzz'); await page.keyboard.press('Escape');
  assert.equal(await page.inputValue('#home'), 'Sydney (SYD)', 'Escape restores the saved city');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('setup is short: secondary settings start collapsed', async () => {
  const { page, ctx } = await openApp(browser, server.url, { trip: NY_LONDON });
  assert.equal(await page.isVisible('#strategy'), false);
  assert.equal(await page.isVisible('#weight'), false);
  await page.click('#more-options summary');
  assert.equal(await page.isVisible('#strategy'), true);
  assert.equal(await page.isVisible('#weight'), false, 'water details stay inside their own section');
  await ctx.close();
});

test('Today card follows the trip', async () => {
  const trip = { ...NY_LONDON, ret: true, retDate: '2026-12-09', retTime: '17:00', retDurH: 8, retDurM: 0 };
  const cases = [
    ['2026-11-20T15:00:00Z', /Trip starts in \d+ days/],
    ['2026-12-02T03:00:00Z', /In the air/],
    ['2026-12-04T09:30:00Z', /London time is 9:30/],
    ['2026-12-04T02:00:00Z', /sleep time/],
    ['2026-12-09T23:00:00Z', /In the air · Return/i],
    ['2027-01-20T12:00:00Z', /You're home/],
  ];
  for (const [now, expected] of cases) {
    const { page, ctx, errors } = await openApp(browser, server.url, { trip, now });
    assert.match(await page.textContent('#today'), expected, now);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('water target is standard until personalized', async () => {
  const { page, ctx } = await openApp(browser, server.url, { trip: NY_LONDON, context: { locale: 'en-GB', timezoneId: 'Europe/London' } });
  const target = async () => { await settle(page); await page.click('#tab-water'); const t = (await page.textContent('#pane-water .big-num')).trim(); await page.click('#tab-plan'); return t; };
  assert.equal(await target(), '2.7 L');
  await page.click('#more-options summary'); await page.click('#water-personal summary');
  await page.selectOption('#climate', 'hot');
  assert.equal(await target(), '3.3 L');
  await page.click('#water-standard');
  assert.equal(await target(), '2.7 L');
  await ctx.close();
});

test('return trip: plan, sleep logs and calendar export', async () => {
  const { page, ctx, errors } = await openApp(browser, server.url, { trip: NY_LONDON, context: { acceptDownloads: true } });
  assert.equal(await page.isVisible('#tab-return'), false);
  await page.click('#ret-section summary'); await settle(page);
  assert.equal(await page.isVisible('#tab-return'), true);
  await page.click('#tab-return');
  const sync = () => page.$eval('#ret-summary .stat:nth-child(3) .v', (e) => e.textContent);
  const before = await sync();
  await page.click('#ret-days [data-checkin="1"]');
  await page.fill('#ci-bed', '02:00'); await page.fill('#ci-wake', '10:00');
  await page.click('#checkin-form button[type=submit]'); await settle(page);
  assert.notEqual(await sync(), before, 'a return sleep log adapts the return plan');
  assert.equal((await page.$$('#days .logged')).length, 0, 'outbound logs are separate');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ret-ics-btn')]);
  const ics = await readFile(await dl.path(), 'utf8');
  assert.ok((ics.match(/SUMMARY:Sleep \(back home/g) || []).length >= 1);
  assert.ok(ics.includes('Not medical or health advice'));
  // Closing the section turns the return off; reopening keeps the details.
  const date = await page.inputValue('#retDate');
  await page.click('#ret-section summary'); await settle(page);
  assert.equal(await page.isVisible('#tab-return'), false);
  await page.click('#ret-section summary'); await settle(page);
  assert.equal(await page.isVisible('#tab-return'), true);
  assert.equal(await page.inputValue('#retDate'), date);
  await page.reload(); await page.waitForSelector('.day');
  assert.equal(await page.$eval('#ret-section', (d) => d.open), true, 'stays open after reload');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('device defaults: clock, units and dates', async () => {
  const us = await openApp(browser, server.url, { trip: { ...NY_LONDON, weight: null, weightUnit: null }, context: { locale: 'en-US' } });
  assert.match(await us.page.textContent('#clock option[value=auto]'), /12-hour/);
  assert.match(await us.page.textContent('.stat:nth-child(4) .v'), /am|pm/);
  await us.ctx.close();
  const uk = await openApp(browser, server.url, { trip: NY_LONDON, context: { locale: 'en-GB', timezoneId: 'Europe/London' } });
  assert.match(await uk.page.textContent('#clock option[value=auto]'), /24-hour/);
  assert.match(await uk.page.textContent('.stat:nth-child(4) .v'), /^\d\d:\d\d$/);
  assert.match(await uk.page.textContent('#arrival-hint'), /Wed 2 Dec/);
  await uk.ctx.close();
});

test('install banner only where possible; closing hides it for 24 hours', async () => {
  const visible = async (context) => {
    const ctx = await browser.newContext(context);
    await ctx.addInitScript(() => localStorage.setItem('atc-disclaimer', '1'));
    const page = await ctx.newPage(); await page.goto(server.url); await page.waitForSelector('.day'); await page.waitForTimeout(300);
    const r = { banner: await page.isVisible('#install-banner'), icon: await page.$('#install-btn') !== null };
    if (r.banner) {
      await page.click('#install-banner-close');
      await page.reload(); await page.waitForSelector('.day'); await page.waitForTimeout(300);
      r.closed = await page.isVisible('#install-banner');
      await page.evaluate(() => localStorage.setItem('atc-install-dismissed', JSON.stringify(Date.now() - 25 * 3600000)));
      await page.reload(); await page.waitForSelector('.day'); await page.waitForTimeout(300);
      r.back = await page.isVisible('#install-banner');
    }
    await ctx.close(); return r;
  };
  assert.deepEqual(await visible({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), { banner: true, icon: false, closed: false, back: true });
  assert.deepEqual(await visible({ userAgent: MAC_SAFARI, viewport: { width: 1280, height: 900 } }), { banner: false, icon: false });
  assert.deepEqual(await visible({ viewport: { width: 1280, height: 900 } }), { banner: false, icon: false });
});

test('theme is automatic: season by default, holiday while one is on', async () => {
  const autumn = await openApp(browser, server.url, { trip: NY_LONDON, now: '2026-09-20T15:00:00Z' });
  assert.deepEqual(await autumn.page.evaluate(() => ({ ...document.documentElement.dataset })), { season: 'autumn' });
  await autumn.ctx.close();
  const xmas = await openApp(browser, server.url, { trip: NY_LONDON, now: '2026-12-20T15:00:00Z' });
  const ds = await xmas.page.evaluate(() => ({ ...document.documentElement.dataset }));
  assert.equal(ds.holiday, 'christmas');
  await xmas.page.click('#appearance-btn');
  assert.match(await xmas.page.textContent('#theme-now'), /Christmas/);
  // The menu separates seasons and holidays, and the choice sticks.
  const groups = await xmas.page.$$eval('#theme-picker legend', (g) => g.map((x) => x.textContent));
  assert.deepEqual(groups, ['Automatic', 'Seasons', 'Holidays']);
  const pick = (v) => xmas.page.click(`#theme-picker input[value="${v}"]`);
  await pick('season:summer'); await settle(xmas.page);
  assert.deepEqual(await xmas.page.evaluate(() => ({ ...document.documentElement.dataset })), { season: 'summer' });
  await pick('holiday:pride'); await settle(xmas.page);
  assert.equal(await xmas.page.evaluate(() => document.documentElement.dataset.holiday), 'pride');
  await pick('season'); await settle(xmas.page);
  assert.deepEqual(await xmas.page.evaluate(() => ({ ...document.documentElement.dataset })), { season: 'winter' }, 'current season, no holiday');
  await pick('holiday:halloween'); await settle(xmas.page);
  await xmas.page.reload(); await xmas.page.waitForSelector('.day');
  assert.equal(await xmas.page.evaluate(() => document.documentElement.dataset.holiday), 'halloween', 'choice is saved');
  assert.equal(await xmas.page.$eval('#theme-picker input:checked', (e) => e.value), 'holiday:halloween');
  await xmas.page.click('#appearance-btn');
  await xmas.page.uncheck('input[name=decorations]'); await settle(xmas.page);
  assert.equal(await xmas.page.$eval('#decor-particles', (e) => e.children.length), 0);
  await xmas.ctx.close();
});

test('layout lines up on desktop and phones, on every tab', async () => {
  const sizes = [{ viewport: { width: 1440, height: 900 } }, { viewport: { width: 1024, height: 800 } }, { viewport: { width: 768, height: 1000 } },
    devices['iPhone 13'], { viewport: { width: 320, height: 640 } }];
  for (const context of sizes) {
    const { page, ctx, errors } = await openApp(browser, server.url, { trip: NY_LONDON, context });
    await page.click('#ret-section summary'); await settle(page);
    await page.click('#more-options summary');
    for (const tab of ['plan', 'flight', 'water', 'recovery', 'return']) {
      await page.click('#tab-' + tab);
      const issues = await page.evaluate(() => {
        const out = []; const W = innerWidth; const R = (e) => e.getBoundingClientRect();
        if (document.documentElement.scrollWidth > W) out.push('page scrolls sideways');
        document.querySelectorAll('.row-2').forEach((row) => {
          const c = [...row.children].map((f) => f.querySelector('input,select')).filter((e) => e && e.offsetParent);
          if (c.length === 2 && getComputedStyle(row).gridTemplateColumns.split(' ').length === 2) {
            const [a, b] = c.map(R);
            if (Math.abs(a.top - b.top) > 1 || Math.abs(a.height - b.height) > 1) out.push('misaligned: ' + row.innerText.split('\n')[0]);
          }
        });
        document.querySelectorAll('.panel, .field, .stat, .notice').forEach((e) => {
          if (e.offsetParent && e.scrollWidth > e.clientWidth + 1) out.push('overflow: ' + (e.id || e.className));
        });
        return out;
      });
      assert.deepEqual(issues, [], `${JSON.stringify(context.viewport)} ${tab}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Travel Tools: list on phones, buttons on wider screens', async () => {
  for (const [context, wide] of [[devices['iPhone 13'], false], [{ viewport: { width: 1280, height: 900 } }, true]]) {
    const { page, ctx } = await openApp(browser, server.url, { trip: NY_LONDON, context });
    const links = await page.$$eval('.quick-links a', (a) => a.map((x) => [x.querySelector('.ql-name').textContent, x.href]));
    assert.equal(links.length, 5);
    assert.deepEqual(links[0], ['Jet Lag & Recovery', 'https://jetlag.alltripsconsidered.com/']);
    const current = await page.$$eval('.quick-links a[aria-current=page] .ql-name', (e) => e.map((x) => x.textContent));
    assert.deepEqual(current, ['Jet Lag & Recovery']);
    assert.equal(await page.$eval('.quick-links ul', (u) => getComputedStyle(u).display), wide ? 'flex' : 'block');
    if (!wide) assert.equal(await page.$eval('.quick-links a[aria-current] .ql-arrow', (e) => e.innerText), 'YOU ARE HERE');
    await ctx.close();
  }
});

test('update banner offers a refresh', async () => {
  const { page, ctx, errors } = await openApp(browser, server.url, { trip: NY_LONDON });
  assert.equal(await page.isVisible('#update-banner'), false);
  await page.evaluate(async () => (await import('./js/pwa.js')).showUpdateBanner());
  assert.equal(await page.isVisible('#update-banner'), true);
  await page.click('#update-later');
  assert.equal(await page.isVisible('#update-banner'), false);
  await page.evaluate(async () => (await import('./js/pwa.js')).showUpdateBanner());
  await Promise.all([page.waitForEvent('load'), page.click('#update-refresh')]);
  assert.deepEqual(errors, []);
  await ctx.close();
});
