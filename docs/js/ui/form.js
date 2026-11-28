// Trip form: location search boxes plus the other inputs, synced with the store.
import { $, $$ } from '../lib/util.js';
import { createLocationPicker } from './location-picker.js';
import { store, setTrip } from '../state.js';
import { devicePrefs } from '../lib/locale.js';
import { addDays } from '../lib/time.js';

const NUMERIC = new Set(['durH', 'durM', 'tripDays', 'cups', 'weight', 'alcohol', 'preDays', 'pace', 'retDurH', 'retDurM']);
const RADIOS = ['chrono', 'caffSens'];
const PERSONAL = new Set(['weight', 'weightUnit', 'activity', 'climate']); // the optional water details
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
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if ((t.type === 'date' || t.type === 'time') && !v) return;
    if (NUMERIC.has(t.name)) {
      v = Number(v);
      if (!Number.isFinite(v)) return;
      // The form has novalidate, so keep numbers inside the field's own range. While typing, the plan
      // uses the nearest allowed value; on leaving the field, the field shows it too.
      const lo = t.min === '' ? -Infinity : Number(t.min);
      const hi = t.max === '' ? Infinity : Number(t.max);
      if (v < lo || v > hi) {
        v = Math.min(hi, Math.max(lo, v));
        if (e.type === 'change') t.value = v;
      }
    }
    if (v === store.trip[t.name]) return; // input and change both fire; skip duplicates
    const patch = { [t.name]: v };
    // Touching any water detail turns on the personalized water target.
    if (PERSONAL.has(t.name)) patch.personalWater = true;
    if (t.name === 'weightUnit') {
      patch.weight = Math.round(v === 'lb' ? store.trip.weight / KG_PER_LB : store.trip.weight * KG_PER_LB);
      $('#weight').value = patch.weight;
    }
    setTrip(patch);
    updateOutputs();
    onChange();
  };

  // The return flight section is collapsible: opening it plans the return, closing it turns it off.
  const retSection = $('#ret-section');
  retSection.addEventListener('toggle', () => {
    const on = retSection.open;
    if (on === !!store.trip.ret) return; // writeForm sets open; ignore that echo
    const patch = { ret: on };
    // First time: suggest the day after the trip ends and the outbound flight length.
    if (on) {
      const s = store.trip;
      if (!s.retDate) patch.retDate = addDays(s.depDate, (Number(s.tripDays) || 7) + 1);
      if (s.retDurH == null) { patch.retDurH = s.durH; patch.retDurM = s.durM; }
    }
    setTrip(patch);
    writeForm();
    onChange();
  });
  $('#water-standard').addEventListener('click', () => {
    setTrip({ personalWater: false });
    $('#water-personal').open = false;
    updateOutputs();
    onChange();
  });

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
    if (el.type === 'checkbox') el.checked = !!t[el.name];
    else el.value = t[el.name] == null ? '' : String(t[el.name]);
  }
  for (const name of RADIOS) for (const r of $$(`input[name="${name}"]`)) r.checked = r.value === t[name];
  for (const p of pickers) p.sync();
  $('#water-personal').open = !!t.personalWater; // start expanded only when already personalized
  updateOutputs();
}

function updateOutputs() {
  const t = store.trip;
  $('#cups-out').textContent = t.cups;
  $('#alcohol-out').textContent = t.alcohol;
  $('#pre-out').textContent = t.preDays;
  const pace = Number(t.pace);
  $('#pace-out').textContent = pace < 0.75 ? 'Gentle' : pace < 1 ? 'Easy' : pace === 1 ? 'Standard' : pace <= 1.25 ? 'Brisk' : 'Aggressive';
  $('#ret-section').open = !!t.ret;
  $('#water-personal-hint').textContent = t.personalWater
    ? 'Your water target uses these details.'
    : 'Using standard advice for adults. Change any field below to personalize your water target.';
  $('#water-standard').hidden = !t.personalWater;
}
