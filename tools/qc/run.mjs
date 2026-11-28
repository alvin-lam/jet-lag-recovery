#!/usr/bin/env node
// QC & Bug Hunter for Jet Lag & Recovery.
//
//   node tools/qc/run.mjs                 static checks, model fuzzing and the browser hunt
//   node tools/qc/run.mjs --quick         static checks and a short fuzz run, no browser
//   node tools/qc/run.mjs --only static   one part: static, model or browser (comma-separated)
//   node tools/qc/run.mjs --cases 20000   more random trips
//   node tools/qc/run.mjs --seed 42       replay an earlier run exactly
//   node tools/qc/run.mjs --base prod     git ref the cache bump check compares with (default origin/prod)
//   node tools/qc/run.mjs --screens       save full-page screenshots of every browser scenario
//   node tools/qc/run.mjs --strict        exit with an error on warnings too
//   node tools/qc/run.mjs --verbose       print passed checks in the console too
//
// A Markdown report is written to qc-report.md at the repository root (ignored by git), in the same layout
// as the points-calculator QC & Bug Hunter. Screenshots kept as evidence go to test-results/qc-evidence/.
// Exit code: 0 when nothing failed, 1 when something failed.
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Report } from './report.mjs';
import { runStatic } from './static-checks.mjs';
import { runModel } from './model-hunt.mjs';
import { runBrowser } from './browser-hunt.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const docs = join(root, 'docs');

const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const value = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
if (flag('help') || flag('h')) {
  console.log(String((await import('node:fs')).readFileSync(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(1, 17).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const quick = flag('quick');
const parts = new Set((value('only', quick ? 'static,model' : 'static,model,browser')).split(','));
const seed = Number(value('seed', Date.now() % 100000));
const cases = Number(value('cases', quick ? 500 : 5000));
const baseRef = value('base', 'origin/prod');
const screens = flag('screens') ? join(root, 'test-results', 'qc-screens') : null;
if (screens) mkdirSync(screens, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
rmSync(join(root, 'test-results', 'qc-evidence'), { recursive: true, force: true }); // screenshots from an earlier run
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return '?'; } };
const dirty = git('status', '--porcelain', '--', 'docs') ? ' + uncommitted changes' : '';

console.log(`QC & Bug Hunter · seed ${seed} · ${[...parts].join(', ')}`);
const r = new Report();
const started = Date.now();
try {
  if (parts.has('static')) await runStatic(r, { docs, today, baseRef });
  if (parts.has('model')) await runModel(r, { docs, seed, cases });
  if (parts.has('browser')) await runBrowser(r, { docs, screens });
} catch (e) {
  r.start('QC tool');
  r.fail('The QC run stopped early', e.stack);
}
const c = r.summary();
const reportPath = join(root, 'qc-report.md');
writeFileSync(reportPath, r.markdown({
  when: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC', seed, cases, parts: [...parts].join(', '),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'), commit: git('rev-parse', '--short', 'HEAD') + dirty,
}));
console.log(`  Report: ${reportPath} · ${((Date.now() - started) / 1000).toFixed(1)} s · replay with --seed ${seed}\n`);
process.exit(c.fail || (flag('strict') && c.warn) ? 1 : 0);
