---
kind: concept
title: "Session"
summary: "One bounded run of interaction with an agent; the session is what fills the context window."
category: "Context Engineering"
tags: ["sessions", "context"]
related: [agent, clearing, compaction, context-window, model, turn]
---

One bounded run of interaction with an [agent](/knowledge/agent/). Starts empty, accumulates messages, tool results, and files read, and ends when [cleared](/knowledge/clearing/), closed, or [compacted](/knowledge/compaction/) into a fresh session. The session is what *fills* the [context window](/knowledge/context-window/): if the context window is the box, the session is the stuff slowly filling it up. Work too large for a single context window must be split across sessions.

The session's message history is the agent's working memory. The [model](/knowledge/model/) is [stateless](https://github.com/joaodavidsilva/skills/blob/main/docs/references/stateless.md), so everything it appears to remember (what you asked for, what the tests said, what it decided three turns ago) is in the message history, re-sent with every model provider request. Whatever isn't in the session doesn't exist for the agent.

That memory ends with the session. A new session starts from nothing: the agent that knew your codebase well at the end of yesterday's session knows none of it this morning. What survives is the filesystem: files written during one session can be read by the next, which is what handoffs, [memory systems](https://github.com/joaodavidsilva/skills/blob/main/docs/references/memory-system.md), and [AGENTS.md](https://github.com/joaodavidsilva/skills/blob/main/docs/references/agents-md.md) rely on.

You choose where a session ends. Everything in a session influences every later [turn](/knowledge/turn/), so unrelated tasks done in one session leave residue that colours the next answer. One task per session keeps the context relevant; finishing a task is a natural point to clear.

*Usage:*

"How long can one session run before it falls apart?"

"Depends on the work. A focused refactor stays sharp longer than open-ended research. Once the session bloats, hand off or compact, don't push through."
