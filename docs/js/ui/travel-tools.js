// Travel Tools footer (shared with the other All Trips Considered tools): mark the link whose web
// address matches the page being viewed with "You are here". The markup marks Jet Lag & Recovery
// by default, so previews on other hosts still show it.
import { $$ } from '../lib/util.js';

export function setupTravelTools(host = location.hostname) {
  const links = $$('.quick-links a');
  const match = links.find((a) => a.hostname === host);
  if (!match) return;
  for (const a of links) {
    const here = a === match;
    a.toggleAttribute('aria-current', here);
    if (here) a.setAttribute('aria-current', 'page');
    a.querySelector('.ql-arrow').textContent = here ? 'You are here' : '\u203a';
  }
}
