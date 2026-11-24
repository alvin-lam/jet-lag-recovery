// Accessible tabs with arrow, Home and End key support.
import { $, $$ } from '../lib/util.js';

const STEP = { ArrowRight: 1, ArrowLeft: -1 };

export function setupTabs() {
  const tabs = $$('[role="tab"]');
  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    }
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key in STEP) next = tabs[(i + STEP[e.key] + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); next.focus(); select(next); }
    });
  });
}
