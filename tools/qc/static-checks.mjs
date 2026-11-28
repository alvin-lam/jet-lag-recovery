// Static checks over the published site in docs/: offline cache list, imports, HTML, metadata and data.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, posix } from 'node:path';
import { execFileSync } from 'node:child_process';

const read = (p) => readFileSync(p, 'utf8');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Files that are served but do not belong in the offline cache.
const NOT_CACHED = new Set(['sw.js', 'CNAME', 'robots.txt', 'sitemap.xml', 'assets/img/og-image.jpg', 'assets/fonts/OFL.txt']);

function swInfo(docs) {
  const src = read(join(docs, 'sw.js'));
  const cache = (src.match(/const CACHE = '([^']+)'/) || [])[1];
  const block = (src.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1] || '';
  const assets = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return { cache, assets };
}

function checkServiceWorker(r, docs, files) {
  const { cache, assets } = swInfo(docs);
  if (!cache) r.fail('sw.js: CACHE name not found');
  const listed = new Set(assets.map((a) => a.replace(/^\.\//, '')).filter(Boolean));
  const missingOnDisk = [...listed].filter((a) => a !== '' && !existsSync(join(docs, a)));
  r.check('fail', 'Every file in the sw.js ASSETS list exists (a missing one breaks offline install)', missingOnDisk);
  const dupes = assets.filter((a, i) => assets.indexOf(a) !== i);
  r.check('warn', 'No duplicate ASSETS entries', dupes);
  const notListed = files.filter((f) => !NOT_CACHED.has(f) && !listed.has(f));
  r.check('fail', 'Every served file is in the offline cache, or deliberately left out', notListed);
}

// ---------- ES module imports ----------
function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  return names;
}

function checkImports(r, docs, files) {
  const js = files.filter((f) => f.endsWith('.js'));
  const problems = [];
  const imported = new Set();
  for (const f of js) {
    const src = read(join(docs, f));
    for (const m of src.matchAll(/(?:import|export)\s*(\{[^}]*\}|\*\s+as\s+\w+|[\w$]+)?\s*(?:,\s*\{[^}]*\})?\s*from\s*'([^']+)'/g)) {
      const spec = m[2];
      if (!spec.startsWith('.')) { problems.push(`${f}: bare import "${spec}" will not load without a bundler`); continue; }
      const target = posix.normalize(posix.join(posix.dirname(f), spec));
      imported.add(target);
      if (!existsSync(join(docs, target))) { problems.push(`${f}: imports missing file ${spec}`); continue; }
      if (m[1] && m[1].startsWith('{')) {
        const have = exportsOf(read(join(docs, target)));
        for (const part of m[1].slice(1, -1).split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (name && !have.has(name)) problems.push(`${f}: "${name}" is not exported by ${spec}`);
        }
      }
    }
  }
  r.check('fail', 'Every import resolves to a file and a real export', problems);

  // Modules nothing imports and no page loads are dead weight in the cache.
  const html = files.filter((f) => f.endsWith('.html')).map((f) => read(join(docs, f))).join('\n');
  const entry = new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/^\.\//, '')));
  const orphans = js.filter((f) => f !== 'sw.js' && !imported.has(f) && !entry.has(f));
  r.check('warn', 'No orphaned JavaScript modules', orphans);
}

// ---------- HTML ----------
function checkHtml(r, docs, files) {
  const pages = files.filter((f) => f.endsWith('.html'));
  const problems = { inlineStyle: [], inlineScript: [], jsonld: [], refs: [], ids: [], csp: [], alt: [] };
  for (const f of pages) {
    const src = read(join(docs, f));
    const lines = src.split('\n');
    lines.forEach((l, i) => { if (/\sstyle="/.test(l)) problems.inlineStyle.push(`${f}:${i + 1}`); });
    for (const m of src.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type="application\/ld\+json"/.test(m[1])) {
        try { JSON.parse(m[2]); } catch (e) { problems.jsonld.push(`${f}: ${e.message}`); }
      } else if (m[2].trim()) problems.inlineScript.push(`${f}: inline <script${m[1]}> is blocked by script-src 'self'`);
    }
    if (/\son[a-z]+="/i.test(src)) problems.inlineScript.push(`${f}: inline event handler attribute (blocked by the CSP)`);
    for (const m of src.matchAll(/\s(?:src|href)="([^"#:]+)(?:[?#][^"]*)?"/g)) {
      const ref = m[1];
      if (ref.startsWith('//') || ref === '') continue;
      const p = ref === './' || ref.endsWith('/') ? join(docs, ref, 'index.html') : join(docs, dirname(f), ref);
      if (!existsSync(p)) problems.refs.push(`${f}: ${ref}`);
    }
    const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) problems.ids.push(`${f}: #${id}`);
    for (const m of src.matchAll(/<img\b[^>]*>/g)) if (!/\salt=/.test(m[0])) problems.alt.push(`${f}: ${m[0].slice(0, 80)}`);
    if (!/http-equiv="Content-Security-Policy"/.test(src)) problems.csp.push(`${f}: no CSP <meta>`);
  }
  r.check('fail', 'No inline style attributes (blocked by style-src \'self\')', problems.inlineStyle);
  r.check('fail', 'No inline scripts or handlers other than JSON-LD', problems.inlineScript);
  r.check('fail', 'JSON-LD structured data parses', problems.jsonld);
  r.check('fail', 'Every local src and href points to a real file', problems.refs);
  r.check('fail', 'No duplicate element ids', problems.ids);
  r.check('warn', 'Every <img> has alt text', problems.alt);
  r.check('fail', 'Every page carries a CSP <meta> tag', problems.csp);

  // The <meta> CSP should match the Cloudflare header in the README (frame-ancestors only works as a header).
  const readme = read(join(docs, '..', 'README.md'));
  const header = (readme.match(/`Content-Security-Policy: ([^`]+)`/) || [])[1];
  const norm = (s) => s.split(';').map((x) => x.trim()).filter((x) => x && !x.startsWith('frame-ancestors')).sort().join('; ');
  const mism = [];
  if (header) {
    for (const f of pages) {
      const meta = (read(join(docs, f)).match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
      if (meta && norm(meta) !== norm(header)) mism.push(`${f} differs from the README header`);
    }
  }
  r.check('warn', 'CSP <meta> matches the Cloudflare header listed in the README', mism);
}

// ---------- Element ids used from JavaScript ----------
function checkSelectors(r, docs, files) {
  const html = read(join(docs, 'index.html'));
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  // Ids that the scripts create themselves.
  const made = new Set();
  const problems = [];
  const js = files.filter((f) => f.startsWith('js/'));
  for (const f of js) for (const m of read(join(docs, f)).matchAll(/\bid\s*=\s*['"`]([\w-]+)['"`]|id="([\w-]+)"/g)) made.add(m[1] || m[2]);
  for (const f of js) {
    const src = read(join(docs, f));
    for (const m of src.matchAll(/(?:\$\$?|querySelector(?:All)?)\(\s*'#([\w-]+)[^']*'/g)) {
      if (!ids.has(m[1]) && !made.has(m[1])) problems.push(`${f}: #${m[1]} is not in index.html`);
    }
    for (const m of src.matchAll(/getElementById\(\s*'([\w-]+)'/g)) {
      if (!ids.has(m[1]) && !made.has(m[1])) problems.push(`${f}: getElementById('${m[1]}') is not in index.html`);
    }
  }
  r.check('fail', 'Every #id the scripts look up exists in the page', [...new Set(problems)]);
}

// ---------- Manifest and icons ----------
function pngSize(p) {
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function checkManifest(r, docs) {
  let m;
  try { m = JSON.parse(read(join(docs, 'manifest.webmanifest'))); } catch (e) { return r.fail('manifest.webmanifest parses', e.message); }
  const problems = [];
  for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) if (!m[key]) problems.push(`missing "${key}"`);
  for (const icon of [...(m.icons || []), ...(m.screenshots || [])]) {
    const p = join(docs, icon.src);
    if (!existsSync(p)) { problems.push(`${icon.src} does not exist`); continue; }
    if (icon.type === 'image/png') {
      const s = pngSize(p);
      if (!s) problems.push(`${icon.src} is not a PNG`);
      else if (icon.sizes !== `${s[0]}x${s[1]}`) problems.push(`${icon.src} is ${s[0]}x${s[1]}, manifest says ${icon.sizes}`);
    }
  }
  if (!(m.icons || []).some((i) => i.purpose === 'maskable')) problems.push('no maskable icon for Android');
  r.check('fail', 'Manifest is complete and its icons match their stated sizes', problems);

  const html = read(join(docs, 'index.html'));
  const iconProblems = [];
  for (const mm of html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*>/g)) {
    const href = (mm[0].match(/href="([^"]+)"/) || [])[1];
    const sizes = (mm[0].match(/sizes="([^"]+)"/) || [])[1];
    if (href && sizes && href.endsWith('.png') && existsSync(join(docs, href))) {
      const s = pngSize(join(docs, href));
      if (s && sizes !== `${s[0]}x${s[1]}`) iconProblems.push(`${href} is ${s[0]}x${s[1]}, <link> says ${sizes}`);
    }
  }
  r.check('warn', 'Icon <link> sizes match the image files', iconProblems);
}

// ---------- Domain and search metadata ----------
function checkDomain(r, docs, today) {
  const domain = read(join(docs, 'CNAME')).trim();
  const base = `https://${domain}/`;
  const problems = [];
  const sources = {
    'index.html': read(join(docs, 'index.html')),
    'privacy.html': read(join(docs, 'privacy.html')),
    'sitemap.xml': read(join(docs, 'sitemap.xml')),
    'robots.txt': read(join(docs, 'robots.txt')),
    'js/ui/share.js': read(join(docs, 'js/ui/share.js')),
  };
  // URLs that describe this app itself. Links to the sister apps on other subdomains are fine.
  const SELF = [
    /<link rel="canonical" href="([^"]+)"/g, /<meta (?:property|name)="(?:og:url|og:image|og:image:secure_url|twitter:image)" content="([^"]+)"/g,
/<loc>([^<]+)<\/loc>/g, /Sitemap: (\S+)/g, /const SITE = '([^']+)'/g,
  ];
  for (const [f, src] of Object.entries(sources)) {
    for (const re of SELF) {
      for (const m of src.matchAll(re)) {
        const host = (m[1].match(/^https:\/\/([^/]+)/) || [])[1];
        if (host && host !== domain) problems.push(`${f}: ${m[1]} does not use ${domain}`);
      }
    }
  }
  // The app's own entries in the structured data (the publisher and sister apps may live elsewhere).
  try {
    const ld = JSON.parse(sources['index.html'].match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    for (const u of [ld.url, ld.screenshot, ld.thumbnailUrl, ...(ld.image || [])].filter(Boolean)) {
      if (!String(u).startsWith(base)) problems.push(`index.html JSON-LD: ${u} does not use ${domain}`);
    }
  } catch { /* reported by the JSON-LD check */ }
  if (!sources['index.html'].includes(`<link rel="canonical" href="${base}">`)) problems.push(`index.html: canonical URL is not ${base}`);
  if (!sources['robots.txt'].includes(base + 'sitemap.xml')) problems.push('robots.txt does not point to the sitemap on ' + domain);
  r.check('fail', `Every self URL uses the CNAME domain (${domain})`, [...new Set(problems)]);

  const dates = [...sources['sitemap.xml'].matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  const future = dates.filter((d) => d > today);
  r.check('warn', 'Sitemap <lastmod> dates are not in the future', future);
  const ld = (sources['index.html'].match(/"dateModified":\s*"([^"]+)"/) || [])[1];
  if (ld && dates.length && ld !== dates[0]) r.warn('JSON-LD dateModified matches the sitemap', `dateModified ${ld}, sitemap ${dates[0]}`);
  else r.pass('JSON-LD dateModified matches the sitemap');
}

// ---------- README project tree ----------
function checkReadme(r, docs, files) {
  const readme = read(join(docs, '..', 'README.md'));
  const tree = (readme.match(/## Project structure[\s\S]*?```\n([\s\S]*?)```/) || [])[1] || '';
  const listed = new Set(tree.split('\n').map((l) => l.trim().split(/\s{2,}/)[0]).filter(Boolean));
  const repoRoot = resolve(docs, '..');
  const missing = [...listed].filter((p) => !existsSync(join(repoRoot, p)));
  r.check('warn', 'Every file named in the README project tree exists', missing);
  const unlisted = files.map((f) => 'docs/' + f).filter((f) => !listed.has(f));
  r.check('warn', 'Every published file is described in the README project tree', unlisted);
}

// ---------- Cache bump ----------
function checkCacheBump(r, docs, baseRef) {
  const root = resolve(docs, '..');
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let changed;
  try {
    git('rev-parse', '--verify', baseRef);
    const mergeBase = git('merge-base', 'HEAD', baseRef);
    changed = git('diff', '--name-only', mergeBase, '--', 'docs').split('\n').filter(Boolean);
    // Uncommitted edits count too.
    changed.push(...git('diff', '--name-only', 'HEAD', '--', 'docs').split('\n').filter(Boolean));
    var oldSw = git('show', `${mergeBase}:docs/sw.js`);
  } catch {
    return r.skip(`Cache name bumped for changed files (no git ref "${baseRef}")`);
  }
  const { cache, assets } = swInfo(docs);
  const cached = new Set(assets.map((a) => 'docs/' + a.replace(/^\.\//, '')));
  const touched = [...new Set(changed)].filter((f) => cached.has(f) || f === 'docs/sw.js');
  const oldCache = (oldSw.match(/const CACHE = '([^']+)'/) || [])[1];
  if (!touched.length) return r.pass(`No cached file changed since ${baseRef}`);
  if (cache === oldCache) {
    r.fail(`Cache name bumped for changed files (still "${cache}")`,
      `Cached files changed since ${baseRef}, so installed copies will keep the old version:\n` + touched.map((t) => '• ' + t).join('\n'));
  } else r.pass(`Cache name bumped (${oldCache} → ${cache}) for ${touched.length} changed file(s)`);
}

// ---------- Leftovers ----------
function checkLeftovers(r, docs, files) {
  const problems = [];
  for (const f of files.filter((x) => x.endsWith('.js') && !x.includes('/data/'))) {
    read(join(docs, f)).split('\n').forEach((l, i) => {
      if (/\b(TODO|FIXME|XXX|HACK)\b/.test(l)) problems.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
      if (/console\.(log|debug)\(/.test(l)) problems.push(`${f}:${i + 1}: console.log left in`);
      if (/\bdebugger\b/.test(l)) problems.push(`${f}:${i + 1}: debugger statement`);
    });
  }
  r.check('warn', 'No TODO, console.log or debugger left in app code', problems);
}

export async function runStatic(r, { docs, today, baseRef }) {
  r.start('Static checks');
  const files = walk(docs).map((p) => relative(docs, p).split('\\').join('/'));
  checkServiceWorker(r, docs, files);
  checkCacheBump(r, docs, baseRef);
  checkImports(r, docs, files);
  checkHtml(r, docs, files);
  checkSelectors(r, docs, files);
  checkManifest(r, docs);
  checkDomain(r, docs, today);
  checkReadme(r, docs, files);
  checkLeftovers(r, docs, files);
}
