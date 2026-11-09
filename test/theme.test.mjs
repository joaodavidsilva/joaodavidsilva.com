import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildFixture } from './build.mjs';
import { stylesheetsOf, nestedRulesOf } from './css.mjs';

const FILES = ['index.html', 'writing/sample/index.html'];

/** The inline theme script of a page's head. */
function themeScriptOf(html) {
  const head = html.match(/<head>(.*?)<\/head>/s)[1];
  const match = head.match(/<script\b([^>]*)>(.*?)<\/script>/s);
  assert.ok(match, 'no script in the head');
  assert.match(match[1], /data-theme-script/);
  assert.doesNotMatch(match[1], /\b(src|type|async|defer)=/, 'the theme script must be inline and blocking');
  assert.ok(head.indexOf(match[0]) < head.search(/<link[^>]*rel="stylesheet"|<style/), 'the theme script runs before styles');
  return match[2];
}

/** Runs the theme script against a stubbed page; returns handles to inspect it. */
function runTheme(source, { stored = null, reducedMotion = false, viewTransitions = true } = {}) {
  const storage = new Map(stored === null ? [] : [['theme', stored]]);
  const listeners = {};
  const radios = ['system', 'light', 'dark'].map((value) => ({ name: 'theme', value, checked: false }));
  const transitions = [];
  const document = {
    documentElement: { dataset: {} },
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    querySelectorAll: () => radios,
    ...(viewTransitions && { startViewTransition: (fn) => (transitions.push(fn), fn()) }),
  };
  const context = {
    document,
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    matchMedia: (query) => ({ matches: query.includes('reduce') && reducedMotion }),
  };
  vm.runInNewContext(source, context);
  const fire = (type, event = {}) => (listeners[type] ?? []).forEach((fn) => fn(event));
  return {
    root: document.documentElement,
    storage,
    radios,
    transitions,
    loaded: () => fire('DOMContentLoaded'),
    choose: (value) => {
      for (const r of radios) r.checked = r.value === value;
      fire('change', { target: radios.find((r) => r.value === value) });
    },
  };
}

test('theme toggle', async (t) => {
  const site = buildFixture('chrome');
  assert.ok(site.ok, site.output);
  const pages = FILES.map((file) => ({ file, html: site.read(file) }));
  const rules = nestedRulesOf(stylesheetsOf(site, pages[0].html));
  const declared = (match, property) =>
    rules.filter((r) => match(r) && r.declarations.some(([p]) => p === property)).map((r) => [r, Object.fromEntries(r.declarations)[property]]);

  await t.test('the menu offers System, Light and Dark, in the header on wide screens and the mobile menu', () => {
    for (const { file, html } of pages) {
      const menu = html.match(/<div class="site-menu" id="site-menu" popover>(.*?)<\/div>\s*<\/nav>/s)?.[1];
      assert.ok(menu, `${file}: no site menu`);
      const toggle = menu.match(/<fieldset class="theme-toggle"[^>]*>(.*?)<\/fieldset>/s)?.[1];
      assert.ok(toggle, `${file}: no theme toggle in the menu`);
      assert.match(toggle, /<legend[^>]*>Theme<\/legend>/);
      const options = [...toggle.matchAll(/<label[^>]*>\s*<input([^>]*)>\s*([^<]+?)\s*<\/label>/g)].map(([, attrs, text]) => [
        attrs.match(/name="([^"]+)"/)?.[1],
        attrs.match(/value="([^"]+)"/)?.[1],
        attrs.match(/type="([^"]+)"/)?.[1],
        text,
      ]);
      assert.deepEqual(options, [
        ['theme', 'system', 'radio', 'System'],
        ['theme', 'light', 'radio', 'Light'],
        ['theme', 'dark', 'radio', 'Dark'],
      ]);
      assert.doesNotMatch(toggle, /\son\w+=/, `${file}: inline event handler`);
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

  await t.test('the toggle reflects and persists the choice', () => {
    const source = themeScriptOf(pages[0].html);
    const page = runTheme(source, { stored: 'dark' });
    page.loaded();
    assert.deepEqual(page.radios.filter((r) => r.checked).map((r) => r.value), ['dark']);
    page.choose('light');
    assert.equal(page.root.dataset.theme, 'light');
    assert.equal(page.storage.get('theme'), 'light');
    // The next page (or visit) starts from the stored choice.
    assert.equal(runTheme(source, { stored: page.storage.get('theme') }).root.dataset.theme, 'light');
    page.choose('system');
    assert.equal(page.root.dataset.theme, undefined);
    assert.equal(page.storage.has('theme'), false);
    const fresh = runTheme(source);
    fresh.loaded();
    assert.deepEqual(fresh.radios.filter((r) => r.checked).map((r) => r.value), ['system']);
  });

  await t.test('switching cross-fades via View Transitions; reduced motion or no support switches instantly', () => {
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
    assert.ok(shown.length && shown.every(([, v]) => v !== 'none'), 'the script does not reveal the toggle');
    const page = runTheme(themeScriptOf(pages[0].html));
    assert.ok('js' in page.root.dataset, 'the script does not mark JavaScript as available');
    // System default: :root follows the OS; only an explicit choice overrides it.
    assert.ok(declared((r) => r.prelude === ':root', 'color-scheme').some(([, v]) => v === 'light dark'));
    for (const theme of ['light', 'dark']) {
      const scheme = declared((r) => r.prelude.replace(/\s/g, '').includes(`[data-theme=${theme}]`), 'color-scheme');
      assert.deepEqual(scheme.map(([, v]) => v), [theme], `no color-scheme override for ${theme}`);
    }
  });

  await t.test('code is highlighted in colours that follow the theme', () => {
    const html = site.read('writing/sample/index.html');
    const pre = html.match(/<pre\b[^>]*class="[^"]*astro-code[^"]*"[^>]*>.*?<\/pre>/s)?.[0];
    assert.ok(pre, 'no highlighted code block');
    const colours = [...pre.matchAll(/(?:^|[;"\s])(?:background-)?color:\s*([^;"]+)/g)].map((m) => m[1].trim());
    assert.ok(colours.length > 2, 'no highlighted tokens');
    // Each colour is a Shiki variable set to a light-dark() palette token, so it follows color-scheme.
    const root = (property) => declared((r) => r.prelude === ':root', property).at(-1)?.[1];
    for (const colour of colours) {
      const variable = colour.match(/^var\((--astro-code-[\w-]+)\)$/)?.[1];
      assert.ok(variable, `hard-coded colour ${colour}`);
      const token = root(variable)?.match(/^var\((--[\w-]+)\)$/)?.[1];
      assert.match(root(token) ?? '', /^light-dark\(/, `${variable} does not follow the theme`);
    }
  });
});
