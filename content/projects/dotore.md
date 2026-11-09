---
name: dotore
oneLine: A pure-Rust static analyzer, deterministic auto-fixer and remediation engine for JS/TS, React, Angular, Python and Rust.
status: in development
published: 2026-11-09
tags: [developer-tools, rust, static-analysis]
links:
  site: https://joaodavidsilva.github.io/dotore/
  repository: https://github.com/joaodavidsilva/dotore
---

dotore is a static analyzer written in Rust. It checks JavaScript/TypeScript, React, Angular, Python and Rust code, applies safe fixes on its own, and turns the remaining findings into a plan for fixing them.

## What it does

dotore parses each file once and builds a cross-file graph of the project. It ships 1,076 rules and switches them on from the project's own manifests (`package.json`, `angular.json`, `pyproject.toml`, `Cargo.toml`), so React rules never run on an Angular or Rust package. It groups findings by root cause and gives the workspace a Health Score from 0 to 100.

Its main commands:

- `dotore check` runs the analysis; `--scope changed` limits it to changed files, and `--baseline` fails only on newly introduced findings.
- `dotore fix` applies deterministic auto-fixes.
- `dotore plan` groups findings into root-cause groups and Fix Capsules ranked by blast radius (P0 to P3).
- `dotore why <file:line>` explains why a rule fired, was suppressed or was skipped.
- `dotore check --handoff` hands findings straight to a coding agent such as Claude Code, Codex or Cursor.

## Key decisions

- **Rules gated by the project, not by configuration.** Capability gates read the manifests, so it works with zero configuration; overrides are optional.
- **Every finding says how big the fix is.** Each diagnostic carries one of three tiers: `autofix` (a byte-range rewrite applied by `dotore fix` and verified by re-parsing), `surgical` (a local edit guided by a Fix Capsule) or `refactor` (a cross-component change, with caller sites and blast radius).
- **One Rust workspace** with a crate per language family (JavaScript, Python, Rust) around a shared core.

It is built and installed from source with `cargo install --path .`; there is no published release yet.
