// Search-as-you-type location picker (ARIA 1.2 combobox with a listbox popup).
// Accepts city names, airport names, IATA codes (LHR), metro codes (NYC) and countries.
import { esc } from '../lib/util.js';
import { tzOffset } from '../lib/time.js';
import { parseLoc, searchLocations } from '../data/locations.js';
import { fmtOffset } from './format.js';

const MAX_RESULTS = 8;

/**
 * @param {HTMLInputElement} input   the combobox input
 * @param {object} opts
 * @param {() => string} opts.getKey        current stored location key
 * @param {(key: string) => void} opts.onSelect  called when the user picks a location
 * @returns {{ sync(): void }}  call sync() to show the stored value
 */
export function createLocationPicker(input, { getKey, onSelect }) {
  const list = document.getElementById(input.getAttribute('aria-controls'));
  const status = document.getElementById(input.dataset.status);
  let results = [];
  let active = -1;

  const optionId = (i) => `${list.id}-opt-${i}`;

  function render() {
    const now = Date.now();
    // Airports show their code on the right. Places without one show their UTC offset there instead,
    // and name the time zone underneath.
    list.innerHTML = results.map((l, i) => {
      const offset = fmtOffset(tzOffset(l.tz, now));
      const badge = l.code
        ? `<span class="opt-code">${l.code}</span>`
        : `<span class="opt-code opt-tz">${offset}</span>`;
      const sub = l.code
        ? `${esc(l.airport)} · ${esc(l.country)} · ${offset}`
        : `${esc(l.airport)} · Time zone ${esc(l.zoneName)}`;
      return `
      <li id="${optionId(i)}" role="option" aria-selected="${i === active}" data-i="${i}">
        <span class="opt-main"><strong>${esc(l.city)}</strong>${badge}</span>
        <span class="opt-sub">${sub}</span>
      </li>`;
    }).join('') || '<li class="opt-empty" role="presentation">No matches. Try a city, airport, or 3-letter code.</li>';
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', optionId(active));
      document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function open() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function sync() {
    input.value = parseLoc(getKey()).label;
  }

  function choose(i) {
    const loc = results[i];
    if (!loc) return;
    close();
    input.value = loc.label;
    if (status) status.textContent = `${loc.label} selected.`;
    if (loc.key !== getKey()) onSelect(loc.key);
  }

  input.addEventListener('input', () => {
    results = searchLocations(input.value, MAX_RESULTS);
    active = results.length ? 0 : -1;
    if (!input.value.trim()) { close(); return; }
    render();
    open();
    if (status) status.textContent = results.length ? `${results.length} results. Use the arrow keys to choose.` : 'No matches.';
  });

  input.addEventListener('keydown', (e) => {
    const isOpen = !list.hidden;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!isOpen) {
          if (!results.length) return;
          open();
        }
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        active = (active + step + results.length) % results.length;
        render();
        break;
      }
      case 'Enter':
        if (isOpen && active >= 0) { e.preventDefault(); choose(active); }
        break;
      case 'Escape':
        if (isOpen) { e.preventDefault(); close(); sync(); }
        break;
      case 'Tab':
        if (isOpen && active >= 0) choose(active);
        break;
      default:
    }
  });

  // Select the whole value on focus so typing replaces it.
  input.addEventListener('focus', () => input.select());
  // Leaving without choosing restores the saved location.
  input.addEventListener('blur', () => { close(); sync(); });

  // mousedown keeps focus in the input; click makes the choice.
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) choose(Number(li.dataset.i));
  });

  return { sync };
}
