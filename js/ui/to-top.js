// "Back to top" button in the lower right. It appears once the header scrolls out of view.
// An IntersectionObserver is used instead of a scroll listener, so nothing runs while scrolling.
import { $ } from '../lib/util.js';

export function setupToTop() {
  const btn = $('#to-top');
  const header = $('.site-header');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { btn.hidden = entry.isIntersecting; }).observe(header);
  } else {
    btn.hidden = false;
  }

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    // Move keyboard focus to the top as well, without a second jump.
    $('.site-title a').focus({ preventScroll: true });
  });
}
