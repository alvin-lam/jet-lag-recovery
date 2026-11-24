// Time zone math using the browser's built-in time zone database (Intl). Handles daylight saving time.
import { pad, DAY_MS } from './util.js';

// Creating Intl.DateTimeFormat objects is costly, so keep one per zone.
const formatters = new Map();
function formatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a zone. */
export function partsIn(tz, ms) {
  const o = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  }
  if (o.hour === 24) o.hour = 0;
  return o;
}

/** Offset of a zone from UTC, in minutes, at an instant. */
export function tzOffset(tz, ms) {
  const p = partsIn(tz, ms);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Wall-clock date ("YYYY-MM-DD") and decimal hour in a zone → UTC milliseconds. */
export function zonedToUtc(dateStr, hours, tz) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const naive = Date.UTC(y, mo - 1, d) + Math.round(hours * 60) * 60000;
  const first = naive - tzOffset(tz, naive) * 60000;
  return naive - tzOffset(tz, first) * 60000; // second pass settles DST edges
}

export function localDateStr(tz, ms) {
  const p = partsIn(tz, ms);
  return p.year + '-' + pad(p.month) + '-' + pad(p.day);
}

export function localHours(tz, ms) {
  const p = partsIn(tz, ms);
  return p.hour + p.minute / 60;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
}

/** Minutes east of UTC → "UTC+5:30", "UTC−11". */
export function fmtOffset(mins) {
  const a = Math.abs(mins);
  return 'UTC' + (mins < 0 ? '−' : '+') + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '');
}

export function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function allTimeZones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return []; }
}
