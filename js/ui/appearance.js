// Appearance panel (matches atc-pwa-template): Mode, Color and Decorations. The Color list has Automatic (the season, switching to a holiday's
// colors while one is on) plus two groups to pick from: Seasons and Holidays. Decorations follow the
// theme: holidays get the full set (garland, falling decorations, corner accents) and seasons a lighter
// touch, and one switch turns them off.
import { $, $$ } from '../lib/util.js';
import { deviceTimeZone } from '../lib/time.js';
import { HOLIDAYS, SEASONS } from '../data/themes.js';
import { detectHoliday, detectSeason, hemisphereForTz } from '../core/calendar.js';
import { store, setAppearance } from '../state.js';

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

/**
 * The theme to show for a choice:
 *   'auto'              the current season, switching to a holiday while one is on
 *   'season'            the current season only
 *   'season:<key>'      one season, all year
 *   'holiday:<key>'     one holiday, all year
 */
export function currentTheme(choice = 'auto', now = Date.now()) {
  const [kind, key] = String(choice).split(':');
  let season = detectSeason(now, hemisphere);
  let holiday = null;
  if (kind === 'auto') holiday = detectHoliday(now, deviceTz);
  else if (kind === 'season' && SEASONS[key]) season = key;
  else if (kind === 'holiday' && HOLIDAYS[key]) holiday = key;
  return { season, holiday, emoji: (holiday ? HOLIDAYS[holiday] : SEASONS[season]).emoji, decor: holiday ? DECOR.holiday : DECOR.season };
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Color list (as in atc-pwa-template): one row per theme with icon, name, color swatch and check mark. */
function renderSchemeList(list) {
  const now = currentTheme('auto');
  const nowTheme = now.holiday ? HOLIDAYS[now.holiday] : SEASONS[now.season];
  const rows = [
    ['auto', '✨', 'Automatic', nowTheme.stripe, 'Now: ' + nowTheme.name],
    ['season', '🗓️', 'Current season', SEASONS[now.season].stripe, 'Now: ' + SEASONS[now.season].name],
    'Seasons', ...Object.entries(SEASONS).map(([k, t]) => ['season:' + k, t.icon, t.name, t.stripe]),
    'Holidays', ...Object.entries(HOLIDAYS).map(([k, t]) => ['holiday:' + k, t.icon, t.name, t.stripe]),
  ];
  list.textContent = '';
  for (const r of rows) {
    if (typeof r === 'string') { list.appendChild(el('p', 'scheme-subhead', r)); continue; }
    const [value, icon, name, stripe, sub] = r;
    const row = el('label', 'scheme-option');
    const input = el('input');
    input.type = 'radio'; input.name = 'theme'; input.value = value;
    const flag = el('span', 'scheme-flag', icon); flag.setAttribute('aria-hidden', 'true');
    const label = el('span', 'scheme-name', name);
    if (sub) label.appendChild(el('small', 'scheme-now', sub));
    const swatch = el('span', 'scheme-swatch'); swatch.setAttribute('aria-hidden', 'true');
    for (const c of stripe) { const i = el('i'); i.style.background = c; swatch.appendChild(i); }
    const check = el('span', 'scheme-check', '✓'); check.setAttribute('aria-hidden', 'true');
    row.append(input, flag, label, swatch, check);
    list.appendChild(row);
  }
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
    return `<span data-style="${style}">${emoji[i % emoji.length]}</span>`;
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
  const { season, holiday, emoji, decor } = currentTheme(a.theme);
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

  updateThemeColor(a.mode);
}

const MODE_HINT = {
  light: 'Always light.',
  dark: 'Always dark.',
};

export function setupAppearance() {
  const button = $('#appearance-btn');
  const panel = $('#appearance-panel');
  const list = $('#scheme-list');
  const where = `Seasons follow the ${hemisphere === 'south' ? 'Southern' : 'Northern'} Hemisphere, from your device time zone.`;

  const sync = () => {
    const a = store.appearance;
    for (const r of $$('input[name="mode"]', panel)) r.checked = r.value === a.mode;
    for (const r of $$('input[name="theme"]', panel)) r.checked = r.value === a.theme;
    panel.querySelector('input[name="decorations"]').checked = a.decorations !== false;
    $('#mode-hint').textContent = MODE_HINT[a.mode]
      || `Follows your device, which is set to ${prefersDark.matches ? 'dark' : 'light'} right now.`;
    list.title = where;
  };

  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'mode') setAppearance({ mode: t.value });
    else if (t.name === 'decorations') setAppearance({ decorations: t.checked });
    else if (t.name === 'theme') setAppearance({ theme: t.value });
    else return;
    applyAppearance();
    sync();
  });

  const open = () => {
    renderSchemeList(list); // refresh "Now:" in case the season or holiday changed
    sync();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.querySelector('input[name="mode"]:checked')?.focus();
  };
  const close = (returnFocus) => {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  };
  button.addEventListener('click', () => (panel.hidden ? open() : close(true)));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.parentNode.contains(e.target)) close(false); });
  panel.addEventListener('focusout', (e) => { if (e.relatedTarget && !panel.parentNode.contains(e.relatedTarget)) close(false); });

  prefersDark.addEventListener?.('change', () => { updateThemeColor(store.appearance.mode); sync(); });
  reducedMotion.addEventListener?.('change', applyAppearance);

  renderSchemeList(list);
  sync();
  applyAppearance();
}
