// Site-wide constants shared by the Astro config and the build.
export const SITE_URL = 'https://joaodavidsilva.com';

// Paths owned by Projects with their own sites; the root site must never claim them.
export const RESERVED_PATHS = ['dotore', 'multiplication-tables', 'abrir'];

// The site's source repository; "Suggest a correction" opens issues there.
export const REPO_URL = 'https://github.com/joaodavidsilva/joaodavidsilva.com';

// The RSS/Atom feed of Articles and Studies; a public URL that must stay stable.
export const FEED_PATH = '/feed.xml';

// Languages a page may exist in, by code, with each language's own name for the switcher.
// English is the Original at the root; every other language is a Translation under `/<code>/`,
// so no English page may start with another language's code.
export const LANGUAGES = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

// The fixed Knowledge Base categories, in index order (spec #1, ADR-0002).
export const KNOWLEDGE_CATEGORIES = [
  'AI Engineering',
  'Context Engineering',
  'Agent Orchestration',
  'Harness Engineering',
  'MCP & Tooling',
  'Software Engineering',
  'Architecture & Design Patterns',
  'Development Processes & Methodologies',
  'Technical References & Guides',
];

// Where Skills live; a Guide's `skill` links to its SKILL.md here.
export const SKILLS_REPO_URL = 'https://github.com/joaodavidsilva/skills';
