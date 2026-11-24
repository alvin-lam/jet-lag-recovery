// Travel Tools footer: mark the link whose web address matches the page being viewed with
// "YOU ARE HERE". The markup marks Jet Lag by default, so previews on other hosts still show it.
import { $$ } from '../lib/util.js';

export function setupTravelTools(host = location.hostname) {
  const links = $$('.travel-tools a');
  const match = links.find((a) => a.hostname === host) || links.find((a) => a.hasAttribute('aria-current'));
  if (!match) return;
  for (const a of links) {
    const here = a === match;
    a.toggleAttribute('aria-current', here);
    a.querySelector('.you-are-here')?.remove();
    if (here) { a.removeAttribute('target'); a.removeAttribute('rel'); a.insertAdjacentHTML('beforeend', '<span class="you-are-here">You are here</span>'); }
    else { a.target = '_blank'; a.rel = 'noopener'; }
  }
}
