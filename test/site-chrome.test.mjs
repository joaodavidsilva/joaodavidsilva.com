import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
  ['Now', '/now/'],
  ['About', '/about/'],
];
const PAGES = {
  'index.html': ['https://joaodavidsilva.com/', 'Chrome home'],
  'writing/sample/index.html': ['https://joaodavidsilva.com/writing/sample/', 'Sample piece'],
};

const decode = (text) => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function attributesOf(tag) {
  const attrs = {};
  for (const [, name, value = ''] of tag.matchAll(/\s([\w-]+)(?:=("[^"]*"|'[^']*'|[^\s>"']+))?/g)) attrs[name] = decode(value.replace(/^["']|["']$/g, ''));
  return attrs;
}
function linksIn(fragment) {
  return [...fragment.matchAll(/(<a\b[^>]*>)(.*?)<\/a>/gs)].map(([, tag, text]) => {
    const attrs = attributesOf(tag);
    return { href: attrs.href, text: decode(text.replace(/<[^>]+>/g, '').trim()), attrs };
  });
}
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
const siteHeaderOf = (html) => elementAt(html, /<header\b[^>]*class="site-header"[^>]*>/);
const siteFooterOf = (html) => html.match(/<footer\b[^>]*>(?:(?!<footer\b).)*<\/footer>\s*<\/body>/s)?.[0] ?? '';

function transitioned([property, value]) {
  if (property === 'transition-property') return value.split(',').map((p) => p.trim());
  const timing = /^(\d|\.|ease|linear|step|cubic-bezier|allow-discrete|normal)/;
  return value.split(/,(?![^(]*\))/).flatMap((part) => part.trim().split(/\s+(?![^(]*\))/).filter((t) => !timing.test(t)));
}
const NO_PREFERENCE = '@media(prefers-reduced-motion:no-preference)';

/** Execute the built progressive-enhancement script against the public menu semantics. */
function runMenu(source) {
  const listeners = {};
  const node = () => ({ dataset: {}, listeners: {}, addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }, setAttribute(name, value) { this[name] = String(value); }, getAttribute(name) { return this[name] ?? null; } });
  const header = node();
  const button = node();
  const nav = node();
  const contact = node();
  const label = { textContent: 'Menu' };
  button.setAttribute('aria-expanded', 'false');
  button.dataset.menuLabel = 'Menu';
  button.dataset.closeLabel = 'Close';
  button.querySelector = (selector) => selector === '[data-menu-label]' ? label : null;
  button.focus = () => { button.focused = true; };
  header.querySelector = (selector) => ({ '[data-menu]': button, '[data-hcontact]': contact, '.site-nav': nav })[selector] ?? null;
  const document = { querySelector: (selector) => selector === '.site-header' ? header : null, addEventListener: (type, fn) => (listeners[type] ??= []).push(fn) };
  vm.runInNewContext(source, { document });
  return {
    header, button, nav, label,
    click: () => button.listeners.click.forEach((fn) => fn({})),
    navigate: () => nav.listeners.click.forEach((fn) => fn({ target: { closest: (selector) => selector === 'a' ? {} : null } })),
    escape: () => listeners.keydown.forEach((fn) => fn({ key: 'Escape' })),
    focused: () => button.focused,
  };
}

test('site chrome', async (t) => {
  const startDate = new Date().toISOString().slice(0, 10);
  const site = buildFixture('chrome');
  const endDate = new Date().toISOString().slice(0, 10);
  assert.ok(site.ok, site.output);
  const pages = Object.entries(PAGES).map(([file, [canonical, title]]) => ({ file, canonical, title, html: site.read(file) }));

  await t.test('a skip link targets the focusable main element on every page', () => {
    for (const { file, html } of pages) {
      assert.match(html, /<a\b[^>]*href="#main"[^>]*>Skip to content<\/a>/, file);
      const main = html.match(/<main\b[^>]*>/)?.[0] ?? '';
      assert.equal(attributesOf(main).id, 'main', file);
      assert.equal(attributesOf(main).tabindex, '-1', file);
    }
  });

  await t.test('the name links Home and Main navigation lists all six sections in order', () => {
    for (const { file, html } of pages) {
      const header = siteHeaderOf(html);
      assert.deepEqual(linksIn(header).filter((link) => link.attrs.class === 'site-name').map(({ text, href }) => [text, href]), [['João David Silva', '/']], file);
      const nav = elementAt(header, /<nav\b[^>]*id="site-nav"[^>]*>/);
      assert.equal(attributesOf(nav.match(/^<[^>]+>/)[0])['aria-label'], 'Main', file);
      assert.deepEqual(linksIn(nav).map(({ text, href }) => [text, href]), SECTIONS, file);
      const contact = linksIn(header).find((link) => 'data-hcontact' in link.attrs);
      assert.deepEqual(contact && [contact.text, contact.href], ['Contact', 'mailto:me@joaodavidsilva.com'], file);
    }
  });

  await t.test('internal chrome links target pages produced by the build', () => {
    for (const { file, html } of pages) {
      for (const { href } of [...linksIn(siteHeaderOf(html)), ...linksIn(siteFooterOf(html))]) {
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        const path = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
        assert.ok(site.has(path), `${file}: missing ${href}`);
      }
    }
  });

  await t.test('the mobile trigger exposes its controlled navigation and expanded state', () => {
    for (const { file, html } of pages) {
      const button = siteHeaderOf(html).match(/<button\b[^>]*data-menu[^>]*>/)?.[0];
      assert.ok(button, `${file}: no menu button`);
      const attrs = attributesOf(button);
      assert.equal(attrs.type, 'button');
      assert.equal(attrs['aria-controls'], 'site-nav');
      assert.equal(attrs['aria-expanded'], 'false');
      assert.match(button, /data-menu-label="Menu"/);
    }
  });

  await t.test('the one menu script toggles, closes after navigation and closes with Escape', () => {
    for (const { file, html } of pages) {
      assert.doesNotMatch(siteHeaderOf(html), /\son\w+=/, `${file}: inline event handler`);
      const scripts = [...html.matchAll(/<script\b([^>]*)>(.*?)<\/script>/gs)];
      const executable = scripts.filter(([attrs]) => !/application\/ld\+json/.test(attrs));
      assert.equal(executable.filter(([, body]) => body.trim()).length, 2, `${file}: expected theme and menu scripts only`);
      const menu = executable.find(([attrs]) => /data-menu-script/.test(attrs));
      assert.ok(menu, `${file}: no menu script`);
      const page = runMenu(menu[2]);
      page.click();
      assert.equal(page.button['aria-expanded'], 'true');
      assert.equal(page.header.dataset.open, 'true');
      assert.equal(page.label.textContent, 'Close');
      page.navigate();
      assert.equal(page.button['aria-expanded'], 'false');
      assert.equal(page.header.dataset.open, 'false');
      page.click();
      page.escape();
      assert.equal(page.button['aria-expanded'], 'false');
      assert.equal(page.label.textContent, 'Menu');
      assert.ok(page.focused());
    }
  });

  await t.test('only Articles map to Writing, Project pages to Projects, and Home has no current nav item', () => {
    const current = (html) => linksIn(elementAt(siteHeaderOf(html), /<nav\b[^>]*id="site-nav"[^>]*>/)).filter((link) => link.attrs['aria-current']).map((link) => [link.text, link.attrs['aria-current']]);
    assert.deepEqual(current(pages[0].html), []);
    assert.deepEqual(current(pages[1].html), [['Writing', 'page']]);
  });

  const rules = nestedRulesOf(stylesheetsOf(site, pages[0].html));
  await t.test('navigation remains visible without JavaScript and collapses only after enhancement at 820px', () => {
    const css = stylesheetsOf(site, pages[0].html);
    assert.match(css, /@media\s*\(width<=820px\)/);
    const enhancedHidden = rules.some((rule) => rule.context.includes('@media(width<=820px)') && /\[data-js\][^{]*\.site-nav/.test(rule.prelude) && rule.declarations.some(([p, v]) => p === 'display' && v === 'none'));
    assert.ok(enhancedHidden, 'the collapsed state is not scoped to JavaScript and the mobile breakpoint');
    const menuDisplay = rules.filter((rule) => (rule.prelude.includes('[data-menu]') || rule.prelude.includes('.menu-button')) && rule.declarations.some(([p]) => p === 'display'));
    assert.ok(menuDisplay.some((rule) => !rule.context.length && rule.declarations.some(([, v]) => v === 'none')));
    assert.ok(menuDisplay.some((rule) => /\[data-js\]/.test(rule.prelude) && rule.context.includes('@media(width<=820px)')));
  });

  await t.test('any motion animates only transform and opacity, and never under reduced motion', () => {
    for (const rule of rules.filter((r) => r.declarations.some(([p]) => p === 'transition' || p === 'transition-property'))) {
      for (const declaration of rule.declarations.filter(([p]) => p === 'transition' || p === 'transition-property')) {
        for (const property of transitioned(declaration)) assert.ok(['opacity', 'transform'].includes(property), `${rule.prelude} transitions ${property}`);
      }
      assert.ok(rule.context.includes(NO_PREFERENCE), `${rule.prelude} animates under reduced motion`);
    }
    assert.doesNotMatch(stylesheetsOf(site, pages[0].html), /@keyframes|animation\s*:/);
  });

  await t.test('pages cross-fade with View Transitions where supported, without a router', () => {
    const viewTransition = rules.find((r) => r.prelude === '@view-transition');
    assert.ok(viewTransition);
    assert.deepEqual(viewTransition.declarations, [['navigation', 'auto']]);
    assert.ok(viewTransition.context.includes(NO_PREFERENCE));
  });

  await t.test('the footer links feeds, llms.txt, Privacy, profiles, Email, licence and build date', () => {
    for (const { file, html } of pages) {
      const footer = siteFooterOf(html);
      const links = linksIn(footer);
      for (const href of ['/feed.xml', '/llms.txt', '/privacy/', 'https://github.com/joaodavidsilva', 'https://www.linkedin.com/in/joaodavidsilvaa/', 'https://x.com/joaodavidsilvaa', 'mailto:me@joaodavidsilva.com', 'https://creativecommons.org/licenses/by/4.0/', 'https://github.com/joaodavidsilva/joaodavidsilva.com/blob/main/LICENSE']) assert.ok(links.some((link) => link.href === href), `${file}: no ${href}`);
      assert.ok(links.some((link) => link.text === 'Email'));
      assert.match(readFileSync(join(root, 'LICENSE'), 'utf8'), /^MIT License/);
      const built = footer.match(/Built\s*<time datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
      assert.ok([startDate, endDate].includes(built));
      const nav = footer.match(/<nav\b[^>]*aria-label="Footer"[^>]*>/);
      assert.ok(nav, `${file}: no named Footer landmark`);
    }
  });

  await t.test('the footer build date never breaks across lines', () => {
    assert.ok(rules.some((r) => r.prelude === '.site-footer time' && r.declarations.some(([p, v]) => p === 'white-space' && v === 'nowrap')));
  });

  await t.test('the theme control lives in the footer, not the header', () => {
    for (const { file, html } of pages) {
      assert.doesNotMatch(siteHeaderOf(html), /theme-toggle/);
      assert.match(siteFooterOf(html), /class="theme-toggle"/);
    }
  });

  await t.test('every content page but Home ends with a correction link', () => {
    const home = pages[0];
    assert.doesNotMatch(elementAt(home.html, /<main\b[^>]*>/), /Suggest a correction/);
    for (const { file, html, canonical, title } of pages.slice(1)) {
      const main = elementAt(html, /<main\b[^>]*>/);
      const suggest = linksIn(main).at(-1);
      assert.equal(suggest?.text, 'Suggest a correction', file);
      const url = new URL(suggest.href);
      assert.equal(`${url.origin}${url.pathname}`, 'https://github.com/joaodavidsilva/joaodavidsilva.com/issues/new');
      assert.equal(url.searchParams.get('title'), `Correction: ${title}`);
      const templatePath = join(root, '.github', 'ISSUE_TEMPLATE', url.searchParams.get('template') ?? 'missing');
      assert.ok(existsSync(templatePath));
      const ids = [...readFileSync(templatePath, 'utf8').matchAll(/^\s*id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
      assert.equal(ids.filter((id) => url.searchParams.get(id) === canonical).length, 1);
    }
  });
});
