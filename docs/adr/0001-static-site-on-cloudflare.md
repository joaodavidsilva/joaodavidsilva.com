# Static site on Cloudflare at joaodavidsilva.com

The website is fully static, served as Cloudflare Workers static assets on `joaodavidsilva.com`; the domain, DNS and hosting live on Cloudflare, while source and issues stay on GitHub. Every public feature is presented on the site, but anything needing request-time computation is kept out of page rendering: the CV (a PDF) is generated at build time and search uses an index built at build time. The public Lozza Waitlist was removed by [ADR-0006](0006-lozza-own-site.md); its same-origin endpoint and Worker remain dormant on Cloudflare pending a separate operational teardown, with no browser UI posting to them. GitHub Pages was rejected because it would split the stack across three vendors (GitHub Pages, Cloudflare DNS, a database host) and its free database options pause. A job-description-tailored CV was considered and dropped; it was the only proposed feature that needed a server-side model call. A DOCX version of the CV was dropped too: nobody edits it, and the PDF is what applications and recruiters use.

## Consequences

- GitHub Pages project sites (e.g. `/dotore/`) no longer inherit the custom domain; they stay on `joaodavidsilva.github.io` unless explicitly brought under `joaodavidsilva.com`.
