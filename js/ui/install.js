// Install support. Browsers differ:
//   - Chrome, Edge, Samsung Internet and others fire `beforeinstallprompt`, so one tap installs.
//   - Safari on iPhone and iPad (and every iOS browser) has no install prompt. People must use
//     Share, then Add to Home Screen, so we remind them how.
//   - Android browsers without the prompt (such as Firefox) install from their menu.
//   - Safari on a Mac installs with File, then Add to Dock.
// The reminder banner appears once, and again only after NAG_DAYS if dismissed. The header
// download icon stays available whenever installing is possible.
import { $ } from '../lib/util.js';
import { load, save } from '../lib/storage.js';
import { STORAGE_KEYS } from '../config.js';
import { openDialog, closeDialog } from './dialog.js';

const NAG_DAYS = 14;
const PROMPT_WAIT_MS = 4000; // give Chromium time to fire beforeinstallprompt before falling back

const SHARE_ICON = '<svg class="inline-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const MENU_ICON = '<svg class="inline-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>';

// Per-platform reminder text (banner) and steps (dialog).
const MANUAL = {
  ios: {
    title: 'Add to Home Screen',
    banner: `Tap Share ${SHARE_ICON}, then <strong>Add to Home Screen</strong>.`,
    steps: [
      `Tap the <strong>Share</strong> button ${SHARE_ICON}. In Safari it is in the toolbar; in other browsers it may be in the address bar or menu.`,
      'Scroll down and tap <strong>Add to Home Screen</strong>.',
      'Tap <strong>Add</strong>. Jet Lag &amp; Recovery appears on your Home Screen as <strong>Jet Lag</strong> and works offline.',
    ],
  },
  android: {
    title: 'Add to Home screen',
    banner: `Open the menu ${MENU_ICON}, then tap <strong>Add to Home screen</strong>.`,
    steps: [
      `Open your browser menu ${MENU_ICON}.`,
      'Tap <strong>Add to Home screen</strong> or <strong>Install</strong>.',
      'Confirm. Jet Lag &amp; Recovery appears on your Home screen as <strong>Jet Lag</strong> and works offline.',
    ],
  },
  mac: {
    title: 'Add to Dock',
    banner: 'In the menu bar, choose <strong>File</strong>, then <strong>Add to Dock</strong>.',
    steps: [
      'In the Safari menu bar, choose <strong>File</strong>.',
      'Choose <strong>Add to Dock</strong>, then <strong>Add</strong>.',
      'Jet Lag &amp; Recovery opens from your Dock like any other app and works offline.',
    ],
  },
};

function detectPlatform() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so check for touch support too.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Version\/\d+.*Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(ua)) return 'mac';
  return 'other';
}

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: window-controls-overlay)').matches
  || navigator.standalone === true;

export function setupInstall() {
  const btn = $('#install-btn');
  const banner = $('#install-banner');
  const dlg = $('#install-dialog');
  const platform = detectPlatform();
  let deferred = null; // the browser's install prompt, when it offers one
  let mode = null;     // 'prompt' or a key of MANUAL

  const dismissedRecently = () => Date.now() - load(STORAGE_KEYS.installNag, 0) < NAG_DAYS * 86400000;

  function hideAll() {
    btn.hidden = true;
    banner.hidden = true;
    document.body.classList.remove('has-install-banner');
  }

  function showBanner() {
    if (dismissedRecently() || isInstalled()) return;
    const legal = $('#legal-dialog');
    // Never stack the reminder on top of the first-visit disclaimer.
    if (legal.open) { legal.addEventListener('close', showBanner, { once: true }); return; }
    if (mode === 'prompt') {
      $('#install-banner-msg').innerHTML = 'Install it for one-tap access that works offline.';
      $('#install-banner-action').textContent = 'Install';
    } else {
      $('#install-banner-msg').innerHTML = MANUAL[mode].banner;
      $('#install-banner-action').textContent = 'Show me how';
    }
    banner.hidden = false;
    document.body.classList.add('has-install-banner');
  }

  function offer(newMode) {
    if (isInstalled()) return;
    mode = newMode;
    btn.hidden = false;
    showBanner();
  }

  function openSteps() {
    const m = MANUAL[mode] || MANUAL.android;
    $('#install-h').textContent = m.title;
    $('#install-steps').innerHTML = m.steps.map((s) => `<li>${s}</li>`).join('');
    openDialog(dlg);
  }

  async function install() {
    if (mode === 'prompt' && deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* ignore */ }
      deferred = null;
      return;
    }
    openSteps();
  }

  // Chromium browsers: keep the prompt so our own button and banner can trigger it.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    offer('prompt');
  });
  window.addEventListener('appinstalled', hideAll);

  btn.addEventListener('click', install);
  $('#install-banner-action').addEventListener('click', install);
  $('#install-banner-close').addEventListener('click', () => {
    save(STORAGE_KEYS.installNag, Date.now());
    banner.hidden = true;
    document.body.classList.remove('has-install-banner');
  });
  $('#install-done').addEventListener('click', () => closeDialog(dlg));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(dlg); });

  if (isInstalled()) return hideAll();
  // Browsers with no install prompt get the manual reminder. On Android, wait briefly in case the
  // browser does support the prompt; iPhone, iPad and Mac Safari never fire it.
  if (platform === 'ios' || platform === 'mac') offer(platform);
  else if (platform === 'android') setTimeout(() => { if (!deferred) offer('android'); }, PROMPT_WAIT_MS);
}
