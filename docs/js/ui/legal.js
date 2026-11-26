// Health and liability disclaimer. Shown on first visit (and again when its version changes)
// and available any time from the footer.
import { $ } from '../lib/util.js';
import { STORAGE_KEYS, DISCLAIMER_VERSION } from '../config.js';
import { load, save } from '../lib/storage.js';
import { openDialog, closeDialog } from './dialog.js';

export function setupLegal() {
  const dlg = $('#legal-dialog');
  const accept = $('#legal-accept');
  const close = $('#legal-close');
  const accepted = () => load(STORAGE_KEYS.disclaimer, 0) >= DISCLAIMER_VERSION;

  const show = (firstVisit) => {
    accept.hidden = !firstVisit;
    close.hidden = firstVisit;
    dlg.dataset.required = firstVisit ? 'true' : '';
    openDialog(dlg);
  };

  // While acknowledgment is required, Escape must not dismiss the notice.
  dlg.addEventListener('cancel', (e) => { if (dlg.dataset.required) e.preventDefault(); });
  accept.addEventListener('click', () => {
    save(STORAGE_KEYS.disclaimer, DISCLAIMER_VERSION);
    dlg.dataset.required = '';
    closeDialog(dlg);
  });
  close.addEventListener('click', () => closeDialog(dlg));
  for (const btn of document.querySelectorAll('[data-open-legal]')) btn.addEventListener('click', () => show(false));

  if (!accepted()) show(true);
}
