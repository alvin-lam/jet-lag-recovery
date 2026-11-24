// Trip form: builds the location pickers, syncs inputs with the store and reports changes.
import { $, $$ } from '../lib/util.js';
import { CITY_GROUPS, CITIES_BY_TZ, locKey, parseLoc } from '../data/cities.js';
import { allTimeZones } from '../lib/time.js';
import { store, setTrip } from '../state.js';

const NUMERIC = new Set(['durH', 'durM', 'tripDays', 'cups', 'weight', 'alcohol', 'preDays', 'pace']);
const RADIOS = ['chrono', 'caffSens'];
const KG_PER_LB = 0.4536;

function buildLocationOptions(deviceTz) {
  const frag = document.createDocumentFragment();
  const group = (label, options) => {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const [text, value] of options) og.appendChild(new Option(text, value));
    frag.appendChild(og);
  };
  if (!CITIES_BY_TZ.has(deviceTz)) {
    group('Your device', [[`Your time zone (${deviceTz.replace(/_/g, ' ')})`, locKey('Your time zone', deviceTz)]]);
  }
  for (const [region, cities] of CITY_GROUPS) {
    group(region, [...cities].sort((a, b) => a[0].localeCompare(b[0])).map(([n, tz]) => [n, locKey(n, tz)]));
  }
  const zones = allTimeZones();
  if (zones.length) {
    group('All time zones', zones.map((tz) => [tz.replace(/_/g, ' '), locKey(tz.split('/').pop().replace(/_/g, ' '), tz)]));
  }
  return frag;
}

export function setupForm({ deviceTz, onChange }) {
  // Build the long option list once and clone it for the second picker.
  const options = buildLocationOptions(deviceTz);
  $('#dest').appendChild(options.cloneNode(true));
  $('#home').appendChild(options);

  const handle = (e) => {
    const t = e.target;
    if (!t.name || !(t.name in store.trip)) return;
    let v = t.value;
    if ((t.type === 'date' || t.type === 'time') && !v) return;
    if (NUMERIC.has(t.name)) {
      v = Number(v);
      if (!Number.isFinite(v)) return;
    }
    if (v === store.trip[t.name]) return; // input and change both fire; skip duplicates
    const patch = { [t.name]: v };
    if (t.name === 'weightUnit') {
      patch.weight = Math.round(v === 'lb' ? store.trip.weight / KG_PER_LB : store.trip.weight * KG_PER_LB);
      $('#weight').value = patch.weight;
    }
    setTrip(patch);
    updateOutputs();
    onChange();
  };
  const form = $('#trip-form');
  form.addEventListener('input', handle);
  form.addEventListener('change', handle);
  form.addEventListener('submit', (e) => e.preventDefault());
}

/** Copy store values into the form controls. */
export function writeForm() {
  const t = store.trip;
  for (const el of $$('#trip-form select, #trip-form input:not([type=radio])')) {
    if (!(el.name in t)) continue;
    const val = String(t[el.name]);
    // Keep a saved zone selectable even if it is not in the current list.
    if (el.tagName === 'SELECT' && !el.querySelector(`option[value="${CSS.escape(val)}"]`)) {
      el.appendChild(new Option(parseLoc(val).name, val));
    }
    el.value = val;
  }
  for (const name of RADIOS) for (const r of $$(`input[name="${name}"]`)) r.checked = r.value === t[name];
  updateOutputs();
}

function updateOutputs() {
  const t = store.trip;
  $('#cups-out').textContent = t.cups;
  $('#alcohol-out').textContent = t.alcohol;
  $('#pre-out').textContent = t.preDays;
  const pace = Number(t.pace);
  $('#pace-out').textContent = pace < 0.75 ? 'Gentle' : pace < 1 ? 'Easy' : pace === 1 ? 'Standard' : pace <= 1.25 ? 'Brisk' : 'Aggressive';
}
