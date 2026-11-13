import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from './build.mjs';
import { stylesheetsOf, nestedRulesOf } from './css.mjs';
import { SITE_URL } from '../site.config.mjs';

function splitSelectors(prelude) {
  const selectors = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < prelude.length; index++) {
    const char = prelude[index];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      selectors.push(prelude.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(prelude.slice(start).trim());
  return selectors;
}
function rulesOf(css) {
  return nestedRulesOf(css).map((rule) => ({
    selectors: splitSelectors(rule.prelude),
    declarations: rule.declarations,
    context: rule.context,
  }));
}
function resolve(rules, value) {
  const custom = new Map(rules.flatMap((r) => r.declarations).filter(([p]) => p.startsWith('--')));
  let resolved = value;
  for (let depth = 0; depth < 10 && /var\(/.test(resolved); depth++) resolved = resolved.replace(/var\((--[\w-]+)(?:,[^)]+)?\)/g, (ref, name) => custom.get(name) ?? ref);
  return resolved;
}
function declared(rules, selector, property) {
  const normalize = (value) => value.replace(/\s*([>+~])\s*/g, '$1');
  const values = rules.filter((r) => r.context.length === 0 && r.selectors.some((candidate) => normalize(candidate) === normalize(selector))).flatMap((r) => r.declarations.filter(([p]) => p === property).map(([, v]) => v));
  return values.length ? resolve(rules, values.at(-1)) : undefined;
}
function lightDark(value) {
  const single = value?.match(/^(#[0-9a-f]{6})$/i);
  if (single) return [single[1], single[1]];
  const pair = value?.match(/^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i);
  return pair ? [pair[1], pair[2]] : null;
}
function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const KEYWORDS = new Set(['inherit', 'currentcolor', 'transparent', 'initial', 'unset', 'none']);

test('redesign typography, palette and shared primitives', async (t) => {
  const site = buildFixture('basic');
  assert.ok(site.ok, site.output);
  const html = site.read('hello/index.html');
  const css = stylesheetsOf(site, html);
  const rules = rulesOf(css);
  const fontFaces = rules.filter((r) => r.selectors.includes('@font-face'));
  const faceValue = (face, property) => face.declarations.find(([p]) => p === property)?.[1] ?? '';

  await t.test('Source Serif 4 and JetBrains Mono are self-hosted; Inter is no longer loaded', () => {
    for (const family of ['Source Serif 4', 'JetBrains Mono']) {
      const declares = new RegExp(`^["']?${family}[-"']`);
      assert.ok(fontFaces.some((face) => declares.test(faceValue(face, 'font-family'))), `no @font-face for ${family}`);
    }
    assert.ok(!fontFaces.some((face) => /^["']?Inter[-"]/.test(faceValue(face, 'font-family'))));
    for (const face of fontFaces) {
      assert.equal(faceValue(face, 'font-display'), 'swap');
      for (const [, url] of faceValue(face, 'src').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        assert.ok(url.startsWith('/') && !url.startsWith('//'), `font ${url} is not same-origin`);
        assert.ok(site.has(url.slice(1)), `font ${url} is not in the build`);
      }
    }
    assert.doesNotMatch(css, /@import|url\(["']?(https?:)?\/\//);
    for (const [, origin] of html.matchAll(/<link[^>]*href="((?:https?:)?\/\/[^"/]+)/g)) assert.equal(new URL(origin, SITE_URL).origin, SITE_URL);
  });

  await t.test('body and headings use Source Serif 4; UI and code use JetBrains Mono', () => {
    assert.match(declared(rules, 'body', 'font-family') ?? '', /^"?Source Serif 4-/);
    assert.match(declared(rules, 'h1', 'font-family') ?? '', /^"?Source Serif 4-/);
    assert.match(declared(rules, 'code', 'font-family') ?? '', /^"?JetBrains Mono-/);
    assert.match(declared(rules, '.site-nav', 'font-family') ?? '', /^"?JetBrains Mono-/);
  });

  await t.test('the exact mockup tokens use the light-dark cascade', () => {
    const tokens = {
      '--paper': ['#faf8f3', '#171512'], '--ink': ['#1d1b18', '#ebe7de'], '--muted': ['#5c574f', '#a9a397'],
      '--rule': ['#ddd7ca', '#35322c'], '--tint': ['#f1ede3', '#221f1b'], '--tint2': ['#e8e3d6', '#2b2722'],
      '--band': ['#1d1b18', '#0e0d0b'], '--band-ink': ['#ebe7de', '#ebe7de'],
      '--band-muted': ['#a9a397', '#a9a397'], '--band-rule': ['#35322c', '#35322c'], '--accent': ['#1f4396', '#9db8ff'],
    };
    assert.equal(declared(rules, ':root', 'color-scheme'), 'light dark');
    for (const [token, expected] of Object.entries(tokens)) assert.deepEqual(lightDark(declared(rules, ':root', token)), expected, token);
  });

  const colours = rules.flatMap((r) => r.declarations.filter(([p]) => ['color', 'background-color', 'background'].includes(p)).filter(([, v]) => !KEYWORDS.has(v.toLowerCase())).map(([property, value]) => ({ property, value, pair: lightDark(resolve(rules, value)) })));
  await t.test('inverted bands keep headings and labels in their band colours', () => {
    assert.equal(declared(rules, '.band :is(h1,h2,h3,h4,h5,h6)', 'color'), '#ebe7de');
    assert.equal(declared(rules, '.band :is(.eyebrow,.row-label,.status)', 'color'), '#a9a397');
  });

  await t.test('all declared text and surface colours have light and dark values', () => {
    for (const { property, value, pair } of colours) assert.ok(pair, `${property}: ${value} does not resolve to light-dark()`);
  });

  await t.test('every designed foreground/background pairing meets WCAG AA in both modes', () => {
    const pairings = [
      ['--paper', '--ink'], ['--paper', '--muted'], ['--paper', '--accent'],
      ['--tint', '--ink'], ['--tint', '--muted'], ['--tint', '--accent'],
      ['--tint2', '--ink'], ['--tint2', '--muted'], ['--tint2', '--accent'],
      ['--band', '--band-ink'], ['--band', '--band-muted'],
      ['--ink', '--paper'], ['--accent', '--paper'],
    ];
    for (const [background, text] of pairings) {
      const bg = lightDark(declared(rules, ':root', background));
      const fg = lightDark(declared(rules, ':root', text));
      for (const [mode, i] of [['light', 0], ['dark', 1]]) assert.ok(contrast(bg[i], fg[i]) >= 4.5, `${mode}: ${text} on ${background} is ${contrast(bg[i], fg[i]).toFixed(2)}:1`);
    }
  });

  await t.test('body is 19px and 17px on small screens, with wrapping and balanced headings', () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    assert.equal(declared(rules, 'body', 'font-size'), '19px');
    assert.match(css, /@media\s*\(width<=640px\)\s*\{[^{}]*body\s*\{[^}]*font-size:\s*17px/s);
    assert.match(declared(rules, 'body', 'overflow-wrap') ?? '', /break-word|anywhere/);
    assert.equal(declared(rules, 'p', 'text-wrap'), 'pretty');
    assert.equal(declared(rules, 'h1', 'text-wrap'), 'balance');
  });

  await t.test('the shared container and labelled rows expose the 1120/220/180px contracts', () => {
    assert.equal(declared(rules, '.container', 'max-inline-size'), '1120px');
    assert.equal(declared(rules, '.container', 'padding-inline'), 'clamp(20px,5vw,56px)');
    assert.equal(declared(rules, '.labelled-row > .row-label', 'flex'), '0 0 220px');
    assert.equal(declared(rules, '.labelled-row--home > .row-label', 'flex'), '0 0 180px');
    assert.equal(declared(rules, '.labelled-row > .row-content', 'flex'), '480px');
  });

  await t.test('shared CTA, stats, cards and definition-row primitives carry accessible sizing', () => {
    for (const selector of ['.card a', '.definition-rows a']) assert.equal(declared(rules, selector, 'min-block-size'), '44px', selector);
    assert.equal(declared(rules, '.button', 'min-block-size'), '50px');
    assert.equal(declared(rules, '.button', 'border-radius'), '4px');
    assert.equal(declared(rules, '.stats', 'border-block-start'), '2px solid light-dark(#1d1b18,#ebe7de)');
    assert.equal(declared(rules, '.card', 'border-block-start'), '1px solid light-dark(#1d1b18,#ebe7de)');
    assert.equal(declared(rules, '.definition-rows > div', 'border-block-end'), '1px solid light-dark(#ddd7ca,#35322c)');
    assert.match(css, /@media\s*\(width<=820px\)/);
    assert.match(css, /@media\s*\(width<=640px\)/);
    assert.match(css, /124px/);
  });

  await t.test('the shared long-form measure and TOC breakpoints are available to page slices', () => {
    assert.equal(declared(rules, '.prose', 'max-inline-size'), '66ch');
    assert.equal(declared(rules, '.toc', 'position'), 'sticky');
    assert.match(css, /@media\s*\(width<=940px\)\s*\{[^{}]*\.toc\s*\{[^}]*position:\s*static/s);
    assert.match(css, /@media\s*\(width<=640px\)\s*\{(?:[^{}]|\{[^{}]*\})*\.toc\s*\{[^}]*display:\s*none/s);
  });

  await t.test('shared display styles preserve the mockup type scale', () => {
    assert.equal(declared(rules, '.home-title', 'font-size'), 'clamp(38px,min(12.4vw,5vw + 40px),116px)');
    assert.equal(Number(declared(rules, '.home-title', 'line-height')), 0.96);
    assert.equal(declared(rules, '.home-intro', 'font-size'), 'clamp(20px,2.2vw,26px)');
    assert.equal(declared(rules, '.band-title', 'font-size'), 'clamp(30px,4.2vw,50px)');
    assert.equal(declared(rules, '.pull-line', 'font-size'), 'clamp(26px,3vw,34px)');
  });

  await t.test('no gradients or shadows are introduced', () => {
    assert.doesNotMatch(css, /gradient\(|box-shadow|text-shadow|drop-shadow/);
  });
});
