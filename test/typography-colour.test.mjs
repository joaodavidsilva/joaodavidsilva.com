import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture } from './build.mjs';
import { SITE_URL } from '../site.config.mjs';

/** Every stylesheet a built page applies: inline `<style>` blocks and linked same-origin files. */
function stylesheetsOf(site, html) {
  const inline = [...html.matchAll(/<style[^>]*>(.*?)<\/style>/gs)].map((m) => m[1]);
  const linked = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => {
    const href = m[0].match(/href="([^"]+)"/)[1];
    assert.ok(href.startsWith('/') && !href.startsWith('//'), `stylesheet ${href} is not same-origin`);
    return site.read(href.slice(1));
  });
  return [...inline, ...linked].join('\n');
}

/** The rules of a stylesheet as { selectors, declarations: [property, value][] }. */
function rulesOf(css) {
  return [...css.replace(/\/\*.*?\*\//gs, '').matchAll(/([^{}]+){([^{}]*)}/g)].map(([, selector, body]) => ({
    selectors: selector.split(',').map((s) => s.trim()),
    declarations: body
      .split(';')
      .map((d) => d.split(/:(.*)/s).map((part) => part?.trim()))
      .filter(([property, value]) => property && value),
  }));
}

/** Expands var() references using the custom properties declared in the stylesheet. */
function resolve(rules, value) {
  const custom = new Map(rules.flatMap((r) => r.declarations).filter(([p]) => p.startsWith('--')));
  let resolved = value;
  for (let depth = 0; depth < 10 && /var\(/.test(resolved); depth++) {
    resolved = resolved.replace(/var\((--[\w-]+)\)/g, (ref, name) => custom.get(name) ?? ref);
  }
  return resolved;
}

/** The last value `selector` declares for `property`, with var() references expanded. */
function declared(rules, selector, property) {
  const values = rules
    .filter((r) => r.selectors.includes(selector))
    .flatMap((r) => r.declarations.filter(([p]) => p === property).map(([, v]) => v));
  return values.length ? resolve(rules, values.at(-1)) : undefined;
}

/** The [light, dark] colours of a `light-dark(#rrggbb, #rrggbb)` value, or null. */
function lightDark(value) {
  const pair = value.match(/^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i);
  return pair ? [pair[1], pair[2]] : null;
}

/** WCAG 2 contrast ratio between two #rrggbb colours. */
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

/** A CSS length in rem or px as px, assuming the default 16px root size. */
function px(length) {
  const [, n, unit] = length.trim().match(/^([\d.]+)(rem|px)$/);
  return unit === 'rem' ? Number(n) * 16 : Number(n);
}

const KEYWORDS = new Set(['inherit', 'currentcolor', 'transparent', 'initial', 'unset']);

test('base typography and colour', async (t) => {
  const site = buildFixture('basic');
  assert.ok(site.ok, site.output);
  const html = site.read('hello/index.html');
  const css = stylesheetsOf(site, html);
  const rules = rulesOf(css);
  const fontFaces = rules.filter((r) => r.selectors.includes('@font-face'));
  const faceValue = (face, property) => face.declarations.find(([p]) => p === property)?.[1] ?? '';

  await t.test('fonts load from the site origin only', () => {
    for (const family of ['Source Serif 4', 'Inter', 'JetBrains Mono']) {
      const declares = new RegExp(`^["']?${family}[-"']`);
      assert.ok(fontFaces.some((face) => declares.test(faceValue(face, 'font-family'))), `no @font-face for ${family}`);
    }
    for (const face of fontFaces) {
      for (const [, url] of faceValue(face, 'src').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        assert.ok(url.startsWith('/') && !url.startsWith('//'), `font ${url} is not same-origin`);
        assert.ok(site.has(url.slice(1)), `font ${url} is not in the build`);
      }
    }
    assert.doesNotMatch(css, /@import|url\(["']?(https?:)?\/\//);
    for (const [, origin] of html.matchAll(/<link[^>]*href="((?:https?:)?\/\/[^"/]+)/g)) {
      assert.equal(new URL(origin, SITE_URL).origin, SITE_URL, `third-party request to ${origin}`);
    }
  });

  await t.test('text renders immediately while fonts load', () => {
    assert.ok(fontFaces.length > 0);
    for (const face of fontFaces) assert.equal(faceValue(face, 'font-display'), 'swap');
  });

  await t.test('body is set in Source Serif 4, headings in Inter, code in JetBrains Mono', () => {
    assert.match(declared(rules, 'body', 'font-family') ?? '', /^"?Source Serif 4-/);
    assert.match(declared(rules, 'h1', 'font-family') ?? '', /^"?Inter-/);
    assert.match(declared(rules, 'code', 'font-family') ?? '', /^"?JetBrains Mono-/);
  });

  // Every text colour must read against every background, so any pairing the
  // site produces meets WCAG AA (4.5:1 for body text) in both modes.
  const colours = rules.flatMap((r) =>
    r.declarations
      .filter(([p]) => ['color', 'background-color', 'background'].includes(p))
      .filter(([, v]) => !KEYWORDS.has(v.toLowerCase()))
      .map(([property, value]) => ({ property, value, pair: lightDark(resolve(rules, value)) })),
  );

  await t.test('light and dark palettes follow the system setting', () => {
    assert.equal(declared(rules, ':root', 'color-scheme'), 'light dark');
    assert.ok(lightDark(declared(rules, 'body', 'color') ?? ''), 'body sets a light-dark() text colour');
    assert.ok(lightDark(declared(rules, 'body', 'background-color') ?? ''), 'body sets a light-dark() background');
    for (const { property, value, pair } of colours) {
      assert.ok(pair, `${property}: ${value} does not resolve to a light-dark() pair`);
    }
  });

  await t.test('every text/background pairing meets WCAG AA in both modes', () => {
    const texts = colours.filter((c) => c.property === 'color');
    const backgrounds = colours.filter((c) => c.property !== 'color');
    assert.ok(texts.length && backgrounds.length);
    for (const [mode, i] of [['light', 0], ['dark', 1]]) {
      for (const text of texts) {
        for (const background of backgrounds) {
          const ratio = contrast(text.pair[i], background.pair[i]);
          assert.ok(ratio >= 4.5, `${mode}: ${text.value} on ${background.value} is ${ratio.toFixed(2)}:1`);
        }
      }
    }
  });

  await t.test('body text keeps a long-form measure at 18–20px and wraps on a phone', () => {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
    const size = declared(rules, 'body', 'font-size');
    const [, min, max] = size.match(/^clamp\(([^,]+),[^,]+,([^,]+)\)$/);
    assert.ok(px(min) >= 18 && px(max) <= 20, `body size ${size} is outside 18–20px`);
    // The measure is in `ch`; real characters per line are checked in a browser at release.
    const width = declared(rules, 'main', 'inline-size');
    const [, ch] = width.match(/^min\(100% - [^,]+,\s*(\d+)ch\)$/);
    assert.ok(Number(ch) >= 60 && Number(ch) <= 72, `measure ${width} is outside the target`);
    assert.match(declared(rules, 'body', 'overflow-wrap') ?? '', /break-word|anywhere/);
  });

  await t.test('no gradients or shadows', () => {
    assert.doesNotMatch(css, /gradient\(|box-shadow|text-shadow|drop-shadow/);
  });
});
