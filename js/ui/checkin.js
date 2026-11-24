// "How did you sleep?" dialog. Logs are saved per trip and fed back into the model.
import { $, toHM, quarter } from '../lib/util.js';
import { store, setCheckin } from '../state.js';
import { tripSignature } from '../core/model.js';
import { fmtDate, fmtRange } from './format.js';
import { openDialog, closeDialog } from './dialog.js';

export function setupCheckin({ getPlan, onChange }) {
  const dlg = $('#checkin-dialog');
  let day = null;

  // One delegated listener instead of one per button, so it survives every re-render.
  $('#days').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-checkin]');
    if (!btn) return;
    day = Number(btn.dataset.checkin);
    const d = getPlan().days[day - 1];
    $('#checkin-sub').textContent = `Night of ${fmtDate(d.date)} (planned ${fmtRange(d.bed, d.wake)}). Enter what really happened and the rest of the plan will adapt.`;
    $('#ci-bed').value = d.log ? d.log.bed : toHM(quarter(d.bed));
    $('#ci-wake').value = d.log ? d.log.wake : toHM(quarter(d.wake));
    $('#ci-clear').hidden = !d.log;
    openDialog(dlg);
  });

  $('#checkin-form').addEventListener('submit', (e) => {
    const bed = $('#ci-bed').value;
    const wake = $('#ci-wake').value;
    if (!bed || !wake) { e.preventDefault(); return; }
    setCheckin(tripSignature(store.trip), day, { bed, wake });
    onChange();
  });
  $('#ci-cancel').addEventListener('click', () => closeDialog(dlg));
  $('#ci-clear').addEventListener('click', () => {
    setCheckin(tripSignature(store.trip), day, null);
    closeDialog(dlg);
    onChange();
  });
}
