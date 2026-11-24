/* The jet lag plan model. Pure functions only: no DOM access and no storage, so it is easy to test.
 *
 * The body clock is tracked as P, the hours it has already shifted toward destination time. It starts
 * at 0 (fully on home time) and moves toward T, the signed shift being adopted. Positive T means the clock
 * must advance (sleep earlier, usually eastward). Negative T means it must delay (sleep later, usually
 * westward). In destination clock time, the body "wants" to sleep at homeBed + (T − P).
 *
 * Core body temperature minimum (Tmin) sits about 3 hours before the body's natural wake time. Light after
 * Tmin advances the clock and light before Tmin delays it.
 */
import { MODEL } from '../config.js';
import { parseLoc } from '../data/locations.js';
import { hm, mod24, clamp, nearest } from '../lib/util.js';
import { zonedToUtc, tzOffset, localDateStr, localHours, addDays } from '../lib/time.js';
import { subtractDaily } from '../lib/intervals.js';

const HOUR_MS = 3600000;

/** Identifies a trip. Sleep logs only apply to the trip they were recorded for. */
export function tripSignature(t) {
  return [t.home, t.dest, t.depDate, t.depTime, t.durH, t.durM].join('~');
}

/** Normalize a signed hour difference into (−12, 12]. */
function wrapShift(h) {
  let v = h;
  while (v > 12) v -= 24;
  while (v <= -12) v += 24;
  return v;
}

/** Choose the direction to shift. Very large gaps can be faster to absorb the other way around the clock. */
function chooseTarget(shift, rateA, rateD) {
  if (shift >= 8 && (24 - shift) / rateD < shift / rateA) return shift - 24;
  if (shift <= -10 && (24 + shift) / rateA < -shift / rateD) return shift + 24;
  return shift;
}

function resolveStrategy(requested, absT, tripDays) {
  if (absT < 1 && requested !== 'home') return 'none';
  if (requested !== 'auto') return requested;
  return tripDays <= MODEL.shortTripDays && absT >= 3 ? 'home' : 'gradual';
}

/** Light to seek and avoid, anchored on the body's current Tmin. */
function lightWindows(bodyWake, sign) {
  const tmin = bodyWake - MODEL.tminBeforeWake;
  const w = MODEL.lightWindow;
  return sign > 0
    ? { seek: [tmin, tmin + w], avoid: [tmin - w, tmin] }
    : { seek: [tmin - w, tmin], avoid: [tmin, tmin + w] };
}

/** Parts of a light window that fall while awake (and, on arrival day, after landing). */
function awakeLight(win, bed, sleepLen, afterHour) {
  let parts = subtractDaily(win, bed, sleepLen);
  if (afterHour != null) {
    parts = parts.map(([a, b]) => {
      const a2 = mod24(a);
      const b2 = a2 + (b - a);
      return b2 <= afterHour + 0.25 ? null : [Math.max(a2, afterHour), b2];
    }).filter(Boolean);
  }
  return parts;
}

function severityOf(absT, sign) {
  const score = absT * (sign > 0 ? 1.25 : 1); // eastward travel is harder
  if (score < 1) return { key: 'mild', label: 'Minimal' };
  if (score < 4) return { key: 'mild', label: 'Mild' };
  if (score < 7.5) return { key: 'moderate', label: 'Moderate' };
  if (score < 11) return { key: 'significant', label: 'Significant' };
  return { key: 'severe', label: 'Severe' };
}

/** Caffeine cutoff in the same day frame as `start` (bedtime may fall after midnight). */
export function cutoffAfter(start, bed, hoursBefore) {
  let cut = bed - hoursBefore;
  while (cut < start) cut += 24;
  if (cut - start > 16) cut -= 24;
  return cut;
}

function flightPlan({ arrHour, depHourDest, durH, nightStart, sleepLen, caffCut }) {
  // Flight window in destination clock hours (may run below 0).
  const end = arrHour;
  const start = end - durH;
  let best = 0, bestStart = 0;
  for (const dayShift of [-48, -24, 0, 24]) {
    const ns = nightStart + dayShift;
    const overlap = Math.min(end, ns + sleepLen) - Math.max(start, ns);
    if (overlap > best) { best = overlap; bestStart = Math.max(start, ns); }
  }
  const sleep = best >= 1 ? { start: bestStart, end: bestStart + best, len: best } : null;
  const awakeH = Math.max(0, durH - (sleep ? sleep.len : 0));
  return {
    start, end, durH, sleep, depHourDest, arrHour,
    waterMl: Math.max(MODEL.glassMl, round50(Math.min(MODEL.flightAwakeMaxMl, awakeH * MODEL.flightAwakeMlPerHour))),
    caffCutoff: sleep ? sleep.start - caffCut : null,
  };
}

function caffeinePlan({ start, bed, caffCut, cups, maxMg, active }) {
  const cutoff = cutoffAfter(start, bed, caffCut);
  const len = cutoff - start;
  const doses = [];
  if (active && len > 0.5) {
    const first = start + 0.5;
    if (cups >= 1 && first < cutoff) doses.push(first);
    const second = Math.min(start + 5, cutoff - 0.25);
    if (cups >= 2 && second > first + 1.5) doses.push(second);
  }
  return { cutoff, window: len > 0 ? [start, cutoff] : null, doses, maxMg };
}

const round50 = (ml) => Math.round(ml / 50) * 50;

function hydration({ dailyMl, dayFrac, flightH, wake, bed }) {
  const base = round50(dailyMl * dayFrac);
  const flight = round50(Math.min(MODEL.cabinLossMaxMl, flightH * MODEL.cabinLossMlPerHour));
  let wakeEnd = bed;
  while (wakeEnd <= wake) wakeEnd += 24;
  const span = Math.max(2, wakeEnd - wake - 1.5); // taper off 90 minutes before bed
  const glasses = Math.max(dayFrac < 1 ? 2 : 4, Math.round(base / MODEL.glassMl));
  const gap = span / Math.max(1, glasses - 1);
  const times = Array.from({ length: glasses }, (_, i) => wake + gap * i);
  return { base, flight, glasses, times, every: Math.max(1, Math.round(gap * 2) / 2) };
}

/**
 * Build the full plan.
 * @param {object} trip   trip inputs (see TRIP_DEFAULTS)
 * @param {object} nights sleep logs for this trip, keyed by day number: { [k]: { bed, wake } }
 * @param {object} [opts]
 * @param {number} [opts.bodyShift] hours the body clock must shift, when it differs from the clock change
 *   (used by the return leg, where the body may only be partly adjusted to the destination)
 */
export function buildPlan(trip, nights = {}, opts = {}) {
  const home = parseLoc(trip.home);
  const dest = parseLoc(trip.dest);
  const homeBed = hm(trip.bed);
  const homeWake = hm(trip.wake);
  const sleepLen = mod24(homeWake - homeBed) || 8;
  const durH = Math.max(0, (Number(trip.durH) || 0) + (Number(trip.durM) || 0) / 60);
  const tripDays = Number(trip.tripDays) || 7;

  // Instants and offsets (DST-aware, evaluated on the travel dates).
  const depUtc = zonedToUtc(trip.depDate, hm(trip.depTime), home.tz);
  const arrUtc = depUtc + durH * HOUR_MS;
  const offHome = tzOffset(home.tz, depUtc);
  const offDest = tzOffset(dest.tz, arrUtc);
  const clockDiff = (offDest - offHome) / 60;
  const shift = wrapShift(opts.bodyShift ?? clockDiff);

  // Shift rates, adjusted for chronotype and the user's chosen pace.
  const chrono = MODEL.chrono[trip.chrono] || MODEL.chrono.neutral;
  const pace = Number(trip.pace) || 1;
  const rateA = MODEL.advanceRate * chrono.advance * pace;
  const rateD = MODEL.delayRate * chrono.delay * pace;

  const target = chooseTarget(shift, rateA, rateD);
  const sign = target >= 0 ? 1 : -1;
  const absT = Math.abs(target);
  const rate = sign > 0 ? rateA : rateD;
  const strategy = resolveStrategy(trip.strategy, absT, tripDays);
  const shifting = strategy === 'gradual' || strategy === 'immediate';

  // Per-person constants, computed once for every day.
  const caffCut = MODEL.caffeineCutoff[trip.caffSens] || MODEL.caffeineCutoff.normal;
  const weightKg = trip.weightUnit === 'lb' ? Number(trip.weight) * 0.4536 : Number(trip.weight);
  const maxMg = trip.caffSens === 'high'
    ? MODEL.caffeineMaxMgSensitive
    : Math.min(MODEL.caffeineMaxMg, Math.round((weightKg * MODEL.caffeineMgPerKg) / 10) * 10);
  const cups = Math.min(Number(trip.cups) || 0, Math.floor(maxMg / MODEL.mgPerCup));
  const dailyMl = weightKg * MODEL.waterMlPerKg
    + (MODEL.waterActivityMl[trip.activity] || 0)
    + (MODEL.waterClimateMl[trip.climate] || 0)
    + (Number(trip.alcohol) || 0) * MODEL.waterPerAlcoholMl;

  // ---------- Before departure (home time) ----------
  const pre = [];
  let P = 0;
  const preDays = shifting ? clamp(Number(trip.preDays) || 0, 0, 3) : 0;
  for (let j = 1; j <= preDays; j++) {
    const step = Math.min(1, absT - Math.abs(P));
    if (step <= 0) break;
    P += sign * step;
    const bed = homeBed - P;
    const wake = homeWake - P;
    const light = lightWindows(wake, sign);
    pre.push({
      date: addDays(trip.depDate, j - preDays - 1), bed, wake, light,
      seek: awakeLight(light.seek, bed, sleepLen),
      avoid: awakeLight(light.avoid, bed, sleepLen),
      caffCutoff: cutoffAfter(wake, bed, caffCut),
    });
  }
  const P0 = P;

  // ---------- Flight ----------
  const arrDate = localDateStr(dest.tz, arrUtc);
  const arrHour = localHours(dest.tz, arrUtc);
  const flight = flightPlan({
    arrHour, durH, sleepLen, caffCut,
    depHourDest: localHours(dest.tz, depUtc),
    nightStart: strategy === 'home' ? homeBed + target : homeBed,
  });

  // ---------- After arrival (destination time) ----------
  const days = [];
  const minDays = strategy === 'none' ? 1
    : strategy === 'home' ? Math.min(tripDays, 4)
    : Math.max(2, Math.ceil((absT - Math.abs(P0)) / rate) + 1);
  let p = P0;
  let adjustedDay = null;

  for (let k = 1; k <= MODEL.maxPlanDays; k++) {
    if (k > minDays && !(shifting && adjustedDay === null)) break;
    const arrivalDay = k === 1;
    const behind = target - p; // hours the body is still off local time at the start of the day
    const bodyWake = homeWake + behind;

    // Schedule for tonight.
    let bed, wake, pNext;
    if (strategy === 'home') {
      bed = homeBed + target; wake = homeWake + target; pNext = 0;
    } else if (strategy === 'none') {
      bed = homeBed; wake = homeWake; pNext = target;
    } else {
      pNext = p + sign * Math.min(rate, Math.abs(target - p));
      const maxOff = strategy === 'immediate' ? 0 : MODEL.gradualMaxOffset;
      const off = clamp(target - pNext, -maxOff, maxOff);
      bed = homeBed + off; wake = homeWake + off;
    }

    // Landing from an hour before bedtime through the planned night, with at least 3 hours of it left:
    // sleep soon after reaching the hotel. Landing nearer the end of the night (for example 6:30 am with
    // a 9 am wake) starts a new day instead, so tonight's bedtime stands.
    const sinceEvening = mod24(arrHour - (bed - 1));
    const landsAtNight = arrivalDay
      && sinceEvening < mod24(wake - (bed - 1)) // lands between an hour before bed and wake time
      && mod24(wake - arrHour) >= 3;            // with at least 3 hours of the night left
    // Evening landing: tonight's bedtime moves to soon after landing.
    // After-midnight landing: sleep from soon after landing until wake time, then the day runs as usual.
    let arrivalSleep = null;
    if (landsAtNight && arrHour + 1 < wake) arrivalSleep = [arrHour + 1, wake];
    const lateArrival = landsAtNight && !arrivalSleep;
    if (lateArrival) bed = arrHour + 1;

    // A logged night nudges the body clock estimate by half the deviation from plan.
    const log = nights[k] || null;
    let logged = null;
    if (log && strategy !== 'none') {
      const aBed = hm(log.bed);
      const aLen = mod24(hm(log.wake) - aBed) || 0.01;
      const plannedMid = bed + mod24(wake - bed) / 2;
      const dev = nearest(aBed + aLen / 2, plannedMid) - plannedMid;
      if (shifting) pNext = clamp(pNext - 0.5 * dev, Math.min(0, target), Math.max(0, target));
      logged = { bed: aBed, wake: hm(log.wake), len: aLen, debt: sleepLen - aLen };
    }

    const dayStart = arrivalDay ? Math.max(arrHour, wake) : wake;
    const night = mod24(wake - bed);
    const light = strategy === 'none' ? null : lightWindows(bodyWake, sign);
    let bedFrame = bed;
    while (bedFrame <= dayStart) bedFrame += 24;
    const dayFrac = arrivalDay ? clamp((bedFrame - dayStart) / Math.max(1, 24 - sleepLen), 0.15, 1) : 1;

    const remainingAfter = Math.abs(target - pNext);
    const isAdjusted = strategy !== 'home' && adjustedDay === null && remainingAfter < 0.5;
    if (isAdjusted) adjustedDay = k;

    days.push({
      k, date: addDays(arrDate, k - 1), bed, wake, night, behind,
      arrivalDay, lateArrival, arrivalSleep, isAdjusted, log, logged,
      light,
      seek: light ? awakeLight(light.seek, bed, night, arrivalDay ? arrHour : null) : [],
      avoid: light ? awakeLight(light.avoid, bed, night, arrivalDay ? arrHour : null) : [],
      melatonin: sign > 0 && shifting && Math.abs(behind) >= 1 ? bed - 0.5 : null,
      caff: caffeinePlan({ start: dayStart, bed, caffCut, cups, maxMg, active: strategy !== 'none' }),
      water: hydration({ dailyMl, dayFrac, flightH: arrivalDay ? durH : 0, wake: dayStart, bed }),
      nap: logged && logged.debt >= 1.5 ? { kind: 'debt', len: logged.len }
        : arrivalDay && arrHour < 13 && !(flight.sleep && flight.sleep.len >= 4) ? { kind: 'arrival' }
        : null,
    });
    p = pNext;
  }

  return {
    home, dest, clockDiff, shift, target, sign, absT, rate, strategy, tripDays,
    offHome, offDest, arrDate, arrHour, durH, homeBed, homeWake, sleepLen, caffCut, weightKg, cups, P0,
    pre, flight, days,
    daysToAdjust: shifting ? (adjustedDay || Math.max(1, Math.ceil((absT - Math.abs(P0)) / rate))) : 0,
    adjustedDay,
    severity: severityOf(absT, sign),
  };
}

const dayNumber = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

/**
 * Plan the flight home (Preview). The traveler starts the return leg with the body clock wherever the
 * outbound plan left it on the departure day: fully adjusted, partly adjusted, or still on home time.
 * Only that amount has to be undone, so a short trip spent on home time needs little or no recovery.
 * Returns null when no return is planned, or { error } when the return date does not work.
 */
export function buildReturnPlan(trip, outbound) {
  if (!trip.ret) return null;
  if (!trip.retDate) return { error: 'Choose a return date.' };
  const dayIndex = dayNumber(trip.retDate) - dayNumber(outbound.arrDate); // 0 = arrival day
  if (dayIndex < 0) return { error: 'The return date is before you arrive. Choose a later date.' };

  // How far the body clock has moved toward destination time by the return day.
  let moved;
  if (outbound.strategy === 'home') moved = 0;
  else if (outbound.strategy === 'none') moved = outbound.target;
  else {
    const day = outbound.days[dayIndex];
    moved = day ? outbound.target - day.behind : outbound.target; // past the plan: fully adjusted
  }

  const back = {
    ...trip,
    home: trip.dest, dest: trip.home,
    depDate: trip.retDate, depTime: trip.retTime,
    durH: trip.retDurH ?? trip.durH, durM: trip.retDurM ?? trip.durM,
    tripDays: 30,                       // home again: no "stay on home time" shortcut
    strategy: trip.strategy === 'home' ? 'auto' : trip.strategy,
    preDays: 0,
  };
  const plan = buildPlan(back, {}, { bodyShift: -moved });
  plan.isReturn = true;
  plan.adjustedBeforeReturn = Math.abs(moved);
  plan.outboundShift = Math.abs(outbound.target);
  return plan;
}
