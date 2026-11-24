// Trip form: location search boxes plus the other inputs, synced with the store.
import { $, $$ } from '../lib/util.js';
import { createLocationPicker } from './location-picker.js';
import { store, setTrip } from '../state.js';
import { devicePrefs } from '../lib/locale.js';

const NUMERIC = new Set(['durH', 'durM', 'tripDays', 'cups', 'weight', 'alcohol', 'preDays', 'pace']);
const RADIOS = ['chrono', 'caffSens'];
const KG_PER_LB = 0.4536;

let pickers = [];

export function setupForm({ onChange }) {
  // The location fields are search boxes. They have no name attribute, so the generic
  // handler below ignores them and each picker reports its own selection.
  pickers = ['home', 'dest'].map((field) => createLocationPicker($('#' + field), {
    getKey: () => store.trip[field],
    onSelect: (key) => { setTrip({ [field]: key }); onChange(); },
  }));

  // Name what "Device setting" resolves to, for example "Device setting (24-hour)".
  const device = devicePrefs();
  $('#clock option[data-device]').textContent = `Device setting (${device.hour12 ? '12-hour' : '24-hour'})`;
  $('#volUnit option[data-device]').textContent = `Device setting (${device.imperial ? 'ounces' : 'liters'})`;

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
    if (el.name in t) el.value = String(t[el.name]);
  }
  for (const name of RADIOS) for (const r of $$(`input[name="${name}"]`)) r.checked = r.value === t[name];
  for (const p of pickers) p.sync();
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
