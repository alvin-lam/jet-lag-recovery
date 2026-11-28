// Bug hunt over the pure code: the plan model, time zone math, interval math, holidays, search,
// the calendar file and the shared plan text. Random trips are seeded so every finding can be replayed.
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { CHECKS } from './report.mjs';

// ---------- Seeded random numbers ----------
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  return { next, int, pick, chance: (p) => next() < p };
}

// The UI modules read the page and storage when they load. Give them just enough to run in Node.
function installShims() {
  const mem = new Map();
  globalThis.localStorage ??= {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  globalThis.addEventListener ??= () => {};
  globalThis.document ??= { addEventListener() {}, visibilityState: 'visible', querySelector: () => null, querySelectorAll: () => [] };
  if (!globalThis.navigator) globalThis.navigator = { language: 'en-US', languages: ['en-US'] };
}

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (h, m) => pad(h) + ':' + pad(m);
const mod24 = (h) => ((h % 24) + 24) % 24;
const EPS = 1e-6;

/** All [a, b] pieces of `iv` that overlap a block repeating daily from `start` for `len` hours. */
function overlapsDaily([a, b], start, len) {
  if (len <= 0) return 0;
  let total = 0;
  for (let s = start + Math.floor((a - start) / 24) * 24 - 24; s < b; s += 24) {
    total += Math.max(0, Math.min(b, s + len) - Math.max(a, s));
  }
  return total;
}
const overlap = ([a, b], [c, d]) => Math.max(0, Math.min(b, d) - Math.max(a, c));

/** Paths of any NaN, Infinity or undefined numbers inside a plan. */
function badNumbers(obj, path = 'plan', out = [], seen = new Set()) {
  if (obj === null || typeof obj !== 'object' || seen.has(obj)) return out;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'home' || k === 'dest' || k === 'log') continue;
    const p = path + '.' + k;
    if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${p} = ${v}`);
    else if (typeof v === 'object') badNumbers(v, p, out, seen);
  }
  return out;
}

// ---------- Plan invariants ----------
function planProblems(p, trip, M) {
  const out = [];
  const inputSleep = mod24(hmLocal(trip.wake) - hmLocal(trip.bed));
  const saneInput = inputSleep >= 3 && inputSleep <= 14;
  if (!saneInput) out.push(['the form accepts an implausible sleep window', `bed ${trip.bed}, wake ${trip.wake} (${inputSleep.toFixed(2)} h)`]);
  const bad = badNumbers(p);
  if (bad.length) out.push(['non-finite numbers in the plan', bad.slice(0, 3).join(', ')]);

  if (Math.abs(p.arrUtc - p.depUtc - p.durH * 3600000) > 1000) out.push(['arrival is not departure plus flight time', '']);
  if (!(p.shift > -12 - EPS && p.shift <= 12 + EPS)) out.push(['shift outside (−12, 12]', `shift ${p.shift}`]);
  const dt = Math.abs(p.target - p.shift);
  if (dt > EPS && Math.abs(dt - 24) > EPS) out.push(['target is neither the shift nor the shift ± 24 h', `shift ${p.shift}, target ${p.target}`]);
  if (!p.days.length) out.push(['plan has no days', '']);
  if (p.days.length > M.maxPlanDays) out.push(['plan is longer than maxPlanDays', String(p.days.length)]);

  const shifting = p.strategy === 'gradual' || p.strategy === 'immediate';
  if (shifting && p.absT >= 1 && !(p.daysToAdjust >= 1)) out.push(['daysToAdjust is 0 for a shifting plan', '']);
  const noLogs = !p.days.some((d) => d.log);
  if (shifting && noLogs && p.adjustedDay === null) out.push(['plan never reaches "adjusted" within maxPlanDays', `absT ${p.absT}, rate ${p.rate}`]);

  // Pre-departure days: consecutive dates ending the day before departure, at most 1 h of shift a day.
  p.pre.forEach((d, i) => {
    const want = addDaysLocal(trip.depDate, i - p.pre.length);
    if (d.date !== want) out.push(['pre-departure dates are not consecutive up to departure', `${d.date} ≠ ${want}`]);
    const prev = i ? p.pre[i - 1].bed : p.homeBed;
    if (Math.abs(d.bed - prev) > 1 + EPS) out.push(['pre-departure bedtime moves more than 1 h in a day', `${prev} → ${d.bed}`]);
  });

  let prevBehind = null;
  p.days.forEach((d, i) => {
    if (d.k !== i + 1) out.push(['day numbers are not 1, 2, 3…', `${d.k} at index ${i}`]);
    const want = addDaysLocal(p.arrDate, i);
    if (d.date !== want) out.push(['day dates are not consecutive from arrival', `${d.date} ≠ ${want}`]);
    if (saneInput && (d.night < 2 - EPS || d.night > 16)) out.push(['planned night is implausible', `day ${d.k}: ${d.night.toFixed(2)} h`]);
    if (d.arrivalSleep && d.arrivalSleep[1] - d.arrivalSleep[0] > 16) out.push(['post-landing sleep is longer than 16 h (bed and wake not wrapped to one day)', `day ${d.k}: [${d.arrivalSleep.map((x) => x.toFixed(2))}]`]);

    // Light advice must never fall while the traveler is asleep.
    const sleeps = [[d.bed, d.night]];
    for (const iv of [...d.seek, ...d.avoid]) {
      for (const [s, len] of sleeps) {
        const ov = overlapsDaily(iv, s, len);
        if (ov > 0.05) out.push(['light advice falls during planned sleep', `day ${d.k}: [${iv.map((x) => x.toFixed(2))}] vs bed ${d.bed.toFixed(2)} for ${len.toFixed(2)} h`]);
      }
      if (d.arrivalSleep && d.arrivalSleep[1] - d.arrivalSleep[0] <= 16) {
        const [a, b] = d.arrivalSleep;
        const ov = overlapsDaily(iv, a, b - a);
        if (ov > 0.05) out.push(['light advice falls during the post-landing sleep', `day ${d.k}: light [${iv.map((x) => x.toFixed(2))}], sleep [${a.toFixed(2)}, ${b.toFixed(2)}]`]);
      }
      if (d.arrivalDay && iv[0] < p.arrHour - EPS) out.push(['light advice starts before landing', `light ${iv[0].toFixed(2)}, lands ${p.arrHour.toFixed(2)}`]);
    }
    for (const s of d.seek) for (const a of d.avoid) {
      if (overlapsDaily(s, a[0], a[1] - a[0]) > 0.05) out.push(['seek and avoid light overlap', `day ${d.k}`]);
    }

    // Caffeine: doses inside the window, the window ends before bedtime.
    const c = d.caff;
    for (const dose of c.doses) {
      if (dose > c.cutoff + EPS) out.push(['coffee dose after the caffeine cutoff', `day ${d.k}`]);
      if (d.arrivalSleep && d.arrivalSleep[1] - d.arrivalSleep[0] <= 16 && overlapsDaily([dose, dose + 0.01], d.arrivalSleep[0], d.arrivalSleep[1] - d.arrivalSleep[0]) > 0) out.push(['coffee dose during the post-landing sleep', `day ${d.k}`]);
    }
    if (c.doses.length > p.cups) out.push(['more coffee doses than allowed cups', `${c.doses.length} > ${p.cups}`]);
    if (p.cups * 95 > c.maxMg + EPS) out.push(['allowed cups exceed the caffeine limit', `${p.cups} cups, ${c.maxMg} mg`]);

    // Water: ascending times, at least two glasses.
    const w = d.water;
    if (w.glasses < 2) out.push(['fewer than 2 glasses of water', `day ${d.k}`]);
    for (let j = 1; j < w.times.length; j++) if (w.times[j] < w.times[j - 1] - EPS) { out.push(['water times go backwards', `day ${d.k}`]); break; }
    if (w.base <= 0) out.push(['daily water target is not positive', `day ${d.k}: ${w.base}`]);

    if (d.melatonin != null && p.sign < 0) out.push(['melatonin suggested on a westward (delay) plan', `day ${d.k}`]);

    // Without sleep logs the body clock only moves toward local time.
    if (shifting && noLogs) {
      if (prevBehind !== null && Math.abs(d.behind) > Math.abs(prevBehind) + EPS) out.push(['body clock moves away from local time', `day ${d.k}: ${prevBehind} → ${d.behind}`]);
      prevBehind = d.behind;
    }
    const bodyP = p.target - d.behind;
    if (bodyP < Math.min(0, p.target) - EPS || bodyP > Math.max(0, p.target) + EPS) out.push(['body clock estimate outside home…destination', `day ${d.k}: ${bodyP}`]);
  });

  const f = p.flight;
  if (f.sleep) {
    if (f.sleep.start < f.start - EPS || f.sleep.end > f.end + EPS) out.push(['in-flight sleep falls outside the flight', `${f.sleep.start}–${f.sleep.end} vs ${f.start}–${f.end}`]);
    if (f.sleep.len > p.durH + EPS) out.push(['in-flight sleep is longer than the flight', '']);
  }
  return out;
}

function hmLocal(str) {
  const [h, m] = String(str || '0:0').split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

function addDaysLocal(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
}

// ---------- Trips ----------
// Dates near daylight saving changes catch most time zone mistakes.
const DST_DATES = ['2027-03-14', '2027-03-28', '2027-04-04', '2027-10-03', '2027-10-31', '2027-11-07', '2026-12-31', '2027-02-28', '2028-02-29'];
const HARD_ZONES = ['tz:Pacific/Kiritimati', 'tz:Pacific/Pago_Pago', 'tz:Pacific/Chatham', 'tz:Asia/Kathmandu', 'tz:Australia/Eucla',
  'tz:Asia/Kolkata', 'tz:America/St_Johns', 'tz:Pacific/Marquesas', 'tz:Australia/Lord_Howe', 'tz:UTC', 'tz:Etc/GMT+12', 'tz:Etc/GMT-14'];

function randomTrip(R, keys, base) {
  const date = R.chance(0.3) ? R.pick(DST_DATES) : addDaysLocal('2026-12-01', R.int(0, 800));
  const loc = () => (R.chance(0.12) ? R.pick(HARD_ZONES) : R.pick(keys));
  const bedH = R.chance(0.8) ? R.pick([21, 22, 23, 0, 1]) : R.int(0, 23);
  const sleep = R.chance(0.85) ? R.int(6, 9) : R.int(0, 14);
  const t = {
    ...base,
    home: loc(), dest: loc(),
    depDate: date, depTime: hhmm(R.int(0, 23), R.pick([0, 15, 30, 45, 55])),
    durH: R.int(0, 23), durM: R.pick([0, 5, 30, 55]), tripDays: R.chance(0.2) ? R.int(1, 3) : R.int(1, 30),
    bed: hhmm(bedH, R.pick([0, 30])), wake: hhmm((bedH + sleep) % 24, R.pick([0, 30])),
    chrono: R.pick(['lark', 'neutral', 'owl']), caffSens: R.pick(['low', 'normal', 'high']), cups: R.int(0, 6),
    strategy: R.pick(['auto', 'auto', 'gradual', 'immediate', 'home']), preDays: R.int(0, 3), pace: R.pick([0.5, 0.75, 1, 1.25, 1.5]),
    personalWater: R.chance(0.4), weight: R.int(30, 200), weightUnit: R.pick(['kg', 'lb']),
    activity: R.pick(['low', 'moderate', 'high']), climate: R.pick(['cool', 'temperate', 'hot']), alcohol: R.int(0, 5),
    ret: R.chance(0.5),
  };
  if (t.ret) {
    t.retDate = addDaysLocal(t.depDate, R.int(-1, 20));
    t.retTime = hhmm(R.int(0, 23), R.pick([0, 30]));
    t.retDurH = R.chance(0.2) ? null : R.int(0, 23);
    t.retDurM = R.pick([0, 15, 45]);
  }
  return t;
}

function randomLogs(R, n) {
  const logs = {};
  for (let k = 1; k <= n; k++) {
    if (!R.chance(0.35)) continue;
    const b = R.int(0, 23);
    logs[k] = { bed: hhmm(b, R.pick([0, 30])), wake: hhmm((b + R.int(0, 12)) % 24, R.pick([0, 15])) };
  }
  return logs;
}

// ---------- Calendar file ----------
function icsProblems(text, events) {
  const out = [];
  if (/[^\r]\n/.test(text)) out.push(['.ics uses bare LF line endings (RFC 5545 needs CRLF)', '']);
  const lines = text.split('\r\n');
  const long = lines.filter((l) => Buffer.byteLength(l, 'utf8') > 75);
  if (long.length) out.push(['.ics lines longer than 75 octets are not folded (RFC 5545 §3.1)', `${long.length} line(s), e.g. "${long[0].slice(0, 60)}…" (${Buffer.byteLength(long[0])} octets)`]);
  const begins = lines.filter((l) => l.startsWith('BEGIN:')).length;
  const ends = lines.filter((l) => l.startsWith('END:')).length;
  if (begins !== ends) out.push(['.ics BEGIN/END blocks do not balance', `${begins} vs ${ends}`]);
  for (const l of lines) if (/DESCRIPTION:.*\n/.test(l)) out.push(['.ics text contains an unescaped newline', '']);
  const uids = lines.filter((l) => l.startsWith('UID:'));
  if (new Set(uids).size !== uids.length) out.push(['.ics UIDs are not unique', '']);
  const sorted = [...events].sort((a, b) => a.start - b.start);
  for (const e of events) if (!(e.end > e.start)) out.push(['calendar event ends before it starts', e.title]);
  for (let i = 1; i < sorted.length; i++) {
    const ov = (sorted[i - 1].end - sorted[i].start) / 3600000;
    if (ov > 0.25) {
      out.push(['calendar sleep events overlap each other', `"${sorted[i - 1].title}" and "${sorted[i].title}" overlap by ${ov.toFixed(1)} h`]);
      break;
    }
  }
  return out;
}

// Findings that are worth a look but are not wrong advice.
const WARN_ONLY = /75 octets|2,000 characters|implausible sleep window|never reaches "adjusted"/;

const TEXT_JUNK = /\b(NaN|undefined|Infinity)\b|\[object Object\]|\bnull\b/;

// How each fuzz invariant reads in the report: its check heading, the code behind it and what should happen.
const META = [
  [/calendar sleep events overlap/, { check: CHECKS.export, title: 'Calendar export has overlapping sleep events when the return flight comes before the end of the outbound plan',
    where: 'docs/js/ui/ics.js:35 (every outbound day is exported), docs/js/core/model.js:324 (return plan)',
    expected: 'Outbound nights stop when the return flight leaves, so no two sleep events overlap.',
    actual: 'Outbound nights after the return date are still exported, on top of the nights back home.' }],
  [/pre-departure dates are not consecutive/, { check: CHECKS.plan, title: 'Pre-adjust nights can stop short of departure, leaving the night before the flight unplanned',
    where: 'docs/js/core/model.js:197 (`addDays(trip.depDate, j - preDays - 1)`)',
    expected: 'Pre-adjust nights fall on the days right before departure.',
    actual: 'When the shift is used up in fewer days than chosen, the dates still count back from the chosen number, so the last pre-adjust night is not the night before the flight. Date shown ≠ date expected:' }],
  [/return flight departs before the outbound flight lands/, { check: CHECKS.plan, title: 'A return flight that leaves before the outbound flight lands is accepted',
    where: 'docs/js/core/model.js:324 (compares dates only)',
    expected: 'An error such as "The return flight leaves before you arrive. Choose a later time."',
    actual: '' }],
  [/post-landing sleep is longer than 16 h/, { check: CHECKS.plan, title: '"Stay on home time" can plan a sleep after landing of more than 24 hours',
    where: 'docs/js/core/model.js:231 (bed and wake not wrapped), docs/js/core/model.js:251 (`arrHour + 1 < wake`)',
    expected: 'Sleep after landing runs from about an hour after landing to the wake time, a few hours at most.',
    actual: 'Wake time is left above 24, so the post-landing sleep spans more than a day and the daily graph fills the whole arrival day with sleep. Interval:' }],
  [/light advice falls during planned sleep/, { check: CHECKS.plan, where: 'docs/js/core/model.js (`awakeLight`)', expected: 'Light advice only while awake.' }],
  [/light advice falls during the post-landing sleep/, { check: CHECKS.plan, where: 'docs/js/core/model.js (`awakeLight` ignores `arrivalSleep`)', expected: 'No light advice while sleeping after landing.' }],
  [/light advice starts before landing/, { check: CHECKS.plan, where: 'docs/js/core/model.js (`awakeLight`)', expected: 'Arrival-day light advice starts after landing.' }],
  [/coffee dose/, { check: CHECKS.plan, where: 'docs/js/core/model.js (`caffeinePlan`)', expected: 'Coffee only while awake and before the cutoff.' }],
  [/never reaches "adjusted"/, { check: CHECKS.plan, title: 'Very slow or very large shifts are cut off at 14 days',
    where: 'docs/js/core/model.js:222 (`MODEL.maxPlanDays`)', expected: 'The plan covers every day needed, or says clearly that it stops at 14 days.',
    actual: 'The plan ends at 14 days while the summary gives a larger "Days to adjust".' }],
  [/implausible sleep window/, { check: CHECKS.edge, title: 'The form accepts a sleep window under 3 or over 14 hours',
    where: 'docs/index.html (`#bed`, `#wake`), docs/js/core/model.js:143', expected: 'A hint or a rejection for implausible sleep, such as bedtime equal to wake time.' }],
  [/75 octets/, { check: CHECKS.export, title: 'Calendar file lines are not folded at 75 octets',
    where: 'docs/js/ui/ics.js:52', expected: 'Lines longer than 75 octets are folded (RFC 5545 §3.1). Most calendar apps accept long lines, so this is a warning.' }],
  [/Google Calendar link/, { check: CHECKS.export, where: 'docs/js/ui/ics.js (`googleUrl`)', expected: 'Links under 2,000 characters.' }],
  [/shared (plan )?text/, { check: CHECKS.export, where: 'docs/js/ui/share.js:13 (`planText`)', expected: 'No NaN, undefined or null in the shared text.' }],
  [/calendar export throws|planText throws/, { check: CHECKS.export, where: 'docs/js/ui/ics.js, docs/js/ui/share.js', expected: 'Export never throws.' }],
  [/plan has no days/, { check: CHECKS.plan, title: 'A trip length below 1 gives a plan with no days', where: 'docs/js/core/model.js:216 (`minDays`)', expected: 'At least one plan day.' }],
  [/throws|different plan|non-finite/, { check: CHECKS.plan, where: 'docs/js/core/model.js (`buildPlan`)', expected: 'A complete, finite plan for every valid trip.' }],
];
function metaFor(name) {
  const bare = name.replace(/^return: /, '');
  const hit = META.find(([re]) => re.test(bare));
  const m = hit ? { ...hit[1] } : { check: CHECKS.plan, where: 'docs/js/core/model.js', expected: '' };
  if (bare !== name && m.title) m.title = 'Return trip: ' + m.title[0].toLowerCase() + m.title.slice(1);
  if (!m.title) m.title = name[0].toUpperCase() + name.slice(1);
  return m;
}

/** A trip as the steps a person would take in the form. */
function describeTrip(t) {
  const place = (k) => String(k || '').replace(/^code:/, '').replace(/^tz:/, '');
  const parts = [
    `${place(t.home)} → ${place(t.dest)}`,
    `depart ${t.depDate || '(no date)'} at ${t.depTime}`,
    `flight ${t.durH} h` + (Number(t.durM) ? ` ${t.durM} min` : ''),
    `trip ${t.tripDays} days`,
    `bed ${t.bed}, wake ${t.wake}`,
  ];
  const opts = [];
  if (t.chrono && t.chrono !== 'neutral') opts.push(`chronotype ${t.chrono}`);
  if (t.strategy && t.strategy !== 'auto') opts.push(`plan style ${t.strategy}`);
  if (Number(t.preDays)) opts.push(`pre-adjust ${t.preDays} day${Number(t.preDays) === 1 ? '' : 's'}`);
  if (Number(t.pace) !== 1) opts.push(`pace ${t.pace}`);
  if (opts.length) parts.push('More options: ' + opts.join(', '));
  if (t.ret) parts.push(`return flight ${t.retDate || '(no date)'} at ${t.retTime}, ${t.retDurH ?? t.durH} h` + (Number(t.retDurM ?? t.durM) ? ` ${t.retDurM ?? t.durM} min` : ''));
  return parts.join('; ') + '.';
}

export async function runModel(r, { docs, seed, cases }) {
  installShims();
  const imp = (p) => import(pathToFileURL(join(docs, p)).href);
  const { MODEL, TRIP_DEFAULTS } = await imp('js/config.js');
  const { buildPlan, buildReturnPlan } = await imp('js/core/model.js');
  const { LOCATIONS, searchLocations, parseLoc } = await imp('js/data/locations.js');
  const { zonedToUtc, tzOffset, localDateStr, localHours, allTimeZones } = await imp('js/lib/time.js');
  const { subtractDaily, toDayPieces } = await imp('js/lib/intervals.js');
  const cal = await imp('js/core/calendar.js');
  const themes = await imp('js/data/themes.js');
  const { sleepEvents, icsText, googleUrl } = await imp('js/ui/ics.js');
  const { planText } = await imp('js/ui/share.js');

  // ---------- Fuzzed plans ----------
  r.start(`Plan model fuzzing (${cases.toLocaleString('en-US')} random trips, seed ${seed})`, CHECKS.plan);
  const R = rng(seed);
  const keys = LOCATIONS.map((l) => l.key);
  const found = new Map(); // invariant → { count, detail, repro }
  let tripHit = false;
  // Keep the simplest trip for each finding, so the report's steps are easy to follow:
  // well-known airports, few options changed and no sleep logs.
  const { AIRPORTS: CURATED } = await imp('js/data/airports.js');
  const major = new Set(CURATED.map((a) => 'code:' + a[0]));
  const simplicity = ({ trip: t, logs }) => (major.has(t.home) ? 0 : 3) + (major.has(t.dest) ? 0 : 3)
    + Object.keys(logs || {}).length * 2 + (t.ret ? 1 : 0)
    + ['chrono', 'strategy', 'preDays', 'pace'].filter((k) => t[k] !== TRIP_DEFAULTS[k]).length;
  const note = (name, detail, repro) => {
    if (!WARN_ONLY.test(name)) tripHit = true;
    const f = found.get(name);
    if (!f) found.set(name, { count: 1, detail, repro, score: simplicity(repro) });
    else {
      f.count++;
      const sc = simplicity(repro);
      if (sc < f.score) Object.assign(f, { detail, repro, score: sc });
    }
  };
  let crashes = 0, clean = 0, withReturn = 0, events = 0;
  for (let i = 0; i < cases; i++) {
    const trip = randomTrip(R, keys, TRIP_DEFAULTS);
    const logs = R.chance(0.3) ? randomLogs(R, 8) : {};
    const repro = { trip, logs };
    tripHit = false;
    let p, back;
    try {
      p = buildPlan(trip, logs);
      const again = buildPlan(trip, logs);
      if (JSON.stringify(again.days) !== JSON.stringify(p.days)) note('the same trip gives a different plan', '', repro);
    } catch (e) {
      crashes++;
      note('buildPlan throws', e.stack.split('\n').slice(0, 3).join(' | '), repro);
      continue;
    }
    for (const [name, detail] of planProblems(p, trip, MODEL)) note(name, detail, repro);

    try {
      back = buildReturnPlan(trip, p, {});
    } catch (e) {
      note('buildReturnPlan throws', e.message, repro);
      continue;
    }
    if (back && !back.error) {
      withReturn++;
      for (const [name, detail] of planProblems(back, { ...trip, depDate: trip.retDate }, MODEL)) note('return: ' + name, detail, repro);
      if (back.depUtc < p.arrUtc) {
        note('return flight departs before the outbound flight lands, but no error is shown',
          `Outbound lands ${new Date(p.arrUtc).toISOString()}; return leaves ${new Date(back.depUtc).toISOString()}. The return plan is built anyway.`, repro);
      }
    }

    try {
      const ev = sleepEvents(p, back);
      events += ev.length;
      for (const [name, detail] of icsProblems(icsText(ev), ev)) note(name, detail, repro);
      for (const e of ev.slice(0, 2)) if (googleUrl(e).length > 2000) note('Google Calendar link longer than 2,000 characters', '', repro);
    } catch (e) {
      note('calendar export throws', e.message, repro);
    }
    try {
      const text = planText(p, back);
      const m = text.match(TEXT_JUNK);
      if (m) note('shared plan text shows a placeholder value', `"${m[0]}" in: ${text.split('\n').find((l) => TEXT_JUNK.test(l))}`, repro);
    } catch (e) {
      note('planText throws', e.message, repro);
    }
    if (!tripHit) clean++;
  }
  const pct = (n) => (n / cases * 100).toFixed(n / cases < 0.01 ? 2 : 1) + '%';
  r.stat(`${clean.toLocaleString('en-US')} of ${cases.toLocaleString('en-US')} random trips passed every plan, calendar and text check (warnings aside); ${withReturn.toLocaleString('en-US')} had a return plan; ${events.toLocaleString('en-US')} calendar events built.`);
  if (!found.size) r.pass(`All ${cases} random trips passed every plan, calendar and text check`);
  for (const [name, f] of [...found.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const m = metaFor(name);
    r.add(WARN_ONLY.test(name) ? 'warn' : 'fail', m.title || name, f.detail, f.repro, {
      check: m.check, where: m.where, expected: m.expected,
      steps: 'Enter this trip: ' + describeTrip(f.repro.trip) + (Object.keys(f.repro.logs || {}).length ? ' Sleep logs are in the replay JSON.' : ''),
      actual: (m.actual ? m.actual + ' ' : '') + f.detail,
      evidence: `Found in ${f.count.toLocaleString('en-US')} of ${cases.toLocaleString('en-US')} random trips (${pct(f.count)}), seed ${seed}. The simplest case is below.`,
      count: f.count,
    });
  }
  if (crashes) r.fail(`${crashes} trips crashed the model`);

  // ---------- Hand-picked edge cases ----------
  r.start('Plan model edge cases', CHECKS.edge);
  const base = { ...TRIP_DEFAULTS, home: 'code:JFK', dest: 'code:LHR', depDate: '2027-06-10' };
  const edges = [
    ['same city', { dest: 'code:JFK' }],
    ['zero-length flight', { durH: 0, durM: 0 }],
    ['23 h 55 min flight', { durH: 23, durM: 55, dest: 'code:SIN' }],
    ['bed equals wake', { bed: '07:00', wake: '07:00' }],
    ['sleep after midnight', { bed: '02:00', wake: '10:00' }],
    ['very short sleep', { bed: '03:00', wake: '05:00' }],
    ['+26 h clock gap (Kiritimati to Pago Pago)', { home: 'tz:Pacific/Kiritimati', dest: 'tz:Pacific/Pago_Pago' }],
    ['45-minute zone', { dest: 'tz:Asia/Kathmandu' }],
    ['spring-forward departure in a DST gap', { depDate: '2027-03-14', depTime: '02:30' }],
    ['fall-back departure in a repeated hour', { depDate: '2027-11-07', depTime: '01:30' }],
    ['1-day trip', { tripDays: 1, dest: 'code:NRT' }],
    ['every option at its limit', { preDays: 3, pace: 1.5, chrono: 'lark', cups: 6, caffSens: 'high', dest: 'code:SYD' }],
    ['slowest pace, 12 h shift', { pace: 0.5, dest: 'code:SIN', strategy: 'gradual' }],
    ['empty sleep log values', { }, { 1: { bed: '', wake: '' }, 2: { bed: '25:99', wake: 'x' } }],
    ['negative trip length typed in', { tripDays: -4, dest: 'code:NRT' }],
    ['out-of-range numbers typed in', { durH: 30, durM: 999, cups: 99, alcohol: -2, preDays: 9, pace: 0 }],
    ['missing date (cleared field)', { depDate: '' }],
    ['unknown location key', { dest: 'code:ZZZ' }],
    ['return on arrival day, before landing', { ret: true, retDate: null, retTime: '00:30', durH: 7 }, null, (t, p) => ({ ...t, retDate: p.arrDate })],
    ['return before arrival date', { ret: true, retDate: '2027-06-01', retTime: '10:00' }],
    ['return with no date', { ret: true, retDate: null }],
  ];
  let edgeOk = 0;
  for (const [label, patch, logs, post] of edges) {
    let trip = { ...base, ...patch };
    const steps = () => 'Enter this trip: ' + describeTrip(trip) + (logs ? ' Log nights with ' + JSON.stringify(logs) + '.' : '');
    try {
      let p = buildPlan(trip, logs || {});
      if (post) { trip = post(trip, p); p = buildPlan(trip, logs || {}); }
      const probs = planProblems(p, trip, MODEL);
      const back = buildReturnPlan(trip, p, {});
      if (back && !back.error && back.depUtc < p.arrUtc) probs.push(['return flight departs before the outbound flight lands, but no error is shown', '']);
      if (back && !back.error) probs.push(...planProblems(back, { ...trip, depDate: trip.retDate }, MODEL).map(([n, d]) => ['return: ' + n, d]));
      const text = planText(p, back);
      const m = text.match(TEXT_JUNK);
      if (m) probs.push(['shared text shows a placeholder value', `"${m[0]}"`]);
      if (!probs.length) { edgeOk++; r.pass(label); continue; }
      const first = metaFor(probs[0][0]);
      const noDays = probs.some(([n]) => n === 'plan has no days');
      const Label = label[0].toUpperCase() + label.slice(1);
      const listed = probs.map(([n, d]) => `• ${n}${d ? ': ' + d : ''}`);
      r.add(probs.every(([n]) => WARN_ONLY.test(n)) ? 'warn' : 'fail', `${Label}: ${first.title || probs[0][0]}`,
        listed.length === 1 ? listed[0].slice(2) : listed.join('\n'), { trip, logs }, {
          where: noDays ? 'docs/js/core/model.js:216 (`minDays`), docs/js/ui/plan-view.js:38 (`p.days[0]`), docs/index.html:165 (`novalidate`)' : first.where,
          steps: steps(),
          expected: noDays ? 'Trip length below 1 is rejected or treated as 1, and the plan has at least one day.' : first.expected,
          evidence: noDays ? 'buildPlan returns days: []. In the browser the same input throws "Cannot read properties of undefined (reading \'bed\')" in renderSummary (see 5. Edge cases, browser).' : 'Reproduced with the hand-picked trip below.',
        });
    } catch (e) {
      const lvl = label.startsWith('missing date') ? 'warn' : 'fail';
      r.add(lvl, `${label[0].toUpperCase() + label.slice(1)}: buildPlan throws ${e.name}`, e.message, { trip }, {
        where: 'docs/js/lib/time.js (`zonedToUtc`), docs/js/main.js (`render`)', steps: steps(),
        expected: 'A message asking for a date, or the last good plan kept with a note.',
        actual: `buildPlan throws "${e.message}". main.js catches it, so the page shows no new plan and no message.` + (lvl === 'warn' ? ' Only reachable through saved data, because the form ignores a cleared date.' : ''),
        confidence: lvl === 'warn' ? 'Likely' : 'Confirmed',
      });
    }
  }
  r.stat(`${edgeOk} of ${edges.length} hand-picked edge-case trips passed.`);

  // ---------- Time zone math ----------
  r.start('Time zone math', CHECKS.data);
  const zones = allTimeZones();
  const tzProblems = [];
  const offsetProblems = [];
  const TR = rng(seed + 1);
  for (let i = 0; i < 4000; i++) {
    const tz = TR.pick(zones);
    const date = TR.chance(0.4) ? TR.pick(DST_DATES) : addDaysLocal('2026-01-01', TR.int(0, 1100));
    const hours = TR.int(0, 95) / 4;
    const ms = zonedToUtc(date, hours, tz);
    const backDate = localDateStr(tz, ms);
    const backH = localHours(tz, ms);
    const sameWall = backDate === date && Math.abs(backH - hours) < 1e-6;
    if (!sameWall) {
      // Allowed only inside a spring-forward gap, where the wall time does not exist: it moves by up to the gap.
      const before = tzOffset(tz, ms - 6 * 3600000), after = tzOffset(tz, ms + 6 * 3600000);
      const gap = (after - before) / 60;
      const drift = (Date.UTC(...backDate.split('-').map((x, j) => (j === 1 ? x - 1 : +x))) / 3600000 + backH)
        - (Date.UTC(...date.split('-').map((x, j) => (j === 1 ? x - 1 : +x))) / 3600000 + hours);
      if (!(gap > 0 && Math.abs(drift) > 0 && Math.abs(drift) <= gap + 1e-6)) tzProblems.push(`${tz} ${date} ${hours}h → ${backDate} ${backH}h`);
    }
    // Cross-check the offset against Intl's own label.
    try {
      const label = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName').value;
      const m = label.match(/GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?/);
      const want = m && m[1] ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
      // Intl rounds historical offsets with seconds; ignore those zones (all pre-1900).
      if (!m[4] && tzOffset(tz, ms) !== want) offsetProblems.push(`${tz} at ${new Date(ms).toISOString()}: ${tzOffset(tz, ms)} vs ${want}`);
    } catch { /* older engines lack longOffset */ }
  }
  r.check('fail', 'Wall time → UTC → wall time round-trips in 4,000 random zone and time pairs', tzProblems);
  r.check('fail', 'tzOffset agrees with Intl in every sampled zone', offsetProblems);

  // ---------- Interval math ----------
  r.start('Interval math', CHECKS.plan);
  const ivProblems = [];
  const IR = rng(seed + 2);
  for (let i = 0; i < 3000; i++) {
    const a = IR.int(-48, 48) / 2, len = IR.int(0, 60) / 2, bs = IR.int(-24, 48) / 2, bl = IR.int(0, 40) / 2;
    const iv = [a, a + len];
    const parts = subtractDaily(iv, bs, bl, 0);
    const got = parts.reduce((s, [x, y]) => s + (y - x), 0);
    const want = len - overlapsDaily(iv, bs, bl);
    const outside = parts.some(([x, y]) => x < iv[0] - EPS || y > iv[1] + EPS || overlapsDaily([x, y], bs, bl) > EPS);
    if (Math.abs(got - Math.max(0, want)) > 1e-6 || outside) ivProblems.push(`subtractDaily([${iv}], ${bs}, ${bl}) = ${JSON.stringify(parts)}`);
    const pieces = toDayPieces(a, a + len);
    const plen = pieces.reduce((s, [x, y]) => s + (y - x), 0);
    if (Math.abs(plen - Math.min(len, 24)) > EPS || pieces.some(([x, y]) => x < 0 || y > 24 + EPS)) ivProblems.push(`toDayPieces(${a}, ${a + len}) = ${JSON.stringify(pieces)}`);
  }
  r.check('fail', 'subtractDaily and toDayPieces match a brute-force check on 3,000 random intervals', ivProblems);

  // ---------- Holidays and seasons ----------
  r.start('Holidays and seasons', CHECKS.data);
  const known = { easter: { 2025: '04-20', 2026: '04-05', 2027: '03-28', 2030: '04-21', 2038: '04-25' }, thanksgiving: { 2025: '11-27', 2026: '11-26', 2027: '11-25', 2030: '11-28' } };
  const hol = [];
  for (const [y, md] of Object.entries(known.easter)) if (new Date(cal.easterDate(+y)).toISOString().slice(5, 10) !== md) hol.push(`Easter ${y}`);
  for (const [y, md] of Object.entries(known.thanksgiving)) if (new Date(cal.thanksgivingDate(+y)).toISOString().slice(5, 10) !== md) hol.push(`Thanksgiving ${y}`);
  r.check('fail', 'Easter and Thanksgiving match published dates', hol);

  const thisYear = new Date().getFullYear();
  const tables = { 'Lunar New Year': themes.LUNAR_NEW_YEAR, Diwali: themes.DIWALI, Hanukkah: themes.HANUKKAH };
  const horizon = [];
  for (const [name, t] of Object.entries(tables)) {
    const years = Object.keys(t).map(Number).sort();
    const last = years[years.length - 1];
    for (let y = years[0]; y <= last; y++) if (!t[y]) horizon.push(`${name}: ${y} missing`);
    if (last - thisYear < 3) horizon.push(`${name}: dates end in ${last}, ${last - thisYear} year(s) from now`);
    for (const y of years) {
      const [m, d] = t[y];
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (dt.getUTCMonth() !== m - 1) horizon.push(`${name} ${y}: ${m}/${d} is not a real date`);
    }
  }
  r.check('warn', 'Lunisolar holiday tables are complete and reach at least 3 years ahead', horizon);

  const daily = [];
  let lastKey = null, runs = 0;
  for (let t = Date.UTC(thisYear, 0, 1, 12); t < Date.UTC(thisYear + 1, 0, 1); t += 86400000) {
    try {
      const k = cal.detectHoliday(t, 'America/New_York');
      if (k && !themes.HOLIDAYS[k]) daily.push(`${new Date(t).toISOString().slice(0, 10)}: unknown holiday "${k}"`);
      if (k !== lastKey) { runs++; lastKey = k; }
      const s = cal.detectSeason(t, cal.hemisphereForTz('Australia/Sydney'));
      if (!themes.SEASONS[s]) daily.push(`unknown season "${s}"`);
    } catch (e) { daily.push(e.message); break; }
  }
  r.check('fail', `Every day of ${thisYear} maps to a known holiday or season`, daily);
  const south = ['Australia/Sydney', 'America/Sao_Paulo', 'Africa/Johannesburg', 'Pacific/Auckland', 'America/Argentina/Buenos_Aires'];
  const north = ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'Asia/Singapore', 'Africa/Cairo'];
  const hemi = [...south.filter((z) => cal.hemisphereForTz(z) !== 'south'), ...north.filter((z) => cal.hemisphereForTz(z) !== 'north')];
  r.check('fail', 'Hemisphere detection for well-known zones', hemi);

  // ---------- Location data and search ----------
  r.start('Location data and search', CHECKS.data);
  const codes = LOCATIONS.map((l) => l.code);
  const dup = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))];
  r.check('fail', `Airport codes are unique across ${LOCATIONS.length} airports`, dup);
  const badTz = [];
  for (const l of LOCATIONS) {
    if (!/^[A-Z0-9]{3}$/.test(l.code)) badTz.push(`${l.code}: not a 3-character code`);
    try { new Intl.DateTimeFormat('en', { timeZone: l.tz }); } catch { badTz.push(`${l.code}: unknown time zone ${l.tz}`); continue; }
    if (!l.city || !l.country) badTz.push(`${l.code}: missing city or country`);
  }
  r.check('warn', 'Every airport has a valid code, time zone, city and country', badTz);
  const expect = [['LHR', 'LHR'], ['tromso', 'TOS'], ['Bombay', 'BOM'], ['nyc', null, /New York/], ['zurich', 'ZRH'], ['saigon', 'SGN'], ['pago', null, /Pago Pago/], ['heathrow', 'LHR'], ['  sao paulo ', null, /São Paulo/]];
  const searchProblems = [];
  for (const [q, code, re] of expect) {
    const hits = searchLocations(q);
    const top = hits[0];
    if (!top) { searchProblems.push(`"${q}" finds nothing`); continue; }
    if (code && top.code !== code) searchProblems.push(`"${q}" ranks ${top.label} first, expected ${code}`);
    if (re && !re.test(top.label)) searchProblems.push(`"${q}" ranks ${top.label} first`);
  }
  for (const q of ['', ' ', '(', '.*', '\\', 'ü', 'a'.repeat(300)]) {
    try { searchLocations(q); } catch (e) { searchProblems.push(`"${q.slice(0, 10)}" throws ${e.message}`); }
  }
  r.check('fail', 'Search ranks the expected place first and survives odd input', searchProblems);
  const parse = [];
  for (const k of ['code:LHR', 'tz:Asia/Kolkata', 'London|Europe/London', 'garbage', 'tz:Not/AZone']) {
    try {
      const l = parseLoc(k);
      if (!l || !l.tz) parse.push(`${k}: no time zone`);
      else tzOffset(l.tz, Date.now());
    } catch (e) { parse.push(`${k}: ${e.message}`); }
  }
  r.check('warn', 'parseLoc handles current, legacy and broken keys without throwing', parse);

  // ---------- README claims ----------
  r.start('README claims', CHECKS.readme);
  const { readFileSync } = await import('node:fs');
  const readme = readFileSync(join(docs, '..', 'README.md'), 'utf8');
  const { AIRPORTS } = await imp('js/data/airports.js');
  const lines = readme.split('\n');
  const claims = [];
  let held = 0;
  const claim = (quote, ok, actual) => {
    const line = lines.findIndex((l) => l.includes(quote)) + 1;
    if (!line) claims.push({ quote, line: 0, actual: 'the README no longer says this; update the check in tools/qc/model-hunt.mjs' });
    else if (!ok) claims.push({ quote, line, actual });
    else held++;
  };
  claim('About 3,100 airports are built in', Math.abs(LOCATIONS.length - 3100) <= 150, `the app has ${LOCATIONS.length.toLocaleString('en-US')}`);
  const curatedClaim = (readme.match(/(\d[\d,]*) hand-picked major airports/) || [])[1] || '0';
  claim(`${curatedClaim} hand-picked major airports`, Math.abs(AIRPORTS.length - Number(curatedClaim.replace(/,/g, ''))) <= 10, `the curated list has ${AIRPORTS.length}`);
  claim('about 1 hour per day when advancing (flying east) and 1.5 hours per day when delaying', MODEL.advanceRate === 1 && MODEL.delayRate === 1.5, `MODEL has ${MODEL.advanceRate} and ${MODEL.delayRate}`);
  claim('about 3 hours before your body\'s natural wake time', MODEL.tminBeforeWake === 3, `tminBeforeWake is ${MODEL.tminBeforeWake}`);
  claim('pre-adjust up to 3 days', buildPlan({ ...base, preDays: 9, dest: 'code:SYD' }).pre.length <= 3, 'more than 3 pre-adjust days are planned');
  const icsSrc = readFileSync(join(docs, 'js/ui/ics.js'), 'utf8');
  claim('alert 15 minutes before bedtime', /ALERT_MINUTES = 15\b/.test(icsSrc), 'ALERT_MINUTES is not 15');
  const lastYear = Math.min(...[themes.LUNAR_NEW_YEAR, themes.DIWALI, themes.HANUKKAH].map((t) => Math.max(...Object.keys(t).map(Number))));
  claim('Lunar New Year, Diwali, and Hanukkah dates extended through 2036', lastYear === 2036, `the tables end in ${lastYear}`);
  const shortTrip = buildPlan({ ...base, tripDays: MODEL.shortTripDays, dest: 'code:NRT' });
  claim('a trip kept on home time needs little recovery', shortTrip.strategy === 'home', `a ${MODEL.shortTripDays}-day trip to Tokyo uses "${shortTrip.strategy}"`);
  const tromso = searchLocations('tromso')[0];
  claim('"tromso" finds Tromsø', tromso && /Troms/.test(tromso.city), `top result is ${tromso && tromso.label}`);
  // The README's example of a place with no listed airport, shown with its UTC offset.
  const example = (readme.match(/for example "([^"(]+) \((UTC[^)]*)\)"/) || []);
  const place = example[1] && searchLocations(example[1])[0];
  claim(example[0] ? example[0].replace('for example ', '') : 'for example "Place (UTC±N)"', place && place.label === `${example[1]} (${example[2]})`, `label is "${place && place.label}"`);
  for (const c of claims) {
    const q = c.quote.startsWith('"') ? c.quote : `"${c.quote}"`;
    r.fail(`README says ${q}, but ${c.actual}`, '', null, {
      where: c.line ? `README.md:${c.line}` : 'tools/qc/model-hunt.mjs (README claims)',
      steps: 'Compare the README line with the app data and a plan built from it.',
      expected: `The app matches the README: ${q}.`,
      actual: c.actual[0].toUpperCase() + c.actual.slice(1) + '.',
      evidence: 'Tested against the code by the script.',
    });
  }
  if (!claims.length) r.pass('Concrete README claims match the app (airport counts, shift rates, pre-adjust, alerts, holidays, search)');
  const n = held;
  r.stat(`${n} of ${held + claims.length} README claims tested by the script hold.`);
}
