# All Trip Considered

A progressive web app (PWA) that helps frequent flyers recover from jet lag. Enter your flight and normal sleep pattern, and it builds a day-by-day plan for sleep, light, caffeine, and hydration.

> **Not health advice.** All Trip Considered provides general information for educational purposes only. It is not medical, health, or nutritional advice and does not replace a qualified health professional. The app is provided "as is," without warranties, and its creators are not liable for any damages arising from its use. See [Disclaimer](#disclaimer).

## Features

- **Interactive trip input:** pick departure and arrival cities (or any time zone), flight time, trip length, and your usual bedtime, wake time, and chronotype.
- **Adaptive daily plan:** each day gets a 24-hour timeline showing sleep, when to seek or avoid bright light, the caffeine window, and water reminders.
- **Sleep check-ins:** log how you actually slept. The rest of the plan shifts to match your real progress.
- **Adjustable output:** choose a strategy (gradual, immediate, or stay on home time), pre-adjust up to 3 days before departure, and set the adjustment pace.
- **Hydration estimates:** a daily water estimate based on weight, activity, climate, and alcohol, plus in-flight intake. Metric or imperial.
- **Recovery methods:** light, movement, meals, naps, and sleep setting tips tailored to your direction of travel.
- **Calendar export** (`.ics`) and print.
- **Appearance menu:** light, dark, or system mode; seasonal themes with hemisphere support; automatic or manual holiday themes; and decoration controls.
- **Installable and offline:** works without a connection after the first visit.
- **Private:** all data stays in the browser's local storage on your device.

## Health and liability notices in the app

- A disclaimer dialog appears on first visit and must be acknowledged before use. It reappears if `DISCLAIMER_VERSION` in `js/config.js` is increased.
- A "Not health advice" notice sits above every plan.
- The Flight, Hydration, and Recovery tabs each end with a not-advice reminder.
- The footer states the app is not health advice, is provided as is, and links to the full disclaimer and limitation of liability.
- Exported calendar events carry a not-advice note.

## Project structure

```
index.html               Page markup, dialogs (disclaimer, sleep check-in, appearance)
manifest.webmanifest     Install metadata
sw.js                    Service worker (offline cache)
css/
  styles.css             Theme tokens, season and holiday palettes, layout, decorations
assets/icons/            App icons (SVG source and generated PNGs)
js/
  main.js                Entry point: wires state, model, and views
  config.js              Defaults, storage keys, and all model constants
  state.js               The single store for trip, sleep logs, and appearance
  pwa.js                 Service worker registration and install button
  data/
    cities.js            City list with O(1) lookup maps
    themes.js            Holiday and season names, emoji, and lunisolar dates
  lib/
    util.js              Small shared helpers
    storage.js           Guarded localStorage access
    time.js              Time zone math (DST aware, uses Intl)
    intervals.js         24-hour interval math
  core/
    model.js             The jet lag plan model (pure functions)
    calendar.js          Season and holiday detection (pure functions)
  ui/
    form.js              Trip form
    plan-view.js         Summary and daily plan cards
    panes.js             Flight, Hydration, and Recovery tabs
    timeline.js          24-hour timeline bars
    format.js            Time, duration, and volume formatting
    checkin.js           Sleep log dialog
    appearance.js        Appearance menu and decorations
    legal.js             Disclaimer dialog
    tabs.js, dialog.js, ics.js
```

### Data design

- **One store.** `js/state.js` owns everything that is saved. Saved data is filtered to known keys on load, and trip writes are debounced.
- **Pure model.** `core/model.js` takes plain inputs and returns a plan object. It never touches the page, so it is easy to test.
- **Indexed lookups.** Cities are indexed by key and by time zone in `Map`s. Parsed locations, `Intl` formatters, and yearly holiday dates are cached.
- **Exact interval math.** Light windows are clipped against sleep with interval subtraction rather than sampling.
- **Constants in one place.** Shift rates, caffeine limits, and hydration factors live in `MODEL` in `js/config.js`.
- **Per-trip sleep logs.** Logs are keyed by a trip signature, so changing the trip never applies old logs to a new plan.

## How the plan works

The model tracks how far your body clock has shifted toward destination time. It assumes about 1 hour per day when advancing (flying east) and 1.5 hours per day when delaying (flying west), adjusted for chronotype and the pace you choose. For very large gaps it picks the shorter direction around the clock. Light advice is timed around the core body temperature minimum, about 3 hours before your body's natural wake time. These are simplified population averages, and individual responses vary.

## Run locally

No build step or dependencies. Serve the folder over HTTP, because ES modules and the service worker do not load from `file://`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

When you change any cached file, bump `CACHE` in `sw.js` so installed copies update.

## Deploy

Any static host works, including GitHub Pages. Publish the repository root.

## Disclaimer

All Trip Considered and its content are for general informational and educational purposes only. Nothing in the app is medical, health, nutritional, or professional advice, and using it does not create a doctor and patient relationship. Always consult a qualified health professional before changing your sleep schedule, caffeine or fluid intake, or before taking melatonin or any other supplement or medication. The app is not for emergencies.

The app is provided "as is" and "as available," without warranties of any kind, express or implied. To the fullest extent permitted by law, All Trip Considered and its creators, contributors, and affiliates are not liable for any direct, indirect, incidental, special, consequential, or punitive damages, or for any injury, illness, loss, or cost, arising from or related to use of, or reliance on, the app or its content. You use the app at your own risk.

© All Trip Considered. All rights reserved.
