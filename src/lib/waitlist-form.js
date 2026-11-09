// Sends the Waitlist form to the Worker without leaving the page and announces its answer.
// Without JavaScript the form stays disabled: the Turnstile bot check needs it.
for (const form of document.querySelectorAll('form[data-waitlist]')) {
  const fields = form.querySelector('fieldset');
  const status = form.querySelector('[role="status"]');
  const widget = form.querySelector('.cf-turnstile');
  const say = (message, result) => {
    status.textContent = message;
    form.dataset.result = result;
  };

  fields.disabled = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (!data.get('cf-turnstile-response')) {
      say('The bot check is still running. Try again in a moment.', 'rejected');
      return;
    }
    fields.disabled = true;
    say('Joining…', 'pending');
    try {
      const response = await fetch(form.action, { method: 'POST', body: data });
      const body = await response.json();
      say(body.message, body.status);
      if (body.status !== 'rejected') form.reset();
    } catch {
      say('The sign-up could not be sent. Check your connection and try again.', 'rejected');
    } finally {
      fields.disabled = false;
      // A Turnstile token is valid for one check only.
      globalThis.turnstile?.reset(widget);
    }
  });
}
