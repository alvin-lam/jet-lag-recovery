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
  if (!(saved.v >= 4)) {
    // v4: body weight, activity and climate became optional. Travelers who had changed them from the
    // defaults keep their personalized water target; everyone else gets the standard advice.
    const w = Number(saved.weight);
    saved.personalWater = (w > 0 && w !== 70 && w !== 154)
      || (saved.activity && saved.activity !== 'moderate')
      || (saved.climate && saved.climate !== 'temperate');
    saved.v = 4;
  }
  return saved;
}

// The theme used to have season and holiday pickers. Choosing None for both turned decorations off,
// so keep them off for those people; every other old choice now follows the automatic theme.
function upgradeAppearance(saved) {
  if (saved && typeof saved === 'object' && !('decorations' in saved) && saved.season === 'none' && saved.holiday === 'none') {
    saved.decorations = false;
  }
  return saved;
}

export const store = {
  trip: pick(TRIP_DEFAULTS, upgradeTrip(load(STORAGE_KEYS.trip, null))),
  // Sleep logs: { sig: trip signature, nights: { [dayNumber]: { bed: 'HH:MM', wake: 'HH:MM' } } }
  checkins: load(STORAGE_KEYS.checkins, { sig: '', nights: {} }),
  // Same shape, for the return leg. Kept separate so the two legs' day numbers never collide.
  retCheckins: load(STORAGE_KEYS.retCheckins, { sig: '', nights: {} }),
  appearance: pick(APPEARANCE_DEFAULTS, upgradeAppearance(load(STORAGE_KEYS.appearance, null))),
};

// Writes are batched so dragging a slider does not hit storage on every tick.
const saveTripSoon = debounce(() => save(STORAGE_KEYS.trip, store.trip), 250);
// Save right away when the page is hidden, closed or reloaded, so a batched change is never lost.
addEventListener('pagehide', () => save(STORAGE_KEYS.trip, store.trip));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save(STORAGE_KEYS.trip, store.trip);
});

export function setTrip(patch) {
  Object.assign(store.trip, patch);
  saveTripSoon();
}

export function resetTrip() {
  store.trip = { ...TRIP_DEFAULTS };
  store.checkins = { sig: '', nights: {} };
  store.retCheckins = { sig: '', nights: {} };
  save(STORAGE_KEYS.checkins, store.checkins);
  save(STORAGE_KEYS.retCheckins, store.retCheckins);
}

export function saveTripNow() { save(STORAGE_KEYS.trip, store.trip); }

// leg is 'out' (outbound trip) or 'return'.
const LOGS = { out: ['checkins', STORAGE_KEYS.checkins], return: ['retCheckins', STORAGE_KEYS.retCheckins] };

export function setCheckin(sig, day, entry, leg = 'out') {
  const [prop, key] = LOGS[leg];
  if (store[prop].sig !== sig) store[prop] = { sig, nights: {} };
  if (entry) store[prop].nights[day] = entry;
  else delete store[prop].nights[day];
  save(key, store[prop]);
}

/** Logs for the given trip leg, or none if they belong to a different trip. */
export function nightsFor(sig, leg = 'out') {
  const logs = store[LOGS[leg][0]];
  return logs.sig === sig ? logs.nights : {};
}

export function setAppearance(patch) {
  Object.assign(store.appearance, patch);
  save(STORAGE_KEYS.appearance, store.appearance);
}
