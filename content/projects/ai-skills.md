---
name: AI Skills
oneLine: Small, composable agent skills for real software engineering with coding agents, not vibe coding.
status: active
published: 2026-11-09
tags: [ai, agents, developer-tools]
links:
  repository: https://github.com/joaodavidsilva/skills
facts:
  - label: Licence
    value: MIT, open source
  - label: Install
    value: "`npx skills@latest add joaodavidsilva/skills`"
  - label: Works with
    value: Claude Code, Codex and other coding agents
---

AI Skills is my open-source collection of agent skills: the instructions I use every day with Claude Code, Codex and other coding agents. They are MIT-licensed and install as editable files with `npx skills@latest add joaodavidsilva/skills`.

## Why it exists

Frameworks like GSD, BMAD and Spec-Kit help by owning the process, and in doing so they take away your control and make bugs in the process hard to resolve. These skills are small, easy to adapt and composable, and they work with any model. Each one fixes a failure mode I keep seeing with coding agents:

- **The agent didn't do what I wanted.** `/grill-with-docs` runs a grilling session: the agent asks detailed questions before it builds anything.
- **The agent is way too verbose.** The same session builds a shared language for the project (a `GLOSSARY.md` and ADRs), so the agent stops using twenty words where one will do.
- **The code doesn't work.** `/tdd` drives a red-green-refactor loop, and `/diagnosing-bugs` a disciplined debugging loop.
- **We built a ball of mud.** `/to-spec` and `/improve-codebase-architecture` keep the design of the code in view.

## How they fit together

Most work travels one main flow: `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement`, `/retro`. Bugs, big efforts and prototypes join it from the side.

## Key decisions

- **User-invoked and model-invoked skills.** User-invoked skills run only when you type them and orchestrate; model-invoked skills can also be picked up by the agent when the task fits and hold the reusable discipline. A user-invoked skill may call model-invoked ones, never another user-invoked one.
- **Grounded in classics.** Each fix draws on a classic of software engineering: *The Pragmatic Programmer*, *Domain-Driven Design*, *Extreme Programming Explained* and *A Philosophy of Software Design*.
- **Editable, not managed.** Skills install as plain files you can change; updates are manual.

Many [Knowledge Base](/knowledge/) entries started as the skills' reference documents.
