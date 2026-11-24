// Accessible tabs with arrow, Home and End key support. Hidden tabs are skipped.
import { $, $$ } from '../lib/util.js';

const STEP = { ArrowRight: 1, ArrowLeft: -1 };
let tabs = [];

export function selectTab(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  }
}

/** Show or hide a tab; if the selected tab is hidden, fall back to the first tab. */
export function setTabVisible(id, visible) {
  const tab = $('#' + id);
  tab.hidden = !visible;
  if (!visible && tab.getAttribute('aria-selected') === 'true') selectTab(tabs[0]);
}

export function setupTabs() {
  tabs = $$('[role="tab"]');
  tabs.forEach((t) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const visible = tabs.filter((x) => !x.hidden);
      const i = visible.indexOf(t);
      let next = null;
      if (e.key in STEP) next = visible[(i + STEP[e.key] + visible.length) % visible.length];
      else if (e.key === 'Home') next = visible[0];
      else if (e.key === 'End') next = visible[visible.length - 1];
      if (next) { e.preventDefault(); next.focus(); selectTab(next); }
    });
  });
}
