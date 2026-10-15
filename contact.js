(() => {
  const form = document.querySelector('#enquiry-form');
  if (!form) return;
  const fields = document.querySelector('#enquiry-fields');
  const submit = document.querySelector('#enquiry-submit');
  const status = document.querySelector('#enquiry-status');
  const unavailable = document.querySelector('#enquiry-unavailable');
  const success = document.querySelector('#enquiry-success');
  const service = document.querySelector('#enquiry-service');
  const endpoint = String(window.ENQUIRY_CONFIG?.endpoint || '').trim();
  const configured = /^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i.test(endpoint);
  const services = {
    'proposal-review': 'Expert proposal review',
    'technical-consulting': 'Science & engineering consulting',
    'mission-planning': 'Mission & ISRU concept planning',
    'decision-support': 'Systems & decision support',
    'collaboration': 'Research collaboration',
    'talks': 'Talk or workshop',
    'general': 'General enquiry'
  };
  const requested = new URLSearchParams(location.search).get('service');
  if (Object.hasOwn(services, requested)) service.value = services[requested];

  if (configured) {
    form.action = endpoint;
    submit.disabled = false;
    unavailable.hidden = true;
  }

  let sending = false;
  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
    status.focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    if (!configured) {
      showStatus('This form is not accepting enquiries yet. You can connect with me on LinkedIn in the meantime.');
      return;
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    // Reject whitespace-only names and messages in addition to native validation.
    if (!String(data.get('name') || '').trim() || !String(data.get('message') || '').trim()) {
      showStatus('Please add your name and a message before submitting.');
      return;
    }
    sending = true;
    fields.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    form.setAttribute('aria-busy', 'true');
    status.hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', body: data, headers: { Accept: 'application/json' },
        credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin', signal: controller.signal
      });
      let result;
      try { result = await response.json(); } catch { result = null; }
      if (!response.ok || result?.ok !== true) {
        showStatus('Your enquiry could not be confirmed. Your message is still here. Please check your details and try again, or connect with me on LinkedIn.');
        return;
      }
      form.reset();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch {
      showStatus('We could not confirm whether your enquiry arrived. Your message is still here. Please try again later or connect with me on LinkedIn.');
    } finally {
      clearTimeout(timeout);
      sending = false;
      fields.disabled = false;
      submit.disabled = false;
      submit.textContent = 'Submit an enquiry';
      form.removeAttribute('aria-busy');
    }
  });
})();
