/* PizzaPitch — apply flow
 * Django integration:
 *   - Set the endpoint on the form: <form id="applyForm" data-endpoint="{% url 'apply' %}">
 *   - Include {% csrf_token %} inside the form (renders the hidden csrfmiddlewaretoken input).
 *   - If data-endpoint is empty or "#", the form runs in DEMO mode: it validates and shows
 *     the confirmation screen without hitting a backend (useful for previewing the flow).
 */
(function () {
  'use strict';

  var form      = document.getElementById('applyForm');
  if (!form) return;

  var overlay   = document.getElementById('overlay');
  var sheetBody = document.querySelector('.sheet-body');
  var alertBox  = document.getElementById('formAlert');
  var submitBtn = form.querySelector('button[type="submit"]');
  var heroImg   = document.getElementById('heroPhoto');

  var panels = {};
  document.querySelectorAll('.panel').forEach(function (p) { panels[p.dataset.panel] = p; });
  var pips = Array.prototype.slice.call(document.querySelectorAll('.pip'));

  var EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var STEP_INDEX = { type: 1, form: 2, done: 3 };
  var state      = { type: null, step: 'type' };

  var i18nEl = document.getElementById('i18n-strings');
  var i18n   = i18nEl ? JSON.parse(i18nEl.textContent) : {};

  var DONE_STEPS = {
    startup: i18n.doneStepsStartup || [],
    guest: i18n.doneStepsGuest || []
  };

  /* ---------- helpers ---------- */
  function showAlert(msg) { alertBox.textContent = msg; alertBox.classList.add('show'); }
  function hideAlert()    { alertBox.classList.remove('show'); }

  function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : '';
  }
  function csrfToken() {
    var input = form.querySelector('[name="csrfmiddlewaretoken"]');
    return (input && input.value) || getCookie('csrftoken');
  }

  /* ---------- panels ---------- */
  function show(name) {
    Object.keys(panels).forEach(function (k) { panels[k].classList.remove('show'); });
    panels[name].classList.add('show');
    state.step = name;
    var idx = STEP_INDEX[name];
    pips.forEach(function (p, i) { p.classList.toggle('on', i < idx); });
    if (sheetBody) sheetBody.scrollTop = 0;
  }

  function openApply() {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    show('type');
  }
  function closeApply() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    resetForm();
  }
  function resetForm() {
    form.reset();
    state.type = null;
    hideAlert();
    form.querySelectorAll('.field.err').forEach(function (f) { f.classList.remove('err'); });
  }

  /* ---------- type selection ---------- */
  function selectType(type) {
    state.type = type;
    var isStartup = type === 'startup';
    form.querySelector('.only-startup').hidden = !isStartup;
    form.querySelector('.only-guest').hidden   = isStartup;
    document.getElementById('formTitle').textContent = isStartup ? i18n.formTitleStartup : i18n.formTitleGuest;
    document.getElementById('formSub').textContent   = isStartup ? i18n.formSubStartup : i18n.formSubGuest;
    hideAlert();
    show('form');
    requestAnimationFrame(function () {
      var first = form.querySelector('input[name="name"]');
      if (first) first.focus();
    });
  }

  /* ---------- validation ---------- */
  // Only validate required fields that aren't inside a hidden group.
  function requiredFields() {
    return Array.prototype.slice.call(form.querySelectorAll('[data-req]'))
      .filter(function (f) { return !f.closest('[hidden]'); });
  }
  function validateField(field) {
    var el = field.querySelector('input, select, textarea');
    var value = (el.value || '').trim();
    var ok = el.type === 'checkbox' ? el.checked
      : field.hasAttribute('data-email') ? EMAIL_RE.test(value) : value.length > 0;
    field.classList.toggle('err', !ok);
    return ok;
  }

  /* ---------- submit ---------- */
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
  }

  function renderDone(email) {
    var template = i18n.doneSubTemplate || '{email}';
    document.getElementById('doneSub').textContent = template.replace('{email}', email);
    document.getElementById('whatnext').innerHTML = (DONE_STEPS[state.type] || DONE_STEPS.guest)
      .map(function (s, i) { return '<p><span class="n">' + (i + 1) + '</span><span>' + s + '</span></p>'; })
      .join('');
  }

  async function submitForm() {
    var endpoint = form.dataset.endpoint;
    var email = form.querySelector('input[name="email"]').value.trim();

    setLoading(true);
    try {
      if (endpoint && endpoint !== '#') {
        var data = new FormData(form);
        data.append('type', state.type);
        var res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken() },
          body: data
        });
        if (!res.ok) {
          var message = i18n.genericError;
          try {
            var payload = await res.json();
            if (payload && payload.error) message = payload.error;
          } catch (parseErr) { /* keep default message */ }
          var apiErr = new Error(message);
          apiErr.isApiError = true;
          throw apiErr;
        }
      }
      renderDone(email);
      show('done');
    } catch (err) {
      showAlert(err.isApiError ? err.message : i18n.genericError);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    var fields = requiredFields();
    var firstErr = null;
    var missing = [];
    fields.forEach(function (f) {
      if (!validateField(f)) {
        if (!firstErr) firstErr = f;
        var lb = f.querySelector('label');
        if (f.dataset.label) missing.push(f.dataset.label);
        else if (lb) missing.push(lb.textContent.replace('*', '').trim());
      }
    });
    if (firstErr) {
      showAlert((i18n.fillFieldsPrefix || '') + missing.join(', '));
      if (firstErr.scrollIntoView) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErr.querySelector('input, select, textarea').focus({ preventScroll: true });
      return;
    }
    hideAlert();
    submitForm();
  }

  /* ---------- events ---------- */
  var openBtn = document.getElementById('openBtn');
  if (openBtn) openBtn.addEventListener('click', openApply);
  document.getElementById('closeBtn').addEventListener('click', closeApply);
  document.getElementById('backdrop').addEventListener('click', closeApply);
  document.getElementById('doneClose').addEventListener('click', closeApply);
  document.getElementById('backBtn').addEventListener('click', function () {
    if (state.step === 'form') show('type'); else closeApply();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeApply();
  });

  document.querySelectorAll('.choice').forEach(function (btn) {
    btn.addEventListener('click', function () { selectType(btn.dataset.type); });
  });

  form.querySelectorAll('[data-req]').forEach(function (f) {
    var el = f.querySelector('input, select, textarea');
    el.addEventListener('blur', function () {
      if ((el.type !== 'checkbox' && el.value.trim()) || f.classList.contains('err')) validateField(f);
    });
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () {
      if (f.classList.contains('err')) validateField(f);
      hideAlert();
    });
  });

  form.addEventListener('submit', handleSubmit);

  // Hero image fallback (kept out of inline handlers for CSP-friendliness)
  if (heroImg) {
    heroImg.addEventListener('error', function () {
      heroImg.style.display = 'none';
      var fb = heroImg.nextElementSibling;
      if (fb) fb.style.display = 'flex';
    });
  }
})();

/* Experts rail — click-and-drag on desktop (mouse), native touch swipe on mobile.
 * Pointer events are gated to pointerType 'mouse' so touch/pen keep the browser's
 * own smooth, momentum-driven scrolling instead of being fought by JS.
 */
(function () {
  'use strict';

  var rail = document.getElementById('expertsRail');
  if (!rail) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var dragging = false, moved = false;
  var startX = 0, startScroll = 0;
  var lastX = 0, lastT = 0, velocity = 0;
  var glideId = null;

  function stopGlide() {
    if (glideId) { cancelAnimationFrame(glideId); glideId = null; }
  }

  function glide() {
    velocity *= 0.95;
    if (Math.abs(velocity) < 0.3) {
      glideId = null;
      rail.classList.remove('dragging'); // re-enable scroll-snap now that JS is done moving it
      return;
    }
    rail.scrollLeft -= velocity;
    glideId = requestAnimationFrame(glide);
  }

  rail.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return; // let touch/pen use native scrolling
    dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = rail.scrollLeft;
    lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    stopGlide();
    rail.setPointerCapture(e.pointerId);
    rail.classList.add('dragging');
  });

  rail.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    rail.scrollLeft = startScroll - dx;

    var now = performance.now();
    var dt = now - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt * 16; // px per ~frame
    lastX = e.clientX;
    lastT = now;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (!reduceMotion && Math.abs(velocity) > 0.5) {
      glideId = requestAnimationFrame(glide); // keeps .dragging (snap disabled) until it settles
    } else {
      rail.classList.remove('dragging');
    }
  }

  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') endDrag(); });

  // Swallow the click that follows an actual drag so it doesn't act like a tap.
  rail.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

  // Trackpad/mouse-wheel: turn vertical wheel intent into horizontal scroll.
  rail.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      rail.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
})();

/* Partners ribbon — static logo strip, draggable with mouse or touch via
 * Pointer Events. The track renders the logo set twice back-to-back so
 * wrapping the offset at the halfway point is seamless in both directions.
 */
(function () {
  'use strict';

  var ribbon = document.getElementById('partnersRibbon');
  var track = document.getElementById('partnersTrack');
  if (!ribbon || !track) return;

  var half = 0; // width of one logo set (track holds two)
  function measure() { half = track.scrollWidth / 2; }
  measure();
  window.addEventListener('resize', measure);

  var offset = 0; // current translateX

  // wrap offset into [-half, 0] so dragging past an end loops seamlessly
  function norm(x) {
    if (half <= 0) return x;
    x = x % half;
    if (x > 0) x -= half;
    return x;
  }

  // ---- drag (mouse + touch via Pointer Events) ----
  var dragging = false, startX = 0, startOffset = 0, moved = 0;

  ribbon.addEventListener('pointerdown', function (e) {
    dragging = true;
    moved = 0;
    startX = e.clientX;
    startOffset = offset;
    ribbon.classList.add('dragging');
    ribbon.setPointerCapture(e.pointerId);
  });

  ribbon.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    moved += Math.abs(dx);
    offset = norm(startOffset + dx);
    track.style.transform = 'translateX(' + offset + 'px)';
  });

  function up() {
    if (!dragging) return;
    dragging = false;
    ribbon.classList.remove('dragging');
  }
  ribbon.addEventListener('pointerup', up);
  ribbon.addEventListener('pointercancel', up);

  // swallow accidental click after a real drag (so logo links don't fire)
  ribbon.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
})();

/* Partner inquiry popup — "become a partner" lead form (email + message). */
(function () {
  'use strict';

  var overlay = document.getElementById('partnerOverlay');
  var form = document.getElementById('partnerInquiryForm');
  if (!overlay || !form) return;

  var ctaLink = document.getElementById('partnerCtaLink');
  var closeBtn = document.getElementById('partnerCloseBtn');
  var backdrop = document.getElementById('partnerBackdrop');
  var doneClose = document.getElementById('partnerDoneClose');
  var alertBox = document.getElementById('partnerFormAlert');
  var submitBtn = form.querySelector('button[type="submit"]');
  var defaultAlertText = alertBox.textContent;

  var panels = {};
  overlay.querySelectorAll('[data-partner-panel]').forEach(function (p) {
    panels[p.dataset.partnerPanel] = p;
  });

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function show(name) {
    Object.keys(panels).forEach(function (k) { panels[k].classList.remove('show'); });
    panels[name].classList.add('show');
  }

  function open() {
    show('form');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    form.reset();
    hideAlert();
    form.querySelectorAll('.field.err').forEach(function (f) { f.classList.remove('err'); });
  }

  function showAlert(text) {
    alertBox.textContent = text || defaultAlertText;
    alertBox.classList.add('show');
  }
  function hideAlert() { alertBox.classList.remove('show'); }

  function validateField(field) {
    var el = field.querySelector('input, textarea');
    var value = (el.value || '').trim();
    var ok = field.hasAttribute('data-email') ? EMAIL_RE.test(value) : value.length > 0;
    field.classList.toggle('err', !ok);
    return ok;
  }

  function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : '';
  }
  function csrfToken() {
    var input = form.querySelector('[name="csrfmiddlewaretoken"]');
    return (input && input.value) || getCookie('csrftoken');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
  }

  async function submitForm() {
    var endpoint = form.dataset.endpoint;
    setLoading(true);
    try {
      if (endpoint && endpoint !== '#') {
        var data = new FormData(form);
        var res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken() },
          body: data
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      }
      show('done');
    } catch (err) {
      showAlert(form.dataset.genericError);
    } finally {
      setLoading(false);
    }
  }

  if (ctaLink) ctaLink.addEventListener('click', function (e) { e.preventDefault(); open(); });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  doneClose.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  form.querySelectorAll('[data-req]').forEach(function (f) {
    var el = f.querySelector('input, textarea');
    el.addEventListener('blur', function () {
      if (el.value.trim() || f.classList.contains('err')) validateField(f);
    });
    el.addEventListener('input', function () {
      if (f.classList.contains('err')) validateField(f);
      hideAlert();
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = Array.prototype.slice.call(form.querySelectorAll('[data-req]'));
    var firstErr = null;
    fields.forEach(function (f) {
      if (!validateField(f) && !firstErr) firstErr = f;
    });
    if (firstErr) {
      showAlert();
      firstErr.querySelector('input, textarea').focus({ preventScroll: true });
      return;
    }
    hideAlert();
    submitForm();
  });
})();
