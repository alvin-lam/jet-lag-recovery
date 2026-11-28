# Jet Lag & Recovery

Jet Lag & Recovery is a progressive web app (PWA) by All Trips Considered that helps frequent flyers recover from jet lag. Enter your flight and normal sleep pattern, and it builds a day-by-day plan for sleep, light, caffeine, and hydration.

Live site: https://jetlag.alltripsconsidered.com/

![Jet Lag & Recovery link preview](docs/assets/img/og-image.jpg)

## Features

- **Location search:** type a city, airport name, IATA code (`LHR`), metro code (`NYC`, `LON`), former name (`Bombay`, `Saigon`), or country. About 3,100 airports are built in: 230 hand-picked major airports with friendly names and aliases, plus every other large or mid-sized airport with scheduled passenger flights worldwide. Accents and special letters are optional ("tromso" finds Tromsø). Places without a listed airport fall back to their time zone and show its UTC offset in place of a code, for example "Pago Pago (UTC−11)". The search is fully keyboard and screen reader accessible.
- **Interactive trip input:** flight time, trip length, and your usual bedtime, wake time, and chronotype.
- **Today:** a card at the top answers "what should I do right now?" for wherever you are in the trip. It shows a countdown before you leave, pre-adjust steps, and whether to sleep or stay awake in the air. During the adjustment days and on the way home, it shows what to do now and the next three steps with times. It refreshes every minute.
- **Adaptive daily plan:** each day gets a 24-hour timeline showing sleep, when to seek or avoid bright light, the caffeine window, and water reminders.
- **Sleep check-ins:** log how you actually slept. The rest of the plan shifts to match your real progress.
- **Return trip planning (Preview):** open the collapsed "Return flight (optional)" section to get a plan for coming home. Close it to turn the return plan off; your details are kept. The plan starts from where your body clock is on the return day. A fully adjusted trip reverses the whole shift, a short trip only undoes part of it, and a trip kept on home time needs little recovery. Sleep logs and calendar export work for both legs.
- **Adjustable output:** choose a strategy (gradual, immediate, or stay on home time), pre-adjust up to 3 days before departure, and set the adjustment pace.
- **Hydration estimates:** a standard daily water estimate for adults, adjusted for alcohol, plus in-flight intake. Body weight, activity, and destination climate are optional. They sit under a collapsed "Personalize my water target" section and refine the target only when filled in. Metric or imperial.
- **Recovery methods:** light, movement, meals, naps, and sleep setting tips tailored to your direction of travel.
- **Add to Calendar:** choose **Apple Calendar** (iPhone, iPad and Mac), **Google Calendar** (one link per night that opens Google Calendar with the event filled in, shown in local time at the destination) or **Other (.ics)** for Outlook and other apps. Apple Calendar and Other use an `.ics` file in which every night has an alert 15 minutes before bedtime; Google Calendar links use the person's own default reminder.
- **Share to…:** next to Add to Calendar. **Email with graphs** sends the plan as text plus an image of the daily graphs through the device share sheet (Mail, Gmail, Outlook); where a browser cannot share files, it saves the image and opens an email to attach it to. **Email as plain text** opens the email app with the plan written out, **Copy text** puts it on the clipboard, and **Copy image** copies the daily graphs image to paste into an email, message or document. Every version ends with the not-advice note and a link to the app.
- **Device defaults:** the clock (12- or 24-hour), water units, and body weight unit follow the device's region settings. For example, the US gets 12-hour time, ounces, and pounds, and most other places get 24-hour time, liters, and kilograms. Dates use the region's date order in English ("Wed, Dec 2" in the US, "Tue 1 Dec" in the UK). The Clock and Water units menus offer "Device setting" plus fixed choices, and Reset returns to the device defaults.
- **Short setup:** flight, return flight, and normal sleep are up front. Caffeine, water, plan style, clock, and units sit in a collapsed "More options."
- **Appearance panel** (half-filled circle in the header, matching atc-pwa-template): **Mode** (Auto, Light, Dark), **Color**, and **Decorations**. In Color, **Automatic** is the default: colors follow the season and switch to a holiday's colors while it is on. Travelers can pick instead from **Current season**, **Seasons** (Spring 🌸, Summer ☀️, Autumn 🍂, Winter ❄️) or **Holidays** (any one holiday, such as Christmas 🎄 or Pride Month 🏳️‍🌈). Each row shows a color swatch. A checkbox turns seasonal and holiday decorations on or off. Automatic seasons use the hemisphere of the device time zone, and US-only holidays appear automatically only in US time zones.
- **Automatic decorations:** holidays get a garland, falling decorations, and corner accents; seasons get a lighter set. One switch in the Appearance menu turns them off. Animation stops when the device asks for reduced motion.
- **Back to top** button in the lower right once you scroll past the header.
- **Installable and offline:** works without a connection after the first visit. The short name, **Jet Lag**, is used for home screen labels. Browsers with an install prompt (Chrome, Edge, Samsung Internet) get a one-tap Install button. Where there is no prompt, a reminder explains how to add the app: Share, then Add to Home Screen on iPhone and iPad; the browser menu on Android. Desktop browsers without an install prompt, such as Safari on a Mac, show no install icon or reminder. The reminder waits until the disclaimer is accepted, can be closed for 24 hours, and never appears once the app is installed. When a new version is ready, an "Update available" banner offers a Refresh.
- **Footer:** the app icon sits centered above the copyright line, which links to All Trips Considered. Below it, **Travel Tools** links to the other All Trips Considered apps (the same section as the Schengen 90/180 app). It is a row of buttons on wider screens and a list on phones, with "You are here" on the app being viewed.

### Health and liability notices

- A disclaimer dialog appears on first visit and must be acknowledged before use. It reappears if `DISCLAIMER_VERSION` in `docs/js/config.js` is increased.
- A "Not health advice" notice sits above every plan.
- The Flight, Hydration, and Recovery tabs each end with a not-advice reminder.
- The footer states the app is not health advice, is provided as is, and links to the full disclaimer and limitation of liability.
- Exported calendar events carry a not-advice note.

### How the plan works

The model tracks how far your body clock has shifted toward destination time. It assumes about 1 hour per day when advancing (flying east) and 1.5 hours per day when delaying (flying west), adjusted for chronotype and the pace you choose. For very large gaps it picks the shorter direction around the clock. Light advice is timed around the core body temperature minimum, about 3 hours before your body's natural wake time. These are simplified population averages, and individual responses vary.

## Privacy

Jet Lag & Recovery saves your trip details, sleep logs, appearance choices, disclaimer acceptance, and when you last closed the install reminder in the browser's local storage. Everything stays on your device, and nothing is uploaded. The full policy is in [`docs/privacy.html`](docs/privacy.html).

## Project structure

Everything the site serves lives in `docs/`, which GitHub Pages publishes. Development files stay at the repository root and are not published.

```
docs/index.html                         Page markup, dialogs (disclaimer, sleep check-in, appearance)
docs/privacy.html                       Privacy policy page
docs/manifest.webmanifest               Install metadata
docs/sw.js                              Service worker (offline cache)
docs/CNAME                              Custom domain for GitHub Pages
docs/robots.txt                         Lets search engines crawl the site and points to the sitemap
docs/sitemap.xml                        Page list for search engines
docs/css/styles.css                     Theme tokens, season and holiday palettes, layout, decorations
docs/css/privacy.css                    Styles for the privacy page
docs/assets/img/icon-192.png            App icon, 192 px
docs/assets/img/icon-512.png            App icon, 512 px, rounded
docs/assets/img/icon-maskable-512.png   Maskable app icon for Android
docs/assets/img/apple-touch-icon.png    Home screen icon for iPhone and iPad
docs/assets/img/favicon-32.png          App icon, 32 px
docs/assets/img/tabicon-32.png          Browser tab icon: All Trips Considered artwork, 32 px
docs/assets/img/tabicon-192.png         Browser tab icon: All Trips Considered artwork, 192 px
docs/favicon.ico                        Favicon: the app icon (16, 32 and 48 px)
docs/assets/img/og-image.jpg            1200×630 preview image for shared links
docs/assets/fonts/instrument-serif-latin.woff2   Instrument Serif for the title and copyright
docs/assets/fonts/OFL.txt               SIL Open Font License for Instrument Serif
docs/js/main.js                         Entry point: wires state, model, and views
docs/js/config.js                       Defaults, storage keys, and all model constants
docs/js/state.js                        The single store for trip, sleep logs, and appearance
docs/js/boot.js                         Runs before first paint: saved color mode and the CSP-safe style helper
docs/js/pwa.js                          Service worker registration and the Update available banner
docs/js/data/airports.js                Hand-picked major airports: code, city, country, time zone, aliases
docs/js/data/airports-world.js          Generated list of other airports with scheduled flights (see tools/)
docs/js/data/locations.js               Location keys, lookups, and ranked search index
docs/js/data/themes.js                  Holiday and season names, emoji, and lunisolar dates
docs/js/lib/util.js                     Small shared helpers
docs/js/lib/locale.js                   Device clock, measurement system, and date style
docs/js/lib/storage.js                  Guarded localStorage access
docs/js/lib/time.js                     Time zone math (DST aware, uses Intl)
docs/js/lib/intervals.js                24-hour interval math
docs/js/core/model.js                   The jet lag plan model (pure functions)
docs/js/core/calendar.js                Season and holiday detection (pure functions)
docs/js/ui/form.js                      Trip form
docs/js/ui/plan-view.js                 Summary and daily plan cards
docs/js/ui/panes.js                     Flight, Hydration, and Recovery tabs
docs/js/ui/timeline.js                  24-hour timeline bars
docs/js/ui/format.js                    Time, duration, and volume formatting
docs/js/ui/checkin.js                   Sleep log dialog
docs/js/ui/appearance.js                Appearance menu, automatic theme, and decorations
docs/js/ui/today.js                     Today card: what to do now and next
docs/js/ui/legal.js                     Disclaimer dialog
docs/js/ui/to-top.js                    Back to top button
docs/js/ui/location-picker.js           Search box (combobox) for departure and arrival
docs/js/ui/install.js                   Install button, Add to Home Screen reminder and steps
docs/js/ui/travel-tools.js              Travel Tools footer: marks the current app "You are here"
docs/js/ui/tabs.js                      Accessible tabs with keyboard support
docs/js/ui/dialog.js                    Wrapper over <dialog> with a fallback for older browsers
docs/js/ui/ics.js                       Sleep events, the .ics file (15-minute alerts) and Google Calendar links
docs/js/ui/calendar-menu.js             Add to Calendar: Apple Calendar, Google Calendar or Other (.ics)
docs/js/ui/share.js                     Share to: email with graphs, email as plain text, or copy text

README.md                               This file
design/icon-source.png                  Full-size original of the app icon; the icons in docs/assets/img/ are generated from it
tools/build-airports.py                 Builds docs/js/data/airports-world.js from the airport data sources
tools/qc/run.mjs                        QC & Bug Hunter: runs the checks below and writes qc-report.md
tools/qc/static-checks.mjs              Offline cache list, cache bump, imports, HTML, CSP, manifest, domain, README tree
tools/qc/model-hunt.mjs                 Fuzzes the plan model with seeded random trips, plus time zone, interval, holiday and search checks
tools/qc/browser-hunt.mjs               Drives the app in headless Chromium: errors, CSP, broken text, overflow, dialogs, offline
tools/qc/report.mjs                     Prints findings and writes the Markdown report
.claude/agents/qc-bug-hunter.md         Claude Code agent for an on-demand QC pass; writes the same report
```

### Data design

- **One store.** `docs/js/state.js` owns everything that is saved. Saved data is filtered to known keys on load, and trip writes are debounced.
- **Pure model.** `docs/js/core/model.js` takes plain inputs and returns a plan object. It never touches the page.
- **Indexed lookups.** Airports are indexed by key and by time zone in `Map`s, and normalized search fields are built once at load time. Parsed locations, `Intl` formatters, and yearly holiday dates are cached.
- **Exact interval math.** Light windows are clipped against sleep with interval subtraction rather than sampling.
- **Constants in one place.** Shift rates, caffeine limits, and hydration factors live in `MODEL` in `docs/js/config.js`.
- **Per-trip sleep logs.** Logs are keyed by a trip signature, so changing the trip never applies old logs to a new plan.

## Run locally

There is no build step and there are no dependencies. Serve the `docs/` folder over HTTP, because ES modules and the service worker do not load from `file://`:

```sh
python3 -m http.server 8000 --directory docs
```

Open http://localhost:8000.

## Making changes

### Updating the airport list

`docs/js/data/airports-world.js` is generated. To rebuild it, download `airports.csv` from
[OurAirports](https://github.com/davidmegginson/ourairports-data) and `airports.json` from
[mwgg/Airports](https://github.com/mwgg/Airports), then run:

```sh
python3 tools/build-airports.py path/to/airports.csv path/to/airports.json
```

The script keeps airports with scheduled passenger service and skips codes already in the hand-picked list. It checks every time zone against the system time zone database and reports any zone that looks wrong for the airport's country or longitude. Fix those in `TZ_FIX` inside the script.

### Checking for bugs (QC & Bug Hunter)

Run the QC & Bug Hunter before opening a pull request. It needs only Node 18 or later. The browser checks also need Playwright; without it they are skipped.

```sh
node tools/qc/run.mjs
```

It runs three passes and writes `qc-report.md` at the repository root (ignored by git):

- **Static checks:** every cached file is in the `sw.js` `ASSETS` list, `CACHE` was bumped when a cached file changed since `origin/prod`, imports resolve to real exports, there are no inline styles or scripts the CSP would block, every `#id` the scripts use exists, the manifest icons match their sizes, self URLs match `docs/CNAME`, and the README project tree matches `docs/`.
- **Model fuzzing:** thousands of seeded random trips (daylight saving dates, odd time zones, every option) checked against invariants. For example, light advice never falls during sleep, coffee stays before the cutoff, calendar events do not overlap, and shared text never shows `NaN` or `undefined`. Time zone math, interval math, holiday dates and search ranking are checked as well.
- **Browser hunt:** the real app in headless Chromium on desktop and phone, in several regions and both color modes. It records uncaught errors, CSP violations, failed requests, placeholder text, sideways scrolling and missing labels. It also exercises the disclaimer, tabs, calendar and share dialogs, search, odd form input and offline reload.

Useful options: `--quick` (no browser, short fuzz run), `--only static,model`, `--cases 20000`, `--seed 42` to replay a run exactly, `--screens` to save screenshots to `test-results/qc-screens/`, and `--strict` to fail on warnings. The command exits with an error when anything fails.

The report uses the same layout as the points-calculator QC & Bug Hunter. Findings sit under seven numbered checks: display, plan calculation, time zones and data, calendar and sharing, edge cases, offline and release, and README accuracy. Each finding gives where it is, the steps to trigger it, the expected and actual results, the evidence and a confidence of "Confirmed" or "Likely". The report ends with a "Could not verify" list and a summary of what passed.

For a deeper review, ask Claude Code for a QC pass. The `qc-bug-hunter` agent in `.claude/agents/qc-bug-hunter.md` runs the script, confirms each finding, then checks by hand what a script cannot: the plan against the published rules, upcoming time zone and holiday date changes, calendar imports, and every README claim. It writes the same report and never changes the repository.

### Showing the disclaimer again

Increase `DISCLAIMER_VERSION` in `docs/js/config.js` when the disclaimer changes. Every visitor then sees the dialog again and must acknowledge it.

### Changing the domain

The canonical URL, Open Graph and X image URLs, structured data, `docs/robots.txt`, and `docs/sitemap.xml` all use `https://jetlag.alltripsconsidered.com/`. Update them together with `docs/CNAME` if the domain changes.

### Releasing an update

When any cached file changes, bump the cache name (`CACHE`) in `docs/sw.js` so installed copies update. Add any new file the app needs offline to the `ASSETS` list in the same file.

## Security

- A strict Content-Security-Policy `<meta>` tag in `docs/index.html` and `docs/privacy.html` lets only this site's own scripts, styles, fonts, and images load. There are no inline style attributes. The only inline `<script>` is the JSON-LD structured data block, which browsers do not run.
- Trusted Types is not enforced, because the views build HTML with `innerHTML`.
- The Instrument Serif font is self-hosted, and the page makes no third-party requests.
- Saved data is checked on load: only known keys are kept, so stale or tampered storage cannot add unexpected fields.
- Development files (`design/`, `tools/`) are not published.
- Run `node tools/qc/run.mjs` before release; it flags CSP-blocked markup and an unbumped cache name.

### Headers to set in Cloudflare

GitHub Pages cannot send custom headers, so they are set with a Cloudflare Transform Rule (Rules > Transform Rules > Modify Response Header) for `jetlag.alltripsconsidered.com`:

- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`
- `Cross-Origin-Opener-Policy: same-origin`

## Deployment

GitHub Pages publishes the `/docs` folder of the `prod` branch (Settings > Pages > Deploy from a branch). `docs/CNAME` sets the custom domain, and Cloudflare provides DNS. `prod` is the default branch. Changes reach it only through an approved pull request, and the site updates a few minutes after a merge.

For search engines, `docs/robots.txt` points to `docs/sitemap.xml`. Update `<lastmod>` in `docs/sitemap.xml` when a page changes meaningfully.

## Roadmap

Open work, in rough priority order. Check items off as they ship.

### 1. Features for frequent flyers

- [ ] **Return trips and connections.** Return planning is in Preview, with sleep logs and calendar export for both legs. Still to do: multi-leg trips with layovers.
- [ ] **Saved trips.** Keep several trips and switch between them.
- [ ] **Reminders.** Alert travelers when to seek light, stop caffeine, and go to bed. Reliable notifications likely need a small server; the calendar export and Today card cover part of this today.
- [ ] **Share a plan.** Send a travel companion a link that opens the same trip.
- [ ] **Flight lookup.** Fill in cities, times, and flight length from a flight number such as BA 178. This needs a flight data service (usually paid) and a small server to keep its key private.

### 2. Trust and polish

- [ ] **Expert review.** Have a sleep specialist review the plan logic and wording.
- [ ] **Legal review.** Have a lawyer review the disclaimer and limitation of liability.
- [ ] **Return trips out of Preview.** Once real travelers have used return planning, remove the Preview label.
- [ ] **Color contrast check.** Confirm each season and holiday palette meets WCAG AA in light and dark mode.
- [ ] **Extend holiday dates before 2037.** Lunar New Year, Diwali, and Hanukkah dates are listed through 2036 in `docs/js/data/themes.js`. Add the next ten years before then.

### Done

- [x] Live site verified: the custom domain is confirmed in GitHub Pages and "Enforce HTTPS" is on.
- [x] Today card, shorter setup with More options, and an automatic season and holiday theme.
- [x] Airport coverage expanded to about 3,100 airports worldwide.
- [x] Search and sharing metadata: description, canonical URL, Open Graph and X (Twitter) link previews with a 1200×630 image, structured data, robots.txt, and sitemap.xml.
- [x] Brand name set to All Trips Considered, with links to alltripsconsidered.com.
- [x] Add to Calendar (Apple Calendar, Google Calendar or Other with 15-minute alerts) and Share to (email with graphs, plain text, copy text or copy image). The search description, keywords and structured data feature list mention both.
- [x] Lunar New Year, Diwali, and Hanukkah dates extended through 2036.

## Disclaimer

> **Not health advice.** Jet Lag & Recovery provides general information for educational purposes only. It is not medical, health, or nutritional advice and does not replace a qualified health professional. The app is provided "as is," without warranties, and its creators are not liable for any damages arising from its use.

Jet Lag & Recovery and its content are for general informational and educational purposes only. Nothing in the app is medical, health, nutritional, or professional advice, and using it does not create a doctor and patient relationship. Always consult a qualified health professional before changing your sleep schedule, caffeine or fluid intake, or before taking melatonin or any other supplement or medication. The app is not for emergencies.

The app is provided "as is" and "as available," without warranties of any kind, express or implied. To the fullest extent permitted by law, All Trips Considered and its creators, contributors, and affiliates are not liable for any direct, indirect, incidental, special, consequential, or punitive damages, or for any injury, illness, loss, or cost, arising from or related to use of, or reliance on, the app or its content. You use the app at your own risk.

## Credits and licenses

- Title font: Instrument Serif, SIL Open Font License (see `docs/assets/fonts/OFL.txt`).
- Airport codes, names, and locations: [OurAirports](https://ourairports.com/data/), public domain.
- Airport time zones: [mwgg/Airports](https://github.com/mwgg/Airports), MIT License, Copyright (c) 2014 mwgg. Zones that were wrong for the airport's country were corrected (see `TZ_FIX` in `tools/build-airports.py`).

<p align="center">
  <img src="docs/assets/img/icon-512.png" alt="Jet Lag &amp; Recovery app icon" width="96" height="96">
</p>

<p align="center">© 2026 All Trips Considered. All rights reserved.</p>
