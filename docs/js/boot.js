// Runs before the page draws (loaded in <head>, not a module), so it must stay tiny and self-contained.
// It lives in its own file because the Content-Security-Policy does not allow inline scripts.
(function () {
  // Apply the saved color mode before first paint to avoid a theme flash.
  try {
    var a = JSON.parse(localStorage.getItem('atc-appearance') || '{}');
    if (a.mode === 'light' || a.mode === 'dark') document.documentElement.dataset.theme = a.mode;
  } catch (e) { /* storage may be blocked */ }

  // The Content-Security-Policy blocks style="" attributes in markup. Views write data-style="" instead,
  // and this copies it into the element's style through the CSS object model, which the policy allows.
  function applyStyles(root) {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('data-style')) { root.style.cssText = root.getAttribute('data-style'); root.removeAttribute('data-style'); }
    var els = root.querySelectorAll('[data-style]');
    for (var i = 0; i < els.length; i++) { els[i].style.cssText = els[i].getAttribute('data-style'); els[i].removeAttribute('data-style'); }
  }
  new MutationObserver(function (records) {
    for (var r = 0; r < records.length; r++) {
      var added = records[r].addedNodes;
      for (var n = 0; n < added.length; n++) applyStyles(added[n]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
