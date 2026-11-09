---
kind: concept
title: "Context window"
summary: "Everything the model sees on each model provider request: finite, model-specific, and the only surface through which it perceives anything."
published: 2026-11-09
category: "Context Engineering"
tags: ["context", "tokens", "fundamentals"]
related: [model, token, harness, tool-call, session, compaction, clearing]
---

Everything the [model](/knowledge/model/) sees on each model provider request. Finite, model-specific, and the *only* surface through which the model perceives anything.

It's a single sequence of [tokens](/knowledge/token/): the system prompt, the conversation so far, every tool result the [harness](/knowledge/harness/) has fed back in. If something is in that sequence, the model can use it; if it isn't, the model doesn't know it exists: not your codebase, not the file you edited yesterday, not the instruction you gave three sessions ago. Anything outside the window has to be brought in, usually via a [tool call](/knowledge/tool-call/), before it can affect anything.

Finite means it fills up. Every turn appends more (your messages, the model's responses, tool results) and a long [session](/knowledge/session/) will eventually hit the limit, forcing [compaction](/knowledge/compaction/) or [clearing](/knowledge/clearing/). It also means everything in the window competes: each token you load is one less available for the rest, and content you didn't need still occupies the model's attention. The practical stance is to treat the window as a budget: load what the task needs, leave the rest out.

*Avoid:* "memory", because the context window is working state and doesn't persist across sessions. [Memory](https://github.com/joaodavidsilva/skills/blob/main/docs/references/memory-system.md) is a separate concept layered on top.

*Usage:*

"Can I just paste the whole monorepo into the prompt?"

"The context window's 200k tokens, which is maybe a fifth of the repo. Pick the files the task touches, leave the rest behind a tool call."
