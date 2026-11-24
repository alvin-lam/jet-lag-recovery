// Display formatting. Reads the user's clock and unit preferences from the shared store.
import { store } from '../state.js';
import { mod24, pad, quarter } from '../lib/util.js';

const ML_PER_OZ = 29.5735;

export function fmtTime(h) {
  const t = Math.round(mod24(quarter(h)) * 60) % 1440;
  const H = Math.floor(t / 60);
  const M = t % 60;
  if (store.trip.clock === '24') return pad(H) + ':' + pad(M);
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
  if (store.trip.volUnit === 'imperial') {
    const oz = ml / ML_PER_OZ;
    return Math.round(oz) + ' oz (' + Math.round((oz / 8) * 2) / 2 + ' cups)';
  }
  return (Math.round(ml / 100) / 10).toFixed(1) + ' L';
}

export function fmtVolShort(ml) {
  if (store.trip.volUnit === 'imperial') return Math.round(ml / ML_PER_OZ) + ' oz';
  return ml >= 1000 ? (Math.round(ml / 100) / 10).toFixed(1) + ' L' : Math.round(ml) + ' ml';
}

export function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined,
    { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export { fmtOffset } from '../lib/time.js';
