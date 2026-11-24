// Appearance: color mode, plus a fully automatic theme. The colors follow the season by default and
// switch to a holiday's colors while that holiday is on. Decorations follow the same theme: holidays
// get the full set (garland, falling decorations, corner accents) and seasons a lighter touch. The
// only theme setting is whether to show decorations at all.
import { $, $$ } from '../lib/util.js';
import { deviceTimeZone } from '../lib/time.js';
import { HOLIDAYS, SEASONS, themeLabel } from '../data/themes.js';
import { detectHoliday, detectSeason, hemisphereForTz } from '../core/calendar.js';
import { store, setAppearance } from '../state.js';
import { openDialog, closeDialog } from './dialog.js';

const DARK_BAR = '#101826';
const DECOR = {
  holiday: { garland: 26, particles: 18, corners: true },
  season:  { garland: 0,  particles: 10, corners: true },
};
const deviceTz = deviceTimeZone();
const hemisphere = hemisphereForTz(deviceTz);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function setData(el, key, value) {
  if (value) el.dataset[key] = value;
  else delete el.dataset[key];
}

/** The theme for a moment: the season always, and a holiday on top while one is on. */
export function currentTheme(now = Date.now()) {
  const season = detectSeason(now, hemisphere);
  const holiday = detectHoliday(now, deviceTz);
  return { season, holiday, emoji: (holiday ? HOLIDAYS[holiday] : SEASONS[season]).emoji, decor: holiday ? DECOR.holiday : DECOR.season };
}

const garlandHtml = (emoji, count) =>
  Array.from({ length: count }, (_, i) => `<span class="g">${emoji[i % emoji.length]}</span>`).join('');

// Deterministic pseudo-random layout so decorations do not jump around on every change.
function particlesHtml(emoji, count, animate) {
  return Array.from({ length: count }, (_, i) => {
    const style = [
      `left:${(i * 97.3) % 100}%`,
      animate ? '' : `top:${(i * 41) % 95}%`,
      `font-size:${14 + ((i * 37) % 16)}px`,
      `animation-duration:${11 + ((i * 53) % 13)}s`,
      `animation-delay:${-((i * 71) % 24)}s`,
      `--drift:${(i % 2 ? 1 : -1) * (20 + ((i * 13) % 60))}px`,
    ].filter(Boolean).join(';');
    return `<span style="${style}">${emoji[i % emoji.length]}</span>`;
  }).join('');
}

function updateThemeColor(mode) {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f5d8a';
  for (const m of $$('meta[name="theme-color"]')) {
    const dark = mode === 'dark' || (mode === 'system' && m.media.includes('dark'));
    m.setAttribute('content', dark ? DARK_BAR : accent);
  }
}

export function applyAppearance() {
  const a = store.appearance;
  const root = document.documentElement;
  const { season, holiday, emoji, decor } = currentTheme();
  const animate = !reducedMotion.matches;
  const show = a.decorations !== false;

  setData(root, 'theme', a.mode === 'light' || a.mode === 'dark' ? a.mode : null);
  setData(root, 'season', season);
  setData(root, 'holiday', holiday);

  const garland = $('#decor-garland');
  const showGarland = show && decor.garland > 0;
  garland.innerHTML = showGarland ? garlandHtml(emoji, decor.garland) : '';
  garland.classList.toggle('on', showGarland);
  garland.classList.toggle('swing', showGarland && animate);

  const particles = $('#decor-particles');
  particles.classList.toggle('static', !animate);
  particles.innerHTML = show ? particlesHtml(emoji, decor.particles, animate) : '';

  $('#decor-corners').innerHTML = show && decor.corners
    ? `<span class="tl">${emoji[0]}</span><span class="bl">${emoji[1 % emoji.length]}</span>` : '';

  $('#theme-now').textContent = holiday
    ? `${themeLabel(HOLIDAYS[holiday])}, during ${themeLabel(SEASONS[season]).toLowerCase()}`
    : themeLabel(SEASONS[season]);
  updateThemeColor(a.mode);
}

export function setupAppearance() {
  const form = $('#appearance-form');
  const dlg = $('#appearance-dialog');
  $('#theme-where').textContent = `${hemisphere === 'south' ? 'Southern' : 'Northern'} Hemisphere seasons, from your device time zone.`;

  const writeForm = () => {
    for (const r of $$('input[name="mode"]', form)) r.checked = r.value === store.appearance.mode;
    form.elements.decorations.checked = store.appearance.decorations !== false;
  };

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name === 'mode') setAppearance({ mode: t.value });
    else if (t.name === 'decorations') setAppearance({ decorations: t.checked });
    else return;
    applyAppearance();
  });
  $('#appearance-btn').addEventListener('click', () => { writeForm(); openDialog(dlg); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(dlg); }); // click on backdrop
  prefersDark.addEventListener?.('change', () => updateThemeColor(store.appearance.mode));
  reducedMotion.addEventListener?.('change', applyAppearance);

  writeForm();
  applyAppearance();
}
