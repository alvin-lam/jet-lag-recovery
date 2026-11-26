// Display formatting. Times and units follow the user's choice, or the device when set to "Device setting".
// Dates use the device region's date style in English (for example "Tue, Dec 1" in the US, "Tue 1 Dec" in the UK).
import { store } from '../state.js';
import { devicePrefs } from '../lib/locale.js';
import { mod24, pad, quarter } from '../lib/util.js';

const ML_PER_OZ = 29.5735;

/** True when times should use the 24-hour clock. */
export const uses24h = () => (store.trip.clock === 'auto' ? !devicePrefs().hour12 : store.trip.clock === '24');
/** True when volumes should use ounces and cups. */
export const usesImperial = () => (store.trip.volUnit === 'auto' ? devicePrefs().imperial : store.trip.volUnit === 'imperial');

export function fmtTime(h) {
  const t = Math.round(mod24(quarter(h)) * 60) % 1440;
  const H = Math.floor(t / 60);
  const M = t % 60;
  if (uses24h()) return pad(H) + ':' + pad(M);
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return h12 + (M ? ':' + pad(M) : '') + (H < 12 ? ' am' : ' pm');
}

export const fmtRange = (a, b) => fmtTime(a) + ' to ' + fmtTime(b);
export const fmtRanges = (list) => list.map(([a, b]) => fmtRange(a, b)).join(' and ');

export function fmtDur(h) {
  const t = quarter(h);
  const H = Math.floor(t);
  const M = Math.round((t - H) * 60);
  return H + ' h' + (M ? ' ' + M + ' min' : '');
}

export const fmtHours = (h) => Number(Math.abs(h).toFixed(2)) + ' h';

export function fmtVol(ml) {
  if (usesImperial()) {
    const oz = ml / ML_PER_OZ;
    return Math.round(oz) + ' oz (' + Math.round((oz / 8) * 2) / 2 + ' cups)';
  }
  return (Math.round(ml / 100) / 10).toFixed(1) + ' L';
}

export function fmtVolShort(ml) {
  if (usesImperial()) return Math.round(ml / ML_PER_OZ) + ' oz';
  return ml >= 1000 ? (Math.round(ml / 100) / 10).toFixed(1) + ' L' : Math.round(ml) + ' ml';
}

// One formatter in the device's date style, reused for every date.
let dateFormat = null;
export function fmtDate(dateStr) {
  dateFormat ||= new Intl.DateTimeFormat(devicePrefs().dateLocale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const [y, m, d] = dateStr.split('-').map(Number);
  return dateFormat.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export { fmtOffset } from '../lib/time.js';
