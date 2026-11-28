// "Share to": send the plan by email with the daily graphs (as an image) or as plain text, or copy the text or the image.
// Browsers cannot attach files to a mailto: link, so "Email with graphs" uses the device share sheet
// (Mail, Gmail, Outlook...) where it supports files, and otherwise saves the image to attach by hand.
import { $ } from '../lib/util.js';
import { toDayPieces } from '../lib/intervals.js';
import { daysBeforeReturn } from '../core/model.js';
import { fmtDate, fmtTime, fmtRange, fmtRanges, fmtHours } from './format.js';
import { openDialog, closeDialog } from './dialog.js';

const SITE = 'https://jetlag.alltripsconsidered.com';
const NOTE = 'General information only. Not medical or health advice.';

/** The plan as plain text, one block per day. */
export function planText(p, back) {
  const out = [`Jet Lag & Recovery plan: ${p.home.name} → ${p.dest.name}`, ''];
  if (p.strategy === 'home') out.push(`Stay on ${p.home.name} time for this short trip.`, '');
  else out.push(`Time difference: ${fmtHours(p.clockDiff)}. Body clock shift: ${fmtHours(p.absT)}. Days to adjust: ${p.daysToAdjust || '—'}.`, '');
  for (const d of p.pre) {
    out.push(`${fmtDate(d.date)} (before you fly, ${p.home.name} time)`,
      `  Sleep ${fmtRange(d.bed, d.wake)}`,
      ...(d.seek?.length ? [`  Bright light ${fmtRanges(d.seek)}`] : []),
      ...(d.avoid?.length ? [`  Dim light ${fmtRanges(d.avoid)}`] : []),
      `  Last caffeine ${fmtTime(d.caffCutoff)}`, '');
  }
  out.push(`Flight: arrive ${fmtDate(p.arrDate)} at ${fmtTime(p.arrHour)} ${p.dest.name} time.`, '');
  const days = (plan, label) => {
    for (const d of plan === p ? daysBeforeReturn(p, back) : plan.days) {
      out.push(`${fmtDate(d.date)} (${label}${plan.dest.name} time)`,
        `  Wake ${fmtTime(d.wake)}, bed ${fmtTime(d.bed)}`,
        ...(d.seek?.length ? [`  Bright light ${fmtRanges(d.seek)}`] : []),
        ...(d.avoid?.length ? [`  Dim light ${fmtRanges(d.avoid)}`] : []),
        `  ${d.caff.window ? 'Last caffeine ' + fmtTime(d.caff.cutoff) : 'Skip caffeine'}`, '');
    }
  };
  days(p, '');
  if (back && !back.error) { out.push('Return trip', ''); days(back, 'back home, '); }
  out.push(`Made with Jet Lag & Recovery: ${SITE}`, NOTE);
  return out.join('\n');
}

/** The daily graphs drawn on a canvas, one 24-hour row per day. */
export function planImage(p, back) {
  const css = getComputedStyle(document.documentElement);
  const c = (name, fb) => css.getPropertyValue(name).trim() || fb;
  const color = { sleep: c('--sleep', '#4b4fa8'), light: c('--light', '#f2b705'), dark: c('--dark', '#7b8494'), caff: c('--caff', '#8a5a36') };
  const rows = [
    ...p.pre.map((d) => ({ date: d.date, place: p.home.name, sleep: [[d.bed, d.bed + p.sleepLen]], seek: d.light ? [d.light.seek] : [], avoid: d.light ? [d.light.avoid] : [], caff: [[d.wake, d.caffCutoff]] })),
    ...[p, ...(back && !back.error ? [back] : [])].flatMap((plan) => (plan === p ? daysBeforeReturn(p, back) : plan.days).map((d) => ({
      date: d.date, place: plan.dest.name,
      sleep: [[d.bed, d.bed + d.night], ...(d.arrivalSleep ? [d.arrivalSleep] : [])],
      seek: d.light ? [d.light.seek] : [], avoid: d.light ? [d.light.avoid] : [],
      caff: d.caff.window ? [d.caff.window] : [] }))),
  ];
  const W = 1000, LEFT = 210, RIGHT = 24, TOP = 96, ROW = 62, S = 2;
  const H = TOP + rows.length * ROW + 70;
  const cv = document.createElement('canvas');
  cv.width = W * S; cv.height = H * S;
  const g = cv.getContext('2d'); g.scale(S, S);
  const font = (w, px) => `${w} ${px}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#18202c'; g.font = font(700, 24); g.fillText(`Jet Lag & Recovery: ${p.home.name} → ${p.dest.name}`, 24, 42);
  g.fillStyle = '#5d6878'; g.font = font(400, 14);
  g.fillText('Sleep, bright light, dim light and caffeine for each day, in local time.', 24, 66);
  const x = (h) => LEFT + (h / 24) * (W - LEFT - RIGHT);
  const lane = (y, list, fill, hatch) => list.forEach(([a, b]) => toDayPieces(a, b).forEach(([s, e]) => {
    g.fillStyle = fill; g.globalAlpha = hatch ? 0.45 : 1;
    g.fillRect(x(s), y, Math.max(2, x(e) - x(s)), 12); g.globalAlpha = 1;
  }));
  rows.forEach((r, i) => {
    const y = TOP + i * ROW;
    if (i % 2) { g.fillStyle = '#f5f7fa'; g.fillRect(0, y - 6, W, ROW); }
    g.fillStyle = '#18202c'; g.font = font(600, 15); g.fillText(fmtDate(r.date), 24, y + 18);
    g.fillStyle = '#5d6878'; g.font = font(400, 12); g.fillText(r.place + ' time', 24, y + 36);
    g.fillStyle = '#e7ebf1'; [0, 1, 2].forEach((k) => g.fillRect(x(0), y + k * 16, x(24) - x(0), 12));
    lane(y, r.sleep, color.sleep);
    lane(y + 16, r.seek, color.light); lane(y + 16, r.avoid, color.dark, true);
    lane(y + 32, r.caff, color.caff);
  });
  const ay = TOP + rows.length * ROW + 4;
  g.fillStyle = '#5d6878'; g.font = font(400, 12); g.textAlign = 'center';
  [0, 6, 12, 18, 24].forEach((t) => g.fillText(t === 24 ? fmtTime(0) : fmtTime(t), x(t), ay));
  g.textAlign = 'left';
  let lx = 24; const ly = ay + 30;
  for (const [label, fill] of [['Sleep', color.sleep], ['Seek bright light', color.light], ['Avoid bright light', color.dark], ['Caffeine OK', color.caff]]) {
    g.fillStyle = fill; g.fillRect(lx, ly - 10, 14, 10); g.fillStyle = '#18202c'; g.font = font(400, 13);
    g.fillText(label, lx + 20, ly); lx += g.measureText(label).width + 48;
  }
  g.fillStyle = '#5d6878'; g.textAlign = 'right'; g.fillText(SITE.replace('https://', ''), W - RIGHT, ly); g.textAlign = 'left';
  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}

const fileName = (p) => 'jet-lag-plan-' + p.dest.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

function saveFile(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const mailto = (subject, body) => 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

export function setupShare(getPlans) {
  const dlg = $('#share-dialog');
  const status = $('#share-status');
  const open = () => { if (!getPlans().plan) return; status.textContent = ''; openDialog(dlg); };

  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg) return closeDialog(dlg);
    const btn = e.target.closest('[data-share]');
    if (!btn) return;
    const { plan, back } = getPlans();
    const text = planText(plan, back);
    const subject = `Jet lag plan: ${plan.home.name} → ${plan.dest.name}`;
    const kind = btn.dataset.share;

    if (kind === 'text') { location.href = mailto(subject, text); return; }

    if (kind === 'copy-image') {
      // Safari needs the clipboard write to start inside the tap, so hand it the image as a promise.
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': planImage(plan, back) })]);
        status.textContent = 'Image copied. Paste it into an email, message or document.';
      } catch {
        status.textContent = 'Copying images is not available in this browser. Use Email with graphs instead.';
      }
      return;
    }

    if (kind === 'copy') {
      try { await navigator.clipboard.writeText(text); status.textContent = 'Copied. Paste it into any email or message.'; }
      catch { status.textContent = 'Copying is not available here. Use Email as plain text instead.'; }
      return;
    }

    // Email with graphs
    const blob = await planImage(plan, back);
    const file = new File([blob], fileName(plan) + '.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: subject, text }); closeDialog(dlg); }
      catch (err) { if (err?.name !== 'AbortError') status.textContent = 'Sharing did not work. Try Email as plain text.'; }
      return;
    }
    saveFile(blob, file.name);
    status.textContent = 'The graphs were saved as an image. Attach it to the email that opens next.';
    setTimeout(() => { location.href = mailto(subject, text + '\n\n(Graphs attached as an image.)'); }, 600);
  });
  $('#share-close').addEventListener('click', () => closeDialog(dlg));
  $('#share-btn').addEventListener('click', open);
  $('#ret-share-btn').addEventListener('click', open);
}
