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
    var ok = field.hasAttribute('data-email') ? EMAIL_RE.test(value) : value.length > 0;
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
        if (lb) missing.push(lb.textContent.replace('*', '').trim());
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
  document.getElementById('openBtn').addEventListener('click', openApply);
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
      if (el.value.trim() || f.classList.contains('err')) validateField(f);
    });
    el.addEventListener('input', function () {
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
