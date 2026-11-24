// Thin wrapper over <dialog> with a fallback for older browsers.
export function openDialog(dlg) {
  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute('open', '');
  }
}

export function closeDialog(dlg) {
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
}
