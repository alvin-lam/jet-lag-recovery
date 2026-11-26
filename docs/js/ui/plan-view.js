// Summary card, form hints and the day-by-day plan.
import { $, esc } from '../lib/util.js';
import { localDateStr, localHours } from '../lib/time.js';
import { fmtTime, fmtRanges, fmtRange, fmtDur, fmtHours, fmtVol, fmtVolShort, fmtDate, fmtOffset } from './format.js';
import { bar, marker, lightBars, timeline } from './timeline.js';

const tipsList = (items) => '<ul class="tips">' + items.filter(Boolean).map(([icon, html]) =>
  `<li><span class="ic" aria-hidden="true">${icon}</span><span>${html}</span></li>`).join('') + '</ul>';

const isShifting = (p) => p.strategy === 'gradual' || p.strategy === 'immediate';

export function renderHints(p) {
  $('#arrival-hint').innerHTML = `Lands <strong>${esc(fmtDate(p.arrDate))} at ${fmtTime(p.arrHour)}</strong> ${esc(p.dest.name)} time.`;
  $('#sleep-hint').innerHTML = `You normally sleep <strong>${fmtDur(p.sleepLen)}</strong>.`
    + (p.sleepLen < 7 ? ' Most adults need 7 to 9 hours. Extra sleep before you fly will help.' : '');
}

function strategyText(p) {
  if (p.strategy === 'none') {
    return p.isReturn && p.outboundShift >= 1
      ? 'Your body clock stayed on home time while you were away, so you should settle back in quickly. Keep your normal routine.'
      : 'The time difference is small. Keep your normal routine.';
  }
  if (p.strategy === 'home') return `Your trip is short, so stay on ${p.home.name} time and plan activities around it.`;
  const dir = p.sign > 0 ? 'advance (sleep earlier)' : 'delay (sleep later)';
  const longWay = Math.sign(p.target) !== Math.sign(p.clockDiff)
    ? ` With a ${fmtHours(p.clockDiff)} gap, it is easier to ${dir} by ${fmtHours(p.absT)} than to go the other way.` : '';
  const main = p.strategy === 'immediate'
    ? `Switch to ${p.dest.name} time on arrival and use light to pull your body clock along.`
    : `Shift your body clock about ${fmtHours(p.rate)} per day toward ${p.dest.name} time.`;
  const pre = p.P0 ? ` Pre-adjusting before you leave already covers ${fmtHours(p.P0)}.` : '';
  return main + longWay + pre;
}

export function renderSummary(p, target = '#summary') {
  const adjusted = p.adjustedDay ? p.days[p.adjustedDay - 1] : null;
  const stat = (k, v, s) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const first = p.days[0];
  // Return leg: explain how much of the outbound shift has to be undone.
  let returnNote = '';
  if (p.isReturn && p.outboundShift >= 1 && p.adjustedBeforeReturn >= 0.5) {
    const full = p.outboundShift - p.adjustedBeforeReturn < 0.5;
    returnNote = `<p class="callout">${full
      ? `By the time you fly home, your body clock has fully adjusted to ${esc(p.home.name)} time, so the whole ${fmtHours(p.outboundShift)} shift is reversed.`
      : `By the time you fly home, your body clock has adjusted about ${fmtHours(p.adjustedBeforeReturn)} of the ${fmtHours(p.outboundShift)} shift, so only that part needs to be undone.`}</p>`;
  }
  $(target).innerHTML = `
    <h3>${esc(p.home.name)} → ${esc(p.dest.name)}</h3>
    <p class="route">${fmtOffset(p.offHome)} to ${fmtOffset(p.offDest)} · ${fmtDur(p.durH)} flight ·
      <span class="badge ${p.severity.key}">${p.severity.label} jet lag</span></p>
    <div class="stats">
      ${stat('Time difference', p.clockDiff === 0 ? '0 h' : fmtHours(p.clockDiff),
        p.clockDiff === 0 ? 'Same time zone' : esc(p.dest.name) + (p.clockDiff > 0 ? ' is ahead' : ' is behind'))}
      ${stat('Body clock', p.strategy === 'none' ? 'Hold' : p.strategy === 'home' ? 'Stay' : p.sign > 0 ? 'Advance' : 'Delay',
        isShifting(p) ? fmtHours(p.absT) + ' to shift' : 'No shift needed')}
      ${stat('Days to adjust', p.daysToAdjust || '—',
        adjusted && isShifting(p) ? 'Back in sync by ' + esc(fmtDate(adjusted.date)) : isShifting(p) ? 'Beyond this plan' : 'Not shifting')}
      ${stat('First night', fmtTime(first.bed), 'Wake ' + fmtTime(first.wake))}
    </div>
    <p class="callout">${esc(strategyText(p))}</p>${returnNote}`;
}

function preDayCard(p, d, daysOut) {
  return `<article class="panel day">
    <div class="day-head"><h3>${esc(fmtDate(d.date))}<span>${esc(p.home.name)} time</span></h3>
      <span class="day-tag">Before you fly · ${daysOut} day${daysOut > 1 ? 's' : ''} out</span></div>
    ${timeline({
      sleep: bar('sleep', d.bed, d.bed + p.sleepLen, 'Sleep'),
      light: lightBars(d.light),
      caff: bar('caff', d.wake, d.caffCutoff, 'Caffeine OK'),
    })}
    ${tipsList([
      ['🛏️', `Go to bed at <strong>${fmtTime(d.bed)}</strong> and wake at <strong>${fmtTime(d.wake)}</strong>, ${p.sign > 0 ? 'an hour earlier' : 'an hour later'} each day.`],
      d.seek.length && ['☀️', `Get bright light ${fmtRanges(d.seek)}.`],
      d.avoid.length && ['🕶️', `Keep lights dim ${fmtRanges(d.avoid)}.`],
      ['☕', `Last caffeine by <strong>${fmtTime(d.caffCutoff)}</strong>.`],
    ])}
  </article>`;
}

function flightCard(p) {
  const f = p.flight;
  return `<article class="panel day flight">
    <div class="day-head"><h3>Travel day<span>${esc(p.dest.name)} time</span></h3><span class="day-tag">✈️ In flight</span></div>
    ${timeline({
      sleep: f.sleep ? bar('sleep', f.sleep.start, f.sleep.end, 'Sleep on the plane') : '',
      light: bar('flightbar', f.start, f.end, 'Flight'),
      caff: bar('caff', f.start, f.sleep ? Math.min(f.end, f.caffCutoff) : f.end, 'Caffeine OK'),
    })}
    ${tipsList([
      ['🕑', `Set your watch to ${esc(p.dest.name)} time when you board. You depart at ${fmtTime(f.depHourDest)} and land at ${fmtTime(f.arrHour)} destination time.`],
      f.sleep
        ? ['😴', `Sleep from about <strong>${fmtRange(f.sleep.start, f.sleep.end)}</strong> (${fmtDur(f.sleep.len)}), which is night at your destination.`]
        : ['👀', 'It is daytime at your destination for this whole flight, so try to stay awake.'],
      ['💧', `Drink about <strong>${fmtVolShort(f.waterMl)}</strong> of water during the flight.`],
    ])}
  </article>`;
}

function napText(nap) {
  if (!nap) return null;
  return nap.kind === 'debt'
    ? `You slept ${fmtDur(nap.len)}, so a 20 to 30 minute nap is fine. Finish it at least 8 hours before bedtime.`
    : 'Arriving in the morning with little sleep: one nap of 20 to 30 minutes before 2 pm is fine. Set an alarm.';
}

function dayCard(p, d, today, nowHour) {
  const tag = d.arrivalDay ? 'Arrival day' : d.isAdjusted ? 'Back in sync' : 'Day ' + d.k;
  const isToday = d.date === today;

  const sleepLine = d.lateArrival
    ? `Land at ${fmtTime(p.arrHour)}. Head to bed as soon as you can, around <strong>${fmtTime(d.bed)}</strong>, and wake at <strong>${fmtTime(d.wake)}</strong>.`
    : d.arrivalSleep
    ? `Land at ${fmtTime(p.arrHour)}. Sleep from about <strong>${fmtRange(d.arrivalSleep[0], d.arrivalSleep[1])}</strong>, then start your day. Go to bed tonight at <strong>${fmtTime(d.bed)}</strong>.`
    : (d.arrivalDay
      ? `Land at ${fmtTime(p.arrHour)}. Go to bed at <strong>${fmtTime(d.bed)}</strong>.`
      : `Wake at <strong>${fmtTime(d.wake)}</strong>. Go to bed at <strong>${fmtTime(d.bed)}</strong>.`)
      + (p.strategy === 'gradual' && Math.abs(d.bed - p.homeBed) > 0.2 ? ` This is a stepping stone toward your usual ${fmtTime(p.homeBed)}.` : '');

  const bodyTip = !isShifting(p) ? null
    : Math.abs(d.behind) >= 0.5
      ? ['🧭', `Your body clock starts the day about <strong>${fmtHours(d.behind)}</strong> ${d.behind > 0 ? 'behind' : 'ahead of'} local time.`]
      : ['✅', 'Your body clock is in sync with local time. Keep a steady routine.'];

  const c = d.caff;
  const caffTip = !c.window ? ['☕', 'Skip caffeine today. Bedtime is too close.']
    : ['☕', (c.doses.length ? `Caffeine at ${c.doses.map(fmtTime).join(' and ')} (about ${c.doses.length} cup${c.doses.length > 1 ? 's' : ''}). ` : '')
      + `Last caffeine by <strong>${fmtTime(c.cutoff)}</strong>.`];

  const w = d.water;
  const logged = d.logged
    ? `<span class="logged">Logged ${fmtRange(d.logged.bed, d.logged.wake)} (${fmtDur(d.logged.len)}). The days that follow were adjusted.</span>` : '';

  return `<article class="panel day${d.isAdjusted ? ' adjusted' : ''}">
    <div class="day-head"><h3>${esc(fmtDate(d.date))}<span>${esc(p.dest.name)} time${isToday ? ' · Today' : ''}</span></h3>
      <span class="day-tag">${tag}</span></div>
    ${timeline({
      sleep: bar('sleep', d.bed, d.bed + d.night, 'Sleep')
        + (d.arrivalSleep ? bar('sleep', d.arrivalSleep[0], d.arrivalSleep[1], 'Sleep after landing') : '')
        + (d.melatonin !== null ? marker('mel', d.melatonin, 'Melatonin') : '')
        + (isToday ? marker('now', nowHour, 'Now') : ''),
      light: lightBars(d.light),
      caff: (c.window ? bar('caff', c.window[0], c.window[1], 'Caffeine OK') : '')
        + w.times.map((t) => marker('water', t, 'Drink water')).join(''),
    })}
    ${tipsList([
      ['🛏️', sleepLine],
      bodyTip,
      d.seek.length && ['☀️', `Get bright light, ideally outdoors, ${fmtRanges(d.seek)}.`],
      d.avoid.length && ['🕶️', `Avoid bright light ${fmtRanges(d.avoid)}. Wear sunglasses if you are outside.`],
      caffTip,
      d.melatonin !== null && ['💊', `Some people use 0.5 to 3 mg of melatonin around <strong>${fmtTime(d.melatonin)}</strong>. Ask a doctor or pharmacist before trying it.`],
      d.nap && ['💤', napText(d.nap)],
      ['💧', `Drink <strong>${fmtVol(w.base + w.flight)}</strong> today${w.flight ? ' including the flight' : ''}, about a glass every ${w.every === 1 ? 'hour' : w.every + ' hours'}.`],
    ])}
    ${p.strategy === 'none' ? '' : `<div class="checkin-row">
      <button type="button" class="btn btn-ghost btn-sm" data-checkin="${d.k}" data-leg="${p.isReturn ? 'return' : 'out'}">${d.log ? 'Edit sleep log' : 'Log tonight’s sleep'}</button>${logged}</div>`}
  </article>`;
}

export function renderDays(p, target = '#days') {
  const now = Date.now();
  const today = localDateStr(p.dest.tz, now);
  const nowHour = localHours(p.dest.tz, now);
  $(target).innerHTML = [
    ...p.pre.map((d, i) => preDayCard(p, d, p.pre.length - i)),
    flightCard(p),
    ...p.days.map((d) => dayCard(p, d, today, nowHour)),
  ].join('');
}
