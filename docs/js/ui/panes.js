// The "On the flight", "Hydration" and "Recovery" tabs.
import { $, esc, clamp } from '../lib/util.js';
import { store } from '../state.js';
import { MODEL } from '../config.js';
import { fmtTime, fmtRange, fmtDur, fmtVol, fmtVolShort, fmtDate } from './format.js';

const card = (title, body) => `<section class="panel info"><h3>${title}</h3>${body}</section>`;
const list = (items) => '<ul>' + items.map((i) => `<li>${i}</li>`).join('') + '</ul>';
const NOT_ADVICE = '<p class="hint">General information only, not health advice. See the disclaimer below.</p>';

export function renderFlight(p) {
  const f = p.flight;
  $('#pane-flight').innerHTML = `<div class="info-grid">
    ${card('😴 Sleep', (f.sleep
      ? `<p>Sleep from <strong>${fmtRange(f.sleep.start, f.sleep.end)}</strong> destination time. That is ${fmtDur(f.sleep.len)} of the ${fmtDur(f.durH)} flight.</p>`
      : '<p>It is daytime at your destination for the whole flight. <strong>Stay awake</strong> so you are tired at bedtime after landing.</p>')
      + list([
        'Bring an eye mask, earplugs or noise-canceling headphones, and a neck pillow.',
        'Choose a window seat if you plan to sleep, so you are not disturbed.',
        'Do not take sleeping pills or other sleep aids unless a doctor has approved them for you.',
      ]))}
    ${card('💧 Water', `<p class="big-num">${fmtVolShort(f.waterMl)}</p>
      <p>Cabin air is very dry. A common rule of thumb is about ${fmtVolShort(MODEL.glassMl)} for each hour you are awake on board.</p>`
      + list(['Bring an empty bottle through security and fill it at the gate.', 'Limit alcohol. It dehydrates you and fragments sleep.']))}
    ${card('☕ Caffeine', f.sleep
      ? `<p>Have no caffeine after <strong>${fmtTime(f.caffCutoff)}</strong> destination time so you can sleep on board.</p>`
      : `<p>A coffee or tea can help you stay awake. Stop by <strong>${fmtTime(p.days[0].caff.cutoff)}</strong> destination time.</p>`)}
    ${card('🍽️ Meals and movement', list([
      'Eat on destination time. Skip a meal if it falls in your sleep window.',
      'Walk the aisle and flex your ankles every hour or two while awake.',
      'If you are at risk of blood clots, ask a doctor about compression socks and other precautions for long flights.',
    ]))}
  </div>${NOT_ADVICE}`;
}

const LABELS = {
  activity: { low: 'light', moderate: 'moderate', high: 'high' },
  climate: { cool: 'cool', temperate: 'mild', hot: 'hot' },
};

export function renderWater(p) {
  const t = store.trip;
  const full = p.days[1] || p.days[0]; // a full day, not the partial arrival day
  const w = full.water;
  const alcohol = Number(t.alcohol);
  const drinks = alcohol ? `${alcohol} alcoholic drink${alcohol > 1 ? 's' : ''} a day` : '';
  const basis = p.weightKg
    ? `An estimate based on ${Math.round(t.weightUnit === 'lb' ? p.weightKg / 0.4536 : p.weightKg)} ${esc(t.weightUnit)} body weight, ${LABELS.activity[t.activity]} activity, a ${LABELS.climate[t.climate]} climate${drinks ? ', and ' + drinks : ''}.`
    : `A standard estimate for adults${drinks ? ', plus extra for ' + drinks : ''}. Drink more if it is hot or you are active, or personalize it in the form under "Personalize my water target."`;
  const rows = p.days.map((d) => `<tr><td>${esc(fmtDate(d.date))}</td><td>${fmtVolShort(d.water.base)}</td>
    <td>${d.water.flight ? fmtVolShort(d.water.flight) : '—'}</td><td><strong>${fmtVol(d.water.base + d.water.flight)}</strong></td></tr>`).join('');

  $('#pane-water').innerHTML = `<div class="info-grid">
    ${card('💧 Daily target', `<p class="big-num">${fmtVol(w.base)}</p>
      <div class="water-bar" aria-hidden="true"><i data-style="width:${clamp((w.base / 5000) * 100, 5, 100)}%"></i></div>
      <p>About <strong>${w.glasses} glasses</strong> of ${fmtVolShort(MODEL.glassMl)} each, from all drinks and water-rich foods.</p>
      <p class="hint">${basis} People with heart or kidney conditions, or on fluid limits, should follow their doctor's guidance instead.</p>`)}
    ${card('⏰ Suggested times on a full day', `<p>${w.times.slice(0, 12).map(fmtTime).join(', ')}</p>
      <p class="hint">Front-load water in the morning and slow down 90 minutes before bed so you are not woken up.</p>`)}
    ${card('✅ Am I hydrated?', list([
      'Pale straw-colored urine is a common sign of good hydration.',
      'Headache, dry mouth, or dark urine can mean you need more.',
      'An electrolyte drink can help after long flights or in hot weather.',
      'For each alcoholic drink, add a glass of water.',
    ]))}
  </div>
  ${card('📅 Day by day', `<p class="hint">The arrival day is scaled to the hours you are awake after landing.</p>
    <div class="table-wrap"><table class="water"><thead><tr><th>Day</th><th>Base</th><th>Flight</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`)}${NOT_ADVICE}`;
}

export function renderRecovery(p) {
  const east = p.sign > 0;
  $('#pane-recovery').innerHTML = `<div class="info-grid">
    ${card('☀️ Light', '<p>Light is the strongest signal for your body clock. Follow the yellow and striped bars in the daily plan.</p>'
      + list(['Outdoor daylight is far brighter than indoor light.', 'A light therapy lamp can help on cloudy days.', 'Use sunglasses to block light when the plan says to avoid it.']))}
    ${card('🏃 Movement', `<p>${east
      ? 'Exercise outdoors in the morning. Morning activity and light help pull your clock earlier.'
      : 'Exercise in the late afternoon or early evening. It helps you stay up later.'}</p>`
      + list(['A 20 to 30 minute walk counts.', 'Skip intense workouts within 2 hours of bedtime.']))}
    ${card('🍽️ Meals', `<p>${east
      ? 'Eat breakfast soon after waking. Keep dinner lighter and finish 2 to 3 hours before bed.'
      : 'Eat dinner on local time and avoid a large breakfast before your body is hungry.'}</p>`
      + list(['Switch to local mealtimes as soon as you land.', 'Avoid heavy, spicy, or fatty food late at night.']))}
    ${card('💤 Naps', list(['Keep naps to 20 to 30 minutes.', 'Finish napping at least 8 hours before bedtime.']))}
    ${card('💊 Melatonin', `<p>${east
      ? 'Some travelers use low-dose melatonin near local bedtime for the first few nights after flying east.'
      : 'Melatonin is usually considered unnecessary when flying west. Bright evening light does most of the work.'}</p>
      <p class="hint"><strong>Talk to a doctor or pharmacist before using melatonin or any supplement.</strong> It can interact with medications and is not suitable for everyone, including people who are pregnant or breastfeeding.</p>`)}
    ${card('🛏️ Sleep setting', list(['Keep the room cool and dark.', 'Put devices away 30 to 60 minutes before bed, or use night mode.', 'If you cannot sleep after 20 minutes, get up and read in dim light.']))}
    ${card('🍷 Alcohol', '<p>Alcohol makes you drowsy but breaks up deep sleep and dehydrates you. Keep it light during the first few days.</p>')}
    ${card('🧳 Frequent flyer habits', list(['Flights that land in the late afternoon make eastward trips easier.', 'For trips of 2 days or less, consider staying on home time.', 'Log your sleep each morning. The plan adapts to how you actually slept.']))}
  </div>
  <p class="hint">Seek medical care if you have chest pain, shortness of breath, leg swelling or pain, confusion, or symptoms that do not improve after travel.</p>${NOT_ADVICE}`;
}
