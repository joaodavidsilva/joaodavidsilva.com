// Applies the stored theme before first paint and wires the System / Light / Dark buttons.
// Inlined, blocking, into every page's head (src/layouts/Base.astro).
(() => {
  const root = document.documentElement;
  const KEY = 'theme';
  const explicit = (value) => value === 'light' || value === 'dark';
  let theme = null;
  try {
    theme = localStorage.getItem(KEY);
  } catch {
    // Storage may be unavailable: System remains a complete fallback.
  }
  if (explicit(theme)) root.dataset.theme = theme;
  else delete root.dataset.theme;
  root.dataset.js = '';

  const sync = () => {
    const current = explicit(theme) ? theme : 'system';
    for (const button of document.querySelectorAll('[data-theme-choice]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === current));
    }
  };
  const apply = () => {
    if (explicit(theme)) root.dataset.theme = theme;
    else delete root.dataset.theme;
    sync();
  };
  document.addEventListener('DOMContentLoaded', sync);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-choice]');
    if (!button) return;
    theme = button.dataset.themeChoice;
    try {
      if (explicit(theme)) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch {
      // The choice still applies to this page when storage is unavailable.
    }
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  });
})();
