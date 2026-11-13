# Lozza waitlist on a Cloudflare Worker and D1

> **Superseded by [ADR-0006](0006-lozza-own-site.md).** The website no longer offers a Lozza Waitlist; this record remains for the existing operational infrastructure.

Lozza waitlist sign-ups are stored in Cloudflare D1 behind a same-origin Worker, rather than an email-marketing service (too expensive, or free tiers capped) or Supabase (Free projects pause after 7 days of inactivity and silently drop sign-ups). The Worker rejects malformed and disposable addresses, verifies a Cloudflare Turnstile token, deduplicates on the normalised address and stores email, consent timestamp, source and privacy-notice version. There is no double opt-in, since nothing sends email yet; consent is an explicit checkbox.

## Consequences

- Emailing the waitlist at launch requires choosing a sending service then.
- Sign-ups are stored with a `source`, so a later list (a newsletter, product updates) reuses the same Worker, validation and consent records; there is no newsletter at launch.
