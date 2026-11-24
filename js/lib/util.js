// Small, dependency-free helpers shared across modules.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const DAY_MS = 86400000;
export const mod24 = (h) => ((h % 24) + 24) % 24;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const pad = (n) => String(n).padStart(2, '0');
/** Round hours to the nearest quarter hour so advice reads naturally. */
export const quarter = (h) => Math.round(h * 4) / 4;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** "HH:MM" → decimal hours. */
export function hm(str) {
  const [h, m] = String(str || '0:0').split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}
/** Decimal hours → "HH:MM" (wrapped to one day). */
export function toHM(h) {
  const t = Math.round(mod24(h) * 60) % 1440;
  return pad(Math.floor(t / 60)) + ':' + pad(t % 60);
}

/** Pick the representative of x (mod 24) closest to ref. */
export function nearest(x, ref) {
  let v = x;
  while (v - ref > 12) v -= 24;
  while (ref - v > 12) v += 24;
  return v;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
