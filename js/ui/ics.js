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

export function exportIcs(p) {
  const now = stamp(Date.now());
  const events = [];
  const add = (start, hours, summary, desc) => events.push(
    'BEGIN:VEVENT', `UID:${start}-${events.length}@alltripsconsidered.com`, 'DTSTAMP:' + now,
    'DTSTART:' + stamp(start), 'DTEND:' + stamp(start + hours * HOUR_MS),
    'SUMMARY:' + escText(summary), 'DESCRIPTION:' + escText(desc + ' ' + NOTE), 'END:VEVENT');

  for (const d of p.pre) {
    add(sleepStart(d.date, d.bed, p.home.tz), p.sleepLen, 'Sleep (jet lag prep)', 'Jet Lag & Recovery: pre-flight shift.');
  }
  for (const d of p.days) {
    add(sleepStart(d.date, d.bed, p.dest.tz), d.night || p.sleepLen, 'Sleep in ' + p.dest.name,
      `Jet Lag & Recovery: last caffeine ${fmtTime(d.caff.cutoff)}.`);
  }

  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//All Trips Considered//Jet Lag & Recovery//EN',
    'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  a.download = 'jet-lag-plan-' + p.dest.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
