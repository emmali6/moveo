/* Nav dropdowns: hover/focus-within on fine pointers; toggle button on coarse/touch */
(function initNavDropdownMenus() {
  function bind() {
    document.querySelectorAll('.nav-dropdown').forEach((item) => {
      const toggle = item.querySelector('.nav-dropdown-touch-toggle');
      const menu = item.querySelector('.nav-dropdown-menu');
      if (!toggle || !menu) return;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const openning = !item.classList.contains('is-touch-open');
        document.querySelectorAll('.nav-dropdown.is-touch-open').forEach((o) => {
          if (o !== item) {
            o.classList.remove('is-touch-open');
            const t = o.querySelector('.nav-dropdown-touch-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
        item.classList.toggle('is-touch-open', openning);
        toggle.setAttribute('aria-expanded', String(openning));
      });
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.nav-dropdown')) return;
      document.querySelectorAll('.nav-dropdown.is-touch-open').forEach((o) => {
        o.classList.remove('is-touch-open');
        const t = o.querySelector('.nav-dropdown-touch-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
