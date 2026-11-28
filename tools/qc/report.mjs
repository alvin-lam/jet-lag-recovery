// Collects QC findings, prints a short console view and writes the Markdown report.
// The report follows the same layout as the points-calculator QC & Bug Hunter: findings grouped under
// numbered check headings and ranked by severity, each with where, steps, expected, actual, evidence and
// confidence, then a "Could not verify" list and a summary of what passed.

export const CHECKS = {
  display: '1. Display bugs',
  plan: '2. Plan calculation bugs',
  data: '3. Time zones, airports and holidays',
  export: '4. Calendar export and sharing',
  edge: '5. Edge cases',
  release: '6. Offline, security and release',
  readme: '7. README matches behavior',
};

const ICON = { fail: '✖', warn: '▲', pass: '✔', skip: '○' };
const COLOR = { fail: '\x1b[31m', warn: '\x1b[33m', pass: '\x1b[32m', skip: '\x1b[90m' };
const RESET = '\x1b[0m';
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (lvl, s) => (tty ? COLOR[lvl] + s + RESET : s);
const verbose = process.argv.includes('--verbose');

export class Report {
  constructor() {
    this.items = [];
    this.stats = [];
    this.heading = CHECKS.release;
    this.part = '';
  }

  /** Begin a part of the run. `check` is the default heading for its findings. */
  start(part, check) {
    this.part = part;
    if (check) this.heading = check;
    console.log('\n' + (tty ? '\x1b[1m' : '') + '── ' + part + ' ' + '─'.repeat(Math.max(0, 60 - part.length)) + (tty ? RESET : ''));
  }

  /** Switch the heading for the findings that follow, without printing a new part. */
  under(check) { this.heading = check; }

  /**
   * Record one finding.
   * meta: { check, where, steps, expected, actual, evidence, confidence, count }
   * `detail` becomes `actual` when no actual is given. `repro` is a trip or input to replay it.
   */
  add(level, title, detail = '', repro = null, meta = {}) {
    const item = {
      check: meta.check || this.heading, level, title,
      where: meta.where || '', steps: meta.steps || '', expected: meta.expected || '',
      actual: meta.actual || detail || '', evidence: meta.evidence || '',
      confidence: meta.confidence || 'Confirmed', count: meta.count || 0, repro,
    };
    this.items.push(item);
    if (level !== 'pass' || verbose) {
      console.log(paint(level, `  ${ICON[level]} ${title}`));
      if (item.actual && level !== 'pass') for (const line of String(item.actual).split('\n').slice(0, 6)) console.log('      ' + line);
    }
    return item;
  }
  pass(t, d, r, m) { return this.add('pass', t, d, r, m); }
  warn(t, d, r, m) { return this.add('warn', t, d, r, m); }
  fail(t, d, r, m) { return this.add('fail', t, d, r, m); }
  skip(t, d, r, m) { return this.add('skip', t, d, r, m); }

  /** Pass when the list is empty, otherwise one finding listing each problem (up to `max`). */
  check(level, title, problems, meta = {}, max = 15) {
    if (!problems.length) return this.pass(title, '', null, meta);
    const shown = problems.slice(0, max).map((p) => '• ' + p);
    if (problems.length > max) shown.push(`… and ${problems.length - max} more`);
    return this.add(level, `${title} (${problems.length})`, shown.join('\n'), null, { expected: title, ...meta });
  }

  /** A line for the "what passed" summary, such as "4,512 of 5,000 random trips passed every check". */
  stat(line) { this.stats.push(line); }

  counts() {
    const c = { fail: 0, warn: 0, pass: 0, skip: 0 };
    for (const i of this.items) c[i.level]++;
    return c;
  }

  summary() {
    const c = this.counts();
    console.log('\n' + '─'.repeat(64));
    console.log(`  ${paint('fail', c.fail + ' bugs')}  ${paint('warn', c.warn + ' warnings')}  ${paint('pass', c.pass + ' passed')}  ${paint('skip', c.skip + ' could not verify')}`);
    return c;
  }

  markdown(meta) {
    const c = this.counts();
    const confirmed = this.items.filter((i) => i.level === 'fail' && i.confidence === 'Confirmed').length;
    const out = [
      '# QC & Bug Hunter report: Jet Lag & Recovery', '',
      `Run ${meta.when} on \`${meta.branch}\` at \`${meta.commit}\` · seed ${meta.seed} · ${meta.cases.toLocaleString('en-US')} random trips · parts: ${meta.parts}`, '',
      `**${c.fail} bugs** (${confirmed} confirmed) · **${c.warn} warnings** · ${c.pass} checks passed · ${c.skip} could not verify`, '',
      'Findings are ranked from most to least severe within each check. "Confirmed" means the run reproduced it;',
      '"Likely" means it comes from reading the code or data. Replay any run with `node tools/qc/run.mjs --seed ' + meta.seed + '`.', '',
    ];
    const rank = (a, b) => (a.level === b.level ? 0 : a.level === 'fail' ? -1 : 1) || (b.count - a.count);
    for (const heading of Object.values(CHECKS)) {
      const here = this.items.filter((i) => i.check === heading);
      if (!here.length) continue;
      out.push(`## ${heading}`, '');
      const findings = here.filter((i) => i.level === 'fail' || i.level === 'warn').sort(rank);
      if (!findings.length) out.push('No findings.', '');
      findings.forEach((f, n) => {
        out.push(`### ${heading.split('.')[0]}.${n + 1} ${f.level === 'fail' ? 'Bug' : 'Warning'}: ${f.title}`, '');
        if (f.where) out.push(`- **Where:** ${f.where}`);
        if (f.steps) out.push(`- **Steps:** ${f.steps}`);
        if (f.expected) out.push(`- **Expected:** ${f.expected}`);
        if (f.actual) {
          const lines = String(f.actual).split('\n');
          if (lines.length === 1) out.push(`- **Actual:** ${lines[0]}`);
          else out.push('- **Actual:**', '', ...lines.map((l) => '  ' + l), '');
        }
        if (f.evidence) out.push(`- **Evidence:** ${f.evidence}`);
        out.push(`- **Confidence:** ${f.confidence}`);
        if (f.repro) out.push('', '  <details><summary>Trip to replay</summary>', '', '  ```json', '  ' + JSON.stringify(f.repro), '  ```', '', '  </details>');
        out.push('');
      });
      const passed = here.filter((i) => i.level === 'pass');
      if (passed.length) {
        out.push(`<details><summary>${passed.length} checks passed</summary>`, '', ...passed.map((p) => `- ${p.title}`), '', '</details>', '');
      }
    }

    out.push('## Could not verify', '');
    const skipped = this.items.filter((i) => i.level === 'skip');
    if (!skipped.length) out.push('Nothing. Every automated check ran.');
    for (const s of skipped) out.push(`- **${s.title}** (${s.check})${s.actual ? ': ' + s.actual.replace(/\n/g, ' ') : ''}`);
    out.push('', 'The script cannot judge the sleep science, the wording of advice or the disclaimer. Those need the', 'agent pass or a person (see `.claude/agents/qc-bug-hunter.md`).', '');

    out.push('## Summary of what passed', '');
    for (const s of this.stats) out.push(`- ${s}`);
    for (const heading of Object.values(CHECKS)) {
      const here = this.items.filter((i) => i.check === heading);
      if (!here.length) continue;
      const n = (l) => here.filter((i) => i.level === l).length;
      const k = (x, w) => `${x} ${w}${x === 1 ? '' : 's'}`;
      out.push(`- ${heading}: ${n('pass')} passed, ${k(n('fail'), 'bug')}, ${k(n('warn'), 'warning')}${n('skip') ? `, ${n('skip')} not verified` : ''}`);
    }
    out.push('');
    return out.join('\n');
  }
}
