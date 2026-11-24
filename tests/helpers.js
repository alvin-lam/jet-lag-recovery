// Shared test helpers: a tiny static file server for the app, and browser pages with a clean or seeded state.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};

/** Serve the repository root on a free local port. */
export function startServer() {
  const server = http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(ROOT, path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) });
  }));
}

/**
 * Open the app in a new browser context.
 * @param {import('playwright').Browser} browser
 * @param {string} url
 * @param {object} [o]
 * @param {object} [o.context]   Playwright context options (viewport, locale, timezoneId, device...)
 * @param {object} [o.trip]      saved trip settings to start from
 * @param {boolean} [o.accept]   pre-accept the disclaimer and silence the install reminder (default true)
 * @param {string|Date} [o.now]  fixed clock time
 */
export async function openApp(browser, url, { context = {}, trip, accept = true, now } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York', locale: 'en-US', ...context });
  await ctx.addInitScript(({ trip, accept }) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (accept) {
      localStorage.setItem('atc-disclaimer', '1');
      localStorage.setItem('atc-install-dismissed', String(Date.now()));
    }
    if (trip) localStorage.setItem('atc-state', JSON.stringify(trip));
  }, { trip: trip || null, accept });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (now) await page.clock.setFixedTime(new Date(now));
  await page.goto(url);
  if (accept) await page.waitForSelector('.day');
  return { page, ctx, errors };
}

/** A fixed trip used by several tests: New York to London, 1 December 2026. */
export const NY_LONDON = { home: 'code:JFK', dest: 'code:LHR', depDate: '2026-12-01', depTime: '18:30', durH: 7, durM: 0, tripDays: 7, v: 4 };
