// Applies the stored theme before first paint and wires the System / Light / Dark toggle.
// Inlined, blocking, into every page's head (src/layouts/Base.astro).
(() => {
  const root = document.documentElement;
  const KEY = 'theme';
  const explicit = (t) => t === 'light' || t === 'dark';
  const apply = (t) => {
    if (explicit(t)) root.dataset.theme = t;
    else delete root.dataset.theme;
  };
  let theme = null;
  try {
    theme = localStorage.getItem(KEY);
  } catch {}
  apply(theme);
  root.dataset.js = '';

  document.addEventListener('DOMContentLoaded', () => {
    const current = explicit(theme) ? theme : 'system';
    for (const radio of document.querySelectorAll('input[name="theme"]')) radio.checked = radio.value === current;
  });

  document.addEventListener('change', (event) => {
    const radio = event.target;
    if (radio.name !== 'theme') return;
    theme = radio.value;
    try {
      if (explicit(theme)) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch {}
    const update = () => apply(theme);
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(update);
    } else {
      update();
    }
  });
})();
