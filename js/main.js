// Entry point: wires the store, the model and the views together.
import { $, DAY_MS, debounce } from './lib/util.js';
import { deviceTimeZone, localDateStr } from './lib/time.js';
import { locationForTz, migrateKey, parseLoc } from './data/locations.js';
import { store, setTrip, resetTrip, saveTripNow, nightsFor } from './state.js';
import { buildPlan, tripSignature } from './core/model.js';
import { detectHoliday, detectSeason, hemisphereForTz } from './core/calendar.js';
import { setupForm, writeForm } from './ui/form.js';
import { renderHints, renderSummary, renderDays } from './ui/plan-view.js';
import { renderFlight, renderWater, renderRecovery } from './ui/panes.js';
import { setupTabs } from './ui/tabs.js';
import { setupCheckin } from './ui/checkin.js';
import { exportIcs } from './ui/ics.js';
import { setupAppearance } from './ui/appearance.js';
import { setupLegal } from './ui/legal.js';
import { setupToTop } from './ui/to-top.js';
import { setupInstall } from './ui/install.js';
import { setupPwa } from './pwa.js';

const deviceTz = deviceTimeZone();
let plan = null;

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
  $('#ics-btn').addEventListener('click', () => plan && exportIcs(plan));

  setupCheckin({ getPlan: () => plan, onChange: render });
  setupTabs();
  setupAppearance();
  setupLegal();
  setupToTop();
  setupPwa();
  setupInstall();
  render();
}

// Expose pure functions for testing from a console or headless browser.
window.ATC = { buildPlan, detectHoliday, detectSeason, hemisphereForTz };

init(); // module scripts run after the document is parsed
