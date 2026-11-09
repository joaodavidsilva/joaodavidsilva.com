// Sends the Waitlist form to the Worker without leaving the page and announces its answer.
// The form unlocks once the Turnstile bot check passes; without JavaScript it stays disabled.
const form = document.querySelector('form[data-waitlist]');
const fields = form.querySelector('fieldset');
const email = form.querySelector('input[type="email"]');
const status = form.querySelector('[role="status"]');
const widget = form.querySelector('.cf-turnstile');
const words = JSON.parse(form.dataset.messages);
const BOT_CHECK_TIMEOUT_MS = 10_000;
// Answers about the address itself, tied to the email field so it is announced as invalid.
const EMAIL_REASONS = new Set(['invalid-email', 'disposable-email']);

const say = (message, result) => {
  status.textContent = message;
  form.dataset.result = result;
};
const markEmail = (invalid) => {
  if (invalid) {
    email.setAttribute('aria-invalid', 'true');
    email.setAttribute('aria-describedby', status.id);
  } else {
    email.removeAttribute('aria-invalid');
    email.removeAttribute('aria-describedby');
  }
};

let ready = false;
const unavailable = () => {
  if (!ready) say(words.unavailable, 'unavailable');
};
const timer = setTimeout(unavailable, BOT_CHECK_TIMEOUT_MS);
const unlock = () => {
  if (ready) return;
  ready = true;
  clearTimeout(timer);
  fields.disabled = false;
  if (form.dataset.result === 'unavailable') say('', '');
};
// Named in the widget's data-callback and data-error-callback. Turnstile retries after an
// error, so a later pass still unlocks the form.
globalThis.waitlistBotCheckPassed = unlock;
globalThis.waitlistBotCheckFailed = unavailable;
// The check may have passed before this script ran.
if (form.querySelector('[name="cf-turnstile-response"]')?.value) unlock();

email.addEventListener('input', () => markEmail(false));
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (!data.get('cf-turnstile-response')) {
    say(words.checking, 'rejected');
    return;
  }
  markEmail(false);
  fields.disabled = true;
  say(words.joining, 'pending');
  try {
    const response = await fetch(form.action, { method: 'POST', body: data });
    const body = await response.json();
    say(body.message, body.status);
    markEmail(EMAIL_REASONS.has(body.reason));
    if (body.status !== 'rejected') form.reset();
  } catch {
    say(words.offline, 'rejected');
  } finally {
    fields.disabled = false;
    // A Turnstile token is valid for one check only.
    globalThis.turnstile?.reset(widget);
  }
});
