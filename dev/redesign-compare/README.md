# Redesign rendered comparison

Dev-only acceptance tooling for issue #33. It builds the real Astro site, serves `dist` on an ephemeral loopback port, drives installed Chrome with Playwright, and compares the real rendered pages with the 78 stored mockup PNGs. It does not use Cloudflare/Wrangler, download a browser, or run as part of `pnpm test`.

## Setup

1. Install the locked Node dependencies with `pnpm install`. No Playwright browser install is needed or recommended.
2. Keep the reference renders in `../jds-notes/redesign-v2` (the path from `visual-contract.md`), or set `REDESIGN_COMPARE_REFERENCES` to that directory.
3. Install Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, or set `CHROME_EXECUTABLE` to another Chrome/Chromium executable.

## Run

```sh
pnpm compare:redesign
```

The command always performs a fresh `pnpm build` into `dist`. It checks all 13 exact contract routes in light and dark, captures full-page PNGs at device scale factor 1 after fonts are ready, and disables motion. Explicit themes are persisted before load and exercised through the real footer controls. Open-menu captures are taken through the real Menu button at 390px.

The deterministic overflow sweep covers every 10px from 320 through 1280 inclusive, in both themes on every route, with additional 641/821/941px boundary probes. Separate browser assertions cover:

- menu open, button close, Escape close/focus restoration, and navigation close;
- mobile navigation at 820px and desktop navigation at 821px;
- Article TOC sticky/static/hidden behavior across 940px and 640px;
- BrightBoi's four screenshots changing from four columns to two at 820px;
- computed Source Serif 4 and JetBrains Mono fonts and every key light/dark palette token.

Missing routes/references, browser runtime or same-origin asset errors, horizontal overflow, failed interaction/layout/font/token checks, missing captures, and visual threshold failures make the command exit nonzero. Corrected real copy is never rewritten or masked to reduce a diff.

## Output

Generated artifacts are outside `dist` and ignored by Git:

- `.redesign-compare/current/<reference-filename>.png` — current full-page renders;
- `.redesign-compare/diff/<reference-filename>.png` — pixel differences in red on a transparent mask;
- `.redesign-compare/report.json` — routes, configuration, every comparison and dimension pair, all responsive samples/checks, runtime errors, and the final pass/fail summary.

Each comparison records reference/current width and height, signed `widthDifference` and `heightDifference`, comparison canvas dimensions, different-pixel count, and `diffRatio`. Width mismatches fail independently of the ratio. Height mismatches are reported separately because the approved real content can legitimately be shorter or longer than the mockup; they do not fail by themselves. For differing dimensions, both images are padded with transparent pixels to their union rectangle before comparison, so pixels present on only one side contribute to the ratio rather than being silently cropped.

## Thresholds and configuration

The default maximum per-image diff ratio is route-specific because the approved real site deliberately contains corrected copy, extra Project sections, Lozza and the complete Professional record that the mockup does not show. These limits are regression ceilings, not targets; inspect current and diff PNGs when changing them.

| Route id | Maximum diff ratio |
| --- | ---: |
| `home` | 0.31 |
| `writing` | 0.26 |
| `article` | 0.16 |
| `research` | 0.29 |
| `knowledge` | 0.23 |
| `projects` | 0.18 |
| `project` (BrightBoi) | 0.38 |
| `pAiSkills` | 0.23 |
| `pDotore` | 0.26 |
| `pFacts` | 0.27 |
| `pMarkdown` | 0.33 |
| `now` | 0.19 |
| `about` | 0.28 |

A ratio equal to the threshold passes; a ratio above it fails. Pixelmatch's color-distance threshold is **0.1**, with anti-alias detection enabled and detected anti-aliased pixels excluded from the failure count (`includeAA: false`). Set `REDESIGN_COMPARE_MAX_DIFF_RATIO` to apply one stricter or looser override to every route.

Optional environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `REDESIGN_COMPARE_REFERENCES` | `../jds-notes/redesign-v2` | Directory containing all 78 contract PNGs |
| `REDESIGN_COMPARE_OUTPUT_DIR` | `.redesign-compare` | Artifact directory; must remain outside `dist` |
| `CHROME_EXECUTABLE` | macOS Google Chrome path above | Existing Chrome/Chromium binary |
| `REDESIGN_COMPARE_MAX_DIFF_RATIO` | Per-route table above | Optional override applied to every route, from 0 to 1 |
| `REDESIGN_COMPARE_PIXEL_THRESHOLD` | `0.1` | Pixelmatch per-pixel color-distance threshold, from 0 to 1 |

For example:

```sh
CHROME_EXECUTABLE=/path/to/chrome \
REDESIGN_COMPARE_MAX_DIFF_RATIO=0.005 \
pnpm compare:redesign
```

Review current and diff PNGs alongside the JSON report. Intentional mockup corrections still appear as visual differences; update approved external references deliberately, not the site's sourced facts or the comparison logic.
