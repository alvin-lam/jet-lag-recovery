// Curated city list grouped by region. Each entry is [display name, IANA time zone].
export const CITY_GROUPS = [
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

// A location is stored as a single "Name|Zone" key so a city and its zone travel together.
export const locKey = (name, tz) => name + '|' + tz;

// Indexes built once at load time, so lookups are O(1) instead of scanning the list.
export const CITY_BY_KEY = new Map();
export const CITIES_BY_TZ = new Map();
for (const [, list] of CITY_GROUPS) {
  for (const [name, tz] of list) {
    const city = { key: locKey(name, tz), name, tz };
    CITY_BY_KEY.set(city.key, city);
    if (!CITIES_BY_TZ.has(tz)) CITIES_BY_TZ.set(tz, []);
    CITIES_BY_TZ.get(tz).push(city);
  }
}

// Turn a stored key back into { name, tz }. Results are cached because this runs on every render.
const parsed = new Map();
export function parseLoc(key) {
  let loc = parsed.get(key);
  if (!loc) {
    const i = key.lastIndexOf('|');
    loc = { key, name: key.slice(0, i), tz: key.slice(i + 1) };
    parsed.set(key, loc);
  }
  return loc;
}

// Best city for a time zone: the one named after the zone (New York for America/New_York), else the first.
export function cityForTz(tz) {
  const list = CITIES_BY_TZ.get(tz);
  if (!list) return null;
  const zoneCity = tz.split('/').pop().replace(/_/g, ' ');
  return list.find((c) => c.name === zoneCity) || list[0];
}
