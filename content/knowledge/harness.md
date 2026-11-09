---
kind: concept
title: "Harness"
summary: "Everything around the model that turns it into an agent: tools, system prompt, context-window management, permissions, hooks."
category: "Harness Engineering"
tags: ["harness", "agents"]
related: [model, agent, tool, context-window, turn, context, tool-call, session, compaction]
---

Everything around the [model](/knowledge/model/) that turns it into an [agent](/knowledge/agent/): [tools](/knowledge/tool/), system prompt, [context-window management](/knowledge/context-window/), permissions, hooks. **Claude.ai** and **Claude Code** run on the same model but behave differently because their harnesses differ.

The model itself only does one thing: take text in, produce text out. It can't read a file, run a command, or remember the last [turn](/knowledge/turn/). The harness supplies all of that. It assembles the [context](/knowledge/context/) for each model provider request, executes the [tool calls](/knowledge/tool-call/) the model asks for, feeds the tool results back in, stores the [session](/knowledge/session/) history, asks you for permission before risky actions, and decides when to [compact](/knowledge/compaction/). The agent loop (model proposes, harness executes, repeat) is run by the harness.

This matters for diagnosis. When behaviour differs between two products, or between yesterday and today, the model is often not the variable; the harness is. A different system prompt, a different set of tools, a changed permission default, or a new context-management strategy all change behaviour without any change to the model. It also means the harness is where most of your configuration lives: [AGENTS.md](https://github.com/joaodavidsilva/skills/blob/main/docs/references/agents-md.md) files, permission settings, and hooks are all instructions to the harness, not the model.

Examples: Claude Code, Cursor, Codex CLI, and Claude.ai, which is a chat harness rather than a coding one.

*Usage:*

"Same model, why is Claude Code editing files and Claude.ai just answering questions?"

"Different harnesses: Claude Code has filesystem tools, a different system prompt, and a permission layer. The model isn't the variable here."
