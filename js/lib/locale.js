// Device preferences read from the browser's locale settings, used as defaults for time and units.
// Dates are formatted with the device locale directly (see ui/format.js).

let cached = null;

export function devicePrefs() {
  if (cached) return cached;
  let hour12 = false;
  let region = '';
  try {
    // The device's hour cycle: h11 and h12 mean a 12-hour clock.
    const o = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    hour12 = typeof o.hour12 === 'boolean' ? o.hour12 : /h1[12]/.test(o.hourCycle || '');
  } catch { /* keep 24-hour */ }
  try {
    const lang = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    region = new Intl.Locale(lang).maximize().region || '';
  } catch { /* unknown region */ }
  // Regions that use US customary units day to day (the US and its territories, Liberia, Myanmar).
  const imperial = /^(US|PR|GU|VI|AS|MP|UM|LR|MM)$/.test(region);
  // Dates follow the device region's conventions (day and month order) but stay in English to match
  // the rest of the app: a German device gets "Tue 1 Dec", not "Di., 1. Dez.".
  let dateLocale = 'en';
  try {
    const lang = navigator.language || 'en';
    const candidate = /^en\b/i.test(lang) ? lang : region ? 'en-' + region : 'en';
    dateLocale = Intl.DateTimeFormat.supportedLocalesOf([candidate])[0] || 'en';
  } catch { /* plain English */ }
  cached = { hour12, imperial, region, dateLocale };
  return cached;
}
