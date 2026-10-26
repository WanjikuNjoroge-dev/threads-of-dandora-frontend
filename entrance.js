/* Lightweight opening sequence. Placeholder garments can be replaced independently. */
(function () {
  'use strict';
  var intro = document.getElementById('dandora-intro');
  if (!intro) return;
  var sequence = intro.querySelector('.dd-running');
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var entries = window.performance && window.performance.getEntriesByType ? window.performance.getEntriesByType('navigation') : [];
  var hash = window.location.hash.toLowerCase();
  var homepage = !hash || hash === '#film' || hash === '#top' || hash === '#main-content' || hash === '#';
  var timer;
  var started = false;
  var finished = false;
  function dismiss() {
    finished = true;
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pagehide', dismiss);
    if (motion.removeEventListener) motion.removeEventListener('change', dismiss);
    else if (motion.removeListener) motion.removeListener(dismiss);
    if (intro.parentNode) intro.parentNode.removeChild(intro);
  }
  function onKey(event) { if (event.key === 'Escape' || event.key === 'Tab') dismiss(); }
  function begin() {
    if (started || finished || document.hidden) return;
    started = true;
    intro.hidden = false;
    sequence.classList.remove('dd-paused');
    timer = window.setTimeout(dismiss, 3300);
  }
  function onVisibility() {
    if (!started) { begin(); return; }
    if (document.hidden) {
      sequence.classList.add('dd-paused');
      window.clearTimeout(timer);
    } else {
      /* Restart together after switching tabs so the reveal is never missed. */
      sequence.classList.remove('dd-running');
      void sequence.offsetWidth;
      sequence.classList.add('dd-running');
      sequence.classList.remove('dd-paused');
      timer = window.setTimeout(dismiss, 3300);
    }
  }
  if (motion.matches || !homepage || (entries[0] && entries[0].type === 'back_forward')) { dismiss(); return; }
  sequence.classList.add('dd-paused');
  var background = intro.querySelector('.dd-film-background');
  var track = background.querySelector('.dd-film-track');
  background.appendChild(track.cloneNode(true));
  background.appendChild(track.cloneNode(true));
  window.addEventListener('keydown', onKey);
  window.addEventListener('pagehide', dismiss);
  document.addEventListener('visibilitychange', onVisibility);
  if (motion.addEventListener) motion.addEventListener('change', dismiss);
  else if (motion.addListener) motion.addListener(dismiss);
  begin();
}());
