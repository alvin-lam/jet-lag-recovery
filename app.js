/* All Trip Considered: jet lag recovery planner.
 * Plain JavaScript, no dependencies. All calculations run on the device. */
(function () {
  'use strict';

  /* ================================================================
   * Reference data
   * ================================================================ */
  const CITIES = [
    ['North America', [
      ['Honolulu', 'Pacific/Honolulu'], ['Anchorage', 'America/Anchorage'],
      ['Los Angeles', 'America/Los_Angeles'], ['San Francisco', 'America/Los_Angeles'],
      ['Seattle', 'America/Los_Angeles'], ['Vancouver', 'America/Vancouver'],
      ['Las Vegas', 'America/Los_Angeles'], ['Phoenix', 'America/Phoenix'],
      ['Denver', 'America/Denver'], ['Dallas', 'America/Chicago'], ['Houston', 'America/Chicago'],
      ['Chicago', 'America/Chicago'], ['Mexico City', 'America/Mexico_City'],
      ['Atlanta', 'America/New_York'], ['Miami', 'America/New_York'], ['Washington, D.C.', 'America/New_York'],
      ['New York', 'America/New_York'], ['Boston', 'America/New_York'], ['Toronto', 'America/Toronto'],
      ['Montreal', 'America/Toronto'], ['Halifax', 'America/Halifax'],
    ]],
    ['Central and South America', [
      ['Panama City', 'America/Panama'], ['Bogotá', 'America/Bogota'], ['Lima', 'America/Lima'],
      ['Santiago', 'America/Santiago'], ['Buenos Aires', 'America/Argentina/Buenos_Aires'],
      ['São Paulo', 'America/Sao_Paulo'], ['Rio de Janeiro', 'America/Sao_Paulo'],
    ]],
    ['Europe', [
      ['Reykjavík', 'Atlantic/Reykjavik'], ['Dublin', 'Europe/Dublin'], ['Lisbon', 'Europe/Lisbon'],
      ['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['Madrid', 'Europe/Madrid'],
      ['Amsterdam', 'Europe/Amsterdam'], ['Brussels', 'Europe/Brussels'], ['Frankfurt', 'Europe/Berlin'],
      ['Berlin', 'Europe/Berlin'], ['Zurich', 'Europe/Zurich'], ['Rome', 'Europe/Rome'],
      ['Vienna', 'Europe/Vienna'], ['Copenhagen', 'Europe/Copenhagen'], ['Stockholm', 'Europe/Stockholm'],
      ['Oslo', 'Europe/Oslo'], ['Warsaw', 'Europe/Warsaw'], ['Prague', 'Europe/Prague'],
      ['Athens', 'Europe/Athens'], ['Helsinki', 'Europe/Helsinki'], ['Istanbul', 'Europe/Istanbul'],
      ['Moscow', 'Europe/Moscow'],
    ]],
    ['Africa and Middle East', [
      ['Casablanca', 'Africa/Casablanca'], ['Lagos', 'Africa/Lagos'], ['Cairo', 'Africa/Cairo'],
      ['Johannesburg', 'Africa/Johannesburg'], ['Nairobi', 'Africa/Nairobi'],
      ['Tel Aviv', 'Asia/Jerusalem'], ['Riyadh', 'Asia/Riyadh'], ['Doha', 'Asia/Qatar'],
      ['Dubai', 'Asia/Dubai'], ['Abu Dhabi', 'Asia/Dubai'],
    ]],
    ['Asia', [
      ['Karachi', 'Asia/Karachi'], ['Delhi', 'Asia/Kolkata'], ['Mumbai', 'Asia/Kolkata'],
      ['Bengaluru', 'Asia/Kolkata'], ['Kathmandu', 'Asia/Kathmandu'], ['Dhaka', 'Asia/Dhaka'],
      ['Bangkok', 'Asia/Bangkok'], ['Ho Chi Minh City', 'Asia/Ho_Chi_Minh'], ['Jakarta', 'Asia/Jakarta'],
      ['Singapore', 'Asia/Singapore'], ['Kuala Lumpur', 'Asia/Kuala_Lumpur'], ['Manila', 'Asia/Manila'],
      ['Hong Kong', 'Asia/Hong_Kong'], ['Taipei', 'Asia/Taipei'], ['Shanghai', 'Asia/Shanghai'],
      ['Beijing', 'Asia/Shanghai'], ['Seoul', 'Asia/Seoul'], ['Tokyo', 'Asia/Tokyo'], ['Osaka', 'Asia/Tokyo'],
    ]],
    ['Oceania', [
      ['Perth', 'Australia/Perth'], ['Brisbane', 'Australia/Brisbane'], ['Sydney', 'Australia/Sydney'],
      ['Melbourne', 'Australia/Melbourne'], ['Auckland', 'Pacific/Auckland'], ['Fiji', 'Pacific/Fiji'],
    ]],
  ];
  const CITY_BY_KEY = {};
  CITIES.forEach(([, list]) => list.forEach(([name, tz]) => { CITY_BY_KEY[name + '|' + tz] = { name, tz }; }));

  const DEFAULTS = {
    home: null, dest: null,
    depDate: null, depTime: '18:30', durH: 7, durM: 0, tripDays: 7,
    bed: '23:00', wake: '07:00', chrono: 'neutral',
    caffSens: 'normal', cups: 2, weight: 70, weightUnit: 'kg',
    activity: 'moderate', climate: 'temperate', alcohol: 0,
    strategy: 'auto', preDays: 0, pace: 1, clock: '12', volUnit: 'metric',
  };
  const APPEARANCE_DEFAULTS = {
    mode: 'system', season: 'auto', hemisphere: 'north', holiday: 'auto',
    garland: true, particles: true, corners: true, motion: true, intensity: 2,
  };

  const HOLIDAYS = {
    newyear:      { name: "New Year's", emoji: ['🎆', '🎉', '🥂', '✨', '🎊'] },
    lunar:        { name: 'Lunar New Year', emoji: ['🧧', '🏮', '🐉', '🎊', '🍊'] },
    valentine:    { name: "Valentine's Day", emoji: ['❤️', '💕', '🌹', '💌', '💖'] },
    stpatrick:    { name: "St. Patrick's Day", emoji: ['☘️', '🍀', '🌈', '💚'] },
    easter:       { name: 'Easter', emoji: ['🐣', '🥚', '🌷', '🐰', '🌼'] },
    independence: { name: 'Independence Day (US)', emoji: ['🎆', '🇺🇸', '✨', '🎇', '⭐'] },
    halloween:    { name: 'Halloween', emoji: ['🎃', '👻', '🦇', '🕸️', '🍬'] },
    diwali:       { name: 'Diwali', emoji: ['🪔', '✨', '🎇', '🌺', '🪷'] },
    thanksgiving: { name: 'Thanksgiving (US)', emoji: ['🦃', '🍂', '🥧', '🌽', '🍁'] },
    hanukkah:     { name: 'Hanukkah', emoji: ['🕎', '✨', '🔵', '⭐', '🍩'] },
    christmas:    { name: 'Christmas', emoji: ['🎄', '🎁', '❄️', '⭐', '🔔'] },
  };
  const SEASONS = {
    spring: { name: 'Spring', emoji: ['🌸', '🌷', '🦋', '🌱', '🌼'] },
    summer: { name: 'Summer', emoji: ['☀️', '🌴', '🌊', '🍉', '🕶️'] },
    autumn: { name: 'Autumn', emoji: ['🍁', '🍂', '🍃', '🌰', '🍄'] },
    winter: { name: 'Winter', emoji: ['❄️', '⛄', '🌨️', '🧣', '❄️'] },
  };
  // Lunisolar holidays that cannot be computed simply. Dates are the first day.
  const LUNAR_NEW_YEAR = { 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11' };
  const DIWALI = { 2025: '10-20', 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26', 2031: '11-14', 2032: '11-02' };
  const HANUKKAH = { 2025: '12-14', 2026: '12-04', 2027: '12-24', 2028: '12-12', 2029: '12-01', 2030: '12-20', 2031: '12-09', 2032: '11-27' };

  /* ================================================================
   * Small helpers
   * ================================================================ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const mod24 = (h) => ((h % 24) + 24) % 24;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad = (n) => String(n).padStart(2, '0');
  const DAY_MS = 86400000;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function hm(str) {
    const [h, m] = String(str || '0:0').split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  function toHM(h) {
    const t = Math.round(mod24(h) * 60) % 1440;
    return pad(Math.floor(t / 60)) + ':' + pad(t % 60);
  }
  // Round to the nearest quarter hour so advice reads naturally.
  const q = (h) => Math.round(h * 4) / 4;

  function storageGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage may be blocked */ }
  }

  /* ================================================================
   * Time zone math (uses the browser's built-in time zone database)
   * ================================================================ */
  const dtfCache = {};
  function dtf(tz) {
    if (!dtfCache[tz]) {
      dtfCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
    return dtfCache[tz];
  }
  function partsIn(tz, ms) {
    const o = {};
    dtf(tz).formatToParts(new Date(ms)).forEach((p) => { if (p.type !== 'literal') o[p.type] = Number(p.value); });
    if (o.hour === 24) o.hour = 0;
    return o;
  }
  // Offset of tz from UTC in minutes at the given instant.
  function tzOffset(tz, ms) {
    const p = partsIn(tz, ms);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
  }
  // Convert a wall-clock date and hour in tz to a UTC timestamp.
  function zonedToUtc(dateStr, hours, tz) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const naive = Date.UTC(y, mo - 1, d) + Math.round(hours * 60) * 60000;
    let guess = naive - tzOffset(tz, naive) * 60000;
    guess = naive - tzOffset(tz, guess) * 60000;
    return guess;
  }
  function localDateStr(tz, ms) {
    const p = partsIn(tz, ms);
    return p.year + '-' + pad(p.month) + '-' + pad(p.day);
  }
  function localHours(tz, ms) {
    const p = partsIn(tz, ms);
    return p.hour + p.minute / 60;
  }
  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  function fmtDate(dateStr, opts) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(undefined,
      Object.assign({ weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }, opts || {}));
  }
  function tzLabel(tz) {
    const c = Object.values(CITY_BY_KEY).find((x) => x.tz === tz);
    return c ? c.name : tz.split('/').pop().replace(/_/g, ' ');
  }
  function fmtOffset(mins) {
    const s = mins < 0 ? '−' : '+';
    const a = Math.abs(mins);
    return 'UTC' + s + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '');
  }

  /* ================================================================
   * State
   * ================================================================ */
  let state = Object.assign({}, DEFAULTS, storageGet('atc-state', {}));
  let checkins = storageGet('atc-checkins', { sig: '', nights: {} });
  let appearance = Object.assign({}, APPEARANCE_DEFAULTS, storageGet('atc-appearance', {}));

  const deviceTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();

  function fillDefaults() {
    if (!state.home) {
      const cities = Object.values(CITY_BY_KEY).filter((c) => c.tz === deviceTz);
      const tzCity = deviceTz.split('/').pop().replace(/_/g, ' ');
      const match = cities.find((c) => c.name === tzCity) || cities[0];
      state.home = match ? match.name + '|' + match.tz : 'Your time zone|' + deviceTz;
    }
    if (!state.dest) {
      const homeTz = state.home.split('|')[1];
      state.dest = /^America\//.test(homeTz) ? 'London|Europe/London' : 'New York|America/New_York';
      if (state.home === state.dest) state.dest = 'Tokyo|Asia/Tokyo';
    }
    if (!state.depDate) {
      const now = new Date();
      state.depDate = localDateStr(deviceTz, now.getTime() + 7 * DAY_MS);
    }
  }

  /* ================================================================
   * The plan model
   *
   * The body clock is tracked as P, the number of hours it has already
   * shifted toward destination time. It starts at 0 (fully on home time)
   * and moves toward T, the signed shift being adopted. Positive T means
   * the clock must advance (sleep earlier, usually eastward). Negative T
   * means it must delay (sleep later, usually westward).
   *
   * In destination clock time, the body "wants" to sleep at
   *   homeBed + (T − P).
   * Core body temperature minimum (Tmin) sits about 3 hours before the
   * body's natural wake time. Light after Tmin advances the clock; light
   * before Tmin delays it. Typical shift rates are roughly 1 h/day when
   * advancing and 1.5 h/day when delaying.
   * ================================================================ */
  function buildPlan(s) {
    const homeTz = s.home.split('|')[1];
    const destTz = s.dest.split('|')[1];
    const homeName = s.home.split('|')[0];
    const destName = s.dest.split('|')[0];
    const homeBed = hm(s.bed);
    const homeWake = hm(s.wake);
    const sleepLen = mod24(homeWake - homeBed) || 8;
    const durH = Math.max(0, (Number(s.durH) || 0) + (Number(s.durM) || 0) / 60);

    const depUtc = zonedToUtc(s.depDate, hm(s.depTime), homeTz);
    const arrUtc = depUtc + durH * 3600000;
    const offHome = tzOffset(homeTz, depUtc);
    const offDest = tzOffset(destTz, arrUtc);
    const clockDiff = (offDest - offHome) / 60; // real difference shown to the user
    let shift = clockDiff;
    while (shift > 12) shift -= 24;
    while (shift <= -12) shift += 24;

    const chronoAdj = { lark: { a: 1.15, d: 0.85 }, neutral: { a: 1, d: 1 }, owl: { a: 0.85, d: 1.15 } }[s.chrono] || { a: 1, d: 1 };
    const pace = Number(s.pace) || 1;
    const rateA = 1.0 * chronoAdj.a * pace;
    const rateD = 1.5 * chronoAdj.d * pace;

    // Choose direction. Very large eastward shifts can be easier to absorb by delaying.
    let target = shift;
    if (shift > 0 && shift >= 8) {
      const daysA = shift / rateA;
      const daysD = (24 - shift) / rateD;
      if (daysD < daysA) target = shift - 24;
    } else if (shift < 0 && shift <= -10) {
      const daysD = -shift / rateD;
      const daysA = (24 + shift) / rateA;
      if (daysA < daysD) target = shift + 24;
    }
    const sign = target >= 0 ? 1 : -1;
    const absT = Math.abs(target);
    const rate = sign > 0 ? rateA : rateD;

    let strategy = s.strategy;
    const tripDays = Number(s.tripDays) || 7;
    if (strategy === 'auto') {
      if (absT < 1) strategy = 'none';
      else if (tripDays <= 2 && absT >= 3) strategy = 'home';
      else strategy = 'gradual';
    }
    if (absT < 1 && strategy !== 'home') strategy = 'none';

    const caffCut = { low: 6, normal: 8, high: 10 }[s.caffSens] || 8;
    const weightKg = s.weightUnit === 'lb' ? Number(s.weight) * 0.4536 : Number(s.weight);

    // ---------- Pre-departure days (in home time) ----------
    const preDays = strategy === 'home' || strategy === 'none' ? 0 : clamp(Number(s.preDays) || 0, 0, 3);
    const pre = [];
    let P = 0;
    for (let j = 1; j <= preDays; j++) {
      const step = Math.min(1, absT - Math.abs(P));
      if (step <= 0) break;
      P += sign * step;
      const bed = homeBed - P;
      const wake = homeWake - P;
      pre.push({
        kind: 'pre', index: j - preDays - 1, date: addDays(s.depDate, j - preDays - 1), tz: homeTz,
        bed, wake, P, ...lightWindows(homeWake - P, sign),
      });
    }
    const P0 = P;

    // ---------- Flight ----------
    const arrDate = localDateStr(destTz, arrUtc);
    const arrHour = localHours(destTz, arrUtc);
    const depHourDest = localHours(destTz, depUtc);
    const targetBed = homeBed; // same clock time at destination
    const targetWake = homeWake;
    const flight = buildFlight({ depUtc, arrUtc, durH, destTz, homeTz, targetBed, targetWake, sleepLen, strategy, homeBed, target, caffCut, depHourDest, arrHour });

    // ---------- Post-arrival days (in destination time) ----------
    const days = [];
    const nights = (checkins.sig === tripSignature(s)) ? checkins.nights : {};
    const maxDays = 14;
    let p = P0;
    const totalDays = strategy === 'none' ? 1
      : strategy === 'home' ? Math.min(tripDays, 4)
      : Math.min(maxDays, Math.max(2, Math.ceil((absT - Math.abs(P0)) / rate) + 1));
    let adjustedDay = null;

    for (let k = 1; k <= maxDays && (k <= totalDays || (adjustedDay === null && strategy !== 'home' && strategy !== 'none')); k++) {
      const date = addDays(arrDate, k - 1);
      const remainingStart = target - p; // hours the body is still behind local time
      const bodyBed = homeBed + remainingStart;
      const bodyWake = homeWake + remainingStart;
      const tmin = bodyWake - 3;

      let bed, wake;
      let pNext = p;
      if (strategy === 'home') {
        bed = homeBed + target; wake = homeWake + target; pNext = 0;
      } else if (strategy === 'none') {
        bed = homeBed; wake = homeWake; pNext = target;
      } else {
        const step = Math.min(rate, Math.abs(target - p));
        pNext = p + sign * step;
        const off = target - pNext;
        const maxOff = strategy === 'immediate' ? 0 : 2;
        const clamped = clamp(off, -maxOff, maxOff);
        bed = homeBed + clamped;
        wake = homeWake + clamped;
      }
      // Arrival day: no need to "wake up", the day begins on landing.
      const arrivalDay = k === 1;
      // Landing near or after the planned bedtime: sleep soon after reaching the hotel.
      let lateArrival = false;
      if (arrivalDay && mod24(arrHour - bed) < 6) {
        bed = arrHour + 1;
        lateArrival = true;
      }

      // Apply a logged night if present.
      const log = nights[k];
      let logInfo = null;
      if (log && strategy !== 'none') {
        const aBed = hm(log.bed), aWake = hm(log.wake);
        const aLen = mod24(aWake - aBed) || 0.01;
        // Compare where sleep actually fell with the plan. Sleeping later than planned
        // means the clock moved less (eastward) or more (westward) than expected, and
        // vice versa. One night is noisy, so only half the deviation is applied.
        const plannedMid = bed + mod24(wake - bed) / 2;
        const dev = nearest(aBed + aLen / 2, plannedMid) - plannedMid;
        if (strategy !== 'home') {
          pNext = clamp(pNext - 0.5 * dev, Math.min(0, target), Math.max(0, target));
        }
        logInfo = { bed: aBed, wake: aWake, len: aLen, debt: sleepLen - aLen };
      }

      const lw = lightWindows(bodyWake, sign);
      const caff = caffeinePlan({ wake, bed, arrivalDay, arrHour, caffCut, sens: s.caffSens, cups: Number(s.cups), weightKg, sign, strategy });
      let bedFrame = bed;
      while (bedFrame <= arrHour) bedFrame += 24;
      const dayFrac = arrivalDay ? clamp((bedFrame - Math.max(arrHour, wake)) / Math.max(1, 24 - sleepLen), 0.15, 1) : 1;
      const water = hydration({ dayFrac, weightKg, activity: s.activity, climate: s.climate, alcohol: Number(s.alcohol), flightH: arrivalDay ? durH : 0, wake: arrivalDay ? Math.max(arrHour, wake) : wake, bed });

      const remainingAfter = Math.abs(target - pNext);
      const isAdjusted = strategy !== 'home' && remainingAfter < 0.5 && adjustedDay === null;
      if (isAdjusted) adjustedDay = k;

      days.push({
        kind: 'post', k, date, tz: destTz, bed, wake, bodyBed, bodyWake, tmin,
        seek: strategy === 'none' ? [] : lw.seek, avoid: strategy === 'none' ? [] : lw.avoid,
        melatonin: (sign > 0 && strategy !== 'home' && strategy !== 'none' && Math.abs(remainingStart) >= 1) ? bed - 0.5 : null,
        caff, water, arrivalDay, lateArrival, arrHour, remainingStart, remainingAfter, isAdjusted, log, logInfo,
        nap: napAdvice({ arrivalDay, arrHour, bed, logInfo, flight }),
      });
      p = pNext;
    }

    const daysToAdjust = strategy === 'gradual' || strategy === 'immediate'
      ? Math.max(1, Math.ceil((absT - Math.abs(P0)) / rate)) : 0;

    return {
      homeTz, destTz, homeName, destName, shift, clockDiff, target, sign, absT, rate, strategy, tripDays,
      offHome, offDest, depUtc, arrUtc, arrDate, arrHour, durH, homeBed, homeWake, sleepLen,
      pre, flight, days, daysToAdjust, caffCut, weightKg, P0,
      severity: severityOf(absT, sign),
    };
  }

  // Pick the representative of x (mod 24) closest to ref.
  function nearest(x, ref) {
    let v = x;
    while (v - ref > 12) v -= 24;
    while (ref - v > 12) v += 24;
    return v;
  }

  function lightWindows(bodyWake, sign) {
    const tmin = bodyWake - 3;
    if (sign > 0) return { seek: [[tmin, tmin + 4]], avoid: [[tmin - 4, tmin]] };
    return { seek: [[tmin - 4, tmin]], avoid: [[tmin, tmin + 4]] };
  }

  function severityOf(absT, sign) {
    const score = absT * (sign > 0 ? 1.25 : 1);
    if (score < 1) return { key: 'mild', label: 'Minimal' };
    if (score < 4) return { key: 'mild', label: 'Mild' };
    if (score < 7.5) return { key: 'moderate', label: 'Moderate' };
    if (score < 11) return { key: 'significant', label: 'Significant' };
    return { key: 'severe', label: 'Severe' };
  }

  function buildFlight(o) {
    // Flight window expressed in destination clock hours (may extend past 24 or below 0).
    const end = o.arrHour;
    const start = end - o.durH;
    // Destination night to sleep through. In "home" strategy, keep home night.
    const nightStart = o.strategy === 'home' ? o.homeBed + o.target : o.targetBed;
    const nightLen = o.sleepLen;
    let best = 0, bestStart = null, bestEnd = null;
    for (const shiftDay of [-48, -24, 0, 24]) {
      const ns = nightStart + shiftDay, ne = ns + nightLen;
      const s2 = Math.max(start, ns), e2 = Math.min(end, ne);
      if (e2 - s2 > best) { best = e2 - s2; bestStart = s2; bestEnd = e2; }
    }
    const sleep = best >= 1 ? { start: bestStart, end: bestEnd, len: best } : null;
    // About 250 ml per waking hour on board (roughly 8 oz), capped at 2.5 L.
    const awakeH = Math.max(0, o.durH - (sleep ? sleep.len : 0));
    return {
      start, end, durH: o.durH, sleep, depHourDest: o.depHourDest, arrHour: o.arrHour,
      waterMl: Math.max(250, Math.round(Math.min(2500, awakeH * 250) / 50) * 50),
      caffCutoff: sleep ? sleep.start - o.caffCut : null,
    };
  }

  function caffeinePlan(o) {
    const maxMg = o.sens === 'high' ? 200 : Math.min(400, Math.round(o.weightKg * 5.7 / 10) * 10);
    const perCup = 95;
    const cups = Math.min(o.cups, Math.floor(maxMg / perCup));
    const start = o.arrivalDay ? Math.max(o.arrHour, o.wake) : o.wake;
    const cut = cutoffAfter(start, o.bed, o.caffCut);
    const windowLen = cut - start;
    const doses = [];
    if (windowLen > 0.5 && o.strategy !== 'none') {
      const first = start + 0.5;
      if (cups >= 1 && first < cut) doses.push(first);
      if (cups >= 2) {
        const second = Math.min(start + 5, cut - 0.25);
        if (second > first + 1.5) doses.push(second);
      }
    }
    return { start, cutoff: cut, window: windowLen > 0 ? [start, cut] : null, doses, maxMg, cups };
  }

  // Caffeine cutoff expressed in the same day frame as `start` (bed may fall after midnight).
  function cutoffAfter(start, bed, hoursBefore) {
    let cut = bed - hoursBefore;
    while (cut < start) cut += 24;
    if (cut - start > 16) cut -= 24;
    return cut;
  }

  function hydration(o) {
    let ml = o.weightKg * 33;
    ml += { low: 0, moderate: 350, high: 700 }[o.activity] || 0;
    ml += { cool: -150, temperate: 0, hot: 600 }[o.climate] || 0;
    ml += (o.alcohol || 0) * 250;
    const base = Math.round((ml * (o.dayFrac || 1)) / 50) * 50;
    // Dry cabin air adds fluid loss: about 75 ml per flight hour, capped at 1 L.
    const flight = Math.round(Math.min(1000, (o.flightH || 0) * 75) / 50) * 50;
    // Spread intake across waking hours: a glass roughly every 2 hours.
    let wakeEnd = o.bed;
    while (wakeEnd <= o.wake) wakeEnd += 24;
    const awake = wakeEnd - o.wake;
    const glasses = Math.max(o.dayFrac < 1 ? 2 : 4, Math.round(base / 250));
    const times = [];
    const span = Math.max(2, awake - 1.5); // stop ~90 min before bed
    for (let i = 0; i < glasses; i++) times.push(o.wake + (span * i) / Math.max(1, glasses - 1));
    const every = Math.max(1, Math.round((span / Math.max(1, glasses - 1)) * 2) / 2);
    return { base, flight, total: base, glasses, times, every };
  }

  function napAdvice(o) {
    if (o.logInfo && o.logInfo.debt >= 1.5) {
      return 'You slept ' + fmtDur(o.logInfo.len) + ', so a 20 to 30 minute nap is fine. Finish it at least 8 hours before bedtime.';
    }
    if (o.arrivalDay && o.arrHour < 13 && !(o.flight.sleep && o.flight.sleep.len >= 4)) {
      return 'Arriving in the morning with little sleep: one nap of 20 to 30 minutes before 2 pm is fine. Set an alarm.';
    }
    return null;
  }

  /* ================================================================
   * Formatting
   * ================================================================ */
  function fmtTime(h) {
    const t = Math.round(mod24(q(h)) * 60) % 1440;
    const H = Math.floor(t / 60), M = t % 60;
    if (state.clock === '24') return pad(H) + ':' + pad(M);
    const ap = H < 12 ? 'am' : 'pm';
    const h12 = H % 12 === 0 ? 12 : H % 12;
    return h12 + (M ? ':' + pad(M) : '') + ' ' + ap;
  }
  function fmtRange(a, b) { return fmtTime(a) + ' to ' + fmtTime(b); }
  function fmtDur(h) {
    const t = Math.round(h * 4) / 4;
    const H = Math.floor(t), M = Math.round((t - H) * 60);
    return H + ' h' + (M ? ' ' + M + ' min' : '');
  }
  function fmtShift(h) {
    return Number(Math.abs(h).toFixed(2)) + ' h';
  }
  function fmtVol(ml) {
    if (state.volUnit === 'imperial') {
      const oz = ml / 29.5735;
      return Math.round(oz) + ' oz (' + (Math.round(oz / 8 * 2) / 2) + ' cups)';
    }
    return (Math.round(ml / 100) / 10).toFixed(1) + ' L';
  }
  function fmtVolShort(ml) {
    if (state.volUnit === 'imperial') return Math.round(ml / 29.5735) + ' oz';
    return ml >= 1000 ? (Math.round(ml / 100) / 10).toFixed(1) + ' L' : Math.round(ml) + ' ml';
  }

  /* ================================================================
   * Timeline rendering
   * ================================================================ */
  // Split an interval (hours, may wrap or exceed 0..24) into in-range pieces.
  function pieces(a, b) {
    const len = b - a;
    if (len <= 0) return [];
    if (len >= 24) return [[0, 24]];
    const s = mod24(a), e = s + len;
    return e <= 24 ? [[s, e]] : [[s, 24], [0, e - 24]];
  }
  function bar(cls, a, b, title) {
    return pieces(a, b).map(([s, e]) =>
      `<span class="seg-bar ${cls}" style="left:${(s / 24) * 100}%;width:${((e - s) / 24) * 100}%" title="${esc(title)}"></span>`
    ).join('');
  }
  function marker(cls, h, title) {
    return `<span class="marker ${cls}" style="left:${(mod24(h) / 24) * 100}%" title="${esc(title)}"></span>`;
  }
  function axis() {
    const ticks = [0, 6, 12, 18, 24];
    return '<div class="axis">' + ticks.map((t) =>
      `<span style="left:${(t / 24) * 100}%">${t === 24 ? (state.clock === '24' ? '24:00' : '12 am') : fmtTime(t)}</span>`
    ).join('') + '</div>';
  }
  function timeline(opts) {
    const lanes = [];
    lanes.push(`<div class="lane" aria-hidden="true">${opts.sleep || ''}</div>`);
    lanes.push(`<div class="lane" aria-hidden="true">${opts.light || ''}</div>`);
    lanes.push(`<div class="lane" aria-hidden="true">${opts.caff || ''}</div>`);
    return `<div class="timeline">${lanes.join('')}${axis()}</div>`;
  }

  /* ================================================================
   * Rendering
   * ================================================================ */
  let lastPlan = null;

  function render() {
    let plan;
    try { plan = buildPlan(state); } catch (e) { console.error(e); return; }
    lastPlan = plan;
    renderHints(plan);
    renderSummary(plan);
    renderDays(plan);
    renderFlight(plan);
    renderWater(plan);
    renderRecovery(plan);
  }

  function renderHints(p) {
    $('#arrival-hint').innerHTML = `Lands <strong>${esc(fmtDate(p.arrDate))} at ${fmtTime(p.arrHour)}</strong> ${esc(p.destName)} time.`;
    $('#sleep-hint').innerHTML = `You normally sleep <strong>${fmtDur(p.sleepLen)}</strong>.` +
      (p.sleepLen < 7 ? ' Most adults need 7 to 9 hours. Extra sleep before you fly will help.' : '');
  }

  function strategyText(p) {
    if (p.strategy === 'none') return 'The time difference is small. Keep your normal routine.';
    if (p.strategy === 'home') return `Your trip is short, so stay on ${p.homeName} time and plan activities around it.`;
    const dir = p.sign > 0 ? 'advance (sleep earlier)' : 'delay (sleep later)';
    const note = Math.sign(p.target) !== Math.sign(p.clockDiff)
      ? ` With a ${fmtShift(p.clockDiff)} gap, it is easier to ${dir} by ${fmtShift(p.absT)} than to go the other way.`
      : '';
    return (p.strategy === 'immediate'
      ? `Switch to ${p.destName} time on arrival and use light to pull your body clock along.`
      : `Shift your body clock about ${fmtShift(p.rate)} per day toward ${p.destName} time.`) + note;
  }

  function renderSummary(p) {
    const dirWord = p.clockDiff > 0 ? 'ahead' : 'behind';
    const eastWest = p.sign > 0 ? 'Advance' : 'Delay';
    const adjusted = p.days.find((d) => d.isAdjusted);
    $('#summary').innerHTML = `
      <h3>${esc(p.homeName)} → ${esc(p.destName)}</h3>
      <p class="route">${esc(fmtOffset(p.offHome))} to ${esc(fmtOffset(p.offDest))} · ${fmtDur(p.durH)} flight ·
        <span class="badge ${p.severity.key}">${p.severity.label} jet lag</span></p>
      <div class="stats">
        <div class="stat"><div class="k">Time difference</div><div class="v">${p.clockDiff === 0 ? '0 h' : fmtShift(p.clockDiff)}</div>
          <div class="s">${p.clockDiff === 0 ? 'Same time zone' : esc(p.destName) + ' is ' + dirWord}</div></div>
        <div class="stat"><div class="k">Body clock</div><div class="v">${p.strategy === 'none' ? 'Hold' : p.strategy === 'home' ? 'Stay' : eastWest}</div>
          <div class="s">${p.strategy === 'none' || p.strategy === 'home' ? 'No shift needed' : fmtShift(p.absT) + ' to shift'}</div></div>
        <div class="stat"><div class="k">Days to adjust</div><div class="v">${(p.strategy === 'gradual' || p.strategy === 'immediate') && adjusted ? adjusted.k : (p.daysToAdjust || '—')}</div>
          <div class="s">${adjusted ? 'Back in sync by ' + esc(fmtDate(adjusted.date)) : p.strategy === 'home' ? 'Not shifting' : 'Plan extends beyond view'}</div></div>
        <div class="stat"><div class="k">First night</div><div class="v">${fmtTime(p.days[0].bed)}</div>
          <div class="s">Wake ${fmtTime(p.days[0].wake)}</div></div>
      </div>
      <p class="callout">${esc(strategyText(p))}${p.P0 ? ` Pre-adjusting before you leave already covers ${fmtShift(p.P0)}.` : ''}</p>`;
  }

  function tipsList(items) {
    return '<ul class="tips">' + items.filter(Boolean).map(([ic, html]) =>
      `<li><span class="ic" aria-hidden="true">${ic}</span><span>${html}</span></li>`).join('') + '</ul>';
  }

  // Remove the sleep window from light windows so we only list waking hours.
  function awakeParts(windows, bed, wake) {
    const out = [];
    const sleepLen = mod24(wake - bed);
    windows.forEach(([a, b]) => {
      // Sample at 15-minute steps; simple and robust for wrap-around cases.
      let cur = null;
      for (let t = a; t <= b + 1e-9; t += 0.25) {
        const inSleep = mod24(t - bed) < sleepLen;
        if (!inSleep && t < b) { if (cur === null) cur = t; }
        else if (cur !== null) { if (t - cur >= 0.5) out.push([cur, t]); cur = null; }
      }
      if (cur !== null && b - cur >= 0.5) out.push([cur, b]);
    });
    return out;
  }

  function renderDays(p) {
    const html = [];
    // Pre-departure days
    p.pre.forEach((d, i) => {
      const seek = awakeParts(d.seek, d.bed, d.wake);
      const avoid = awakeParts(d.avoid, d.bed, d.wake);
      html.push(`<article class="panel day">
        <div class="day-head"><h3>${esc(fmtDate(d.date))}<span>${esc(p.homeName)} time</span></h3>
          <span class="day-tag">Before you fly · ${p.pre.length - i} day${p.pre.length - i > 1 ? 's' : ''} out</span></div>
        ${timeline({
          sleep: bar('sleep', d.bed, d.bed + p.sleepLen, 'Sleep'),
          light: d.seek.map(([a, b]) => bar('light', a, b, 'Seek bright light')).join('') + d.avoid.map(([a, b]) => bar('dark', a, b, 'Avoid bright light')).join(''),
          caff: bar('caff', d.wake, cutoffAfter(d.wake, d.bed, p.caffCut), 'Caffeine OK'),
        })}
        ${tipsList([
          ['🛏️', `Go to bed at <strong>${fmtTime(d.bed)}</strong> and wake at <strong>${fmtTime(d.wake)}</strong>, ${p.sign > 0 ? 'an hour earlier' : 'an hour later'} each day.`],
          seek.length ? ['☀️', `Get bright light ${seek.map(([a, b]) => fmtRange(a, b)).join(' and ')}.`] : null,
          avoid.length ? ['🕶️', `Keep lights dim ${avoid.map(([a, b]) => fmtRange(a, b)).join(' and ')}.`] : null,
          ['☕', `Last caffeine by <strong>${fmtTime(cutoffAfter(d.wake, d.bed, p.caffCut))}</strong>.`],
        ])}
      </article>`);
    });

    // Flight day
    const f = p.flight;
    html.push(`<article class="panel day flight">
      <div class="day-head"><h3>Travel day<span>${esc(p.destName)} time</span></h3><span class="day-tag">✈️ In flight</span></div>
      ${timeline({
        sleep: f.sleep ? bar('sleep', f.sleep.start, f.sleep.end, 'Sleep on the plane') : '',
        light: bar('flightbar', f.start, f.end, 'Flight'),
        caff: f.sleep ? bar('caff', f.start, Math.min(f.end, f.sleep.start - p.caffCut), 'Caffeine OK') : bar('caff', f.start, f.end, 'Caffeine OK'),
      })}
      ${tipsList([
        ['🕑', `Set your watch to ${esc(p.destName)} time when you board. You depart at ${fmtTime(f.depHourDest)} and land at ${fmtTime(f.arrHour)} destination time.`],
        f.sleep ? ['😴', `Sleep from about <strong>${fmtRange(f.sleep.start, f.sleep.end)}</strong> (${fmtDur(f.sleep.len)}), which is night at your destination.`]
          : ['👀', 'It is daytime at your destination for this whole flight, so try to stay awake.'],
        ['💧', `Drink about <strong>${fmtVolShort(f.waterMl)}</strong> of water during the flight.`],
      ])}
    </article>`);

    // Post-arrival days
    const today = localDateStr(p.destTz, Date.now());
    p.days.forEach((d) => {
      // On arrival day, light advice only applies after landing.
      const afterLanding = (list) => list.map(([a, b]) => {
        if (!d.arrivalDay) return [a, b];
        const a2 = mod24(a), b2 = a2 + (b - a);
        if (b2 <= d.arrHour + 0.25) return null;
        return [Math.max(a2, d.arrHour), b2];
      }).filter(Boolean);
      const seek = afterLanding(awakeParts(d.seek, d.bed, d.wake));
      const avoid = afterLanding(awakeParts(d.avoid, d.bed, d.wake));
      const tag = d.arrivalDay ? 'Arrival day' : (d.isAdjusted ? 'Back in sync' : 'Day ' + d.k);
      const shiftLeft = d.remainingStart;
      const bodyNote = p.strategy === 'none' || p.strategy === 'home' ? null
        : Math.abs(shiftLeft) >= 0.5
          ? ['🧭', `Your body clock starts the day about <strong>${fmtShift(shiftLeft)}</strong> ${shiftLeft > 0 ? 'behind' : 'ahead of'} local time.`]
          : ['✅', 'Your body clock is in sync with local time. Keep a steady routine.'];
      const caffTip = d.caff.window
        ? ['☕', (d.caff.doses.length
            ? `Caffeine at ${d.caff.doses.map(fmtTime).join(' and ')}` + (d.caff.cups ? ` (about ${d.caff.doses.length} cup${d.caff.doses.length > 1 ? 's' : ''})` : '') + '. '
            : '') + `Last caffeine by <strong>${fmtTime(d.caff.cutoff)}</strong>.`]
        : ['☕', 'Skip caffeine today. Bedtime is too close.'];
      const wakeLine = d.lateArrival
        ? `Land at ${fmtTime(d.arrHour)}. Head to bed as soon as you can, around <strong>${fmtTime(d.bed)}</strong>, and wake at <strong>${fmtTime(d.wake)}</strong>.`
        : d.arrivalDay
        ? `Land at ${fmtTime(d.arrHour)}. Go to bed at <strong>${fmtTime(d.bed)}</strong>.`
        : `Wake at <strong>${fmtTime(d.wake)}</strong>. Go to bed at <strong>${fmtTime(d.bed)}</strong>.`;
      const logged = d.logInfo
        ? `<span class="logged">Logged ${fmtRange(d.logInfo.bed, d.logInfo.wake)} (${fmtDur(d.logInfo.len)}). The days that follow were adjusted.</span>`
        : '';
      const isToday = d.date === today;
      const nowMarker = isToday ? marker('now', localHours(p.destTz, Date.now()), 'Now') : '';

      html.push(`<article class="panel day${d.isAdjusted ? ' adjusted' : ''}">
        <div class="day-head"><h3>${esc(fmtDate(d.date))}<span>${esc(p.destName)} time${isToday ? ' · Today' : ''}</span></h3>
          <span class="day-tag">${tag}</span></div>
        ${timeline({
          sleep: bar('sleep', d.bed, d.bed + mod24(d.wake - d.bed), 'Sleep') + (d.melatonin !== null ? marker('mel', d.melatonin, 'Melatonin') : '') + nowMarker,
          light: d.seek.map(([a, b]) => bar('light', a, b, 'Seek bright light')).join('') + d.avoid.map(([a, b]) => bar('dark', a, b, 'Avoid bright light')).join(''),
          caff: (d.caff.window ? bar('caff', d.caff.window[0], d.caff.window[1], 'Caffeine OK') : '') + d.water.times.map((t) => marker('water', t, 'Drink water')).join(''),
        })}
        ${tipsList([
          ['🛏️', wakeLine + (p.strategy === 'gradual' && !d.lateArrival && Math.abs(d.bed - p.homeBed) > 0.2 ? ' This is a stepping stone toward your usual ' + fmtTime(p.homeBed) + '.' : '')],
          bodyNote,
          seek.length ? ['☀️', `Get bright light, ideally outdoors, ${seek.map(([a, b]) => fmtRange(a, b)).join(' and ')}.`] : null,
          avoid.length ? ['🕶️', `Avoid bright light ${avoid.map(([a, b]) => fmtRange(a, b)).join(' and ')}. Wear sunglasses if you are outside.`] : null,
          caffTip,
          d.melatonin !== null ? ['💊', `Optional: 0.5 to 3 mg of melatonin at <strong>${fmtTime(d.melatonin)}</strong>, 30 minutes before bed.`] : null,
          d.nap ? ['💤', d.nap] : null,
          ['💧', `Drink <strong>${fmtVol(d.water.base + d.water.flight)}</strong> today${d.water.flight ? ' including the flight' : ''}, about a glass every ${d.water.every === 1 ? 'hour' : d.water.every + ' hours'}.`],
        ])}
        ${p.strategy === 'none' ? '' : `<div class="checkin-row">
          <button type="button" class="btn btn-ghost btn-sm" data-checkin="${d.k}">${d.log ? 'Edit sleep log' : 'Log tonight’s sleep'}</button>
          ${logged}</div>`}
      </article>`);
    });

    $('#days').innerHTML = html.join('');
    $$('[data-checkin]').forEach((b) => b.addEventListener('click', () => openCheckin(Number(b.dataset.checkin))));
  }

  function renderFlight(p) {
    const f = p.flight;
    const sleepTip = f.sleep
      ? `<p>Sleep from <strong>${fmtRange(f.sleep.start, f.sleep.end)}</strong> destination time. That is ${fmtDur(f.sleep.len)} of the ${fmtDur(f.durH)} flight.</p>`
      : `<p>It is daytime at your destination for the whole flight. <strong>Stay awake</strong> so you are tired at bedtime after landing.</p>`;
    $('#pane-flight').innerHTML = `<div class="info-grid">
      <section class="panel info"><h3>😴 Sleep</h3>${sleepTip}
        <ul><li>Bring an eye mask, earplugs or noise-canceling headphones, and a neck pillow.</li>
        <li>Choose a window seat if you plan to sleep, so you are not disturbed.</li>
        <li>Skip sleeping pills unless your doctor has approved them. They can leave you groggy and raise clot risk by keeping you still.</li></ul></section>
      <section class="panel info"><h3>💧 Water</h3>
        <p class="big-num">${fmtVolShort(f.waterMl)}</p>
        <p>Cabin air is very dry, often 10 to 20 percent humidity. Aim for about ${fmtVolShort(250)} for each hour you are awake on board.</p>
        <ul><li>Bring an empty bottle through security and fill it at the gate.</li>
        <li>Limit alcohol. It dehydrates you and fragments sleep.</li></ul></section>
      <section class="panel info"><h3>☕ Caffeine</h3>
        ${f.sleep ? `<p>Have no caffeine after <strong>${fmtTime(f.caffCutoff)}</strong> destination time so you can sleep on board.</p>`
          : `<p>A coffee or tea can help you stay awake. Stop by <strong>${fmtTime(p.days[0].caff.cutoff)}</strong> destination time.</p>`}</section>
      <section class="panel info"><h3>🍽️ Meals and movement</h3>
        <ul><li>Eat on destination time. Skip a meal if it falls in your sleep window.</li>
        <li>Walk the aisle and flex your ankles every hour or two while awake.</li>
        <li>Wear compression socks on flights longer than 4 hours.</li></ul></section>
    </div>`;
  }

  function renderWater(p) {
    // Use a full day (not the partial arrival day) for the headline numbers.
    const d0 = p.days[1] || p.days[0];
    const base = d0.water.base;
    const rows = p.days.map((d) => `<tr><td>${esc(fmtDate(d.date))}</td><td>${fmtVolShort(d.water.base)}</td>
      <td>${d.water.flight ? fmtVolShort(d.water.flight) : '—'}</td><td><strong>${fmtVol(d.water.base + d.water.flight)}</strong></td></tr>`).join('');
    const schedule = d0.water.times.slice(0, 12).map((t) => fmtTime(t)).join(', ');
    $('#pane-water').innerHTML = `<div class="info-grid">
      <section class="panel info"><h3>💧 Daily target</h3>

        <p class="big-num">${fmtVol(base)}</p>
        <div class="water-bar" aria-hidden="true"><i style="width:${clamp(base / 5000 * 100, 5, 100)}%"></i></div>
        <p>About <strong>${d0.water.glasses} glasses</strong> of ${fmtVolShort(250)} each, from all drinks and water-rich foods.</p>
        <p class="hint">Based on ${Math.round(state.weightUnit === 'lb' ? p.weightKg / 0.4536 : p.weightKg)} ${esc(state.weightUnit)} body weight, ${esc({ low: 'light', moderate: 'moderate', high: 'high' }[state.activity])} activity, a ${esc({ cool: 'cool', temperate: 'mild', hot: 'hot' }[state.climate])} climate${Number(state.alcohol) ? ', and ' + state.alcohol + ' alcoholic drink' + (state.alcohol > 1 ? 's' : '') + ' a day' : ''}.</p></section>
      <section class="panel info"><h3>⏰ Suggested times on a full day</h3>
        <p>${esc(schedule)}</p>
        <p class="hint">Front-load water in the morning and slow down 90 minutes before bed so you are not woken up.</p></section>
      <section class="panel info"><h3>✅ Am I hydrated?</h3>
        <ul><li>Pale straw-colored urine is a good sign.</li>
        <li>Headache, dry mouth, or dark urine mean you need more.</li>
        <li>Add an electrolyte drink after long flights or in hot weather.</li>
        <li>Each alcoholic drink: add one glass of water.</li></ul></section>
    </div>
    <section class="panel info"><h3>📅 Day by day</h3>
      <p class="hint">The arrival day is scaled to the hours you are awake after landing.</p>
      <div class="table-wrap"><table class="water"><thead><tr><th>Day</th><th>Base</th><th>Flight</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table></div></section>`;
  }

  function renderRecovery(p) {
    const east = p.sign > 0;
    const exercise = east
      ? 'Exercise outdoors in the morning. Morning activity and light help pull your clock earlier.'
      : 'Exercise in the late afternoon or early evening. It helps you stay up later.';
    const meals = east
      ? 'Eat a protein-rich breakfast soon after waking. Keep dinner lighter and finish 2 to 3 hours before bed.'
      : 'Eat dinner on local time and avoid a large breakfast before your body is hungry.';
    const mel = east
      ? 'Low-dose melatonin (0.5 to 3 mg) about 30 minutes before local bedtime can speed up eastward recovery. Use it for the first few nights only.'
      : 'Melatonin is usually unnecessary when flying west. Bright evening light does most of the work.';
    $('#pane-recovery').innerHTML = `<div class="info-grid">
      <section class="panel info"><h3>☀️ Light</h3><p>Light is the strongest signal for your body clock. Follow the yellow and striped bars in the daily plan.</p>
        <ul><li>Outdoor daylight is 10 to 100 times brighter than indoor light.</li><li>A light therapy lamp or bright screen can help on cloudy days.</li><li>Use sunglasses to block light when the plan says to avoid it.</li></ul></section>
      <section class="panel info"><h3>🏃 Movement</h3><p>${exercise}</p><ul><li>A 20 to 30 minute walk counts.</li><li>Skip intense workouts within 2 hours of bedtime.</li></ul></section>
      <section class="panel info"><h3>🍽️ Meals</h3><p>${meals}</p><ul><li>Switch to local mealtimes as soon as you land.</li><li>Avoid heavy, spicy, or fatty food late at night.</li></ul></section>
      <section class="panel info"><h3>💤 Naps</h3><ul><li>Keep naps to 20 to 30 minutes.</li><li>Finish napping at least 8 hours before bedtime.</li><li>A short nap right after a coffee (a "coffee nap") can boost alertness.</li></ul></section>
      <section class="panel info"><h3>💊 Melatonin</h3><p>${mel}</p><p class="hint">Check with a doctor first, especially if you take other medication.</p></section>
      <section class="panel info"><h3>🛏️ Sleep setting</h3><ul><li>Keep the room cool, around 18 °C (65 °F), and dark.</li><li>Put devices away 30 to 60 minutes before bed, or use night mode.</li><li>If you cannot sleep after 20 minutes, get up and read in dim light.</li></ul></section>
      <section class="panel info"><h3>🍷 Alcohol</h3><p>Alcohol makes you drowsy but breaks up deep sleep and dehydrates you. Keep it light during the first few days.</p></section>
      <section class="panel info"><h3>🧳 Frequent flyer habits</h3><ul><li>Book flights that land in the late afternoon when flying east, so bedtime comes soon.</li><li>For trips of 2 days or less, stay on home time if you can.</li><li>Log your sleep each morning in the daily plan. The plan adapts to how you actually slept.</li></ul></section>
    </div>`;
  }

  /* ================================================================
   * Check-in dialog
   * ================================================================ */
  let checkinDay = null;
  function tripSignature(s) { return [s.home, s.dest, s.depDate, s.depTime, s.durH, s.durM].join('~'); }

  function openCheckin(k) {
    checkinDay = k;
    const d = lastPlan.days.find((x) => x.k === k);
    $('#checkin-sub').textContent = `Night of ${fmtDate(d.date)} (planned ${fmtRange(d.bed, d.wake)}). Enter what really happened and the rest of the plan will adapt.`;
    $('#ci-bed').value = d.log ? d.log.bed : toHM(q(d.bed));
    $('#ci-wake').value = d.log ? d.log.wake : toHM(q(d.wake));
    $('#ci-clear').hidden = !d.log;
    showDialog($('#checkin-dialog'));
  }
  function saveCheckin() {
    const sig = tripSignature(state);
    if (checkins.sig !== sig) checkins = { sig, nights: {} };
    checkins.nights[checkinDay] = { bed: $('#ci-bed').value, wake: $('#ci-wake').value };
    storageSet('atc-checkins', checkins);
    render();
  }
  function clearCheckin() {
    if (checkins.nights) delete checkins.nights[checkinDay];
    storageSet('atc-checkins', checkins);
    closeDialog($('#checkin-dialog'));
    render();
  }

  function showDialog(dlg) {
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeDialog(dlg) {
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }

  /* ================================================================
   * Calendar export
   * ================================================================ */
  function icsStamp(ms) {
    const d = new Date(ms);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
  }
  function exportIcs() {
    const p = lastPlan;
    if (!p) return;
    const ev = [];
    const add = (startMs, endMs, title, desc) => {
      ev.push('BEGIN:VEVENT', 'UID:' + startMs + '-' + ev.length + '@alltripconsidered',
        'DTSTAMP:' + icsStamp(Date.now()), 'DTSTART:' + icsStamp(startMs), 'DTEND:' + icsStamp(endMs),
        'SUMMARY:' + title, 'DESCRIPTION:' + desc.replace(/[,;]/g, '\\$&'), 'END:VEVENT');
    };
    p.pre.forEach((d) => {
      const bedDate = mod24(d.bed) < 12 ? addDays(d.date, 1) : d.date;
      const s = zonedToUtc(bedDate, mod24(q(d.bed)), p.homeTz);
      add(s, s + p.sleepLen * 3600000, 'Sleep (jet lag prep)', 'All Trip Considered: pre-flight shift');
    });
    p.days.forEach((d) => {
      const bedDate = mod24(d.bed) < 12 ? addDays(d.date, 1) : d.date;
      const s = zonedToUtc(bedDate, mod24(q(d.bed)), p.destTz);
      const len = mod24(d.wake - d.bed) || p.sleepLen;
      add(s, s + len * 3600000, 'Sleep in ' + p.destName, 'All Trip Considered: last caffeine ' + fmtTime(d.caff.cutoff));
    });
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//All Trip Considered//Jet Lag Planner//EN', 'CALSCALE:GREGORIAN']
      .concat(ev, ['END:VCALENDAR']).join('\r\n');
    const blob = new Blob([body], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jet-lag-plan-' + p.destName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ================================================================
   * Form wiring
   * ================================================================ */
  function populateTzSelects() {
    let allZones = [];
    try { allZones = Intl.supportedValuesOf('timeZone'); } catch (e) { allZones = []; }
    const build = (sel) => {
      const frag = document.createDocumentFragment();
      // Device zone first if not a listed city.
      const known = Object.values(CITY_BY_KEY).some((c) => c.tz === deviceTz);
      if (!known) {
        const og = document.createElement('optgroup'); og.label = 'Your device';
        og.appendChild(new Option('Your time zone (' + deviceTz.replace(/_/g, ' ') + ')', 'Your time zone|' + deviceTz));
        frag.appendChild(og);
      }
      CITIES.forEach(([region, list]) => {
        const og = document.createElement('optgroup'); og.label = region;
        list.slice().sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, tz]) => og.appendChild(new Option(name, name + '|' + tz)));
        frag.appendChild(og);
      });
      if (allZones.length) {
        const og = document.createElement('optgroup'); og.label = 'All time zones';
        allZones.forEach((tz) => og.appendChild(new Option(tz.replace(/_/g, ' '), tz.split('/').pop().replace(/_/g, ' ') + '|' + tz)));
        frag.appendChild(og);
      }
      sel.appendChild(frag);
    };
    build($('#home')); build($('#dest'));
  }

  const FIELDS = ['home', 'dest', 'depDate', 'depTime', 'durH', 'durM', 'tripDays', 'bed', 'wake', 'cups',
    'weight', 'weightUnit', 'activity', 'climate', 'alcohol', 'strategy', 'preDays', 'pace', 'clock', 'volUnit'];
  const RADIOS = ['chrono', 'caffSens'];
  const NUMERIC = new Set(['durH', 'durM', 'tripDays', 'cups', 'weight', 'alcohol', 'preDays', 'pace']);

  function writeForm() {
    FIELDS.forEach((f) => {
      const el = $('#' + f);
      if (!el) return;
      if (el.tagName === 'SELECT' && !Array.from(el.options).some((o) => o.value === String(state[f]))) {
        // Keep a saved zone selectable even if the list changes.
        if (f === 'home' || f === 'dest') el.appendChild(new Option(String(state[f]).split('|')[0], state[f]));
      }
      el.value = state[f];
    });
    RADIOS.forEach((r) => $$(`input[name="${r}"]`).forEach((i) => { i.checked = i.value === state[r]; }));
    updateOutputs();
  }

  function updateOutputs() {
    $('#cups-out').textContent = state.cups;
    $('#alcohol-out').textContent = state.alcohol;
    $('#pre-out').textContent = state.preDays;
    const pace = Number(state.pace);
    $('#pace-out').textContent = pace < 0.75 ? 'Gentle' : pace < 1 ? 'Easy' : pace === 1 ? 'Standard' : pace <= 1.25 ? 'Brisk' : 'Aggressive';
  }

  function readForm(e) {
    const t = e && e.target;
    if (!t || !t.name) return;
    let v = t.value;
    if (NUMERIC.has(t.name)) {
      v = Number(v);
      if (!isFinite(v)) return;
    }
    if (t.name === 'weightUnit' && v !== state.weightUnit) {
      state.weight = Math.round(v === 'lb' ? state.weight / 0.4536 : state.weight * 0.4536);
      $('#weight').value = state.weight;
    }
    if (t.type === 'date' && !v) return;
    if (t.type === 'time' && !v) return;
    state[t.name] = v;
    storageSet('atc-state', state);
    updateOutputs();
    scheduleRender();
  }

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 60);
  }

  /* ================================================================
   * Tabs
   * ================================================================ */
  function setupTabs() {
    const tabs = $$('[role="tab"]');
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); n.focus(); select(n); }
      });
    });
  }

  /* ================================================================
   * Appearance: color mode, seasons, holidays, decorations
   * ================================================================ */
  function easterDate(y) {
    // Anonymous Gregorian algorithm.
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }
  function thanksgivingDate(y) {
    const nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay();
    const firstThu = 1 + ((4 - nov1 + 7) % 7);
    return Date.UTC(y, 10, firstThu + 21);
  }
  function tableDate(table, y) {
    return table[y] ? Date.UTC(y, Number(table[y].slice(0, 2)) - 1, Number(table[y].slice(3))) : null;
  }

  // Each holiday is active from `before` days ahead of its main date to `after` days past it.
  function holidayWindows(y) {
    const D = (m, d) => Date.UTC(y, m - 1, d);
    return [
      ['newyear', D(1, 1), 2, 1], ['newyear', Date.UTC(y + 1, 0, 1), 2, 1],
      ['lunar', tableDate(LUNAR_NEW_YEAR, y), 7, 7],
      ['valentine', D(2, 14), 7, 0],
      ['stpatrick', D(3, 17), 7, 0],
      ['easter', easterDate(y), 7, 1],
      ['independence', D(7, 4), 6, 1],
      ['halloween', D(10, 31), 16, 0],
      ['diwali', tableDate(DIWALI, y), 5, 2],
      ['thanksgiving', thanksgivingDate(y), 10, 1],
      ['hanukkah', tableDate(HANUKKAH, y), 2, 8],
      ['christmas', D(12, 25), 24, 1],
    ].filter((w) => w[1] !== null);
  }
  function detectHoliday(now) {
    const n = new Date(now);
    const today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
    let best = null;
    holidayWindows(n.getFullYear()).forEach(([key, main, before, after]) => {
      if (today >= main - before * DAY_MS && today <= main + after * DAY_MS) {
        const dist = Math.abs(today - main);
        if (!best || dist < best.dist) best = { key, dist };
      }
    });
    return best ? best.key : null;
  }
  function detectSeason(now, hemi) {
    const m = new Date(now).getMonth(); // 0..11
    const north = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
    if (hemi !== 'south') return north;
    return { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' }[north];
  }

  function applyAppearance() {
    const root = document.documentElement;
    if (appearance.mode === 'light' || appearance.mode === 'dark') root.dataset.theme = appearance.mode;
    else delete root.dataset.theme;

    const season = appearance.season === 'auto' ? detectSeason(Date.now(), appearance.hemisphere)
      : appearance.season === 'none' ? null : appearance.season;
    const holiday = appearance.holiday === 'auto' ? detectHoliday(Date.now())
      : appearance.holiday === 'none' ? null : appearance.holiday;
    if (season) root.dataset.season = season; else delete root.dataset.season;
    if (holiday) root.dataset.holiday = holiday; else delete root.dataset.holiday;

    const theme = holiday ? HOLIDAYS[holiday] : season ? SEASONS[season] : null;
    const emoji = theme ? theme.emoji : [];
    const motionOk = appearance.motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const level = Number(appearance.intensity) || 2;

    // Garland
    const g = $('#decor-garland');
    if (appearance.garland && emoji.length) {
      const count = 14 + level * 6;
      let s = '';
      for (let i = 0; i < count; i++) s += `<span class="g">${emoji[i % emoji.length]}</span>`;
      g.innerHTML = s;
      g.classList.add('on');
      g.classList.toggle('swing', motionOk);
    } else { g.innerHTML = ''; g.classList.remove('on', 'swing'); }

    // Falling particles
    const pc = $('#decor-particles');
    pc.innerHTML = '';
    pc.classList.toggle('static', !motionOk);
    if (appearance.particles && emoji.length) {
      const n = [0, 10, 18, 30][level];
      let s = '';
      for (let i = 0; i < n; i++) {
        const left = (i * 97.3) % 100;
        const size = 14 + ((i * 37) % 16);
        const dur = 11 + ((i * 53) % 13);
        const delay = -((i * 71) % 24);
        const drift = ((i % 2 ? 1 : -1) * (20 + (i * 13) % 60)) + 'px';
        const top = motionOk ? '' : `top:${(i * 41) % 95}%;`;
        s += `<span style="left:${left}%;${top}font-size:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;--drift:${drift}">${emoji[i % emoji.length]}</span>`;
      }
      pc.innerHTML = s;
    }

    // Corner accents
    const c = $('#decor-corners');
    c.innerHTML = appearance.corners && emoji.length
      ? `<span class="tl">${emoji[0]}</span><span class="br">${emoji[1 % emoji.length]}</span>` : '';

    // Hint inside the dialog
    const hint = $('#holiday-hint');
    if (hint) {
      const autoH = detectHoliday(Date.now());
      const autoS = detectSeason(Date.now(), appearance.hemisphere);
      hint.textContent = 'Automatic right now: ' + (autoH ? HOLIDAYS[autoH].name : 'no holiday') + ', ' + SEASONS[autoS].name.toLowerCase() + '.';
    }
    $('#intensity-out').textContent = ['', 'Light', 'Medium', 'Festive'][level];
    updateThemeColor();
  }

  function updateThemeColor() {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    $$('meta[name="theme-color"]').forEach((m) => {
      if (appearance.mode === 'system') {
        m.setAttribute('content', m.media.includes('dark') ? '#101826' : accent || '#2f5d8a');
      } else {
        m.setAttribute('content', appearance.mode === 'dark' ? '#101826' : accent || '#2f5d8a');
      }
    });
  }

  function setupAppearance() {
    const sel = $('#holiday-select');
    sel.appendChild(new Option('Automatic', 'auto'));
    sel.appendChild(new Option('None', 'none'));
    Object.entries(HOLIDAYS).forEach(([k, v]) => sel.appendChild(new Option(v.name, k)));

    const form = $('#appearance-form');
    const write = () => {
      $$('input[name="mode"]', form).forEach((i) => { i.checked = i.value === appearance.mode; });
      form.season.value = appearance.season;
      form.hemisphere.value = appearance.hemisphere;
      form.holiday.value = appearance.holiday;
      ['garland', 'particles', 'corners', 'motion'].forEach((k) => { form[k].checked = !!appearance[k]; });
      form.intensity.value = appearance.intensity;
    };
    write();
    form.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.name) return;
      appearance[t.name] = t.type === 'checkbox' ? t.checked : t.name === 'intensity' ? Number(t.value) : t.value;
      storageSet('atc-appearance', appearance);
      applyAppearance();
    });
    $('#appearance-btn').addEventListener('click', () => { write(); showDialog($('#appearance-dialog')); });
    $('#appearance-dialog').addEventListener('click', (e) => { if (e.target.id === 'appearance-dialog') closeDialog(e.target); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', updateThemeColor);
    applyAppearance();
  }

  /* ================================================================
   * PWA: service worker and install prompt
   * ================================================================ */
  function setupPwa() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    let deferred = null;
    const btn = $('#install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferred = e; btn.hidden = false;
    });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) { /* ignore */ }
      deferred = null; btn.hidden = true;
    });
    window.addEventListener('appinstalled', () => { btn.hidden = true; });
  }

  /* ================================================================
   * Init
   * ================================================================ */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    fillDefaults();
    populateTzSelects();
    writeForm();

    const form = $('#trip-form');
    form.addEventListener('input', readForm);
    form.addEventListener('change', readForm);
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#reset-btn').addEventListener('click', () => {
      state = Object.assign({}, DEFAULTS);
      checkins = { sig: '', nights: {} };
      storageSet('atc-checkins', checkins);
      fillDefaults();
      storageSet('atc-state', state);
      writeForm();
      render();
    });

    $('#checkin-form').addEventListener('submit', (e) => {
      if (!$('#ci-bed').value || !$('#ci-wake').value) { e.preventDefault(); return; }
      saveCheckin();
    });
    $('#ci-cancel').addEventListener('click', () => closeDialog($('#checkin-dialog')));
    $('#ci-clear').addEventListener('click', clearCheckin);
    $('#ics-btn').addEventListener('click', exportIcs);
    $('#print-btn').addEventListener('click', () => window.print());

    setupTabs();
    setupAppearance();
    setupPwa();
    render();
  }

  // Expose the model for testing in a console or headless browser.
  window.ATC = { buildPlan: (s) => buildPlan(Object.assign({}, DEFAULTS, s)), detectHoliday, detectSeason, easterDate, thanksgivingDate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
