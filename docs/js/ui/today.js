// "Today" card: what to do right now and what comes next, for wherever the traveler is in the trip.
import { $, esc, mod24 } from '../lib/util.js';
import { localDateStr, localHours } from '../lib/time.js';
import { fmtTime, fmtRange, fmtDate } from './format.js';

const DAY_MS = 86400000;
const insideWindow = (h, a, b) => { const len = b - a; return len > 0 && mod24(h - a) < len; };

/** Upcoming steps for a plan day, as [hour, icon, text], in the day's own hour frame. */
function dayEvents(d) {
  const ev = [];
  if (!d.arrivalDay) ev.push([d.wake, '⏰', 'Wake up']);
  for (const [a, b] of d.seek) ev.push([a, '☀️', `Get bright light until ${fmtTime(b)}`]);
  for (const [a, b] of d.avoid) ev.push([a, '🕶️', `Avoid bright light until ${fmtTime(b)}`]);
  for (const t of d.caff.doses) ev.push([t, '☕', 'Coffee or tea']);
  if (d.caff.window) ev.push([d.caff.cutoff, '🚫', 'Last caffeine']);
  if (d.melatonin !== null) ev.push([d.melatonin, '💊', 'Melatonin, if your doctor agrees']);
  ev.push([d.bed, '🛏️', 'Go to bed']);
  return ev;
}

/** Current state lines for a plan day at local hour h. */
function nowLines(d, prev, h) {
  const out = [];
  const asleep = insideWindow(h, d.bed, d.bed + d.night) || (prev && insideWindow(h, prev.bed, prev.bed + prev.night));
  if (asleep) return [['🌙', 'It is sleep time. Keep the room dark and put your phone away.']];
  const seek = d.seek.find(([a, b]) => insideWindow(h, a, b));
  const avoid = d.avoid.find(([a, b]) => insideWindow(h, a, b));
  if (seek) out.push(['☀️', `Get bright light now, ideally outdoors, until ${fmtTime(seek[1])}.`]);
  else if (avoid) out.push(['🕶️', `Avoid bright light now, until ${fmtTime(avoid[1])}. Sunglasses help outside.`]);
  if (d.caff.window && insideWindow(h, d.caff.window[0], d.caff.window[1])) out.push(['☕', `Caffeine is OK until ${fmtTime(d.caff.cutoff)}.`]);
  else out.push(['🚫', 'No more caffeine today.']);
  return out;
}

function nextSteps(events, h, wake) {
  // Put "now" and every step in one frame that starts a few hours before wake time.
  const start = wake - 3;
  const norm = (t) => start + mod24(t - start);
  const now = norm(h);
  return events.map(([t, icon, text]) => [norm(t), t, icon, text]).filter(([n]) => n > now)
    .sort((a, b) => a[0] - b[0]).slice(0, 3)
    .map(([, t, icon, text]) => [icon, `<strong>${fmtTime(t)}</strong> ${esc(text)}`]);
}

const list = (items) => '<ul class="tips">' + items.map(([icon, html]) =>
  `<li><span class="ic" aria-hidden="true">${icon}</span><span>${html}</span></li>`).join('') + '</ul>';

/** Today guidance for one leg, or null if "now" is outside it. */
function legToday(p, now, label) {
  if (!p || p.error) return null;
  // Before departure (with pre-adjust days, or a countdown).
  if (now < p.depUtc) {
    const today = localDateStr(p.home.tz, now);
    const pre = p.pre.find((d) => d.date === today);
    if (pre) {
      const h = localHours(p.home.tz, now);
      return { title: `Getting ready${label}`, sub: `${esc(p.home.name)} time`, now: [['🧳', `Shift your sleep: bed at <strong>${fmtTime(pre.bed)}</strong>, wake at <strong>${fmtTime(pre.wake)}</strong>.`]],
        next: nextSteps([[pre.wake, '⏰', 'Wake up'], ...pre.seek.map(([a, b]) => [a, '☀️', `Get bright light until ${fmtTime(b)}`]), [pre.bed, '🛏️', 'Go to bed']], h, pre.wake) };
    }
    return { countdown: true, depUtc: p.depUtc, label, p };
  }
  // In the air.
  if (now < p.arrUtc) {
    const h = localHours(p.dest.tz, now);
    const f = p.flight;
    const sleeping = f.sleep && insideWindow(h, f.sleep.start, f.sleep.end);
    return { title: `In the air${label}`, sub: `${esc(p.dest.name)} time is ${fmtTime(h)}`,
      now: [sleeping ? ['😴', `Sleep now if you can, until about ${fmtTime(f.sleep.end)}.`]
        : f.sleep && mod24(f.sleep.start - h) < 12 ? ['👀', `Stay awake for now. Try to sleep from ${fmtRange(f.sleep.start, f.sleep.end)}.`]
        : ['👀', 'Stay awake; it is daytime where you are going.'],
      ['💧', 'Sip water through the flight and go easy on alcohol.']],
      next: [['🛬', `<strong>${fmtTime(p.arrHour)}</strong> Land in ${esc(p.dest.name)}`]] };
  }
  // At the destination, during the plan.
  const today = localDateStr(p.dest.tz, now);
  const i = p.days.findIndex((d) => d.date === today);
  if (i < 0) return null;
  const d = p.days[i];
  const h = localHours(p.dest.tz, now);
  return { title: `${d.arrivalDay ? 'Arrival day' : d.isAdjusted ? 'Back in sync' : 'Day ' + d.k}${label}`, sub: `${esc(p.dest.name)} time is ${fmtTime(h)}`,
    now: nowLines(d, p.days[i - 1], h), next: nextSteps(dayEvents(d), h, d.arrivalDay ? Math.max(p.arrHour, d.wake) : d.wake) };
}

/**
 * @param {object} plan  outbound plan
 * @param {object} back  return plan, or null
 */
export function renderToday(plan, back) {
  const el = $('#today');
  if (!plan) { el.hidden = true; return; }
  const now = Date.now();
  // The return leg takes over once its departure is close (from midnight on its departure day).
  const useBack = back && !back.error && now >= back.depUtc - DAY_MS;
  let t = (useBack && legToday(back, now, ' · Return')) || legToday(plan, now, '');
  if (!t && back && !back.error && now > back.arrUtc) t = { done: true, msg: `You're home. Keep a steady routine of sleep, daylight and meals.` };
  if (!t) t = { done: true, msg: `Your plan for ${esc(plan.dest.name)} has ended. Keep a steady routine, or plan your next trip below.` };

  let html;
  if (t.countdown) {
    const days = Math.ceil((t.depUtc - now) / DAY_MS);
    html = `<div class="today-head"><h2>Today</h2><span class="day-tag">${days <= 1 ? 'Trip starts tomorrow' : `Trip starts in ${days} days`}</span></div>
      <p class="today-lead">You leave ${esc(t.p.home.name)} on <strong>${esc(fmtDate(localDateStr(t.p.home.tz, t.depUtc)))} at ${fmtTime(localHours(t.p.home.tz, t.depUtc))}</strong>.</p>
      ${list([['🛏️', 'Sleep well the nights before you fly; it makes the shift easier.'],
        t.p.pre.length ? ['🧳', `Pre-adjusting starts ${esc(fmtDate(t.p.pre[0].date))}.`] : ['🧳', 'Want a head start? Set days to pre-adjust in More options.'],
        ['📅', 'Add the sleep times to your calendar from the Daily plan.']])}`;
  } else if (t.done) {
    html = `<div class="today-head"><h2>Today</h2></div><p class="today-lead">${t.msg}</p>`;
  } else {
    html = `<div class="today-head"><h2>Today</h2><span class="day-tag">${t.title}</span></div>
      <p class="today-sub">${t.sub}</p>
      <h3 class="today-label">Right now</h3>${list(t.now)}
      ${t.next.length ? `<h3 class="today-label">Next</h3>${list(t.next)}` : ''}`;
  }
  el.innerHTML = html;
  el.hidden = false;
}

