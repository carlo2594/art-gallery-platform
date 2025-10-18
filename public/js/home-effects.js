'use strict';

// Home: reveal text effects for latest exhibitions
(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    try {
      const items = document.querySelectorAll('.home-exhibitions .featurette');
      const header = document.querySelector('.home-exhibitions .section-heading');
      if ((!items.length && !header) || !('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      items.forEach(el => io.observe(el));
      if (header) io.observe(header);
    } catch (e) {
      // silent fail; effects are progressive enhancement
      // console.warn('Home effects init failed', e);
    }
  }
})();
