// Collects QC findings and prints them. Levels: fail (a bug to fix), warn (worth a look), pass.

const ICON = { fail: '✖', warn: '▲', pass: '✔', skip: '○' };
const COLOR = { fail: '\x1b[31m', warn: '\x1b[33m', pass: '\x1b[32m', skip: '\x1b[90m' };
const RESET = '\x1b[0m';
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (lvl, s) => (tty ? COLOR[lvl] + s + RESET : s);

export class Report {
  constructor() { this.items = []; this.section = 'General'; }

  start(section) {
    this.section = section;
    console.log('\n' + (tty ? '\x1b[1m' : '') + '── ' + section + ' ' + '─'.repeat(Math.max(0, 60 - section.length)) + (tty ? RESET : ''));
  }

  add(level, title, detail = '', repro = null) {
    const item = { section: this.section, level, title, detail, repro };
    this.items.push(item);
    console.log(paint(level, `  ${ICON[level]} ${title}`));
    if (detail && level !== 'pass') for (const line of String(detail).split('\n')) console.log('      ' + line);
    return item;
  }
  pass(t, d) { return this.add('pass', t, d); }
  warn(t, d, r) { return this.add('warn', t, d, r); }
  fail(t, d, r) { return this.add('fail', t, d, r); }
  skip(t, d) { return this.add('skip', t, d); }

  /** Pass when the list is empty, otherwise report each problem (up to `max`) under one heading. */
  check(level, title, problems, max = 12) {
    if (!problems.length) return this.pass(title);
    const shown = problems.slice(0, max).map((p) => '• ' + p);
    if (problems.length > max) shown.push(`… and ${problems.length - max} more`);
    return this.add(level, `${title} (${problems.length})`, shown.join('\n'));
  }

  counts() {
    const c = { fail: 0, warn: 0, pass: 0, skip: 0 };
    for (const i of this.items) c[i.level]++;
    return c;
  }

  summary() {
    const c = this.counts();
    console.log('\n' + '─'.repeat(64));
    console.log(`  ${paint('fail', c.fail + ' failed')}  ${paint('warn', c.warn + ' warnings')}  ${paint('pass', c.pass + ' passed')}  ${paint('skip', c.skip + ' skipped')}`);
    return c;
  }

  markdown(meta) {
    const c = this.counts();
    const out = [
      '# QC & Bug Hunter report', '',
      `Run: ${meta.when} · Seed: ${meta.seed} · Fuzz cases: ${meta.cases}`, '',
      `**${c.fail} failed · ${c.warn} warnings · ${c.pass} passed · ${c.skip} skipped**`, '',
    ];
    const sections = [...new Set(this.items.map((i) => i.section))];
    for (const s of sections) {
      out.push(`## ${s}`, '');
      for (const i of this.items.filter((x) => x.section === s)) {
        out.push(`- ${ICON[i.level]} **${i.level.toUpperCase()}** ${i.title}`);
        if (i.detail && i.level !== 'pass') out.push('', '  ```', ...String(i.detail).split('\n').map((l) => '  ' + l), '  ```');
        if (i.repro) out.push('', '  Repro:', '', '  ```json', '  ' + JSON.stringify(i.repro), '  ```');
      }
      out.push('');
    }
    return out.join('\n');
  }
}
