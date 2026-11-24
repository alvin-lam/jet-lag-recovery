// Location lookup and search over airports worldwide, plus any IANA time zone as a fallback.
//
// A trip stores a location as a short key:
//   "code:LHR"            an airport (curated list first, then the generated world list)
//   "tz:Europe/London"    a bare time zone (for places without a listed airport)
// Keys saved by earlier versions ("London|Europe/London") are still understood.
import { AIRPORTS } from './airports.js';
import { WORLD_AIRPORTS } from './airports-world.js';
import { allTimeZones, tzOffset, fmtOffset } from '../lib/time.js';

/** Lowercase and strip accents so "sao" matches "São" and "zurich" matches "Zürich". */
// Letters that do not decompose into a base letter plus an accent are mapped by hand ("tromso" finds Tromsø).
const FOLD = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i', ħ: 'h' };
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[øæœßłđðþıħ]/g, (c) => FOLD[c]);
const words = (s) => s.split(/[^a-z0-9]+/).filter(Boolean);
const tzCity = (tz) => tz.split('/').pop().replace(/_/g, ' ');

function makeAirport([code, city, country, tz, airport, aliases = '']) {
  return { key: 'code:' + code, code, name: city, city, country, tz, airport, aliases, label: `${city} (${code})` };
}

// The world list stores ISO country codes to stay small; the browser supplies English names.
let regionNames = null;
function countryName(cc) {
  try {
    regionNames ||= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(cc) || cc;
  } catch {
    return cc;
  }
}

function parseWorld(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [code, city, cc, tz, airport] = line.split('|');
    out.push(makeAirport([code, city, countryName(cc), tz, airport]));
  }
  return out;
}

// Curated airports come first, then large airports, then medium ones, so search ties rank the
// best-known airport first.
export const LOCATIONS = AIRPORTS.map(makeAirport).concat(parseWorld(WORLD_AIRPORTS));

// Search fields are built on the first search, not at load time, so startup stays fast.
let indexed = false;
function ensureIndex() {
  if (indexed) return;
  for (const l of LOCATIONS) {
    const aliases = l.aliases || '';
    l.s = {
      code: l.code.toLowerCase(),
      aliasCodes: new Set(aliases.split(' ').filter((a) => /^[A-Z]{3}$/.test(a)).map((a) => a.toLowerCase())),
      aliasWords: new Set(words(norm(aliases))),
      city: norm(l.city), cityWords: words(norm(l.city)),
      other: norm(`${l.airport} ${aliases} ${l.country}`), otherWords: words(norm(`${l.airport} ${aliases}`)),
      country: norm(l.country),
      airport: norm(l.airport),
    };
  }
  indexed = true;
}
const BY_KEY = new Map(LOCATIONS.map((l) => [l.key, l]));
const BY_TZ = new Map();
for (const l of LOCATIONS) {
  if (!BY_TZ.has(l.tz)) BY_TZ.set(l.tz, []);
  BY_TZ.get(l.tz).push(l);
}

/**
 * A place with no listed airport, identified by its time zone. Its label shows the zone's current
 * UTC offset in place of an airport code, for example "Pago Pago (UTC−11)". The offset is read
 * when the label is shown, so it stays right across daylight saving changes.
 */
function zoneLocation(tz, name) {
  const fixed = /^(UTC|GMT|Etc\/)/.test(tz); // zones with no city, such as UTC or Etc/GMT+5
  const offset = () => fmtOffset(tzOffset(tz, Date.now()));
  const isUtc = /^(UTC|GMT|Etc\/(UTC|GMT|Universal|Zulu))$/.test(tz);
  const city = name || (isUtc ? 'UTC' : fixed ? offset() : tzCity(tz));
  return {
    key: 'tz:' + tz, code: '', name: city, city, tz,
    country: tz.includes('/') ? tz.split('/')[0].replace(/_/g, ' ') : 'Coordinated Universal Time',
    airport: 'No nearby airport listed',
    zoneName: tz.replace(/_/g, ' '),
    get offset() { return offset(); },
    get label() { return fixed && !name ? city : `${city} (${offset()})`; },
  };
}

/** Turn a stored key into a location object. Results are cached because this runs on every render. */
const cache = new Map();
export function parseLoc(key) {
  let loc = cache.get(key);
  if (loc) return loc;
  if (BY_KEY.has(key)) loc = BY_KEY.get(key);
  else if (key.startsWith('tz:')) loc = zoneLocation(key.slice(3));
  else if (key.includes('|')) {
    // Legacy "Name|Zone" key: prefer the matching airport so the label stays familiar.
    const i = key.lastIndexOf('|');
    const name = key.slice(0, i), tz = key.slice(i + 1);
    loc = (BY_TZ.get(tz) || []).find((l) => l.city === name) || zoneLocation(tz, name);
  } else {
    loc = zoneLocation('UTC');
  }
  cache.set(key, loc);
  return loc;
}

/** Upgrade a legacy key to the current format. */
export const migrateKey = (key) => (key && key.includes('|') ? parseLoc(key).key : key);

/** Best location for a device time zone: an airport in a city named after the zone, any airport in it, or the zone itself. */
export function locationForTz(tz) {
  const list = BY_TZ.get(tz);
  if (!list) return zoneLocation(tz);
  return list.find((l) => l.city === tzCity(tz)) || list[0];
}

// Time zone entries are only built the first time a search needs them.
// UTC is added by hand because some browsers leave it out of their time zone list.
let zoneIndex = null;
function zones() {
  if (!zoneIndex) {
    const list = allTimeZones();
    if (!list.includes('UTC')) list.push('UTC');
    zoneIndex = list.map((tz) => ({ loc: zoneLocation(tz), s: norm(tz.replace(/_/g, ' ')), city: norm(tzCity(tz)) }));
  }
  return zoneIndex;
}

function score(l, q) {
  const s = l.s;
  if (q.length === 3 && s.code === q) return 100;
  if (q.length === 3 && s.aliasCodes.has(q)) return 90;
  if (s.city === q) return 85;
  if (q.length >= 4 && s.aliasWords.has(q)) return 84; // curated alias such as "bali" or "bombay"
  if (s.city.startsWith(q)) return 80;
  if (s.airport.startsWith(q)) return 72; // airport named after the city, e.g. "London Luton"
  if (s.cityWords.some((w) => w.startsWith(q))) return 70;
  if (s.otherWords.includes(q)) return 65; // whole-word alias or airport name, e.g. "bali", "heathrow"
  if (s.otherWords.some((w) => w.startsWith(q))) return 60;
  if (s.country.startsWith(q)) return 45;
  if (s.city.includes(q) || s.other.includes(q)) return 30;
  return 0;
}

/** Ranked search by airport code, city, airport name, alias or country, with time zones as a fallback. */
export function searchLocations(query, limit = 8) {
  const q = norm(query.trim());
  if (!q) return [];
  ensureIndex();
  const hits = [];
  LOCATIONS.forEach((l, i) => {
    const sc = score(l, q);
    if (sc) hits.push({ l, sc, i });
  });
  hits.sort((a, b) => b.sc - a.sc || a.i - b.i);
  const out = hits.slice(0, limit).map((h) => h.l);
  if (out.length < limit && q.length >= 3) {
    // Zones whose city starts with the query rank above zones that merely contain it,
    // so "pago" lists Pago Pago before Galapagos.
    const seen = new Set(out.map((l) => l.tz));
    const matches = zones().filter((z) => z.s.includes(q) && !seen.has(z.loc.tz))
      .map((z) => ({ z, rank: z.city.startsWith(q) ? 0 : 1 }))
      .sort((a, b) => a.rank - b.rank);
    for (const { z } of matches.slice(0, limit - out.length)) out.push(z.loc);
  }
  return out;
}
