// "Add to Calendar": choose Apple Calendar, Google Calendar or a plain .ics file.
// Apple Calendar and Other both use the .ics file (which carries a 15-minute alert per night).
// Google Calendar cannot import many events from a link, so it gets one link per night.
import { $ } from '../lib/util.js';
import { openDialog, closeDialog } from './dialog.js';
import { sleepEvents, downloadIcs, googleUrl } from './ics.js';

export function setupCalendarMenu(getPlans) {
  const dlg = $('#cal-dialog');
  const choose = $('#cal-choose');
  const google = $('#cal-google');
  const list = $('#cal-google-list');

  const show = (googleView) => { choose.hidden = googleView; google.hidden = !googleView; };
  const open = () => { if (!getPlans().plan) return; show(false); openDialog(dlg); };

  function renderGoogle(events) {
    list.textContent = '';
    for (const e of events) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = googleUrl(e); a.target = '_blank'; a.rel = 'noopener'; a.className = 'cal-google-link';
      const when = new Date(e.start);
      const label = document.createElement('span');
      label.textContent = e.title;
      const time = document.createElement('small');
      // Show the bedtime in the place where the traveler will be sleeping.
      time.textContent = when.toLocaleString(undefined, { timeZone: e.tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        + ' ' + e.place + ' time';
      const add = document.createElement('b');
      add.textContent = 'Add';
      a.append(label, time, add);
      a.addEventListener('click', () => a.classList.add('added'));
      li.appendChild(a);
      list.appendChild(li);
    }
  }

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) return closeDialog(dlg); // backdrop
    const btn = e.target.closest('[data-cal]');
    if (!btn) return;
    const { plan, back } = getPlans();
    const events = sleepEvents(plan, back);
    if (btn.dataset.cal === 'google') { renderGoogle(events); show(true); return; }
    downloadIcs(events, plan.dest.name);
    closeDialog(dlg);
  });
  $('#cal-close').addEventListener('click', () => closeDialog(dlg));
  $('#cal-back').addEventListener('click', () => show(false));
  $('#ics-btn').addEventListener('click', open);
  $('#ret-ics-btn').addEventListener('click', open);
}
