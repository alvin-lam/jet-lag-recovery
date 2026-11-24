// Season and holiday detection. Pure functions, used by the appearance menu.
import { DAY_MS } from '../lib/util.js';
import { LUNAR_NEW_YEAR, DIWALI, HANUKKAH } from '../data/themes.js';

/** Easter Sunday (Anonymous Gregorian algorithm), as UTC midnight. */
export function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return Date.UTC(y, Math.floor(n / 31) - 1, (n % 31) + 1);
}

/** US Thanksgiving: the fourth Thursday of November. */
export function thanksgivingDate(y) {
  const nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay();
  return Date.UTC(y, 10, 1 + ((4 - nov1 + 7) % 7) + 21);
}

const fromTable = (table, y) => (table[y] ? Date.UTC(y, table[y][0] - 1, table[y][1]) : null);

// Holiday windows are computed once per year and reused. Each entry is
// [key, main date, days shown before, days shown after].
const windowCache = new Map();
function holidayWindows(y) {
  let w = windowCache.get(y);
  if (!w) {
    const D = (m, d) => Date.UTC(y, m - 1, d);
    w = [
      ['newyear', D(1, 1), 2, 1], ['newyear', Date.UTC(y + 1, 0, 1), 2, 1],
      ['lunar', fromTable(LUNAR_NEW_YEAR, y), 7, 7],
      ['valentine', D(2, 14), 7, 0],
      ['stpatrick', D(3, 17), 7, 0],
      ['easter', easterDate(y), 7, 1],
      ['independence', D(7, 4), 6, 1],
      ['halloween', D(10, 31), 16, 0],
      ['diwali', fromTable(DIWALI, y), 5, 2],
      ['thanksgiving', thanksgivingDate(y), 10, 1],
      ['hanukkah', fromTable(HANUKKAH, y), 2, 8],
      ['christmas', D(12, 25), 24, 1],
    ].filter((x) => x[1] !== null);
    windowCache.set(y, w);
  }
  return w;
}

// US-only holidays are shown automatically only when the device is in a US time zone.
const US_ONLY = new Set(['thanksgiving', 'independence']);
const US_TZ = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Yakutat|Metlakatla|Menominee|Indiana\/|Kentucky\/|North_Dakota\/)|Pacific\/Honolulu$)/;

/**
 * The active holiday for a local date, preferring the one whose main day is closest.
 * Pass the device time zone to skip regional holidays that do not apply there.
 */
export function detectHoliday(now, tz) {
  const inUS = !tz || US_TZ.test(tz);
  const n = new Date(now);
  const today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  let best = null;
  let bestDist = Infinity;
  for (const [key, main, before, after] of holidayWindows(n.getFullYear())) {
    if (!inUS && US_ONLY.has(key)) continue;
    if (today >= main - before * DAY_MS && today <= main + after * DAY_MS) {
      const dist = Math.abs(today - main);
      if (dist < bestDist) { best = key; bestDist = dist; }
    }
  }
  return best;
}

// Time zones south of (or on) the equator, where seasons are reversed. Matching the device's zone
// avoids asking the user for their hemisphere and needs no location permission.
const SOUTHERN_TZ = new RegExp('^(' + [
  'Australia/', 'Antarctica/',
  'Pacific/(Auckland|Chatham|Fiji|Tongatapu|Apia|Tahiti|Noumea|Efate|Port_Moresby|Bougainville|Guadalcanal|'
    + 'Rarotonga|Niue|Norfolk|Pago_Pago|Fakaofo|Funafuti|Wallis|Marquesas|Gambier|Pitcairn|Easter|Galapagos)$',
  'America/(Argentina/|Buenos_Aires|Santiago|Punta_Arenas|Sao_Paulo|Montevideo|Asuncion|La_Paz|Lima|Guayaquil|'
    + 'Bahia|Recife|Fortaleza|Maceio|Belem|Araguaina|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Eirunepe|'
    + 'Manaus|Noronha|Santarem)',
  'Africa/(Johannesburg|Maputo|Harare|Lusaka|Lubumbashi|Windhoek|Gaborone|Maseru|Mbabane|Blantyre|Luanda|'
    + 'Dar_es_Salaam|Kinshasa|Brazzaville|Bujumbura|Kigali|Nairobi)$',
  'Indian/(Antananarivo|Mauritius|Reunion|Mayotte|Comoro|Kerguelen|Chagos|Cocos|Christmas|Mahe)$',
  'Asia/(Jakarta|Makassar|Jayapura|Dili)$',
  'Atlantic/(St_Helena|South_Georgia|Stanley)$',
].join('|') + ')');

export function hemisphereForTz(tz) {
  return SOUTHERN_TZ.test(tz) ? 'south' : 'north';
}

// Meteorological seasons by month index (0 = January), Northern Hemisphere.
const NORTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
const FLIP = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };

export function detectSeason(now, hemisphere) {
  const s = NORTH[new Date(now).getMonth()];
  return hemisphere === 'south' ? FLIP[s] : s;
}
