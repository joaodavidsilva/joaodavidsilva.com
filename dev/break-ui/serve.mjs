// Dev-only break-ui harness: builds the site once per content set with the real build, then
// serves the builds behind a Demo / Worst case / Empty / One / 1,000 rows switch. Nothing here
// reaches a production build: the switch is injected into responses by this server only.
//
//   pnpm break-ui                 build missing sets, serve on http://localhost:4398/
//   pnpm break-ui --rebuild       rebuild every set first
//   pnpm break-ui --rebuild=worst rebuild one set (comma-separate several)
//
// The active set lives in the URL (?data=worst) and in a cookie, so following links keeps it.
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WAITLISTS } from '../../site.config.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const work = join(root, '.break-ui');
const sets = join(root, 'dev', 'break-ui', 'sets');

/** Content sets, in toggle order: the label and the content directory each builds from. */
const SETS = {
  demo: { label: 'Demo', content: join(root, 'content') },
  worst: { label: 'Worst case', content: join(sets, 'worst') },
  empty: { label: 'Empty', content: join(sets, 'empty') },
  one: { label: 'One', content: join(sets, 'one') },
  huge: { label: '1,000 rows', content: join(work, 'content', 'huge'), generate: true },
};

// What the stubbed Waitlist endpoint answers in each set (the Worker's real messages).
const list = WAITLISTS.lozza;
const WAITLIST_REPLIES = {
  demo: [201, { status: 'created', message: `You're on the list. You'll hear when ${list} is available.` }],
  worst: [400, { status: 'rejected', reason: 'disposable-email', message: 'Disposable email addresses cannot join the list. Use an address you will keep.' }],
  empty: [503, { status: 'rejected', reason: 'bot-check-unavailable', message: 'The bot check is unavailable right now. Try again in a few minutes.' }],
  one: [201, { status: 'created', message: `You're on the list. You'll hear when ${list} is available.` }],
  huge: [200, { status: 'already-signed-up', message: `You're already on the list. You'll hear when ${list} is available.` }],
};

// Cloudflare's always-passing Turnstile test site key: the production key refuses localhost.
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

const args = process.argv.slice(2);
const port = Number(process.env.BREAK_UI_PORT ?? 4398);
const rebuildArg = args.find((arg) => arg.startsWith('--rebuild'));
const rebuild = new Set(
  rebuildArg === undefined ? [] : rebuildArg.includes('=') ? rebuildArg.split('=')[1].split(',') : Object.keys(SETS),
);

const outOf = (set) => join(work, 'out', set);

function build(set) {
  const { content, generate } = SETS[set];
  if (generate) run(process.execPath, [join(root, 'dev', 'break-ui', 'huge.mjs'), content]);
  console.log(`break-ui: building "${set}" from ${content}`);
  run(join(root, 'node_modules', '.bin', 'astro'), ['build'], {
    JDS_CONTENT_DIR: content,
    JDS_OUT_DIR: outOf(set),
    JDS_SKILLS_DIR: process.env.JDS_SKILLS_DIR ?? join(root, 'test', 'fixtures', 'skills-repo'),
    ASTRO_TELEMETRY_DISABLED: '1',
  });
}

function run(command, commandArgs, env = {}) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`break-ui: ${command} ${commandArgs.join(' ')} failed`);
}

for (const set of Object.keys(SETS)) {
  if (rebuild.has(set) || !existsSync(join(outOf(set), 'index.html'))) build(set);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

/** The switch: plain chrome in a shadow root, fixed bottom-centre, so site CSS cannot touch it. */
const toggle = (active) => `
<break-ui-toggle data-active="${active}"></break-ui-toggle>
<script type="module" data-break-ui>
const SETS = ${JSON.stringify(Object.fromEntries(Object.entries(SETS).map(([key, { label }]) => [key, label])))};
const host = document.querySelector('break-ui-toggle');
const active = host.dataset.active;
const url = new URL(location.href);
if (url.searchParams.get('data') !== active) {
  url.searchParams.set('data', active);
  history.replaceState(history.state, '', url);
}
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = \`<style>
  :host { all: initial; position: fixed; inset-block-end: 12px; inset-inline-start: 50%; transform: translateX(-50%); z-index: 2147483647; }
  div { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: #e5e5e5; font: 12px/1 system-ui, sans-serif; }
  a { padding: 6px 10px; border-radius: 999px; color: #404040; text-decoration: none; white-space: nowrap; }
  a[aria-current] { background: #fff; color: #111; }
</style><div role="group" aria-label="break-ui data set"></div>\`;
const group = shadow.querySelector('div');
for (const [key, label] of Object.entries(SETS)) {
  const link = document.createElement('a');
  const target = new URL(location.href);
  target.searchParams.set('data', key);
  link.href = target.pathname + target.search + target.hash;
  link.textContent = label;
  if (key === active) link.setAttribute('aria-current', 'true');
  group.append(link);
}
</script>`;

function setOf(request, url) {
  const asked = url.searchParams.get('data');
  if (asked && asked in SETS) return asked;
  const cookie = /(?:^|;\s*)break-ui-data=(\w+)/.exec(request.headers.cookie ?? '')?.[1];
  return cookie && cookie in SETS ? cookie : 'demo';
}

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const set = setOf(request, url);
  response.setHeader('Set-Cookie', `break-ui-data=${set}; Path=/; SameSite=Lax`);
  response.setHeader('Cache-Control', 'no-store');

  if (url.pathname === '/api/waitlist') {
    const [status, body] = WAITLIST_REPLIES[set];
    request.resume();
    response.writeHead(request.method === 'POST' ? status : 405, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.method === 'POST' ? body : { status: 'rejected', reason: 'method-not-allowed', message: 'Only POST requests are accepted.' }));
    return;
  }

  const out = outOf(set);
  let path = normalize(decodeURIComponent(url.pathname));
  if (path.includes('..')) return void response.writeHead(400).end();
  let file = join(out, path);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith('/')) {
      response.writeHead(301, { Location: `${path}/${url.search}` });
      return void response.end();
    }
    file = join(file, 'index.html');
  }
  // Pagefind's Web Worker fetches its content-hashed index files without the cookie; find them in whichever set has them.
  if (!existsSync(file) && path.startsWith('/pagefind/')) {
    file = Object.keys(SETS).map((other) => join(outOf(other), path)).find((candidate) => existsSync(candidate)) ?? file;
  }
  let status = 200;
  if (!existsSync(file)) {
    status = 404;
    file = join(out, '404.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return void response.end(`<!doctype html><title>Not found</title><p>No page at ${path} in the "${set}" set.</p>${toggle(set)}`);
    }
  }
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  if (type.startsWith('text/html')) {
    import('node:fs/promises').then(async ({ readFile }) => {
      const html = (await readFile(file, 'utf8'))
        .replace(/data-sitekey="[^"]*"/g, `data-sitekey="${TURNSTILE_TEST_SITE_KEY}"`)
        .replace('</body>', `${toggle(set)}</body>`);
      response.writeHead(status, { 'Content-Type': type });
      response.end(html);
    });
    return;
  }
  response.writeHead(status, { 'Content-Type': type });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`break-ui: serving ${Object.keys(SETS).join(', ')} on http://localhost:${port}/?data=worst`);
});
