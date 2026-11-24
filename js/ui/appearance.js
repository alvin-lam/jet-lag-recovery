// Appearance menu: color mode, seasonal and holiday themes, and decorations.
import { $, $$ } from '../lib/util.js';
import { HOLIDAYS, SEASONS } from '../data/themes.js';
import { detectHoliday, detectSeason } from '../core/calendar.js';
import { store, setAppearance } from '../state.js';
import { openDialog, closeDialog } from './dialog.js';

const DARK_BAR = '#101826';
const LEVEL_NAMES = ['', 'Light', 'Medium', 'Festive'];
const PARTICLES_PER_LEVEL = [0, 10, 18, 30];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function setData(el, key, value) {
  if (value) el.dataset[key] = value;
  else delete el.dataset[key];
}

function resolveTheme(a, now) {
  const season = a.season === 'auto' ? detectSeason(now, a.hemisphere) : a.season === 'none' ? null : a.season;
  const holiday = a.holiday === 'auto' ? detectHoliday(now) : a.holiday === 'none' ? null : a.holiday;
  return { season, holiday, emoji: (holiday ? HOLIDAYS[holiday] : season ? SEASONS[season] : null)?.emoji || [] };
}

function garlandHtml(emoji, level) {
  const count = 14 + level * 6;
  return Array.from({ length: count }, (_, i) => `<span class="g">${emoji[i % emoji.length]}</span>`).join('');
}

// Deterministic pseudo-random layout so decorations do not jump around on every change.
function particlesHtml(emoji, level, animate) {
  return Array.from({ length: PARTICLES_PER_LEVEL[level] }, (_, i) => {
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
  const { season, holiday, emoji } = resolveTheme(a, now);
  const level = Number(a.intensity) || 2;
  const animate = a.motion && !reducedMotion.matches;
  const has = emoji.length > 0;

  setData(root, 'theme', a.mode === 'light' || a.mode === 'dark' ? a.mode : null);
  setData(root, 'season', season);
  setData(root, 'holiday', holiday);

  const garland = $('#decor-garland');
  garland.innerHTML = a.garland && has ? garlandHtml(emoji, level) : '';
  garland.classList.toggle('on', a.garland && has);
  garland.classList.toggle('swing', a.garland && has && animate);

  const particles = $('#decor-particles');
  particles.classList.toggle('static', !animate);
  particles.innerHTML = a.particles && has ? particlesHtml(emoji, level, animate) : '';

  $('#decor-corners').innerHTML = a.corners && has
    ? `<span class="tl">${emoji[0]}</span><span class="br">${emoji[1 % emoji.length]}</span>` : '';

  const autoHoliday = detectHoliday(now);
  $('#holiday-hint').textContent = 'Automatic right now: '
    + (autoHoliday ? HOLIDAYS[autoHoliday].name : 'no holiday') + ', '
    + SEASONS[detectSeason(now, a.hemisphere)].name.toLowerCase() + '.';
  $('#intensity-out').textContent = LEVEL_NAMES[level];
  updateThemeColor(a.mode);
}

export function setupAppearance() {
  const form = $('#appearance-form');
  const dlg = $('#appearance-dialog');
  const select = $('#holiday-select');
  select.append(new Option('Automatic', 'auto'), new Option('None', 'none'),
    ...Object.entries(HOLIDAYS).map(([k, v]) => new Option(v.name, k)));

  const writeForm = () => {
    const a = store.appearance;
    for (const r of $$('input[name="mode"]', form)) r.checked = r.value === a.mode;
    for (const k of ['season', 'hemisphere', 'holiday', 'intensity']) form.elements[k].value = a[k];
    for (const k of ['garland', 'particles', 'corners', 'motion']) form.elements[k].checked = !!a[k];
  };

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.name || !(t.name in store.appearance)) return;
    setAppearance({ [t.name]: t.type === 'checkbox' ? t.checked : t.name === 'intensity' ? Number(t.value) : t.value });
    applyAppearance();
  });
  $('#appearance-btn').addEventListener('click', () => { writeForm(); openDialog(dlg); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(dlg); }); // click on backdrop
  prefersDark.addEventListener?.('change', () => updateThemeColor(store.appearance.mode));
  reducedMotion.addEventListener?.('change', applyAppearance);

  writeForm();
  applyAppearance();
}
