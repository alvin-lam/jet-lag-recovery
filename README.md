# Jet Lag & Recovery

By All Trips Considered. Its short name, **Jet Lag**, is used for home screen labels. A progressive web app (PWA) that helps frequent flyers recover from jet lag. Enter your flight and normal sleep pattern, and it builds a day-by-day plan for sleep, light, caffeine, and hydration.

> **Not health advice.** Jet Lag & Recovery provides general information for educational purposes only. It is not medical, health, or nutritional advice and does not replace a qualified health professional. The app is provided "as is," without warranties, and its creators are not liable for any damages arising from its use. See [Disclaimer](#disclaimer).

## Features

- **Location search:** type a city, airport name, IATA code (`LHR`), metro code (`NYC`, `LON`), former name (`Bombay`, `Saigon`), or country. About 3,100 airports are built in: 230 hand-picked major airports with friendly names and aliases, plus every other large or mid-sized airport with scheduled passenger flights worldwide. Accents and special letters are optional ("tromso" finds Tromsø). Places without a listed airport fall back to their time zone and show its UTC offset in place of a code, for example "Pago Pago (UTC−11)". Fully keyboard and screen reader accessible.
- **Interactive trip input:** flight time, trip length, and your usual bedtime, wake time, and chronotype.
- **Adaptive daily plan:** each day gets a 24-hour timeline showing sleep, when to seek or avoid bright light, the caffeine window, and water reminders.
- **Sleep check-ins:** log how you actually slept. The rest of the plan shifts to match your real progress.
- **Return trip planning (Preview):** add a return flight to get a plan for coming home. It starts from where your body clock is on the return day, so a fully adjusted trip reverses the whole shift, a short trip only undoes part of it, and a trip kept on home time needs little recovery. Sleep logs and calendar export work for both legs.
- **Adjustable output:** choose a strategy (gradual, immediate, or stay on home time), pre-adjust up to 3 days before departure, and set the adjustment pace.
- **Hydration estimates:** a daily water estimate based on weight, activity, climate, and alcohol, plus in-flight intake. Metric or imperial.
- **Recovery methods:** light, movement, meals, naps, and sleep setting tips tailored to your direction of travel.
- **Calendar export** (`.ics`).
- **Device defaults:** the clock (12- or 24-hour), water units, and body weight unit follow the device's region settings, for example 12-hour, ounces, and pounds in the US, and 24-hour, liters, and kilograms in most other places. Dates use the region's date order in English ("Wed, Dec 2" in the US, "Tue 1 Dec" in the UK). The Clock and Water units menus offer "Device setting" plus fixed choices, and Reset returns to the device defaults.
- **Appearance menu** (palette icon in the header): light, dark, or system mode, plus season and holiday themes chosen from rows of emoji icons (✨ Automatic, each theme such as Winter ❄️ or Pride Month 🏳️‍🌈, and 🚫 None). Hovering shows each name, and the current choice is named above each row. Pride Month runs through June. The hemisphere for seasons comes from the device time zone, and US-only holidays appear automatically only in US time zones.
- **Automatic decorations:** holidays get a garland, falling decorations, and corner accents; seasons get a lighter set. Setting both season and holiday to None turns decorations off. Animation stops when the device asks for reduced motion.
- **Back to top** button in the lower right once you scroll past the header.
- **Installable and offline:** works without a connection after the first visit. Browsers with an install prompt (Chrome, Edge, Samsung Internet) get a one-tap Install button. Where there is no prompt, a reminder explains how to add the app: Share, then Add to Home Screen on iPhone and iPad; the browser menu on Android. Desktop browsers without an install prompt, such as Safari on a Mac, show no install icon or reminder. The reminder waits until the disclaimer is accepted, can be dismissed for 14 days, and never appears once the app is installed. A download icon in the header reopens it.
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
robots.txt               Lets search engines crawl the site and points to the sitemap
sitemap.xml              Page list for search engines
css/
  styles.css             Theme tokens, season and holiday palettes, layout, decorations
assets/icons/            App icons (SVG source and generated PNGs)
assets/og-image.jpg      1200×630 preview image for shared links
assets/fonts/            Instrument Serif for the title and copyright (SIL Open Font License, see OFL.txt)
js/
  main.js                Entry point: wires state, model, and views
  config.js              Defaults, storage keys, and all model constants
  state.js               The single store for trip, sleep logs, and appearance
  pwa.js                 Service worker registration and install button
  data/
    airports.js          Hand-picked major airports: code, city, country, time zone, aliases
    airports-world.js    Generated list of other airports with scheduled flights (see tools/)
    locations.js         Location keys, lookups, and ranked search index
    themes.js            Holiday and season names, emoji, and lunisolar dates
  lib/
    util.js              Small shared helpers
    locale.js            Device clock, measurement system and date style
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
    to-top.js            Back to top button
    location-picker.js   Search box (combobox) for departure and arrival
    install.js           Install button, Add to Home Screen reminder and steps
    tabs.js, dialog.js, ics.js
```

### Data design

- **One store.** `js/state.js` owns everything that is saved. Saved data is filtered to known keys on load, and trip writes are debounced.
- **Pure model.** `core/model.js` takes plain inputs and returns a plan object. It never touches the page, so it is easy to test.
- **Indexed lookups.** Airports are indexed by key and by time zone in `Map`s, and normalized search fields are built once at load time. Parsed locations, `Intl` formatters, and yearly holiday dates are cached.
- **Exact interval math.** Light windows are clipped against sleep with interval subtraction rather than sampling.
- **Constants in one place.** Shift rates, caffeine limits, and hydration factors live in `MODEL` in `js/config.js`.
- **Per-trip sleep logs.** Logs are keyed by a trip signature, so changing the trip never applies old logs to a new plan.

## How the plan works

The model tracks how far your body clock has shifted toward destination time. It assumes about 1 hour per day when advancing (flying east) and 1.5 hours per day when delaying (flying west), adjusted for chronotype and the pace you choose. For very large gaps it picks the shorter direction around the clock. Light advice is timed around the core body temperature minimum, about 3 hours before your body's natural wake time. These are simplified population averages, and individual responses vary.

## Roadmap

Open work, in rough priority order. Check items off as they ship.

### 1. Features for frequent flyers

- [ ] **Return trips and connections.** Return planning is in Preview, with sleep logs and calendar export for both legs. Still to do: multi-leg trips with layovers.
- [ ] **Saved trips.** Keep several trips and switch between them.
- [ ] **Reminders.** Alert travelers when to seek light, stop caffeine, and go to bed. Reliable notifications likely need a small server; the calendar export covers part of this today.

### 2. Content and maintenance

- [ ] **Expert review.** Have a sleep specialist review the plan logic and wording.
- [ ] **Extend holiday dates before 2037.** Lunar New Year, Diwali, and Hanukkah dates are listed through 2036 in `js/data/themes.js`. Add the next ten years before then.

### Done

- [x] Airport coverage expanded to about 3,100 airports worldwide.
- [x] Search and sharing metadata: description, canonical URL, Open Graph and X (Twitter) link previews with a 1200×630 image, structured data, robots.txt, and sitemap.xml.
- [x] Brand name set to All Trips Considered, with links to alltripsconsidered.com.
- [x] Lunar New Year, Diwali, and Hanukkah dates extended through 2036.

## Updating the airport list

`js/data/airports-world.js` is generated. To rebuild it, download `airports.csv` from
[OurAirports](https://github.com/davidmegginson/ourairports-data) and `airports.json` from
[mwgg/Airports](https://github.com/mwgg/Airports), then run:

```sh
python3 tools/build-airports.py path/to/airports.csv path/to/airports.json
```

The script keeps airports with scheduled passenger service, skips codes already in the hand-picked
list, checks every time zone against the system time zone database, and reports any zone that looks
wrong for the airport's country or longitude. Fix those in `TZ_FIX` inside the script.

## Run locally

No build step or dependencies. Serve the folder over HTTP, because ES modules and the service worker do not load from `file://`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

When you change any cached file, bump `CACHE` in `sw.js` so installed copies update.

## Deploy

Any static host works, including GitHub Pages. Publish the repository root.

The site is served at `https://jetlag.alltripsconsidered.com/` (see `CNAME`). The canonical URL, Open Graph and X image URLs, structured data, `robots.txt`, and `sitemap.xml` all use that address, so update them together if the domain changes. Update `<lastmod>` in `sitemap.xml` when the page changes meaningfully.

## Data sources

- Airport codes, names, and locations: [OurAirports](https://ourairports.com/data/), public domain.
- Airport time zones: [mwgg/Airports](https://github.com/mwgg/Airports), MIT License, Copyright (c) 2014 mwgg.
  Zones that were wrong for the airport's country were corrected (see `TZ_FIX` in `tools/build-airports.py`).
- Title font: Instrument Serif, SIL Open Font License (see `assets/fonts/OFL.txt`).

## Disclaimer

Jet Lag & Recovery and its content are for general informational and educational purposes only. Nothing in the app is medical, health, nutritional, or professional advice, and using it does not create a doctor and patient relationship. Always consult a qualified health professional before changing your sleep schedule, caffeine or fluid intake, or before taking melatonin or any other supplement or medication. The app is not for emergencies.

The app is provided "as is" and "as available," without warranties of any kind, express or implied. To the fullest extent permitted by law, All Trips Considered and its creators, contributors, and affiliates are not liable for any direct, indirect, incidental, special, consequential, or punitive damages, or for any injury, illness, loss, or cost, arising from or related to use of, or reliance on, the app or its content. You use the app at your own risk.

© All Trips Considered. All rights reserved.
