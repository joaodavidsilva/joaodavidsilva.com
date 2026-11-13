import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildFixture } from './build.mjs';
import { stylesheetsOf, nestedRulesOf } from './css.mjs';

const FILES = ['index.html', 'writing/sample/index.html'];
function themeScriptOf(html) {
  const head = html.match(/<head>(.*?)<\/head>/s)[1];
  const match = head.match(/<script\b([^>]*)>(.*?)<\/script>/s);
  assert.ok(match, 'no script in the head');
  assert.match(match[1], /data-theme-script/);
  assert.doesNotMatch(match[1], /\b(src|type|async|defer)=/, 'the theme script must be inline and blocking');
  assert.ok(head.indexOf(match[0]) < head.search(/<link[^>]*rel="stylesheet"|<style/), 'the theme script runs before styles');
  return match[2];
}

function runTheme(source, { stored = null, reducedMotion = false, viewTransitions = true } = {}) {
  const storage = new Map(stored === null ? [] : [['theme', stored]]);
  const listeners = {};
  const buttons = ['system', 'light', 'dark'].map((value) => ({
    dataset: { themeChoice: value },
    attributes: { 'aria-pressed': 'false' },
    setAttribute(name, val) { this.attributes[name] = String(val); },
    closest(selector) { return selector === '[data-theme-choice]' ? this : null; },
  }));
  const transitions = [];
  const document = {
    documentElement: { dataset: {} },
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    querySelectorAll: (selector) => selector === '[data-theme-choice]' ? buttons : [],
    ...(viewTransitions && { startViewTransition: (fn) => (transitions.push(fn), fn()) }),
  };
  const context = {
    document,
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    matchMedia: (query) => ({ matches: query.includes('reduce') && reducedMotion }),
  };
  vm.runInNewContext(source, context);
  const fire = (type, event = {}) => (listeners[type] ?? []).forEach((fn) => fn(event));
  return {
    root: document.documentElement, storage, buttons, transitions,
    loaded: () => fire('DOMContentLoaded'),
    choose: (value) => fire('click', { target: buttons.find((button) => button.dataset.themeChoice === value) }),
  };
}

test('theme toggle', async (t) => {
  const site = buildFixture('chrome');
  assert.ok(site.ok, site.output);
  const pages = FILES.map((file) => ({ file, html: site.read(file) }));
  const rules = nestedRulesOf(stylesheetsOf(site, pages[0].html));
  const declared = (match, property) => rules.filter((r) => match(r) && r.declarations.some(([p]) => p === property)).map((r) => [r, Object.fromEntries(r.declarations)[property]]);

  await t.test('the footer offers an accessible System, Light and Dark button group', () => {
    for (const { file, html } of pages) {
      const footer = html.match(/<footer class="site-footer">(.*?)<\/footer>/s)?.[1];
      assert.ok(footer, `${file}: no site footer`);
      const group = footer.match(/<div class="theme-toggle"([^>]*)>(.*?)<\/div>/s);
      assert.ok(group, `${file}: no theme group`);
      assert.match(group[1], /role="group"/);
      assert.match(group[1], /aria-label="Theme"/);
      const options = [...group[2].matchAll(/<button\b([^>]*)>([^<]+)<\/button>/g)].map(([, attrs, text]) => [attrs.match(/data-theme-choice="([^"]+)"/)?.[1], attrs.match(/type="([^"]+)"/)?.[1], text]);
      assert.deepEqual(options, [['system', 'button', 'System'], ['light', 'button', 'Light'], ['dark', 'button', 'Dark']]);
      assert.equal([...group[2].matchAll(/aria-pressed=/g)].length, 3);
      assert.doesNotMatch(group[2], /\son\w+=/);
    }
  });

  await t.test('the stored choice applies before first paint, on every page', () => {
    for (const { html } of pages) {
      const source = themeScriptOf(html);
      assert.equal(runTheme(source, { stored: 'dark' }).root.dataset.theme, 'dark');
      assert.equal(runTheme(source, { stored: 'light' }).root.dataset.theme, 'light');
      assert.equal(runTheme(source).root.dataset.theme, undefined);
      assert.equal(runTheme(source, { stored: 'bogus' }).root.dataset.theme, undefined);
    }
  });

  await t.test('aria-pressed reflects the choice and the existing storage key persists it', () => {
    const source = themeScriptOf(pages[0].html);
    const page = runTheme(source, { stored: 'dark' });
    page.loaded();
    assert.deepEqual(page.buttons.filter((b) => b.attributes['aria-pressed'] === 'true').map((b) => b.dataset.themeChoice), ['dark']);
    page.choose('light');
    assert.equal(page.root.dataset.theme, 'light');
    assert.equal(page.storage.get('theme'), 'light');
    assert.deepEqual(page.buttons.filter((b) => b.attributes['aria-pressed'] === 'true').map((b) => b.dataset.themeChoice), ['light']);
    assert.equal(runTheme(source, { stored: page.storage.get('theme') }).root.dataset.theme, 'light');
    page.choose('system');
    assert.equal(page.root.dataset.theme, undefined);
    assert.equal(page.storage.has('theme'), false);
    assert.deepEqual(page.buttons.filter((b) => b.attributes['aria-pressed'] === 'true').map((b) => b.dataset.themeChoice), ['system']);
  });

  await t.test('switching cross-fades unless reduced motion is requested or View Transitions are unsupported', () => {
    const source = themeScriptOf(pages[0].html);
    const animated = runTheme(source);
    animated.choose('dark');
    assert.equal(animated.transitions.length, 1);
    assert.equal(animated.root.dataset.theme, 'dark');
    const reduced = runTheme(source, { reducedMotion: true });
    reduced.choose('dark');
    assert.equal(reduced.transitions.length, 0);
    assert.equal(reduced.root.dataset.theme, 'dark');
    const unsupported = runTheme(source, { viewTransitions: false });
    unsupported.choose('dark');
    assert.equal(unsupported.root.dataset.theme, 'dark');
  });

  await t.test('without JavaScript the toggle is hidden and the system setting applies', () => {
    const hidden = declared((r) => r.prelude === '.theme-toggle' && !r.context.length, 'display');
    assert.deepEqual(hidden.map(([, v]) => v), ['none']);
    const shown = declared((r) => /\[data-js\][^,]*\.theme-toggle/.test(r.prelude), 'display');
    assert.ok(shown.length && shown.every(([, v]) => v !== 'none'));
    const page = runTheme(themeScriptOf(pages[0].html));
    assert.ok('js' in page.root.dataset);
    assert.ok(declared((r) => r.prelude === ':root', 'color-scheme').some(([, v]) => v === 'light dark'));
    for (const theme of ['light', 'dark']) {
      const scheme = declared((r) => r.prelude.replace(/\s/g, '').includes(`[data-theme=${theme}]`), 'color-scheme');
      assert.deepEqual(scheme.map(([, v]) => v), [theme]);
    }
  });

  await t.test('code highlighting colours follow the theme', () => {
    const html = site.read('writing/sample/index.html');
    const pre = html.match(/<pre\b[^>]*class="[^"]*astro-code[^"]*"[^>]*>.*?<\/pre>/s)?.[0];
    assert.ok(pre, 'no highlighted code block');
    const colours = [...pre.matchAll(/(?:^|[;"\s])(?:background-)?color:\s*([^;"]+)/g)].map((m) => m[1].trim());
    assert.ok(colours.length > 2);
    const root = (property) => {
      let value = declared((r) => r.prelude === ':root', property).at(-1)?.[1];
      for (let depth = 0; depth < 10; depth++) {
        const alias = value?.match(/^var\((--[\w-]+)\)$/)?.[1];
        if (!alias) return value;
        value = declared((r) => r.prelude === ':root', alias).at(-1)?.[1];
      }
      return value;
    };
    for (const colour of colours) {
      const variable = colour.match(/^var\((--astro-code-[\w-]+)\)$/)?.[1];
      assert.ok(variable, `hard-coded colour ${colour}`);
      assert.match(root(variable) ?? '', /^light-dark\(/, `${variable} does not follow the theme`);
    }
  });
});
