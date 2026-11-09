# Waitlist operations

The Lozza Waitlist (ADR-0004): the form on `/projects/lozza/` posts to the Waitlist Worker (`worker/index.js`) at `/api/waitlist`, which stores sign-ups in the D1 database bound as `DB`. Tests: `test/waitlist-worker.test.mjs` (the Worker in the local runtime) and `test/waitlist-form.test.mjs` (the built page).

## One-time setup

Run from the repo root, logged in to the Cloudflare account that owns `joaodavidsilva.com`.

1. **D1 database**, stored in the EU:
   `pnpm exec wrangler d1 create joaodavidsilva-waitlist --jurisdiction eu`
   Copy the printed `database_id` into the `DB` entry of `wrangler.jsonc` and commit it (an ID, not a secret).
2. **Table:** `pnpm exec wrangler d1 migrations apply DB --remote`
3. **Turnstile widget:** Cloudflare dashboard → Turnstile → Add widget. Name `joaodavidsilva.com Waitlist`, hostname `joaodavidsilva.com`, widget mode **Invisible**. Then:
   - put the **site key** (public) in `TURNSTILE_SITE_KEY` in `site.config.mjs` and commit it;
   - store the **secret key** as a Worker secret, never in the repo: `pnpm exec wrangler secret put TURNSTILE_SECRET_KEY` (this deploys a new version).
4. Deploy as usual. Check with a real sign-up on a phone, then delete it (below).

Preview URLs share the production `DB` binding, but their hostnames are not on the widget, so Turnstile rejects sign-ups there.

## Running the list

- Read: `pnpm exec wrangler d1 execute DB --remote --command "SELECT email, source, consented_at, privacy_notice_version FROM signups ORDER BY id"`
- Remove someone who withdraws consent: `pnpm exec wrangler d1 execute DB --remote --command "DELETE FROM signups WHERE email = 'name@example.com'"`
- Schema change: add `migrations/000N_<name>.sql`, then step 2.
- Refresh the disposable-domain blocklist: `pnpm waitlist:blocklist`, run the tests, commit.

## When the privacy notice changes

The notice's last-updated date comes from git: the day of the last commit to `content/pages/privacy.md`. Set `PRIVACY_NOTICE_VERSION` in `wrangler.jsonc` to that date in the same commit; a test fails until it matches the `updated:` field of the built `/privacy.md`.

## Local development

Put `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (Cloudflare's always-passes test secret) in `.dev.vars` (ignored by git), run `pnpm exec wrangler d1 migrations apply DB --local`, `pnpm build` and `pnpm exec wrangler dev`. Locally the widget needs the test site key in `site.config.mjs`.
