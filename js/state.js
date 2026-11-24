// Single source of truth for user data. Everything persisted lives here, and only here.
import { STORAGE_KEYS, TRIP_DEFAULTS, APPEARANCE_DEFAULTS } from './config.js';
import { load, save } from './lib/storage.js';
import { debounce } from './lib/util.js';

// Keep only known keys so stale or tampered storage cannot inject unexpected fields.
function pick(defaults, saved) {
  const out = { ...defaults };
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(defaults)) if (k in saved) out[k] = saved[k];
  }
  return out;
}

// One-time upgrades for settings saved by earlier versions.
function upgradeTrip(saved) {
  if (!saved || typeof saved !== 'object') return saved;
  if (!(saved.v >= 3)) {
    // v3: time and units follow the device. Settings that still hold an earlier default switch to
    // the device; a choice the user changed away from the default is kept.
    if (saved.clock !== '12') saved.clock = 'auto';
    if (saved.volUnit !== 'imperial') saved.volUnit = 'auto';
    if (saved.weightUnit !== 'lb' && (saved.weight === undefined || saved.weight === 70)) {
      saved.weight = null; // untouched default weight: refill in the device's unit
      saved.weightUnit = null;
    }
    saved.v = 3;
  }
  return saved;
}

export const store = {
  trip: pick(TRIP_DEFAULTS, upgradeTrip(load(STORAGE_KEYS.trip, null))),
  // Sleep logs: { sig: trip signature, nights: { [dayNumber]: { bed: 'HH:MM', wake: 'HH:MM' } } }
  checkins: load(STORAGE_KEYS.checkins, { sig: '', nights: {} }),
  appearance: pick(APPEARANCE_DEFAULTS, load(STORAGE_KEYS.appearance, null)),
};

// Writes are batched so dragging a slider does not hit storage on every tick.
const saveTripSoon = debounce(() => save(STORAGE_KEYS.trip, store.trip), 250);

export function setTrip(patch) {
  Object.assign(store.trip, patch);
  saveTripSoon();
}

export function resetTrip() {
  store.trip = { ...TRIP_DEFAULTS };
  store.checkins = { sig: '', nights: {} };
  save(STORAGE_KEYS.checkins, store.checkins);
}

export function saveTripNow() { save(STORAGE_KEYS.trip, store.trip); }

export function setCheckin(sig, day, entry) {
  if (store.checkins.sig !== sig) store.checkins = { sig, nights: {} };
  if (entry) store.checkins.nights[day] = entry;
  else delete store.checkins.nights[day];
  save(STORAGE_KEYS.checkins, store.checkins);
}

/** Logs for the given trip, or none if they belong to a different trip. */
export function nightsFor(sig) {
  return store.checkins.sig === sig ? store.checkins.nights : {};
}

export function setAppearance(patch) {
  Object.assign(store.appearance, patch);
  save(STORAGE_KEYS.appearance, store.appearance);
}
