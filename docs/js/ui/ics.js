// Export planned sleep windows as an iCalendar (.ics) file. Times are written in UTC.
import { mod24, pad, quarter } from '../lib/util.js';
import { zonedToUtc, addDays } from '../lib/time.js';
import { fmtTime } from './format.js';

const HOUR_MS = 3600000;
const NOTE = 'General information only. Not medical or health advice.';

function stamp(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T'
    + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
}

const escText = (s) => s.replace(/[\\,;]/g, '\\$&');

// A bedtime before noon belongs to the early hours of the next calendar day.
function sleepStart(date, bed, tz) {
  return zonedToUtc(mod24(bed) < 12 ? addDays(date, 1) : date, mod24(quarter(bed)), tz);
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
  for (const d of p.pre) {
    add(sleepStart(d.date, d.bed, p.home.tz), p.sleepLen, 'Sleep (jet lag prep)', 'Jet Lag & Recovery: pre-flight shift.', p.home.tz, p.home.name);
  }
  for (const d of p.days) {
    add(sleepStart(d.date, d.bed, p.dest.tz), d.night || p.sleepLen, 'Sleep in ' + p.dest.name,
      `Jet Lag & Recovery: last caffeine ${fmtTime(d.caff.cutoff)}.`, p.dest.tz, p.dest.name);
  }
  if (back && !back.error) {
    for (const d of back.days) {
      add(sleepStart(d.date, d.bed, back.dest.tz), d.night || back.sleepLen, 'Sleep (back home in ' + back.dest.name + ')',
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
