// Service worker registration (offline support). Installing the app is handled in ui/install.js.
// When a new version is released, the service worker downloads it in the background and takes over.
// The page on screen is still the old one, so a banner offers a Refresh instead of reloading by surprise.
export function setupPwa() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // Installed apps can sit in the background for days; check again whenever the app comes back.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => { /* offline support is optional */ });

  // A first install also takes control, but that is not an update.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBanner(); });
}

export function showUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  document.getElementById('install-banner')?.setAttribute('hidden', '');
  banner.hidden = false;
  document.getElementById('update-refresh').onclick = () => location.reload();
  document.getElementById('update-later').onclick = () => { banner.hidden = true; };
}
