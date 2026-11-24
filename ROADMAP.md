# Jet Lag and Recovery roadmap

Open work for Jet Lag and Recovery by All Trips Considered, in rough priority order. Check items off as they ship.

## 1. Launch checks

Do these before promoting the site, since they decide whether the live app works for real users.

- [ ] **Verify the live site and HTTPS.** In the repository's GitHub Pages settings, confirm `jetlag.alltripsconsidered.com` shows as verified and "Enforce HTTPS" is on. Offline use and installing both need HTTPS. Then open the site and confirm the latest release is live.
- [ ] **Test on real phones.** Check a real iPhone (Safari) and Android phone (Chrome):
  - date and time fields look and work right
  - the install banner appears, and its Share or menu steps match the device
  - the app installs, opens full screen, and works offline
- [ ] **Legal review.** Have a lawyer review the disclaimer and limitation of liability for the countries where users live.

## 2. Quality and tooling

- [ ] **Automated tests in the repository.** Move the browser test scripts into the project and run them with GitHub Actions on every push. Cover the plan model (landing times, directions, sleep logs), device defaults, search, appearance, install reminder, and layout at phone and desktop widths.
- [ ] **Link previews.** Add Open Graph and Twitter card tags plus a preview image, so shared links show a title, summary, and picture.
- [ ] **Color contrast audit.** Check every season and holiday palette in light and dark mode against WCAG AA, and adjust colors that are too faint.
- [ ] **Release automation.** Generate the service worker's cache version and file list automatically at release time, so installed apps always pick up updates.
- [ ] **Pull request workflow.** If others will contribute, merge to `prod` through reviewed pull requests instead of pushing directly.

## 3. Features for frequent flyers

- [ ] **Return trips and connections.** Plan the return leg and multi-leg trips with layovers in one itinerary.
- [ ] **Saved trips.** Keep several trips and switch between them.
- [ ] **Reminders.** Alert travelers when to seek light, stop caffeine, and go to bed. Reliable notifications likely need a small server; the calendar export covers part of this today.
- [ ] **Wider airport coverage.** Grow beyond the ~230 built-in airports, or add a larger city list, so smaller cities match by name rather than falling back to time zones.

## 4. Content and maintenance

- [ ] **Expert review.** Have a sleep specialist review the plan logic and wording.
- [ ] **Extend holiday dates before 2037.** Lunar New Year, Diwali, and Hanukkah dates are listed through 2036 in `js/data/themes.js`. Add the next ten years before then.

## Done

- [x] Brand name set to All Trips Considered, with links to alltripsconsidered.com.
- [x] Lunar New Year, Diwali, and Hanukkah dates extended through 2036.
