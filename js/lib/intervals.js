// Interval math on a 24-hour clock. An interval is [start, end] in decimal hours; values may run past 24
// or below 0 to express wrap-around (for example [22, 30] is 10 pm to 6 am).
import { mod24 } from './util.js';

/** Split an interval into pieces that each fit inside [0, 24). */
export function toDayPieces(a, b) {
  const len = b - a;
  if (len <= 0) return [];
  if (len >= 24) return [[0, 24]];
  const s = mod24(a);
  const e = s + len;
  return e <= 24 ? [[s, e]] : [[s, 24], [0, e - 24]];
}

/**
 * Remove a repeating daily block (such as sleep) from an interval.
 * Returns the parts of [a, b] that do not overlap the block, keeping the caller's hour frame,
 * and drops slivers shorter than minLen.
 */
export function subtractDaily([a, b], blockStart, blockLen, minLen = 0.5) {
  // Block occurrences that could touch [a, b].
  const first = blockStart + Math.floor((a - blockStart) / 24) * 24 - 24;
  let out = [[a, b]];
  for (let s = first; s < b; s += 24) {
    const e = s + blockLen;
    const next = [];
    for (const [x, y] of out) {
      if (e <= x || s >= y) { next.push([x, y]); continue; }
      if (s > x) next.push([x, s]);
      if (e < y) next.push([e, y]);
    }
    out = next;
  }
  return out.filter(([x, y]) => y - x >= minLen);
}
