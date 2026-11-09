---
kind: concept
title: "Clearing"
summary: "Ending the current session and starting a fresh one with an empty context window."
published: 2026-11-09
category: "Context Engineering"
tags: ["context", "sessions"]
related: [session, context-window, model, turn, agent, context, harness, compaction]
---

Ending the current [session](/knowledge/session/) and starting a fresh one. The next message begins with an empty session and an empty [context window](/knowledge/context-window/). Usually user-driven.

Clearing is the cure for a polluted context. A session accumulates everything: failed attempts, wrong turns, stale tool results, abandoned plans. The [model](/knowledge/model/) re-reads all of it on every [turn](/knowledge/turn/), and bad history drags on new work. Deep into a long session the [agent](/knowledge/agent/) gets vaguer and less obedient: instructions you gave clearly get ignored, quality slips, and prodding it to do better doesn't help, because the noise it's wading through is still in its [context](/knowledge/context/). Clearing removes the noise.

Clearing doesn't erase the conversation. Most [harnesses](/knowledge/harness/) keep session history on your computer, so the transcript is still there to read or resume. What's gone is the agent's working state: the model is [stateless](https://github.com/joaodavidsilva/skills/blob/main/docs/references/stateless.md), so the new session knows nothing the old one knew. If the session holds decisions or progress the next one will need, have the agent write a handoff artifact first, then start the new session by pointing at it.

Compare [compaction](/knowledge/compaction/), which summarises the session into the new context instead of starting empty. Clearing is the blunter tool: nothing carries over, including the junk.

*Usage:*

"It's stuck looping on the failing test."

"Just clear it. Start a fresh session with the plan doc and the test file. No point fighting the existing context."
