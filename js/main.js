// Entry point: wires the store, the model and the views together.
import { $, DAY_MS, debounce, esc } from './lib/util.js';
import { deviceTimeZone, localDateStr } from './lib/time.js';
import { devicePrefs } from './lib/locale.js';
import { locationForTz, migrateKey, parseLoc } from './data/locations.js';
import { store, setTrip, resetTrip, saveTripNow, nightsFor } from './state.js';
import { buildPlan, buildReturnPlan, tripSignature, returnSignature } from './core/model.js';
import { detectHoliday, detectSeason, hemisphereForTz } from './core/calendar.js';
import { setupForm, writeForm } from './ui/form.js';
import { renderHints, renderSummary, renderDays } from './ui/plan-view.js';
import { renderFlight, renderWater, renderRecovery } from './ui/panes.js';
import { setupTabs, setTabVisible } from './ui/tabs.js';
import { fmtDate, fmtTime } from './ui/format.js';
import { setupCheckin } from './ui/checkin.js';
import { setupCalendarMenu } from './ui/calendar-menu.js';
import { setupAppearance } from './ui/appearance.js';
import { setupTravelTools } from './ui/travel-tools.js';
import { setupLegal } from './ui/legal.js';
import { setupToTop } from './ui/to-top.js';
import { setupInstall } from './ui/install.js';
import { setupPwa } from './pwa.js';
import { renderToday } from './ui/today.js';

const deviceTz = deviceTimeZone();
let plan = null;
let back = null; // return plan (Preview), or null when no return is planned

/** Fill in trip fields that depend on the device: home city, a sensible destination and a date. */
function fillDeviceDefaults() {
  const t = store.trip;
  const patch = {};
  // Upgrade "City|Zone" keys saved by earlier versions to airport keys.
  for (const field of ['home', 'dest']) {
    const upgraded = migrateKey(t[field]);
    if (upgraded !== t[field]) patch[field] = upgraded;
  }
  if (!t.home) patch.home = locationForTz(deviceTz).key;
  if (!t.dest) {
    const home = parseLoc(patch.home || t.home);
    patch.dest = home.tz.startsWith('America/') ? 'code:LHR' : 'code:JFK';
    if (parseLoc(patch.dest).tz === home.tz) patch.dest = 'code:HND';
  }
  if (!t.depDate) patch.depDate = localDateStr(deviceTz, Date.now() + 7 * DAY_MS);
  // Body weight starts in the device's unit: 154 lb in the US, 70 kg elsewhere.
  if (!t.weightUnit || !t.weight) {
    const lb = devicePrefs().imperial;
    patch.weightUnit = lb ? 'lb' : 'kg';
    patch.weight = lb ? 154 : 70;
  }
  if (Object.keys(patch).length) setTrip(patch);
}

function render() {
  try {
    plan = buildPlan(store.trip, nightsFor(tripSignature(store.trip)));
  } catch (err) {
    console.error(err);
    return;
  }
  renderHints(plan);
  renderSummary(plan);
  renderDays(plan);
  renderFlight(plan);
  renderWater(plan);
  renderRecovery(plan);
  renderReturn();
  renderToday(plan, back);
}

/** Return trip (Preview): its own tab, built from where the outbound plan leaves the body clock. */
function renderReturn() {

  try { back = buildReturnPlan(store.trip, plan, nightsFor(returnSignature(store.trip), 'return')); } catch (err) { console.error(err); back = { error: 'This return trip could not be planned.' }; }
  setTabVisible('tab-return', !!back);
  const hint = $('#ret-hint');
  if (!back) { hint.textContent = ''; return; }
  if (back.error) {
    hint.textContent = back.error;
    $('#ret-summary').innerHTML = `<p>${esc(back.error)}</p>`;
    $('#ret-days').innerHTML = '';
    return;
  }
  hint.innerHTML = `Lands <strong>${esc(fmtDate(back.arrDate))} at ${fmtTime(back.arrHour)}</strong> ${esc(back.dest.name)} time. See the Return tab.`;
  renderSummary(back, '#ret-summary');
  renderDays(back, '#ret-days');
}

function init() {
  $('#year').textContent = new Date().getFullYear();
  fillDeviceDefaults();
  saveTripNow(); // persist upgraded or newly filled defaults immediately

  const renderSoon = debounce(render, 60);
  setupForm({ onChange: renderSoon });
  writeForm();

  $('#reset-btn').addEventListener('click', () => {
    resetTrip();
    fillDeviceDefaults();
    saveTripNow();
    writeForm();
    render();
  });
  setupCalendarMenu(() => ({ plan, back }));

  setupCheckin({ getPlan: (leg) => (leg === 'return' ? back : plan), onChange: render });
  setupTabs();
  setupAppearance();
  setupTravelTools();
  setupLegal();
  setupToTop();
  setupPwa();
  // Keep the Today card current: every minute, and whenever the app comes back to the screen.
  setInterval(() => renderToday(plan, back), 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') renderToday(plan, back); });
  setupInstall();
  render();
}

// Expose pure functions for testing from a console or headless browser.
window.ATC = { buildPlan, detectHoliday, detectSeason, hemisphereForTz };

init(); // module scripts run after the document is parsed
