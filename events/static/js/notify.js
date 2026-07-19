/* PizzaPitch — waitlist form (between events)
 * Django: <form id="notifyForm" data-endpoint="{% url 'subscribe' %}"> + {% csrf_token %}
 * Empty/absent data-endpoint = demo mode (no backend call).
 */
(function () {
  'use strict';

  var form = document.getElementById('notifyForm');
  if (!form) return;

  var input = form.querySelector('input[name="email"]');
  var btn   = form.querySelector('button[type="submit"]');
  var msg   = document.getElementById('notifyMsg');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var i18nEl = document.getElementById('notify-i18n');
  var i18n   = i18nEl ? JSON.parse(i18nEl.textContent) : {};

  function say(text, kind) {
    msg.textContent = text;
    msg.className = 'msg2 ' + kind;
  }
  function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : '';
  }
  function csrfToken() {
    var i = form.querySelector('[name="csrfmiddlewaretoken"]');
    return (i && i.value) || getCookie('csrftoken');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = input.value.trim();

    if (!EMAIL_RE.test(email)) {
      say(i18n.invalidEmail, 'err');
      input.focus();
      return;
    }

    btn.disabled = true;
    btn.classList.add('loading');
    try {
      var endpoint = form.dataset.endpoint;
      if (endpoint && endpoint !== '#') {
        var data = new FormData(form);
        var res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrfToken() },
          body: data
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      }
      form.reset();
      say(i18n.success, 'ok');
    } catch (err) {
      say(i18n.error, 'err');
    } finally {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  });

  input.addEventListener('input', function () { msg.className = 'msg2'; });
})();
