// Entry point: wires the store, the model and the views together.
import { $, DAY_MS, debounce } from './lib/util.js';
import { deviceTimeZone, localDateStr } from './lib/time.js';
import { cityForTz, locKey } from './data/cities.js';
import { store, setTrip, resetTrip, saveTripNow, nightsFor } from './state.js';
import { buildPlan, tripSignature } from './core/model.js';
import { detectHoliday, detectSeason } from './core/calendar.js';
import { setupForm, writeForm } from './ui/form.js';
import { renderHints, renderSummary, renderDays } from './ui/plan-view.js';
import { renderFlight, renderWater, renderRecovery } from './ui/panes.js';
import { setupTabs } from './ui/tabs.js';
import { setupCheckin } from './ui/checkin.js';
import { exportIcs } from './ui/ics.js';
import { setupAppearance } from './ui/appearance.js';
import { setupLegal } from './ui/legal.js';
import { setupPwa } from './pwa.js';

const deviceTz = deviceTimeZone();
let plan = null;

/** Fill in trip fields that depend on the device: home city, a sensible destination and a date. */
function fillDeviceDefaults() {
  const t = store.trip;
  const patch = {};
  if (!t.home) {
    const city = cityForTz(deviceTz);
    patch.home = city ? city.key : locKey('Your time zone', deviceTz);
  }
  if (!t.dest) {
    const homeKey = patch.home || t.home;
    patch.dest = homeKey.includes('|America/') ? 'London|Europe/London' : 'New York|America/New_York';
    if (patch.dest === homeKey) patch.dest = 'Tokyo|Asia/Tokyo';
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

  const renderSoon = debounce(render, 60);
  setupForm({ deviceTz, onChange: renderSoon });
  writeForm();

  $('#reset-btn').addEventListener('click', () => {
    resetTrip();
    fillDeviceDefaults();
    saveTripNow();
    writeForm();
    render();
  });
  $('#ics-btn').addEventListener('click', () => plan && exportIcs(plan));
  $('#print-btn').addEventListener('click', () => window.print());

  setupCheckin({ getPlan: () => plan, onChange: render });
  setupTabs();
  setupAppearance();
  setupLegal();
  setupPwa();
  render();
}

// Expose pure functions for testing from a console or headless browser.
window.ATC = { buildPlan, detectHoliday, detectSeason };

init(); // module scripts run after the document is parsed
