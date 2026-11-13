import { spawn } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { comparePngs } from './png-compare.mjs';
import { isWithin, startStaticServer } from './static-server.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const dist = resolve(root, 'dist');
const referenceDir = resolve(root, process.env.REDESIGN_COMPARE_REFERENCES ?? '../jds-notes/redesign-v2');
const outputDir = resolve(root, process.env.REDESIGN_COMPARE_OUTPUT_DIR ?? '.redesign-compare');
const chromeExecutable = process.env.CHROME_EXECUTABLE
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const configuredMaxDiffRatio = process.env.REDESIGN_COMPARE_MAX_DIFF_RATIO === undefined
  ? undefined
  : numberOption('REDESIGN_COMPARE_MAX_DIFF_RATIO', 0.005, 0, 1);
const maxDiffRatios = {
  home: 0.31,
  writing: 0.26,
  article: 0.16,
  research: 0.29,
  knowledge: 0.23,
  projects: 0.18,
  project: 0.38,
  pAiSkills: 0.23,
  pDotore: 0.26,
  pFacts: 0.27,
  pMarkdown: 0.33,
  now: 0.19,
  about: 0.28,
};
const pixelThreshold = numberOption('REDESIGN_COMPARE_PIXEL_THRESHOLD', 0.1, 0, 1);

const routes = [
  { id: 'home', path: '/' },
  { id: 'writing', path: '/writing/' },
  { id: 'article', path: '/writing/ai-changed-the-economics-of-planning/' },
  { id: 'research', path: '/research/' },
  { id: 'knowledge', path: '/knowledge/' },
  { id: 'projects', path: '/projects/' },
  { id: 'project', path: '/projects/brightboi/' },
  { id: 'pAiSkills', path: '/projects/ai-skills/' },
  { id: 'pDotore', path: '/projects/dotore/' },
  { id: 'pFacts', path: '/projects/facts-memorizer/' },
  { id: 'pMarkdown', path: '/projects/markdown-exporter/' },
  { id: 'now', path: '/now/' },
  { id: 'about', path: '/about/' },
];
const themes = ['light', 'dark'];
const expectedTokens = {
  light: {
    paper: '#faf8f3', ink: '#1d1b18', muted: '#5c574f', rule: '#ddd7ca',
    tint: '#f1ede3', tint2: '#e8e3d6', band: '#1d1b18', bandInk: '#ebe7de',
    bandMuted: '#a9a397', bandRule: '#35322c', accent: '#1f4396',
  },
  dark: {
    paper: '#171512', ink: '#ebe7de', muted: '#a9a397', rule: '#35322c',
    tint: '#221f1b', tint2: '#2b2722', band: '#0e0d0b', bandInk: '#ebe7de',
    bandMuted: '#a9a397', bandRule: '#35322c', accent: '#9db8ff',
  },
};
const tokenProperties = {
  paper: '--paper', ink: '--ink', muted: '--muted', rule: '--rule', tint: '--tint',
  tint2: '--tint2', band: '--band', bandInk: '--band-ink', bandMuted: '--band-muted',
  bandRule: '--band-rule', accent: '--accent',
};
const sweepWidths = Array.from({ length: 97 }, (_, index) => 320 + index * 10);
const structuralWidths = [641, 821, 941];
const allWidths = [...new Set([...sweepWidths, ...structuralWidths])].sort((a, b) => a - b);
const currentDir = join(outputDir, 'current');
const diffDir = join(outputDir, 'diff');
const reportPath = join(outputDir, 'report.json');
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  status: 'running',
  config: {
    referenceDir,
    outputDir,
    chromeExecutable,
    maxDiffRatio: configuredMaxDiffRatio ?? 'per-route',
    maxDiffRatios,
    pixelThreshold,
    viewportHeights: { overflowSweep: 900 },
    deviceScaleFactor: 1,
    overflowSweep: { minimum: 320, maximum: 1280, step: 10, structuralWidths },
    routes,
  },
  cases: [],
  fatalErrors: [],
};

function numberOption(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number from ${minimum} to ${maximum}; received ${JSON.stringify(raw)}`);
  }
  return value;
}

function portablePath(path) {
  const pathFromRoot = relative(root, path);
  return (isAbsolute(pathFromRoot) ? path : pathFromRoot).split(sep).join('/');
}

function captureNames(id, theme) {
  return [
    { filename: `${id}-1280-${theme}.png`, width: 1280, menu: false },
    { filename: `${id}-390-${theme}.png`, width: 390, menu: false },
    { filename: `${id}-menu-390-${theme}.png`, width: 390, menu: true },
  ];
}

async function validateConfiguration() {
  if (isWithin(dist, outputDir)) {
    throw new Error(`Comparison output must be outside dist: ${outputDir}`);
  }
  const missing = [];
  for (const route of routes) {
    for (const theme of themes) {
      for (const capture of captureNames(route.id, theme)) {
        const path = join(referenceDir, capture.filename);
        try {
          if (!(await stat(path)).isFile()) missing.push(path);
        } catch {
          missing.push(path);
        }
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.length} reference PNG(s):\n${missing.map((path) => `- ${path}`).join('\n')}`);
  }
  try {
    if (!(await stat(chromeExecutable)).isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Chrome executable not found: ${chromeExecutable}. Set CHROME_EXECUTABLE to an installed Chrome/Chromium binary.`);
  }
  await Promise.all([mkdir(currentDir, { recursive: true }), mkdir(diffDir, { recursive: true })]);
}

function runBuild() {
  return new Promise((resolveBuild, rejectBuild) => {
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const child = spawn(command, ['build'], {
      cwd: root,
      env: { ...process.env, JDS_OUT_DIR: dist },
      stdio: 'inherit',
    });
    child.once('error', rejectBuild);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`pnpm build failed (${signal ? `signal ${signal}` : `exit ${code}`})`));
    });
  });
}

function check(caseReport, name, passed, details = {}) {
  caseReport.checks.push({ name, passed: Boolean(passed), ...details });
  return passed;
}

async function preparePage(page, route, theme, origin, caseReport) {
  page.on('pageerror', (error) => {
    caseReport.errors.push({ type: 'pageerror', message: error.stack ?? error.message });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      caseReport.errors.push({ type: 'console.error', message: message.text(), location: message.location() });
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith(`${origin}/`) && response.status() >= 400) {
      caseReport.errors.push({ type: 'http', status: response.status(), url: response.url() });
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(`${origin}/`)) {
      caseReport.errors.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText });
    }
  });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('theme', selectedTheme);
  }, theme);
  const response = await page.goto(`${origin}${route.path}`, { waitUntil: 'load' });
  if (!response || response.status() !== 200) {
    throw new Error(`Route ${route.path} returned ${response?.status() ?? 'no response'}`);
  }
  check(caseReport, 'route returns 200', true, { route: route.path });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  await page.evaluate(() => document.fonts.ready);
}

async function verifyThemeControl(page, theme, caseReport) {
  const selector = `[data-theme-choice="${theme}"]`;
  const button = page.locator(selector);
  if (!check(caseReport, 'real footer theme control exists', await button.count() === 1, { selector })) return;
  await button.click();
  const state = await page.evaluate((selectedTheme) => ({
    rootTheme: document.documentElement.dataset.theme,
    storedTheme: localStorage.getItem('theme'),
    pressed: document.querySelector(`[data-theme-choice="${selectedTheme}"]`)?.getAttribute('aria-pressed'),
  }), theme);
  check(caseReport, 'real footer theme control applies and persists explicit theme',
    state.rootTheme === theme && state.storedTheme === theme && state.pressed === 'true', state);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function verifyFontsAndTokens(page, theme, caseReport) {
  const result = await page.evaluate(({ properties, expected, selectedTheme }) => {
    const bodyFont = getComputedStyle(document.body).fontFamily;
    const heading = document.querySelector('h1');
    const nav = document.querySelector('.site-nav');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;inset:0 auto auto 0;visibility:hidden;pointer-events:none';
    document.body.append(probe);
    const tokens = {};
    for (const [name, property] of Object.entries(properties)) {
      probe.style.color = `var(${property})`;
      const actual = getComputedStyle(probe).color;
      probe.style.color = expected[name];
      const expectedComputed = getComputedStyle(probe).color;
      tokens[name] = { actual, expected: expectedComputed, passed: actual === expectedComputed };
    }
    probe.remove();
    return {
      bodyFont,
      headingFont: heading ? getComputedStyle(heading).fontFamily : null,
      uiFont: nav ? getComputedStyle(nav).fontFamily : null,
      serifLoaded: document.fonts.check('16px "Source Serif 4"'),
      monoLoaded: document.fonts.check('16px "JetBrains Mono"'),
      tokens,
      selectedTheme,
    };
  }, { properties: tokenProperties, expected: expectedTokens[theme], selectedTheme: theme });
  const serif = /Source Serif 4/i;
  const mono = /JetBrains Mono/i;
  check(caseReport, 'computed Source Serif 4 body and heading fonts',
    serif.test(result.bodyFont) && serif.test(result.headingFont ?? '') && result.serifLoaded,
    { bodyFont: result.bodyFont, headingFont: result.headingFont, loaded: result.serifLoaded });
  check(caseReport, 'computed JetBrains Mono UI font', mono.test(result.uiFont ?? '') && result.monoLoaded,
    { uiFont: result.uiFont, loaded: result.monoLoaded });
  for (const [name, token] of Object.entries(result.tokens)) {
    check(caseReport, `computed ${tokenProperties[name]} token (${theme})`, token.passed, token);
  }
}

async function captureAndCompare(page, route, theme, capture, caseReport) {
  await page.setViewportSize({ width: capture.width, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const currentPath = join(currentDir, capture.filename);
  const referencePath = join(referenceDir, capture.filename);
  const differencePath = join(diffDir, capture.filename);
  const captureMaxDiffRatio = configuredMaxDiffRatio ?? maxDiffRatios[route.id];
  await page.screenshot({ path: currentPath, fullPage: true, animations: 'disabled', scale: 'css' });
  const entry = {
    id: route.id,
    route: route.path,
    theme,
    width: capture.width,
    menu: capture.menu,
    referencePath: portablePath(referencePath),
    currentPath: portablePath(currentPath),
    diffPath: portablePath(differencePath),
  };
  try {
    Object.assign(entry, await comparePngs(
      referencePath, currentPath, differencePath, pixelThreshold, captureMaxDiffRatio,
    ));
  } catch (error) {
    entry.passed = false;
    entry.error = error.stack ?? String(error);
  }
  caseReport.captures.push(entry);
}

async function menuState(page) {
  return page.evaluate(() => {
    const button = document.querySelector('[data-menu]');
    const header = document.querySelector('.site-header');
    const nav = document.querySelector('.site-nav');
    const contact = document.querySelector('[data-hcontact]');
    const label = button?.querySelector('[data-menu-label]');
    return {
      buttonExists: Boolean(button),
      expanded: button?.getAttribute('aria-expanded'),
      headerOpen: header?.dataset.open,
      label: label?.textContent,
      expectedOpenLabel: button?.dataset.closeLabel,
      expectedClosedLabel: button?.dataset.menuLabel,
      navDisplay: nav ? getComputedStyle(nav).display : null,
      contactDisplay: contact ? getComputedStyle(contact).display : null,
      focused: document.activeElement === button,
    };
  });
}

function verifyMenuState(caseReport, state, open, phase, focus = false) {
  const expectedLabel = open ? state.expectedOpenLabel : state.expectedClosedLabel;
  check(caseReport, `menu ${phase}`, state.buttonExists
    && state.expanded === String(open)
    && (open ? state.headerOpen === 'true' : state.headerOpen === undefined || state.headerOpen === 'false')
    && state.label === expectedLabel
    && state.navDisplay !== 'none' === open
    && state.contactDisplay !== 'none' === open
    && (!focus || state.focused), { ...state, phase, expectedFocus: focus });
}

async function verifyBreakpoint(page, width, route, caseReport) {
  if (width === 820 || width === 821) {
    const state = await page.evaluate(() => {
      const button = document.querySelector('[data-menu]');
      const nav = document.querySelector('.site-nav');
      const contact = document.querySelector('[data-hcontact]');
      return {
        buttonDisplay: button ? getComputedStyle(button).display : null,
        navDisplay: nav ? getComputedStyle(nav).display : null,
        contactDisplay: contact ? getComputedStyle(contact).display : null,
      };
    });
    const mobile = width === 820;
    check(caseReport, `${mobile ? 'mobile' : 'desktop'} navigation breakpoint at ${width}px`,
      mobile
        ? state.buttonDisplay !== 'none' && state.navDisplay === 'none' && state.contactDisplay === 'none'
        : state.buttonDisplay === 'none' && state.navDisplay !== 'none' && state.contactDisplay !== 'none',
      { width, ...state });
  }
  if (route.id === 'article' && [1280, 941, 940, 641, 640, 390].includes(width)) {
    const layout = await page.evaluate(() => {
      const element = document.querySelector('.toc');
      const prose = document.querySelector('.prose');
      if (!element || !prose) return null;
      const tocBox = element.getBoundingClientRect();
      const proseBox = prose.getBoundingClientRect();
      return {
        display: getComputedStyle(element).display,
        position: getComputedStyle(element).position,
        tocTop: tocBox.top,
        proseTop: proseBox.top,
      };
    });
    const hidden = width <= 640;
    const sticky = width > 940;
    check(caseReport, `TOC layout at ${width}px`, Boolean(layout)
      && (hidden ? layout.display === 'none' : layout.display !== 'none' && layout.tocTop <= layout.proseTop + 1)
      && (hidden || layout.position === (sticky ? 'sticky' : 'static')), { width, ...layout });
  }
  if (route.id === 'project' && [1280, 821, 820, 390].includes(width)) {
    const grid = await page.evaluate(() => {
      const element = document.querySelector('.screenshots');
      if (!element) return null;
      const columns = getComputedStyle(element).gridTemplateColumns;
      return {
        figureCount: element.querySelectorAll('figure').length,
        gridTemplateColumns: columns,
        columnCount: columns === 'none' ? 0 : columns.trim().split(/\s+/).filter(Boolean).length,
      };
    });
    const expectedColumns = width <= 820 ? 2 : 4;
    check(caseReport, `BrightBoi screenshot grid at ${width}px`,
      grid?.figureCount === 4 && grid.columnCount === expectedColumns,
      { width, expectedColumns, ...grid });
  }
}

async function sweepOverflowAndBreakpoints(page, route, caseReport) {
  for (const width of allWidths) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    const passed = dimensions.documentScrollWidth <= dimensions.innerWidth;
    caseReport.overflowSamples.push({ width, ...dimensions, passed });
    await verifyBreakpoint(page, width, route, caseReport);
  }
}

async function verifyMenuInteractionsAndCapture(page, route, theme, origin, caseReport) {
  await page.setViewportSize({ width: 390, height: 900 });
  verifyMenuState(caseReport, await menuState(page), false, 'initially closed at 390px');
  await captureAndCompare(page, route, theme, captureNames(route.id, theme)[1], caseReport);
  const button = page.locator('[data-menu]');
  if (!check(caseReport, 'real mobile Menu button exists', await button.count() === 1)) return;

  await button.click();
  verifyMenuState(caseReport, await menuState(page), true, 'opens with real button');
  await captureAndCompare(page, route, theme, captureNames(route.id, theme)[2], caseReport);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const desktopState = await menuState(page);
  check(caseReport, 'menu state resets when resizing to desktop', desktopState.expanded === 'false'
    && desktopState.headerOpen === 'false'
    && desktopState.label === desktopState.expectedClosedLabel
    && desktopState.navDisplay !== 'none'
    && desktopState.contactDisplay !== 'none', { ...desktopState, width: 1280 });
  await page.setViewportSize({ width: 390, height: 900 });
  verifyMenuState(caseReport, await menuState(page), false, 'stays closed after returning to mobile');

  await button.click();
  verifyMenuState(caseReport, await menuState(page), true, 'reopens after resizing');
  await button.click();
  verifyMenuState(caseReport, await menuState(page), false, 'closes with real button');

  await button.click();
  await page.keyboard.press('Escape');
  verifyMenuState(caseReport, await menuState(page), false, 'closes with Escape and restores focus', true);

  await button.click();
  const links = page.locator('.site-nav a');
  const linkCount = await links.count();
  let destination = null;
  for (let index = 0; index < linkCount; index += 1) {
    const href = await links.nth(index).getAttribute('href');
    if (href && new URL(href, origin).pathname !== route.path) {
      destination = { index, href };
      break;
    }
  }
  if (!check(caseReport, 'mobile menu has a navigation destination', destination !== null, { linkCount })) return;
  await Promise.all([
    page.waitForURL(new URL(destination.href, origin).href, { waitUntil: 'load' }),
    links.nth(destination.index).click(),
  ]);
  verifyMenuState(caseReport, await menuState(page), false, `closes after navigating to ${destination.href}`);
}

async function runCase(browser, origin, route, theme) {
  const caseReport = {
    id: route.id,
    route: route.path,
    theme,
    checks: [],
    overflowSamples: [],
    captures: [],
    errors: [],
  };
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await preparePage(page, route, theme, origin, caseReport);
    await verifyThemeControl(page, theme, caseReport);
    await verifyFontsAndTokens(page, theme, caseReport);
    await captureAndCompare(page, route, theme, captureNames(route.id, theme)[0], caseReport);
    await sweepOverflowAndBreakpoints(page, route, caseReport);
    await verifyMenuInteractionsAndCapture(page, route, theme, origin, caseReport);
  } catch (error) {
    caseReport.errors.push({ type: 'exception', message: error.stack ?? String(error) });
  } finally {
    await context.close();
  }
  return caseReport;
}

function finalizeReport() {
  const cases = report.cases;
  const captures = cases.flatMap((item) => item.captures);
  const checks = cases.flatMap((item) => item.checks);
  const overflowSamples = cases.flatMap((item) => item.overflowSamples);
  const runtimeErrors = cases.flatMap((item) => item.errors.map((error) => ({ id: item.id, theme: item.theme, ...error })));
  const failedCaptures = captures.filter((capture) => !capture.passed);
  const dimensionMismatches = captures.filter((capture) => capture.dimensionsMatch === false);
  const thresholdFailures = captures.filter((capture) => capture.widthMatch && capture.diffRatio > capture.maxDiffRatio);
  const failedChecks = checks.filter((item) => !item.passed);
  const overflowFailures = overflowSamples.filter((sample) => !sample.passed);
  const expectedCaptureCount = routes.length * themes.length * 3;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    expectedRoutes: routes.length,
    expectedCaptures: expectedCaptureCount,
    captured: captures.length,
    missingCaptures: expectedCaptureCount - captures.length,
    failedCaptures: failedCaptures.length,
    dimensionMismatches: dimensionMismatches.length,
    thresholdFailures: thresholdFailures.length,
    checks: checks.length,
    failedChecks: failedChecks.length,
    overflowSamples: overflowSamples.length,
    overflowFailures: overflowFailures.length,
    runtimeErrors: runtimeErrors.length,
    fatalErrors: report.fatalErrors.length,
  };
  report.passed = report.fatalErrors.length === 0
    && runtimeErrors.length === 0
    && captures.length === expectedCaptureCount
    && failedCaptures.length === 0
    && failedChecks.length === 0
    && overflowFailures.length === 0;
  report.status = report.passed ? 'passed' : 'failed';
}

let server;
let browser;
try {
  await validateConfiguration();
  await rm(currentDir, { recursive: true, force: true });
  await rm(diffDir, { recursive: true, force: true });
  await Promise.all([mkdir(currentDir, { recursive: true }), mkdir(diffDir, { recursive: true })]);
  await runBuild();
  ({ server, origin: report.origin } = await startStaticServer(dist));
  browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });
  for (const route of routes) {
    for (const theme of themes) {
      console.log(`Comparing ${route.id} (${theme})...`);
      report.cases.push(await runCase(browser, report.origin, route, theme));
    }
  }
} catch (error) {
  report.fatalErrors.push({ message: error.stack ?? String(error) });
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  finalizeReport();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`${report.passed ? 'PASS' : 'FAIL'}: ${report.summary.captured}/${report.summary.expectedCaptures} captures, `
  + `${report.summary.failedChecks} failed checks, ${report.summary.overflowFailures} overflow failures, `
  + `${report.summary.runtimeErrors} runtime errors.`);
console.log(`Report: ${reportPath}`);
if (!report.passed) process.exitCode = 1;
