## Agent skills

### Issue tracker

Issues live in GitHub Issues for `joaodavidsilva/joaodavidsilva.com`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Working rules

- **No git worktrees.** Work in the main checkout on `main`. Subagents must not create worktrees or branches for their own use; if work runs in parallel, give each subagent distinct files in the same checkout and tell it never to run `git checkout`, `reset`, `stash` or `clean`.
- **Cloudflare is for the main agent only.** Subagents must not use the Cloudflare MCP server, `wrangler`, or the Cloudflare API: no deploys, DNS, D1, Turnstile, Email Routing or secrets. They report what they need and the main agent does it.
- **Publishing is the main agent's job.** Deploys run from `main` after the full test suite passes; `main` is what is live.
- The Cloudflare skills and MCP server are project-local (`.omp/`, not tracked by git).
