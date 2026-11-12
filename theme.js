/*
 * JSner theme manager.
 *
 * Three modes: auto (follow the OS preference), light, dark. The chosen
 * mode is kept in chrome.storage so both the popup and the results page
 * agree; localStorage mirrors it so a page paints the right grade on
 * first frame with no flash.
 */

(function () {
  const KEY = 'uiTheme';

  function resolve(mode) {
    const chosen = ['auto', 'light', 'dark'].includes(mode) ? mode : 'auto';
    const dark =
      chosen === 'dark' ||
      (chosen === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return dark ? 'dark' : 'light';
  }

  function modeInUse() {
    return document.documentElement.dataset.mode || 'auto';
  }

  function apply(mode) {
    const chosen = ['auto', 'light', 'dark'].includes(mode) ? mode : 'auto';
    document.documentElement.dataset.mode = chosen;
    document.documentElement.dataset.theme = resolve(chosen);
    applied = true;
    try {
      localStorage.setItem(KEY, chosen);
    } catch (e) {
      /* storage unavailable; the cookie-crumbs below are enough */
    }
    document.dispatchEvent(new CustomEvent('jsner:theme', { detail: chosen }));
  }

  let applied = false;

  function readStorage() {
    try {
      const cached = localStorage.getItem(KEY);
      if (cached) apply(cached);
    } catch (e) {
      /* ignore */
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(KEY, (data) => {
        apply((data && data.uiTheme) || 'auto');
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.uiTheme) apply(changes.uiTheme.newValue);
      });
      return;
    }
    if (!applied) apply('auto');
  }

  function cachedAvailable() {
    try {
      localStorage.getItem(KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (modeInUse() === 'auto') apply('auto');
  });

  window.jsnerCycleTheme = function () {
    const current = modeInUse();
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    apply(next);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ uiTheme: next });
    }
    return next;
  };

  apply('auto');
  readStorage();
})();
