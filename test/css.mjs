import assert from 'node:assert/strict';

/** Every stylesheet a built page applies: inline `<style>` blocks and linked same-origin files. */
export function stylesheetsOf(site, html) {
  const inline = [...html.matchAll(/<style[^>]*>(.*?)<\/style>/gs)].map((m) => m[1]);
  const linked = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => {
    const href = m[0].match(/href="([^"]+)"/)[1];
    assert.ok(href.startsWith('/') && !href.startsWith('//'), `stylesheet ${href} is not same-origin`);
    return site.read(href.slice(1));
  });
  return [...inline, ...linked].join('\n');
}

/**
 * The style rules of a stylesheet, at any depth, as
 * { prelude, context, declarations: [property, value][] }, where `context`
 * lists the enclosing at-rule preludes, outermost first, whitespace removed.
 */
export function nestedRulesOf(css) {
  const rules = [];
  const stack = [];
  let buffer = '';
  let quote = null;
  for (const ch of css.replace(/\/\*.*?\*\//gs, '')) {
    if (quote) {
      buffer += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      buffer += ch;
    } else if (ch === '{') {
      stack.push(buffer.split(';').at(-1).trim());
      buffer = '';
    } else if (ch === '}') {
      const prelude = stack.pop();
      if (buffer.trim()) {
        rules.push({
          prelude,
          context: stack.map((p) => p.replace(/\s+/g, '')),
          declarations: buffer
            .split(';')
            .map((d) => d.split(/:(.*)/s, 2).map((part) => part?.trim()))
            .filter(([property, value]) => property && value),
        });
      }
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return rules;
}
