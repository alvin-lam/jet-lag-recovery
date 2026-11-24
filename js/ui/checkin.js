// "How did you sleep?" dialog. Logs are saved per trip leg (outbound or return) and fed back into the model.
import { $, toHM, quarter } from '../lib/util.js';
import { store, setCheckin } from '../state.js';
import { tripSignature, returnSignature } from '../core/model.js';
import { fmtDate, fmtRange } from './format.js';
import { openDialog, closeDialog } from './dialog.js';

const signature = (leg) => (leg === 'return' ? returnSignature(store.trip) : tripSignature(store.trip));

/**
 * @param {object} o
 * @param {(leg: 'out'|'return') => object} o.getPlan  the plan for a leg
 * @param {() => void} o.onChange                      re-render after a log changes
 */
export function setupCheckin({ getPlan, onChange }) {
  const dlg = $('#checkin-dialog');
  let day = null;
  let leg = 'out';

  // One delegated listener per list, so buttons keep working after every re-render.
  const open = (e) => {
    const btn = e.target.closest('[data-checkin]');
    if (!btn) return;
    day = Number(btn.dataset.checkin);
    leg = btn.dataset.leg === 'return' ? 'return' : 'out';
    const d = getPlan(leg).days[day - 1];
    $('#checkin-sub').textContent = `${leg === 'return' ? 'Back home: night' : 'Night'} of ${fmtDate(d.date)} (planned ${fmtRange(d.bed, d.wake)}). Enter what really happened and the rest of the plan will adapt.`;
    $('#ci-bed').value = d.log ? d.log.bed : toHM(quarter(d.bed));
    $('#ci-wake').value = d.log ? d.log.wake : toHM(quarter(d.wake));
    $('#ci-clear').hidden = !d.log;
    openDialog(dlg);
  };
  $('#days').addEventListener('click', open);
  $('#ret-days').addEventListener('click', open);

  $('#checkin-form').addEventListener('submit', (e) => {
    const bed = $('#ci-bed').value;
    const wake = $('#ci-wake').value;
    if (!bed || !wake) { e.preventDefault(); return; }
    setCheckin(signature(leg), day, { bed, wake }, leg);
    onChange();
  });
  $('#ci-cancel').addEventListener('click', () => closeDialog(dlg));
  $('#ci-clear').addEventListener('click', () => {
    setCheckin(signature(leg), day, null, leg);
    closeDialog(dlg);
    onChange();
  });
}
