// Appearance menu: color mode plus seasonal and holiday themes. Decorations follow the theme automatically:
// holidays get the full set (garland, falling decorations, corner accents) and seasons get a lighter touch.
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

function resolveTheme(a, now) {
  const season = a.season === 'auto' ? detectSeason(now, hemisphere) : a.season === 'none' ? null : a.season;
  const holiday = a.holiday === 'auto' ? detectHoliday(now, deviceTz) : a.holiday === 'none' ? null : a.holiday;
  const theme = holiday ? HOLIDAYS[holiday] : season ? SEASONS[season] : null;
  return { season, holiday, emoji: theme ? theme.emoji : [], decor: holiday ? DECOR.holiday : season ? DECOR.season : null };
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
  const now = Date.now();
  const { season, holiday, emoji, decor } = resolveTheme(a, now);
  const animate = !reducedMotion.matches;

  setData(root, 'theme', a.mode === 'light' || a.mode === 'dark' ? a.mode : null);
  setData(root, 'season', season);
  setData(root, 'holiday', holiday);

  const garland = $('#decor-garland');
  const showGarland = !!decor && decor.garland > 0;
  garland.innerHTML = showGarland ? garlandHtml(emoji, decor.garland) : '';
  garland.classList.toggle('on', showGarland);
  garland.classList.toggle('swing', showGarland && animate);

  const particles = $('#decor-particles');
  particles.classList.toggle('static', !animate);
  particles.innerHTML = decor ? particlesHtml(emoji, decor.particles, animate) : '';

  $('#decor-corners').innerHTML = decor && decor.corners
    ? `<span class="tl">${emoji[0]}</span><span class="bl">${emoji[1 % emoji.length]}</span>` : '';

  const autoHoliday = detectHoliday(now, deviceTz);
  $('#holiday-hint').textContent = 'Automatic right now: '
    + (autoHoliday ? themeLabel(HOLIDAYS[autoHoliday]) : 'no holiday') + ', '
    + themeLabel(SEASONS[detectSeason(now, hemisphere)])
    + ` (${hemisphere === 'south' ? 'Southern' : 'Northern'} Hemisphere). Based on your device time zone.`;
  updateThemeColor(a.mode);
}

export function setupAppearance() {
  const form = $('#appearance-form');
  const dlg = $('#appearance-dialog');
  // Menu labels carry an emoji after each name, for example "Winter ❄️" and "Pride Month 🏳️‍🌈".
  const fill = (select, themes) => select.append(new Option('Automatic', 'auto'), new Option('None', 'none'),
    ...Object.entries(themes).map(([k, v]) => new Option(themeLabel(v), k)));
  fill($('#season-select'), SEASONS);
  fill($('#holiday-select'), HOLIDAYS);

  const writeForm = () => {
    const a = store.appearance;
    for (const r of $$('input[name="mode"]', form)) r.checked = r.value === a.mode;
    form.elements.season.value = a.season;
    form.elements.holiday.value = a.holiday;
  };

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.name || !(t.name in store.appearance)) return;
    setAppearance({ [t.name]: t.value });
    applyAppearance();
  });
  $('#appearance-btn').addEventListener('click', () => { writeForm(); openDialog(dlg); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(dlg); }); // click on backdrop
  prefersDark.addEventListener?.('change', () => updateThemeColor(store.appearance.mode));
  reducedMotion.addEventListener?.('change', applyAppearance);

  writeForm();
  applyAppearance();
}
