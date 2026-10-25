(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var header = document.querySelector('.site-header');
  var transition = document.querySelector('#transition');
  var menu = document.querySelector('#main-nav');
  var menuToggle = document.querySelector('.menu-toggle');
  var trailerShell = document.querySelector('#trailer-modal');
  var trailerDialog = trailerShell;
  var toast = document.querySelector('.toast');
  var mobileDisclosureQuery = window.matchMedia('(max-width: 759px)');
  var desktopMenuQuery = window.matchMedia('(min-width: 1100px)');
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var transitionBusy = false;
  var toastTimer = null;
  var modalOpener = null;
  var lockedScrollY = 0;
  var resizeTimer = null;

  function toArray(collection) {
    return Array.prototype.slice.call(collection || []);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('show');
    }, 2400);
  }

  function updateHeader() {
    header.classList.toggle('scrolled', window.pageYOffset > 50);
  }

  function setMenu(open, returnFocus) {
    var shouldOpen = Boolean(open) && !desktopMenuQuery.matches;
    menu.classList.toggle('open', shouldOpen);
    menuToggle.setAttribute('aria-expanded', String(shouldOpen));
    menuToggle.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
    body.classList.toggle('menu-open', shouldOpen);
    if (!shouldOpen && returnFocus) {
      menuToggle.focus();
    }
  }

  function getScrollTopFor(element) {
    return Math.max(0, element.getBoundingClientRect().top + window.pageYOffset - header.offsetHeight);
  }

  function scrollToElement(element) {
    if (!element) return;
    window.scrollTo(0, getScrollTopFor(element));
  }

  function animateTo(selector, flavor) {
    var target;
    if (transitionBusy || !selector) return;
    try {
      target = document.querySelector(selector);
    } catch (error) {
      target = null;
    }
    if (!target) return;

    if (reducedMotionQuery.matches) {
      scrollToElement(target);
      return;
    }

    transitionBusy = true;
    transition.className = 'transition ' + (flavor || 'film');
    window.requestAnimationFrame(function () {
      transition.classList.add('active');
    });
    window.setTimeout(function () { scrollToElement(target); }, 280);
    window.setTimeout(function () { transition.classList.remove('active'); }, 460);
    window.setTimeout(function () { transitionBusy = false; }, 780);
  }

  function lockPage() {
    lockedScrollY = window.pageYOffset;
    body.classList.add('modal-open');
    body.style.position = 'fixed';
    body.style.top = '-' + lockedScrollY + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }

  function unlockPage() {
    body.classList.remove('modal-open');
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo(0, lockedScrollY);
  }

  function getFocusableElements(container) {
    var selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return toArray(container.querySelectorAll(selector)).filter(function (element) {
      return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null;
    });
  }

  function revealModal() {
    trailerShell.hidden = false;
    lockPage();
    var closeButton = trailerShell.querySelector('.modal-close');
    window.requestAnimationFrame(function () {
      (closeButton || trailerDialog).focus();
    });
  }

  function openTrailer(opener) {
    modalOpener = opener || document.activeElement;
    setMenu(false, false);

    if (reducedMotionQuery.matches) {
      revealModal();
      return;
    }

    transition.className = 'transition film';
    transition.classList.add('active');
    window.setTimeout(function () {
      revealModal();
      transition.classList.remove('active');
    }, 280);
  }

  function closeTrailer() {
    if (trailerShell.hidden) return;
    trailerShell.hidden = true;
    unlockPage();
    if (modalOpener && typeof modalOpener.focus === 'function') {
      modalOpener.focus();
    }
    modalOpener = null;
  }

  function handleModalKeydown(event) {
    if (trailerShell.hidden) return;
    if (event.key === 'Escape' || event.keyCode === 27) {
      event.preventDefault();
      closeTrailer();
      return;
    }
    if (event.key !== 'Tab' && event.keyCode !== 9) return;

    var focusable = getFocusableElements(trailerDialog);
    if (!focusable.length) {
      event.preventDefault();
      trailerDialog.focus();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function panelFor(button) {
    var panelId = button.getAttribute('aria-controls');
    return panelId ? document.getElementById(panelId) : null;
  }

  function setDisclosure(button, expanded, rememberMobileState) {
    var panel = panelFor(button);
    if (!panel) return;
    button.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
    button.classList.toggle('is-open', expanded);
    button.classList.remove('is-prompting');
    if (rememberMobileState && button.getAttribute('data-disclosure-mode') === 'mobile') {
      button.setAttribute('data-mobile-expanded', String(expanded));
    }
    if (button.classList.contains('tour-toggle')) {
      var label = button.querySelector('.toggle-label');
      if (label) label.textContent = expanded ? 'Close details' : 'Explore tour';
    }
  }

  function syncResponsiveDisclosures() {
    toArray(document.querySelectorAll('[data-disclosure]')).forEach(function (button) {
      var mode = button.getAttribute('data-disclosure-mode');
      if (mode === 'always') return;
      if (mobileDisclosureQuery.matches) {
        setDisclosure(button, button.getAttribute('data-mobile-expanded') === 'true', false);
      } else {
        var panel = panelFor(button);
        button.setAttribute('aria-expanded', 'true');
        if (panel) panel.hidden = false;
        button.classList.remove('is-prompting');
      }
    });
  }

  function initializeDisclosures() {
    var buttons = toArray(document.querySelectorAll('[data-disclosure]'));
    buttons.forEach(function (button) {
      button.setAttribute('data-mobile-expanded', 'false');
      if (button.getAttribute('data-disclosure-mode') === 'always') {
        setDisclosure(button, false, false);
      }
      button.addEventListener('click', function () {
        var mode = button.getAttribute('data-disclosure-mode');
        if (mode === 'mobile' && !mobileDisclosureQuery.matches) return;
        var expanded = button.getAttribute('aria-expanded') === 'true';
        setDisclosure(button, !expanded, true);
      });
      var svg = button.querySelector('svg');
      if (svg) svg.setAttribute('focusable', 'false');
    });
    syncResponsiveDisclosures();

    if (!reducedMotionQuery.matches && 'IntersectionObserver' in window) {
      var promptObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.target.getAttribute('aria-expanded') === 'false') {
            entry.target.classList.add('is-prompting');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.65 });
      buttons.forEach(function (button) { promptObserver.observe(button); });
    }
  }

  function initializeCarousel() {
    var track = document.querySelector('#product-track');
    var previous = document.querySelector('[data-carousel="prev"]');
    var next = document.querySelector('[data-carousel="next"]');
    if (!track || !previous || !next) return;

    function updateControls() {
      var maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= maxScroll - 2;
      previous.setAttribute('aria-disabled', String(previous.disabled));
      next.setAttribute('aria-disabled', String(next.disabled));
    }

    function cardStep() {
      var firstCard = track.querySelector('.product-card');
      if (!firstCard) return track.clientWidth;
      var style = window.getComputedStyle(firstCard);
      var marginRight = parseFloat(style.marginRight) || 0;
      return firstCard.getBoundingClientRect().width + marginRight;
    }

    function move(direction) {
      var maximum = Math.max(0, track.scrollWidth - track.clientWidth);
      var destination = Math.max(0, Math.min(maximum, track.scrollLeft + cardStep() * direction));
      if (!reducedMotionQuery.matches && 'scrollBehavior' in root.style && typeof track.scrollTo === 'function') {
        try {
          track.scrollTo({ left: destination, behavior: 'smooth' });
          return;
        } catch (error) {
          // Chrome 70 and old Safari use the direct assignment fallback below.
        }
      }
      track.scrollLeft = destination;
      updateControls();
    }

    previous.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    track.addEventListener('scroll', updateControls, { passive: true });
    track.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.keyCode === 37) {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'ArrowRight' || event.keyCode === 39) {
        event.preventDefault();
        move(1);
      }
    });
    window.addEventListener('resize', updateControls);
    updateControls();
  }

  function initializeRevealAnimations() {
    var elements = toArray(document.querySelectorAll('.reveal'));
    if (reducedMotionQuery.matches || !('IntersectionObserver' in window)) {
      elements.forEach(function (element) { element.classList.add('visible'); });
      return;
    }
    root.classList.add('reveal-enabled');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach(function (element) { observer.observe(element); });
  }

  root.classList.add('js-ready');
  toArray(document.querySelectorAll('img[alt=""]')).forEach(function (image) {
    image.setAttribute('aria-hidden', 'true');
  });
  updateHeader();
  setMenu(false, false);

  window.addEventListener('scroll', updateHeader, { passive: true });
  menuToggle.addEventListener('click', function () {
    setMenu(menuToggle.getAttribute('aria-expanded') !== 'true', false);
  });

  document.addEventListener('click', function (event) {
    if (menuToggle.getAttribute('aria-expanded') === 'true' && !header.contains(event.target) && !menu.contains(event.target)) {
      setMenu(false, false);
    }
  });

  document.addEventListener('keydown', function (event) {
    handleModalKeydown(event);
    if (!trailerShell.hidden) return;
    if ((event.key === 'Escape' || event.keyCode === 27) && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false, true);
    }
  });

  toArray(document.querySelectorAll('a[href^="#"][data-transition]')).forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      setMenu(false, false);
      animateTo(link.getAttribute('href'), link.getAttribute('data-transition'));
    });
  });

  toArray(document.querySelectorAll('[data-modal="trailer"]')).forEach(function (button) {
    button.addEventListener('click', function () { openTrailer(button); });
  });
  toArray(trailerShell.querySelectorAll('[data-modal-close]')).forEach(function (button) {
    button.addEventListener('click', closeTrailer);
  });
  trailerShell.querySelector('.trailer-play').addEventListener('click', function () {
    showToast('Add the final trailer URL to begin playback.');
  });

  toArray(document.querySelectorAll('.product-info>button')).forEach(function (button) {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () {
      var card = button.closest('.product-card');
      var name = card.querySelector('h3').textContent;
      button.setAttribute('aria-pressed', 'true');
      button.firstChild.nodeValue = 'Added ';
      var symbol = button.querySelector('span');
      if (symbol) symbol.textContent = '✓';
      showToast(name + ' added to your bag.');
    });
  });

  toArray(document.querySelectorAll('.register')).forEach(function (button) {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () {
      var eventName = button.closest('article').querySelector('h3').textContent;
      var active = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('done', active);
      button.firstChild.nodeValue = active ? 'Registered ' : 'Register ';
      var symbol = button.querySelector('span');
      if (symbol) symbol.textContent = active ? '✓' : '↗';
      showToast(active ? 'You’re registered for ' + eventName + '.' : 'Registration removed for ' + eventName + '.');
    });
  });

  initializeDisclosures();
  initializeCarousel();
  initializeRevealAnimations();

  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (desktopMenuQuery.matches) setMenu(false, false);
      syncResponsiveDisclosures();
    }, 100);
  });
}());
