// Service worker registration and the custom "Install app" button.
import { $ } from './lib/util.js';

export function setupPwa() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  const btn = $('#install-btn');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btn.hidden = true; });
}
