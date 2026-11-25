// 24-hour timeline bars drawn with absolutely positioned spans (no canvas, no SVG, prints cleanly).
import { esc, mod24 } from '../lib/util.js';
import { toDayPieces } from '../lib/intervals.js';
import { fmtTime, uses24h } from './format.js';

const pct = (h) => (h / 24) * 100;

export function bar(cls, a, b, title) {
  return toDayPieces(a, b).map(([s, e]) =>
    `<span class="seg-bar ${cls}" data-style="left:${pct(s)}%;width:${pct(e - s)}%" title="${esc(title)}"></span>`).join('');
}

export function marker(cls, h, title) {
  return `<span class="marker ${cls}" data-style="left:${pct(mod24(h))}%" title="${esc(title)}"></span>`;
}

/** Seek and avoid light bars for a { seek, avoid } pair of windows. */
export function lightBars(light) {
  if (!light) return '';
  return bar('light', light.seek[0], light.seek[1], 'Seek bright light')
    + bar('dark', light.avoid[0], light.avoid[1], 'Avoid bright light');
}

function axis() {
  const end = uses24h() ? '24:00' : '12 am';
  return '<div class="axis">' + [0, 6, 12, 18, 24].map((t) =>
    `<span data-style="left:${pct(t)}%">${t === 24 ? end : fmtTime(t)}</span>`).join('') + '</div>';
}

/** Three lanes: sleep, light, caffeine and water. The text tips carry the same information for screen readers. */
export function timeline({ sleep = '', light = '', caff = '' }) {
  return `<div class="timeline" aria-hidden="true">
    <div class="lane">${sleep}</div><div class="lane">${light}</div><div class="lane">${caff}</div>${axis()}</div>`;
}
