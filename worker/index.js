// The Waitlist Worker (ADR-0004). It answers POST /api/waitlist from the site's own pages with a
// small JSON status (created, already signed up, or rejected with a reason) and stores sign-ups in D1,
// which nothing else exposes. Every other request is served from the static assets.
import { WAITLISTS, WAITLIST_ENDPOINT } from '../site.config.mjs';
import disposableList from './disposable-domains.txt';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_LENGTH = 2048;

// The lists a sign-up can join, by `source`, with the name shown back to the visitor.
const SOURCES = new Map(Object.entries(WAITLISTS));

// Disposable-domain blocklist: github.com/disposable-email-domains/disposable-email-domains (CC0).
// Refresh with `pnpm waitlist:blocklist`.
const DISPOSABLE = new Set(disposableList.split('\n').filter(Boolean));

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

const REJECTIONS = {
  'method-not-allowed': [405, 'Only POST requests are accepted.'],
  'forbidden-origin': [403, 'Sign-ups from another origin are not accepted.'],
  'payload-too-large': [413, 'The request is too large.'],
  'invalid-request': [400, 'The request could not be read. Reload the page and try again.'],
  'unknown-source': [400, 'There is no such list to join.'],
  'consent-required': [400, 'Tick the consent box to join the list.'],
  'invalid-email': [400, 'Enter a valid email address, like name@example.com.'],
  'disposable-email': [400, 'Disposable email addresses cannot join the list. Use an address you will keep.'],
  'bot-check-failed': [403, 'The bot check failed. Reload the page and try again.'],
  'bot-check-unavailable': [503, 'The bot check is unavailable right now. Try again in a few minutes.'],
};

const reply = (status, body, headers) => Response.json(body, { status, headers });

function rejected(reason, headers) {
  const [status, message] = REJECTIONS[reason];
  console.log(JSON.stringify({ event: 'waitlist', status: 'rejected', reason }));
  return reply(status, { status: 'rejected', reason, message }, headers);
}

/** The normalised address: trimmed and lower-cased, so one mailbox is one sign-up. */
const normalise = (email) => email.trim().toLowerCase();

function isValidEmail(email) {
  if (email.length > 254) return false;
  const at = email.lastIndexOf('@');
  if (at < 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length <= 64 && LOCAL_PART.test(local) && domain.length <= 253 && DOMAIN.test(domain);
}

/** Whether the domain, or any domain it is a subdomain of, is on the blocklist. */
function isDisposable(email) {
  const labels = email.slice(email.lastIndexOf('@') + 1).split('.');
  return labels.some((_, i) => DISPOSABLE.has(labels.slice(i).join('.')));
}

/** Verifies a Turnstile token with Siteverify; undefined when Siteverify cannot answer. */
async function verifyTurnstile(token, request, env) {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetch(SITEVERIFY, { method: 'POST', body });
    if (!response.ok) return undefined;
    return (await response.json()).success === true;
  } catch {
    return undefined;
  }
}

async function signUp(request, env) {
  if (request.method !== 'POST') return rejected('method-not-allowed', { Allow: 'POST' });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return rejected('forbidden-origin');
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return rejected('payload-too-large');

  let form;
  try {
    form = await request.formData();
  } catch {
    return rejected('invalid-request');
  }
  const field = (name) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };

  const source = field('source');
  if (!SOURCES.has(source)) return rejected('unknown-source');
  if (field('consent') !== 'yes') return rejected('consent-required');
  const email = normalise(field('email'));
  if (!isValidEmail(email)) return rejected('invalid-email');
  if (isDisposable(email)) return rejected('disposable-email');

  const token = field('cf-turnstile-response');
  if (!token || token.length > MAX_TOKEN_LENGTH) return rejected('bot-check-failed');
  const human = await verifyTurnstile(token, request, env);
  if (human === undefined) return rejected('bot-check-unavailable');
  if (!human) return rejected('bot-check-failed');

  const { meta } = await env.DB.prepare(
    `INSERT INTO signups (email, source, consented_at, privacy_notice_version) VALUES (?, ?, ?, ?)
     ON CONFLICT (email, source) DO NOTHING`,
  )
    .bind(email, source, new Date().toISOString(), env.PRIVACY_NOTICE_VERSION)
    .run();

  const list = SOURCES.get(source);
  if (meta.changes === 0) {
    console.log(JSON.stringify({ event: 'waitlist', status: 'already-signed-up', source }));
    return reply(200, { status: 'already-signed-up', message: `You're already on the list. You'll hear when ${list} is available.` });
  }
  console.log(JSON.stringify({ event: 'waitlist', status: 'created', source }));
  return reply(201, { status: 'created', message: `You're on the list. You'll hear when ${list} is available.` });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === WAITLIST_ENDPOINT) return signUp(request, env);
    return reply(404, { status: 'not-found' });
  },
};
