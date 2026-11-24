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

export const store = {
  trip: pick(TRIP_DEFAULTS, load(STORAGE_KEYS.trip, null)),
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
