import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFixture, buildSite } from './build.mjs';

const wranglerConfig = JSON.parse(
  readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
);

/** The opening tag of the first element matching `pattern`, as an attribute map. */
const attributesOf = (html, pattern) => {
  const tag = html.match(pattern)?.[0];
  assert.ok(tag, `no element matching ${pattern}`);
  return Object.fromEntries([...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].slice(1).map(([, k, v]) => [k, v ?? '']));
};

test('the Lozza Project page offers the Waitlist', async (t) => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const page = site.read('projects/lozza/index.html');
  const form = page.match(/<form\b[^>]*data-waitlist[^>]*>.*?<\/form>/s)?.[0];

  await t.test('a form posts to the same-origin Waitlist endpoint', () => {
    assert.ok(form, 'no Waitlist form');
    const attrs = attributesOf(form, /<form\b[^>]*>/);
    assert.equal(attrs.method, 'post');
    assert.equal(attrs.action, '/api/waitlist');
    assert.deepEqual(attributesOf(form, /<input\b[^>]*name="source"[^>]*>/), {
      type: 'hidden', name: 'source', value: 'lozza',
    });
  });

  await t.test('it asks for an email address, with a label', () => {
    const email = attributesOf(form, /<input\b[^>]*type="email"[^>]*>/);
    assert.equal(email.name, 'email');
    assert.ok('required' in email);
    assert.equal(email.autocomplete, 'email');
    assert.match(form, new RegExp(`<label for="${email.id}">[^<]*Email`));
  });

  await t.test('consent is an explicit, unticked checkbox next to a link to the privacy notice', () => {
    const consent = attributesOf(form, /<input\b[^>]*type="checkbox"[^>]*>/);
    assert.equal(consent.name, 'consent');
    assert.equal(consent.value, 'yes');
    assert.ok('required' in consent);
    assert.ok(!('checked' in consent), 'consent must not be pre-ticked');
    const label = form.match(new RegExp(`<label for="${consent.id}">(.*?)</label>`, 's'))?.[1];
    assert.ok(label, 'the consent checkbox has no label');
    assert.match(label, /Lozza/);
    assert.match(form, /<a href="\/privacy\/">[^<]*privacy notice/i);
  });

  await t.test('it carries an invisible Turnstile bot check', () => {
    const widget = attributesOf(form, /<div\b[^>]*class="cf-turnstile"[^>]*>/);
    assert.match(widget['data-sitekey'], /^\S+$/);
    assert.match(page, /<script\b[^>]*src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"[^>]*>/);
  });

  await t.test('feedback is announced in a live region', () => {
    const status = attributesOf(form, /<\w+\b[^>]*role="status"[^>]*>/);
    assert.equal(status['aria-live'], 'polite');
  });

  await t.test('without JavaScript the form explains why it cannot be sent', () => {
    assert.match(form, /<fieldset\b[^>]*\bdisabled\b/);
    assert.match(form, /<noscript>.*?JavaScript.*?<\/noscript>/s);
  });

  await t.test('the Markdown twin points agents at the Waitlist form', () => {
    assert.match(site.read('projects/lozza.md'), /## Waitlist\n\n.*https:\/\/joaodavidsilva\.com\/projects\/lozza\/#waitlist/);
  });

  await t.test('only the Waitlist page loads scripts beyond the theme script', () => {
    const other = site.read('projects/facts-memorizer/index.html');
    assert.doesNotMatch(other, /<script(?![^>]*(?:application\/ld\+json|data-theme-script))/);
  });

  await t.test('the privacy notice version stored with sign-ups is the notice’s effective date', () => {
    const md = site.read('privacy.md');
    const effective = md.match(/^updated: (\S+)$/m)[1];
    assert.equal(wranglerConfig.vars.PRIVACY_NOTICE_VERSION, effective);
  });
});

test('a Project cannot offer a Waitlist the Worker does not accept', () => {
  const site = buildFixture('project-unknown-waitlist');
  assert.equal(site.ok, false);
  assert.match(site.output, /waitlist/);
  assert.match(site.output, /lozza/);
});
