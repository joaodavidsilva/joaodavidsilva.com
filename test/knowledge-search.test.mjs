import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildFixture } from './build.mjs';

const SEARCH_SCRIPT = /<script\b[^>]*data-knowledge-search/;
const ANY_SCRIPT = /<script\b(?![^>]*(?:application\/ld\+json|data-theme-script|data-menu-script|data-knowledge-search))/;

/** Serves the built site so Pagefind's client can fetch its index as in a browser. */
async function serve(dir) {
  const server = createServer(async (req, res) => {
    try {
      res.end(await readFile(join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))));
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test('the Knowledge Base is searchable', async (t) => {
  const site = buildFixture('knowledge');
  assert.ok(site.ok, site.output);

  await t.test("searching a Concept's term finds it", async () => {
    const { server, origin } = await serve(site.dir);
    try {
      const pagefind = await import(pathToFileURL(join(site.dir, 'pagefind', 'pagefind.js')).href);
      await pagefind.options({ basePath: `${origin}/pagefind/` });
      const { results } = await pagefind.search('budget');
      const urls = await Promise.all(results.map(async (r) => (await r.data()).url.replace(origin, '')));
      assert.ok(urls.includes('/knowledge/token-budget/'), urls.join(', '));
      const budget = await results[urls.indexOf('/knowledge/token-budget/')].data();
      assert.equal(budget.meta.title, 'Token budget');
      assert.equal(budget.meta.kind, 'Concept', 'results carry the kind');
      assert.equal(budget.meta.category, 'Context Engineering', 'results carry the category');
      assert.ok(!urls.some((u) => !u.startsWith('/knowledge/') || u.startsWith('/knowledge/tags/') || u === '/knowledge/'),
        `only entries are indexed: ${urls.join(', ')}`);
      const tagged = await pagefind.search('testing');
      const taggedUrls = await Promise.all(tagged.results.map(async (result) => (await result.data()).url.replace(origin, '')));
      assert.ok(taggedUrls.includes('/knowledge/writing-tests-first/'), `entry tags remain searchable: ${taggedUrls.join(', ')}`);
    } finally {
      server.close();
    }
  });

  await t.test('only the Knowledge index loads the search script', () => {
    const index = site.read('knowledge/index.html');
    assert.match(index, SEARCH_SCRIPT);
    assert.doesNotMatch(index, ANY_SCRIPT, 'Knowledge index has no unexpected scripts');
    for (const path of ['knowledge/context-window/index.html', 'knowledge/tags/tokens/index.html']) {
      const html = site.read(path);
      assert.doesNotMatch(html, SEARCH_SCRIPT, path);
      assert.doesNotMatch(html, ANY_SCRIPT, path);
    }
  });

  await t.test('without JavaScript the search form stays hidden and the index lists everything', () => {
    const index = site.read('knowledge/index.html');
    assert.match(index, /<form\b[^>]*role="search"[^>]*hidden/);
    assert.match(index, /<span>Search the Knowledge Base<\/span>/);
    assert.match(index, /placeholder="context, session, tool…"/);
    assert.match(index, />3 entries in 2 categories<\/p>/);
    for (const id of ['context-window', 'token-budget', 'writing-tests-first']) {
      assert.match(index, new RegExp(`href="/knowledge/${id}/"`));
    }
  });
});
