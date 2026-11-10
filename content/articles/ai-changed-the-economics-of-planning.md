---
title: AI changed the economics of planning
summary: When implementation gets cheap, the bottleneck moves to everything around the code. Plan comprehensively, build incrementally, evolve continuously.
published: 2026-11-10
tags: [ai, agents, product, process]
---

For years we moved away from Waterfall towards Agile. Instead of planning everything upfront, we embraced shorter cycles, incremental planning and continuous feedback.

It made sense. Implementation was expensive, changes were costly, and planning too far ahead meant making assumptions that would eventually prove wrong. Short cycles were a way of not paying twice for the same mistake.

AI is changing that equation.

## Implementation is no longer the slow part

When a coding agent can implement a well-specified piece of work in a fraction of the time it used to take, the cost of building stops being the thing a team has to protect. Something else becomes the bottleneck: everything around the code.

- **Meetings multiply** as teams try to stay aligned, and they wear down the people sitting in them.
- **Decisions lose their context** on the way from the customer to the code. By the time a requirement reaches whoever implements it, the *why* is gone.
- **Tickets and documents drift.** Nobody keeps them up to date, so the real plan lives in people's heads.
- **Attention runs out.** Nobody in their fourth meeting of the day is really listening.

An agent makes all of this more visible. Give it a vague ticket and it will build the wrong thing, confidently and fast. The speed we gained in implementation is lost again in rework, clarification and yet another meeting.

We don't need more meetings, more tickets or more documentation. We need better decision-making processes, shorter feedback loops and engineering artefacts that evolve alongside the product.

## Something in between

This isn't a case for going back to Waterfall, nor for abandoning Agile. Perhaps we need something in between:

- **Plan comprehensively.** Understand as much of the product as reasonably possible before implementation: the requirements, the workflows, the dependencies and the architectural decisions.
- **Build incrementally.** Break the plan into small, independently verifiable pieces.
- **Evolve continuously.** Update the plan as new requirements, constraints and opportunities emerge.

The goal isn't to predict everything upfront. It's to remove unnecessary uncertainty before implementation begins, while keeping the flexibility to adapt.

## What it looks like in practice

This is how I work with coding agents every day, and the process I've open-sourced as [AI Skills](/projects/ai-skills/):

1. **Grill before building.** Before any code, the agent interviews me about the feature until there are no open questions left. Ambiguity gets resolved in minutes of writing instead of an hour of meeting.
2. **Write the language down.** The same session updates a shared glossary and records each significant decision as an ADR. People and agents read the same words, so nobody has to re-explain the domain.
3. **Turn it into a spec, then into tickets.** Each ticket is small and verifiable on its own, so it can be built, reviewed and tested without the rest of the plan in anyone's head.
4. **Implement, then look back.** After the work lands, a short retrospective feeds what we learned back into the plan, the glossary and the decisions.

The artefacts aren't documentation written once and forgotten. They're the working memory of the product: an ADR gets superseded, a glossary term gets sharper, a spec gets a new constraint. Because they're written down, they survive the trip from the customer to the code, and they don't need a meeting to be passed on.

I lived this on Mind4EDP, EDP's multi-agent assistant, where I built the iOS and Android client. It started as hand-written code and, as the process matured, became a project developed entirely by AI agents. The code was never the part that kept it on track: the written decisions, the shared language and the small, verifiable tickets were.

## An open question

Maybe AI hasn't made planning less important. Maybe it has made comprehensive planning economically viable again.

If AI dramatically reduces the cost of implementation, shouldn't we reconsider how much time we invest in planning before we start building? I'd especially like to hear from people working with AI agents in their development workflow: are you planning more upfront now, or sticking to shorter planning cycles?
