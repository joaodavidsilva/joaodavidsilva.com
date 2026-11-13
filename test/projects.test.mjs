import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFixture, buildFixtureWithHistory, buildSite } from './build.mjs';
import { nestedRulesOf, stylesheetsOf } from './css.mjs';

const SITE = 'https://joaodavidsilva.com';

const jsonLdOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
const textOf = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1');

test('Projects: index and Project page', async (t) => {
  // "Last updated" comes from git history: the Project page was last committed on 5 April.
  const site = buildFixtureWithHistory('projects', [{ date: '2026-04-05T12:00:00Z' }]);
  assert.ok(site.ok, site.output);
  const index = site.read('projects/index.html');
  const page = site.read('projects/sample-app/index.html');

  await t.test('the Projects index lists status, version, tags and one line', () => {
    const text = textOf(index);
    assert.match(text, /What I maintain over time\./);
    assert.match(text, /2 projects, with the status and latest version of each\./);
    assert.match(text, /Sample App/);
    assert.match(text, /Active · v2\.3\.1/);
    assert.match(text, /#apps #testing/);
    assert.match(text, /A sample app that practises one thing well\./);
    assert.match(text, /Sample Library/);
    assert.match(text, /Paused/);
    assert.match(text, /A small library, resting for now\./);
    assert.match(index, /<span class="status-dot status-dot--active" aria-hidden="true"><\/span>Active/);
    assert.match(index, /<a href="\/projects\/sample-app\/">Sample App →<\/a>/);
    assert.match(index, /<a href="\/projects\/sample-library\/">Sample Library →<\/a>/);
    assert.ok(index.indexOf('Sample App') < index.indexOf('Sample Library'), 'active Projects come first');
    assert.match(index, /<p class="eyebrow">Projects<\/p>/);
    assert.match(index, /<h1 class="page-title">What I maintain over time\.<\/h1>/);
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
    assert.match(md, /\npublished: \d{4}-\d{2}-\d{2}\n/);
    assert.ok(md.includes('\ntags: []\n'), md);
    assert.match(md, /- \[Sample App\]\(https:\/\/joaodavidsilva\.com\/projects\/sample-app\.md\) \(active, version 2\.3\.1\): A sample app that practises one thing well\./);
    assert.match(md, /- \[Sample Library\]\(https:\/\/joaodavidsilva\.com\/projects\/sample-library\.md\) \(paused\): A small library, resting for now\./);
  });

  await t.test('a Project page renders its breadcrumb, facts and labelled Markdown body', () => {
    assert.match(page, /<nav class="breadcrumb" aria-label="Projects">.*?<a href="\/projects\/">Projects<\/a>.*?<span>Sample App<\/span>.*?<\/nav>/s);
    assert.match(page, /<h1 class="project-title">Sample App<\/h1>/);
    const text = textOf(page);
    assert.match(text, /A sample app that practises one thing well\./);
    assert.match(text, /Status Active/);
    assert.match(text, /Version 2\.3\.1/);
    assert.match(text, /Requirements Runs sample --start; documentation\./);
    assert.match(page, /<dd>Runs <code>sample --start<\/code>; <a href="https:\/\/sample\.example\/docs">documentation<\/a>\.<\/dd>/);
    assert.match(page, /<section class="labelled-row"><h2[^>]*class="row-label">How it works<\/h2><div class="row-content"><dl class="definition-rows">/);
    assert.match(page, /<div><dt><strong>One input\.<\/strong><\/dt><dd>The input drives the output\.<\/dd><\/div>/);
    assert.match(page, /<div><dt><code>sample run<\/code><\/dt><dd>executes one practice run\.<\/dd><\/div>/);
    assert.match(text, /The project body explains why Sample App exists\./);
    assert.match(page, /<footer class="content-footer">.*Read as Markdown.*All projects.*Suggest a correction.*<\/footer>/s);
    assert.match(page, /<a href="\/projects\/sample-app\.md">Read as Markdown<\/a>/);
    assert.match(page, /<a href="\/projects\/">All projects<\/a>/);
    assert.doesNotMatch(page, /<script(?![^>]*(?:application\/ld\+json|data-theme-script|data-menu-script))/);
  });

  await t.test('a Project page renders its external links as CTA buttons', () => {
    assert.match(page, /<a class="button button--primary" href="https:\/\/apps\.apple\.com\/app\/id123">App Store ↗<\/a>/);
    assert.match(page, /<a class="button button--secondary" href="https:\/\/play\.google\.com\/store\/apps\/details\?id=example\.sample">Google Play ↗<\/a>/);
    assert.match(page, /<a class="button button--secondary" href="https:\/\/sample\.example\/">Website ↗<\/a>/);
    assert.match(page, /<a class="button button--secondary" href="https:\/\/github\.com\/example\/sample-app">Repository ↗<\/a>/);
  });

  await t.test('a Project page renders its legal documents at their own URLs', () => {
    assert.match(page, /<a href="\/projects\/sample-app\/privacy\/">Sample App privacy policy<\/a>/);
    assert.ok(site.has('projects/sample-app/privacy/index.html'));
    assert.ok(site.has('projects/sample-app/privacy.md'));
  });

  await t.test('a Project page renders its figures in the dark four-shot band', () => {
    const band = page.match(/<div class="project-screenshots band"><div class="screenshots">.*?<\/div><\/div>/s)?.[0];
    assert.ok(band, 'no screenshot band');
    const figure = band.match(/<figure>.*?<\/figure>/s)?.[0];
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
    assert.match(md, /- \[Repository\]\(https:\/\/github\.com\/example\/sample-app\)/);
    assert.match(md, /- \[Google Play\]\(https:\/\/play\.google\.com\/store\/apps\/details\?id=example\.sample\)/);
    assert.match(md, /- \[Sample App privacy policy\]\(https:\/\/joaodavidsilva\.com\/projects\/sample-app\/privacy\.md\)/);
    assert.match(md, /The project body explains why Sample App exists\./);
    assert.match(md, /Requirements: Runs `sample --start`; \[documentation\]\(https:\/\/sample\.example\/docs\)\./);
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
      'https://apps.apple.com/app/id123',
      'https://play.google.com/store/apps/details?id=example.sample',
      'https://sample.example/',
      'https://github.com/example/sample-app',
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
    assert.match(site.read('projects/index.html'), /<a href="\/projects\/facts-memorizer\/">Facts Memorizer →<\/a>/);
  });
});

test('brightboi: Project page with screenshots, repository and latest release', () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const html = site.read('projects/brightboi/index.html');
  assert.match(html, /href="https:\/\/github\.com\/joaodavidsilva\/brightboi"/);
  assert.match(html, /href="https:\/\/github\.com\/joaodavidsilva\/brightboi\/releases\/latest"/);
  assert.ok((html.match(/<figure>\s*<img /g) ?? []).length >= 4, 'expected the four README screenshots');
  const cssRules = nestedRulesOf(stylesheetsOf(site, html));
  const desktopShots = cssRules.find((rule) => rule.prelude === '.screenshots' && rule.context.length === 0);
  assert.ok(desktopShots?.declarations.some(([property, value]) => property === 'grid-template-columns' && value === 'repeat(4,minmax(0,1fr))'));
  const mobileShots = cssRules.find((rule) => rule.prelude === '.screenshots' && rule.context.includes('@media(width<=820px)'));
  assert.ok(mobileShots?.declarations.some(([property, value]) => property === 'grid-template-columns' && value === 'repeat(2,minmax(0,1fr))'));
  assert.ok(html.indexOf('popover-boost') < html.indexOf('settings-screenshot'), 'Boost shot precedes Settings');
  const ld = jsonLdOf(html);
  assert.equal(ld['@type'], 'SoftwareApplication');
  assert.equal(ld.screenshot.length, 4);
  assert.ok(site.has('projects/brightboi.md'));
  assert.match(site.read('projects/index.html'), /<a href="\/projects\/brightboi\/">BrightBoi →<\/a>/);
});

test('Markdown Exporter: Project page links its repository and extension listing', () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const html = site.read('projects/markdown-exporter/index.html');
  assert.match(html, /href="https:\/\/github\.com\/joaodavidsilva\/markdown-exporter"/);
  assert.match(html, /href="https:\/\/marketplace\.visualstudio\.com\/items\?itemName=joaodavidsilva\.markdown-exporter"/);
  assert.equal(jsonLdOf(html)['@type'], 'SoftwareApplication');
  assert.ok(site.has('projects/markdown-exporter.md'));
  assert.match(site.read('projects/index.html'), /<a href="\/projects\/markdown-exporter\/">Markdown Exporter →<\/a>/);
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
    assert.match(index, new RegExp(`<a href="/projects/${slug}/">${name} →</a>`));
  }
});

test('Lozza is an unlinked own-site card and the Waitlist UI is gone', () => {
  const site = buildSite();
  assert.ok(site.ok, site.output);
  const index = site.read('projects/index.html');
  const names = [...index.matchAll(/<h2>(?:<a[^>]*>)?([A-Za-z ]+)/g)].map((match) => match[1].trim());
  assert.deepEqual(names, ['AI Skills', 'BrightBoi', 'dotore', 'Facts Memorizer', 'Lozza', 'Markdown Exporter']);
  assert.match(index, /In development · own site/);
  assert.match(index, /Native design tool for Mac and iPad, in development\./);
  assert.match(index, /<h2>Lozza<\/h2>/);
  assert.doesNotMatch(index, /href="[^"]*"[^>]*>Lozza/);
  assert.doesNotMatch(index, /href="\/projects\/lozza\/?"/);
  assert.equal(site.has('projects/lozza/index.html'), false);
  assert.equal(site.has('projects/lozza.md'), false);
  const markdown = site.read('projects.md');
  assert.match(markdown, /- Lozza \(in development, own site\): Native design tool for Mac and iPad, in development\./);
  assert.doesNotMatch(markdown, /\[Lozza\]/);
  const llms = site.read('llms.txt');
  assert.doesNotMatch(llms, /projects\/lozza/);
  const privacy = site.read('privacy/index.html');
  assert.doesNotMatch(privacy, /Lozza Waitlist|data-waitlist|cf-turnstile|challenges\.cloudflare\.com/);
  assert.doesNotMatch(site.read('projects/facts-memorizer/index.html'), /data-waitlist|cf-turnstile|challenges\.cloudflare\.com/);
});

test('an unknown Project front-matter field fails the build', () => {
  const site = buildFixture('project-unknown-field');
  assert.equal(site.ok, false);
  assert.match(site.output, /sample\.md/);
  assert.match(site.output, /website/);
});

test('a Projects index with nothing to list says so', () => {
  const site = buildFixture('basic');
  assert.ok(site.ok, site.output);
  const index = site.read('projects/index.html');
  assert.match(index, /<p>No Projects yet\.<\/p>/);
  assert.doesNotMatch(index, /class="project-list"/);
});
