import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixture } from './build.mjs';
import { stylesheetsOf, nestedRulesOf } from './css.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SECTIONS = [
  ['Writing', '/writing/'],
  ['Research', '/research/'],
  ['Knowledge', '/knowledge/'],
  ['Projects', '/projects/'],
  ['About', '/about/'],
];

// Built file → [canonical URL, title] for every page of the `chrome` fixture.
const PAGES = {
  'index.html': ['https://joaodavidsilva.com/', 'Chrome home'],
  'writing/sample/index.html': ['https://joaodavidsilva.com/writing/sample/', 'Sample piece'],
};

const decode = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** The attributes of an opening tag; valueless attributes map to ''. */
function attributesOf(tag) {
  const attrs = {};
  for (const [, name, value = ''] of tag.matchAll(/\s([\w-]+)(?:=("[^"]*"|'[^']*'|[^\s>"']+))?/g)) {
    attrs[name] = decode(value.replace(/^["']|["']$/g, ''));
  }
  return attrs;
}

/** Every link in a fragment as { href, text, attrs }. */
function linksIn(fragment) {
  return [...fragment.matchAll(/(<a\b[^>]*>)(.*?)<\/a>/gs)].map(([, tag, text]) => {
    const attrs = attributesOf(tag);
    return { href: attrs.href, text: decode(text.replace(/<[^>]+>/g, '').trim()), attrs };
  });
}

/** The outer HTML of the element whose opening tag matches `opening`, honouring nesting. */
function elementAt(html, opening) {
  const match = html.match(opening);
  assert.ok(match, `no element matching ${opening}`);
  const name = match[0].match(/^<(\w+)/)[1];
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
  tags.lastIndex = match.index + match[0].length;
  let depth = 1;
  for (let tag; (tag = tags.exec(html)); ) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return html.slice(match.index, tag.index + tag[0].length);
  }
  assert.fail(`unclosed <${name}>`);
}

const siteHeaderOf = (html) => elementAt(html, /(?<=<body[^>]*>\s*)<header\b[^>]*>/);
const siteFooterOf = (html) => html.match(/<footer\b[^>]*>(?:(?!<footer\b).)*<\/footer>\s*<\/body>/s)?.[0] ?? '';

/** The properties a `transition` or `transition-property` value animates. */
function transitioned([property, value]) {
  if (property === 'transition-property') return value.split(',').map((p) => p.trim());
  const timing = /^(\d|\.|ease|linear|step|cubic-bezier|allow-discrete|normal)/;
  return value.split(/,(?![^(]*\))/).flatMap((part) => part.trim().split(/\s+(?![^(]*\))/).filter((t) => !timing.test(t)));
}

const NO_PREFERENCE = '@media(prefers-reduced-motion:no-preference)';

test('site chrome', async (t) => {
  const startDate = new Date().toISOString().slice(0, 10);
  const site = buildFixture('chrome');
  const endDate = new Date().toISOString().slice(0, 10);
  assert.ok(site.ok, site.output);
  const pages = Object.entries(PAGES).map(([file, [canonical, title]]) => ({
    file,
    canonical,
    title,
    html: site.read(file),
  }));

  await t.test('on wide screens the name links Home, followed by every section, on every page', () => {
    for (const { file, html } of pages) {
      const links = linksIn(siteHeaderOf(html));
      assert.deepEqual(
        links.map(({ text, href }) => [text, href]),
        [['João David Silva', '/'], ...SECTIONS],
        file,
      );
    }
  });

  await t.test('on narrow screens a menu button opens the sections in a native popover', () => {
    for (const { file, html } of pages) {
      const header = siteHeaderOf(html);
      const button = header.match(/<button\b[^>]*\bpopovertarget="[^"]+"[^>]*>/)?.[0];
      assert.ok(button, `${file}: no popover menu button`);
      const target = attributesOf(button).popovertarget;
      assert.ok(!('popovertargetaction' in attributesOf(button)) || attributesOf(button).popovertargetaction === 'toggle');
      const menu = elementAt(header, new RegExp(`<\\w+\\b[^>]*\\bid="${target}"[^>]*>`));
      // `auto` popovers close on Escape and on a tap outside them, and return focus to the button.
      assert.match(attributesOf(menu.match(/^<[^>]+>/)[0]).popover ?? 'missing', /^(|auto)$/, `${file}: menu is not an auto popover`);
      assert.deepEqual(
        linksIn(menu).map(({ text, href }) => [text, href]),
        SECTIONS,
        `${file}: the menu does not offer every section`,
      );
      const close = menu.match(/<button\b[^>]*>/)?.[0];
      assert.ok(close, `${file}: the menu has no close button`);
      assert.equal(attributesOf(close).popovertarget, target);
      assert.equal(attributesOf(close).popovertargetaction, 'hide');
    }
  });

  await t.test('the menu works without custom JavaScript', () => {
    for (const { file, html } of pages) {
      assert.doesNotMatch(siteHeaderOf(html), /\son\w+=/, `${file}: inline event handler`);
      assert.doesNotMatch(html, /<script\b(?![^>]*application\/ld\+json)/, `${file}: script`);
    }
  });

  await t.test('the section of the current page is marked', () => {
    const current = (html) => linksIn(siteHeaderOf(html)).filter((l) => 'aria-current' in l.attrs);
    const home = pages.find((p) => p.file === 'index.html').html;
    assert.deepEqual(current(home).map((l) => [l.text, l.attrs['aria-current']]), [['João David Silva', 'page']]);
    const sample = pages.find((p) => p.file === 'writing/sample/index.html').html;
    const marked = current(sample).map((l) => [l.text, l.attrs['aria-current']]);
    assert.deepEqual([...new Set(marked.map(String))], ['Writing,true']);
  });

  const rules = nestedRulesOf(stylesheetsOf(site, pages[0].html));

  await t.test('motion animates only transform and opacity, and only without a reduced-motion preference', () => {
    const transitions = rules.filter((r) => r.declarations.some(([p]) => p === 'transition' || p === 'transition-property'));
    assert.ok(transitions.length, 'no transitions');
    for (const rule of transitions) {
      for (const declaration of rule.declarations.filter(([p]) => p === 'transition' || p === 'transition-property')) {
        for (const property of transitioned(declaration)) {
          assert.ok(['opacity', 'transform'].includes(property), `${rule.prelude} transitions ${property}`);
        }
      }
      assert.ok(rule.context.includes(NO_PREFERENCE), `${rule.prelude} animates under reduced motion`);
    }
    assert.doesNotMatch(stylesheetsOf(site, pages[0].html), /@keyframes|animation\s*:/);

    const starting = rules.filter((r) => r.context.includes('@starting-style') || r.prelude === '@starting-style');
    assert.ok(starting.length, 'the menu has no @starting-style entry');
    for (const rule of starting) {
      for (const [property] of rule.declarations) {
        assert.ok(['opacity', 'transform'].includes(property), `@starting-style sets ${property}`);
      }
    }
  });

  await t.test('pages cross-fade with View Transitions where supported, and navigate normally elsewhere', () => {
    const viewTransition = rules.find((r) => r.prelude === '@view-transition');
    assert.ok(viewTransition, 'no @view-transition rule');
    assert.deepEqual(viewTransition.declarations, [['navigation', 'auto']]);
    assert.ok(viewTransition.context.includes(NO_PREFERENCE), 'page transitions run under reduced motion');
    // A CSS opt-in: browsers without View Transitions ignore it; no client-side router takes over links.
    for (const { html } of pages) assert.doesNotMatch(html, /<script\b(?![^>]*application\/ld\+json)/);
  });

  await t.test('the footer links feeds, llms.txt, profiles, email, licence and build date on every page', () => {
    for (const { file, html } of pages) {
      const footer = siteFooterOf(html);
      assert.ok(footer, `${file}: no site footer`);
      const hrefs = linksIn(footer).map((l) => l.href);
      for (const href of [
        '/feed.xml',
        '/llms.txt',
        'https://github.com/joaodavidsilva',
        'https://www.linkedin.com/in/joaodavidsilvaa/',
        'https://x.com/joaodavidsilvaa',
        'mailto:me@joaodavidsilva.com',
        'https://creativecommons.org/licenses/by/4.0/',
        'https://github.com/joaodavidsilva/joaodavidsilva.com/blob/main/LICENSE',
      ]) {
        assert.ok(hrefs.includes(href), `${file}: footer does not link ${href}`);
      }
      assert.match(footer, /me@joaodavidsilva\.com/);
      assert.match(readFileSync(join(root, 'LICENSE'), 'utf8'), /^MIT License/);
      const built = footer.match(/Built\s*<time datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
      assert.ok([startDate, endDate].includes(built), `${file}: build date ${built} is not the build day`);
    }
  });

  await t.test('every content page ends with a link suggesting a correction', () => {
    for (const { file, html, canonical, title } of pages) {
      const main = elementAt(html, /<main\b[^>]*>/);
      const links = linksIn(main);
      const suggest = links.at(-1);
      assert.equal(suggest?.text, 'Suggest a correction', `${file}: the page does not end with the link`);
      assert.ok(main.indexOf('body paragraph') < main.lastIndexOf('Suggest a correction'));

      const url = new URL(suggest.href);
      assert.equal(`${url.origin}${url.pathname}`, 'https://github.com/joaodavidsilva/joaodavidsilva.com/issues/new');
      assert.equal(url.searchParams.get('title'), `Correction: ${title}`);
      const template = url.searchParams.get('template');
      const templatePath = join(root, '.github', 'ISSUE_TEMPLATE', template ?? 'missing');
      assert.ok(existsSync(templatePath), `${file}: no issue template ${template}`);
      // Issue forms pre-fill the field whose id matches a query parameter.
      const ids = [...readFileSync(templatePath, 'utf8').matchAll(/^\s*id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
      const filled = ids.filter((id) => url.searchParams.get(id) === canonical);
      assert.equal(filled.length, 1, `${file}: no issue form field is pre-filled with ${canonical}`);
    }
  });
});
