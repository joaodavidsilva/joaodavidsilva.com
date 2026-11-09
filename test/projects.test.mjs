import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture, buildFixtureWithHistory, buildSite } from './build.mjs';

const SITE = 'https://joaodavidsilva.com';

const jsonLdOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('Projects: index and Project page', async (t) => {
  // "Last updated" comes from git history: the Project page was last committed on 5 April.
  const site = buildFixtureWithHistory('projects', [{ date: '2026-04-05T12:00:00Z' }]);
  assert.ok(site.ok, site.output);
  const index = site.read('projects/index.html');
  const page = site.read('projects/sample-app/index.html');

  await t.test('the Projects index lists Projects with status and one line', () => {
    const text = textOf(index);
    assert.match(text, /Sample App .*Active.*A sample app that practises one thing well\./);
    assert.match(text, /Sample Library .*Paused.*A small library, resting for now\./);
    assert.match(text, /2\.3\.1/);
    assert.match(index, /<a href="\/projects\/sample-app\/">Sample App<\/a>/);
    assert.match(index, /<a href="\/projects\/sample-library\/">Sample Library<\/a>/);
    assert.ok(index.indexOf('Sample App') < index.indexOf('Sample Library'), 'active Projects come first');
  });

  await t.test('the Projects index is agent-readable', () => {
    assert.match(index, /<link rel="alternate" type="text\/markdown" href="\/projects\.md">/);
    const ld = jsonLdOf(index);
    assert.equal(ld['@type'], 'CollectionPage');
    assert.equal(ld.url, `${SITE}/projects/`);
    assert.deepEqual(
      ld.mainEntity.itemListElement.map((item) => item.url),
      [`${SITE}/projects/sample-app/`, `${SITE}/projects/sample-library/`],
    );
    const md = site.read('projects.md');
    assert.match(md, /^---\ntitle: "Projects"\n/);
    assert.ok(md.includes(`\ncanonical: ${SITE}/projects/\n`));
    assert.match(md, /- \[Sample App\]\(\/projects\/sample-app\/\) \(active, version 2\.3\.1\): A sample app that practises one thing well\./);
    assert.match(md, /- \[Sample Library\]\(\/projects\/sample-library\/\) \(paused\): A small library, resting for now\./);
  });

  await t.test('a Project page renders its status, version and body', () => {
    assert.match(page, /<h1>Sample App<\/h1>/);
    const text = textOf(page);
    assert.match(text, /A sample app that practises one thing well\./);
    assert.match(text, /Status Active/);
    assert.match(text, /Version 2\.3\.1/);
    assert.match(text, /The project body explains why Sample App exists\./);
    assert.doesNotMatch(page, /<script(?![^>]*(?:application\/ld\+json|data-theme-script))/);
  });

  await t.test('a Project page renders its external links', () => {
    assert.match(page, /<a href="https:\/\/sample\.example\/">Website<\/a>/);
    assert.match(page, /<a href="https:\/\/github\.com\/example\/sample-app">Source code<\/a>/);
    assert.match(page, /<a href="https:\/\/apps\.apple\.com\/app\/id123">App Store<\/a>/);
    assert.match(page, /<a href="https:\/\/play\.google\.com\/store\/apps\/details\?id=example\.sample">Google Play<\/a>/);
  });

  await t.test('a Project page renders its legal documents at their own URLs', () => {
    assert.match(page, /<a href="\/projects\/sample-app\/privacy\/">Sample App privacy policy<\/a>/);
    assert.ok(site.has('projects/sample-app/privacy/index.html'));
    assert.ok(site.has('projects/sample-app/privacy.md'));
  });

  await t.test('a Project page renders its figures', () => {
    const figure = page.match(/<figure>.*?<\/figure>/s)?.[0];
    assert.ok(figure, 'no figure');
    assert.match(figure, /alt="Architecture diagram of Sample App"/);
    assert.match(figure, /width="\d+" height="\d+"/);
    assert.match(figure, /<figcaption>How the pieces fit together\.<\/figcaption>/);
    assert.ok(site.has(figure.match(/src="\/([^"]+)"/)[1]), 'figure image is not in the build');
  });

  await t.test('a Project page has a Markdown twin', () => {
    assert.match(page, /<link rel="alternate" type="text\/markdown" href="\/projects\/sample-app\.md">/);
    const md = site.read('projects/sample-app.md');
    for (const line of [
      'title: "Sample App"',
      'summary: "A sample app that practises one thing well."',
      'published: 2026-02-03',
      'updated: 2026-04-05',
      'language: en',
      'tags: ["apps", "testing"]',
      `canonical: ${SITE}/projects/sample-app/`,
      'status: active',
      'version: "2.3.1"',
    ]) assert.ok(md.includes(`\n${line}\n`), `missing ${line}`);
    assert.match(md, /- \[Website\]\(https:\/\/sample\.example\/\)/);
    assert.match(md, /- \[Source code\]\(https:\/\/github\.com\/example\/sample-app\)/);
    assert.match(md, /- \[Google Play\]\(https:\/\/play\.google\.com\/store\/apps\/details\?id=example\.sample\)/);
    assert.match(md, /- \[Sample App privacy policy\]\(\/projects\/sample-app\/privacy\/\)/);
    assert.match(md, /The project body explains why Sample App exists\./);
    const image = md.match(/!\[Architecture diagram of Sample App\]\(\/([^)]+)\)/);
    assert.ok(image, 'twin lacks the figure');
    assert.ok(site.has(image[1]), 'twin figure is not in the build');
  });

  await t.test('a software Project page carries SoftwareApplication JSON-LD', () => {
    const ld = jsonLdOf(page);
    assert.equal(ld['@type'], 'SoftwareApplication');
    assert.equal(ld.name, 'Sample App');
    assert.equal(ld.description, 'A sample app that practises one thing well.');
    assert.equal(ld.softwareVersion, '2.3.1');
    assert.equal(ld.applicationCategory, 'EducationalApplication');
    assert.equal(ld.operatingSystem, 'iOS, Android');
    assert.equal(ld.url, `${SITE}/projects/sample-app/`);
    assert.equal(ld.datePublished, '2026-02-03');
    assert.equal(ld.dateModified, '2026-04-05');
    assert.equal(ld.inLanguage, 'en');
    assert.deepEqual(ld.sameAs, [
      'https://sample.example/',
      'https://github.com/example/sample-app',
      'https://apps.apple.com/app/id123',
      'https://play.google.com/store/apps/details?id=example.sample',
    ]);
    assert.match(ld.screenshot[0], /^https:\/\/joaodavidsilva\.com\/.+/);
  });

  await t.test('a Project that is not an application carries page JSON-LD only', () => {
    const ld = jsonLdOf(site.read('projects/sample-library/index.html'));
    assert.equal(ld['@type'], 'WebPage');
    assert.equal(ld.url, `${SITE}/projects/sample-library/`);
    assert.equal(ld.softwareVersion, undefined);
  });

  await t.test('llms.txt lists the Projects index and every Project', () => {
    const llms = site.read('llms.txt');
    assert.match(llms, /- \[Projects\]\(https:\/\/joaodavidsilva\.com\/projects\.md\): /);
    assert.match(llms, /- \[Sample App\]\(https:\/\/joaodavidsilva\.com\/projects\/sample-app\.md\): A sample app that practises one thing well\./);
    assert.match(llms, /- \[Sample Library\]\(https:\/\/joaodavidsilva\.com\/projects\/sample-library\.md\): A small library, resting for now\./);
  });
});

test('a legal document that does not exist fails the build', () => {
  const site = buildFixture('project-missing-legal');
  assert.equal(site.ok, false);
  assert.match(site.output, /orphan/);
  assert.match(site.output, /projects\/orphan\/privacy/);
});

test('a legal document not marked legal fails the build', () => {
  const site = buildFixture('project-unmarked-legal');
  assert.equal(site.ok, false);
  assert.match(site.output, /loose\/privacy\.md: a Project's legal document must set legal: true/);
});

test('a page claiming a Project page path fails the build', () => {
  const site = buildFixture('project-path-collision');
  assert.equal(site.ok, false);
  assert.match(site.output, /sample\.md: path "\/projects\/sample\/" belongs to a Project page/);
});

test('an unknown Project status fails naming the file and field', () => {
  const site = buildFixture('project-invalid-status');
  assert.equal(site.ok, false);
  assert.match(site.output, /limbo\.md/);
  assert.match(site.output, /status/);
});

test('Facts Memorizer: its legal documents keep their URLs', async (t) => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const legal = {
    'projects/facts-memorizer/privacy/': 'Facts Memorizer privacy policy',
    'projects/facts-memorizer/terms/': 'Facts Memorizer: Terms and Conditions',
  };

  await t.test('the privacy policy, its previous version and the terms are where the stores point', () => {
    for (const path of [...Object.keys(legal), 'projects/facts-memorizer/privacy/2026-08-19/']) {
      const html = site.read(`${path}index.html`);
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/${path}">`));
      assert.ok(site.has(`${path.slice(0, -1)}.md`), `no twin for ${path}`);
    }
  });

  await t.test('the Project page hosts them', () => {
    const html = site.read('projects/facts-memorizer/index.html');
    for (const [path, title] of Object.entries(legal)) {
      assert.ok(html.includes(`<a href="/${path}">${title.replace(/&/g, '&amp;')}</a>`), `no link to /${path}`);
    }
    assert.match(html, /href="https:\/\/apps\.apple\.com\/app\/times-tables-facts-memorizer\/id6797351829"/);
    assert.match(html, /href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.factsmemorizer\.app"/);
    assert.equal(jsonLdOf(html)['@type'], 'SoftwareApplication');
  });

  await t.test('the Projects index lists it', () => {
    assert.match(site.read('projects/index.html'), /<a href="\/projects\/facts-memorizer\/">Facts Memorizer<\/a>/);
  });
});

test('brightboi: Project page with screenshots, repository and latest release', () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const html = site.read('projects/brightboi/index.html');
  assert.match(html, /href="https:\/\/github\.com\/joaodavidsilva\/brightboi"/);
  assert.match(html, /href="https:\/\/github\.com\/joaodavidsilva\/brightboi\/releases\/latest"/);
  assert.ok((html.match(/<figure>\s*<img /g) ?? []).length >= 4, 'expected the four README screenshots');
  const ld = jsonLdOf(html);
  assert.equal(ld['@type'], 'SoftwareApplication');
  assert.equal(ld.screenshot.length, 4);
  assert.ok(site.has('projects/brightboi.md'));
  assert.match(site.read('projects/index.html'), /<a href="\/projects\/brightboi\/">BrightBoi<\/a>/);
});

test('Markdown Exporter: Project page links its repository and extension listing', () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const html = site.read('projects/markdown-exporter/index.html');
  assert.match(html, /href="https:\/\/github\.com\/joaodavidsilva\/markdown-exporter"/);
  assert.match(html, /href="https:\/\/marketplace\.visualstudio\.com\/items\?itemName=joaodavidsilva\.markdown-exporter"/);
  assert.equal(jsonLdOf(html)['@type'], 'SoftwareApplication');
  assert.ok(site.has('projects/markdown-exporter.md'));
  assert.match(site.read('projects/index.html'), /<a href="\/projects\/markdown-exporter\/">Markdown Exporter<\/a>/);
});

test('dotore and AI Skills: Project pages link their own homes', () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const dotore = site.read('projects/dotore/index.html');
  assert.match(dotore, /href="https:\/\/joaodavidsilva\.github\.io\/dotore\/"/);
  assert.match(dotore, /href="https:\/\/github\.com\/joaodavidsilva\/dotore"/);
  const skills = site.read('projects/ai-skills/index.html');
  assert.match(skills, /href="https:\/\/github\.com\/joaodavidsilva\/skills"/);
  const index = site.read('projects/index.html');
  for (const [slug, name] of [['dotore', 'dotore'], ['ai-skills', 'AI Skills']]) {
    assert.match(index, new RegExp(`<a href="/projects/${slug}/">${name}</a>`));
  }
});
