# Lozza on its own site

Lozza is a native design tool for Mac and iPad, in development. It will have its own site and domain rather than a Project page on joaodavidsilva.com. Until that destination exists, the Projects index and Home show a truthful, unlinked own-site card.

This supersedes [ADR-0004](0004-lozza-waitlist-on-worker-and-d1.md) for the public website. The internal Lozza page, Waitlist interface and Waitlist privacy-notice section are removed. Existing Worker and stored-data operations are a separate decision and are unchanged here.

## Consequences

- `/projects/lozza/` and its Markdown twin are no longer generated, and Lozza has no `llms.txt` page entry.
- The site collects no new Lozza Waitlist sign-ups.
- When Lozza's own URL exists, the external card can link to it without creating an internal page.
