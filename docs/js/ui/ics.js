// Export planned sleep windows as an iCalendar (.ics) file. Times are written in UTC.
import { mod24, pad, quarter } from '../lib/util.js';
import { zonedToUtc, addDays, localDateStr } from '../lib/time.js';
import { fmtTime } from './format.js';

const HOUR_MS = 3600000;
const NOTE = 'General information only. Not medical or health advice.';

function stamp(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T'
    + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
}

const escText = (s) => s.replace(/[\\,;]/g, '\\$&');

const AWAKE_MIN_MS = 2 * HOUR_MS; // the shortest time awake between two nights

/**
 * The first moment after `after` when the clock in `tz` reads `bed` (rounded to the quarter hour).
 * Nights are placed one after another this way, so they never overlap and never skip a day, whatever
 * the traveler's sleep times (late sleepers, daytime sleepers, and bedtimes that cross midnight).
 */
function nextBedtime(after, bed, tz) {
  const h = mod24(quarter(bed));
  const date = localDateStr(tz, after);
  const today = zonedToUtc(date, h, tz);
  return today > after ? today : zonedToUtc(addDays(date, 1), h, tz);
}

const ALERT_MINUTES = 15; // every event reminds the traveler shortly before bedtime

/**
 * The sleep events for a plan, as plain objects shared by the .ics file and the Google Calendar links.
 * @param {object} p     the outbound plan
 * @param {object} [back] the return plan, when one is planned; its sleep times are added too
 */
export function sleepEvents(p, back) {
  const events = [];
  const add = (start, hours, title, details, tz, place) => events.push({ start, end: start + hours * HOUR_MS, title, details: details + ' ' + NOTE, tz, place });
  // Before departure: the first night follows midday of its date; each later night follows the last.
  // A night before an early-morning flight ends when the flight leaves.
  let after = p.pre.length ? zonedToUtc(p.pre[0].date, 12, p.home.tz) : 0;
  for (const d of p.pre) {
    const start = nextBedtime(after, d.bed, p.home.tz);
    const hours = Math.min(p.sleepLen, (p.depUtc - start) / HOUR_MS);
    after = start + Math.max(hours, 0) * HOUR_MS + AWAKE_MIN_MS;
    if (hours >= 1) add(start, hours, 'Sleep (jet lag prep)', 'Jet Lag & Recovery: pre-flight shift.', p.home.tz, p.home.name);
  }
  // At the destination: the first night follows landing. With a return flight, these nights stop
  // when it leaves; the nights after that are back home.
  const leaves = back && !back.error ? back.depUtc : Infinity;
  after = p.arrUtc;
  for (const d of p.days) {
    const start = nextBedtime(after, d.bed, p.dest.tz);
    const hours = Math.min(d.night || p.sleepLen, (leaves - start) / HOUR_MS);
    if (hours < 1) break;
    after = start + hours * HOUR_MS + AWAKE_MIN_MS;
    add(start, hours, 'Sleep in ' + p.dest.name,
      `Jet Lag & Recovery: last caffeine ${fmtTime(d.caff.cutoff)}.`, p.dest.tz, p.dest.name);
  }
  if (back && !back.error) {
    after = back.arrUtc;
    for (const d of back.days) {
      const start = nextBedtime(after, d.bed, back.dest.tz);
      const hours = d.night || back.sleepLen;
      after = start + hours * HOUR_MS + AWAKE_MIN_MS;
      add(start, hours, 'Sleep (back home in ' + back.dest.name + ')',
        `Jet Lag & Recovery, return trip: last caffeine ${fmtTime(d.caff.cutoff)}.`, back.dest.tz, back.dest.name);
    }
  }
  return events;
}

/** Calendar file text. Each event carries a display alert 15 minutes before it starts. */
export function icsText(events) {
  const now = stamp(Date.now());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//All Trips Considered//Jet Lag & Recovery//EN', 'CALSCALE:GREGORIAN'];
  events.forEach((e, i) => lines.push(
    'BEGIN:VEVENT', `UID:${e.start}-${i}@alltripsconsidered.com`, 'DTSTAMP:' + now,
    'DTSTART:' + stamp(e.start), 'DTEND:' + stamp(e.end),
    'SUMMARY:' + escText(e.title), 'DESCRIPTION:' + escText(e.details),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escText(e.title), `TRIGGER:-PT${ALERT_MINUTES}M`, 'END:VALARM',
    'END:VEVENT'));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Download the .ics file. Apple Calendar, Outlook and most calendar apps open it. */
export function downloadIcs(events, destName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([icsText(events)], { type: 'text/calendar' }));
  a.download = 'jet-lag-plan-' + destName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** A link that opens Google Calendar with one event filled in. Google uses the person's own default reminder. */
export function googleUrl(e) {
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: e.title, dates: stamp(e.start) + '/' + stamp(e.end),
    details: e.details + ` Tip: set a ${ALERT_MINUTES}-minute reminder.`,
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
