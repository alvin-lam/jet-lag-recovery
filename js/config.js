// App-wide settings, defaults and model constants in one place.

export const STORAGE_KEYS = {
  trip: 'atc-state',
  checkins: 'atc-checkins',
  appearance: 'atc-appearance',
  disclaimer: 'atc-disclaimer',
  installNag: 'atc-install-dismissed', // when the Add to Home Screen reminder was last dismissed
};

// Bump this when the disclaimer text changes so returning users acknowledge the new version.
export const DISCLAIMER_VERSION = 1;

export const TRIP_DEFAULTS = Object.freeze({
  home: null, dest: null,
  depDate: null, depTime: '18:30', durH: 7, durM: 0, tripDays: 7,
  bed: '23:00', wake: '07:00', chrono: 'neutral',
  caffSens: 'normal', cups: 2, weight: 70, weightUnit: 'kg',
  activity: 'moderate', climate: 'temperate', alcohol: 0,
  strategy: 'auto', preDays: 0, pace: 1, clock: '24', volUnit: 'metric',
  v: 2, // settings version, used for one-time upgrades of saved settings (see state.js)
});

// Decorations follow the active season or holiday automatically, so only these choices are stored.
export const APPEARANCE_DEFAULTS = Object.freeze({ mode: 'system', season: 'auto', holiday: 'auto' });

// Circadian and wellness constants used by the plan model.
export const MODEL = Object.freeze({
  advanceRate: 1.0,        // hours per day the body clock can move earlier
  delayRate: 1.5,          // hours per day the body clock can move later
  chrono: {
    lark:    { advance: 1.15, delay: 0.85 },
    neutral: { advance: 1,    delay: 1 },
    owl:     { advance: 0.85, delay: 1.15 },
  },
  tminBeforeWake: 3,       // core body temperature minimum, hours before natural wake
  lightWindow: 4,          // hours of light to seek or avoid around Tmin
  gradualMaxOffset: 2,     // max hours the sleep schedule may differ from local time
  maxPlanDays: 14,
  shortTripDays: 2,        // trips this short default to staying on home time
  caffeineCutoff: { low: 6, normal: 8, high: 10 },   // hours before bed
  caffeineMgPerKg: 5.7,    // about 400 mg for a 70 kg adult
  caffeineMaxMg: 400,
  caffeineMaxMgSensitive: 200,
  mgPerCup: 95,
  waterMlPerKg: 33,
  waterActivityMl: { low: 0, moderate: 350, high: 700 },
  waterClimateMl: { cool: -150, temperate: 0, hot: 600 },
  waterPerAlcoholMl: 250,
  glassMl: 250,
  flightAwakeMlPerHour: 250, flightAwakeMaxMl: 2500,
  cabinLossMlPerHour: 75, cabinLossMaxMl: 1000,
});
