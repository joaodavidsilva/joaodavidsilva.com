# Markdown is the source; every page is agent-readable

The site must be equally usable by humans and agents, so Markdown with front-matter is the source format and HTML is a rendering of it. Every published page guarantees: a Markdown twin at the same path with `.md` (linked via `<link rel="alternate" type="text/markdown">`); an entry in `/llms.txt`; complete semantic HTML that works without JavaScript; and title, summary, dates, tags and canonical URL exposed as JSON-LD in HTML and as front-matter in the twin. These URLs are a public contract and must stay stable.
