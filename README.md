# All Trip Considered

A progressive web app (PWA) that helps frequent flyers recover from jet lag. Enter your flight and normal sleep pattern, and it builds a day-by-day plan for sleep, light, caffeine, melatonin, and hydration.

## Features

- **Interactive trip input:** pick departure and arrival cities (or any IANA time zone), flight time, trip length, and your usual bedtime, wake time, and chronotype.
- **Adaptive daily plan:** each day gets a 24-hour timeline showing sleep, when to seek or avoid bright light, the caffeine window, melatonin timing, and water reminders.
- **Sleep check-ins:** log how you actually slept each night. The rest of the plan shifts to match your real progress.
- **Adjustable output:** choose a strategy (gradual, immediate, or stay on home time), pre-adjust up to 3 days before departure, and set the adjustment pace.
- **Caffeine guidance:** dose timing and a daily cutoff based on your sensitivity, body weight, and bedtime.
- **Hydration targets:** a daily water goal based on weight, activity, climate, and alcohol, plus in-flight intake and suggested drinking times. Metric or imperial.
- **Recovery methods:** light, exercise, meals, naps, melatonin, and sleep setting advice tailored to your direction of travel.
- **Calendar export:** download sleep windows as an `.ics` file.
- **Appearance menu:** light, dark, or system mode; seasonal themes with hemisphere support; automatic or manual holiday themes; and toggles for garland, falling decorations, corner accents, animation, and decoration amount.
- **Installable and offline:** works without a connection after the first visit.

## How the plan works

The model tracks how far your body clock has shifted toward destination time. It assumes about 1 hour per day when advancing (flying east) and 1.5 hours per day when delaying (flying west), adjusted for chronotype and the pace you choose. For very large gaps it picks the shorter direction around the clock. Light advice is timed around your core body temperature minimum, about 3 hours before your body's natural wake time. Light after that point advances the clock, and light before it delays the clock.

This is general wellness guidance, not medical advice.

## Run locally

No build step or dependencies. Serve the folder over HTTP so the service worker can register:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Any static host works, including GitHub Pages. Publish the repository root.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, form, dialogs |
| `styles.css` | Theme tokens, seasonal and holiday palettes, layout, decorations |
| `app.js` | Time zone math, jet lag model, rendering, appearance, PWA setup |
| `sw.js` | Offline cache |
| `manifest.webmanifest` | Install metadata |
| `icons/` | App icons |

© All Trip Considered. All rights reserved.
