// Site-wide constants shared by the Astro config and the build.
export const SITE_URL = 'https://joaodavidsilva.com';

// Paths owned by Projects with their own sites; the root site must never claim them.
export const RESERVED_PATHS = ['dotore', 'multiplication-tables', 'abrir'];

// The site's source repository; "Suggest a correction" opens issues there.
export const REPO_URL = 'https://github.com/joaodavidsilva/joaodavidsilva.com';

// The RSS/Atom feed of Articles and Studies; a public URL that must stay stable.
export const FEED_PATH = '/feed.xml';

// Waitlists the Worker accepts sign-ups for, by `source`, with the name shown to visitors (ADR-0004).
// A Project page offers one with `waitlist: <source>`.
export const WAITLISTS = { lozza: 'Lozza' };

// The same-origin Waitlist Worker endpoint (worker/index.js).
export const WAITLIST_ENDPOINT = '/api/waitlist';

// The public Turnstile site key of the Waitlist widget (Invisible mode). This is Cloudflare's
// "always passes, invisible" test key until the joaodavidsilva.com widget is created; its secret
// key is the TURNSTILE_SECRET_KEY Wrangler secret.
export const TURNSTILE_SITE_KEY = '1x00000000000000000000BB';
