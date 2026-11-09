---
title: "Does writing the failing test first make coding agents produce fewer regressions across a six-month, three-repository, 1,284-pull-request sample?"
summary: "A pre-registered comparison of test-first and test-after prompting across three repositories: regressions per hundred merged pull requests, review time and reverted merges, every raw count published."
published: 2026-10-15
status: in progress
featured: true
tags: [agents, testing, tdd, regressions, statistics, pre-registration, context-engineering-for-long-running-autonomous-agents]
data:
  - { title: "Raw pull-request counts, per repository, per week, with reverted merges flagged (CSV, the version analysed in the preprint)", file: pull-requests-per-week-per-repository-2026-04-to-2026-10.csv }
  - { title: Pre-registration, url: "https://osf.io/abcd1/?view_only=9f8e7d6c5b4a4c3d8e2f1a0b9c8d7e6f" }
scripts:
  - { title: analysis.py, file: analysis.py }
  - { title: "Notebook on GitHub", url: "https://github.com/joaodavidsilva/does-test-first-help-coding-agents/blob/main/notebooks/01-regressions-per-hundred-merged-pull-requests.ipynb" }
---

## Question

Question paragraph.

## Hypothesis

Hypothesis paragraph.

## Method

Method paragraph.

## Observations

Observations paragraph.

## Findings

Findings paragraph.

## Limitations

Limitations paragraph.


Escaping must hold: `<script>alert(1)</script>`, a literal &amp;amp; entity, and asterisks that are \*\*not bold\*\*. A plain-text address like first.last+billing-notifications@sub.department.region.example.co.uk and a bare URL: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/?utm_source=joaodavidsilva.com&utm_medium=article&utm_campaign=waitlist-implementation-notes#accepted-parameters

An unbreakable identifier in prose: `mcp__penpot_execute_code_with_extended_timeout_and_retries`, and the camera file IMG_20250914_183022_HDR_portrait_edited_edited.HEIC.

> [!NOTE]
> A note callout.

> [!WARNING]
> Paramètres de confidentialité et de sécurité: the French label runs about thirty per cent longer than "Privacy & security", and the German one, Benachrichtigungseinstellungen, has no break opportunity at all.

> A plain blockquote, the kind an essay uses for a long quotation from someone else's argument about how software should be specified before it is written.


| Processor | Purpose | Personal data | Retention | Location | Legal basis (GDPR Art. 6) |
| --- | --- | --- | --- | --- | --- |
| Cloudflare, Inc. (Web Analytics) | Counting page views without cookies or fingerprinting | Truncated IP address, user agent, referrer URL | 6 months, aggregated | United States and European Union (Standard Contractual Clauses) | Legitimate interest, Art. 6(1)(f) |
| Cloudflare, Inc. (D1, Workers) | Storing Waitlist sign-ups | Email address, consent timestamp, source, privacy-notice version | Until the product launches or you ask to leave | European Union jurisdiction | Consent, Art. 6(1)(a) |
| Cloudflare, Inc. (Turnstile) | Telling people from bots on the Waitlist form | Browser signals, IP address | Not stored by joaodavidsilva.com | Global edge network | Legitimate interest, Art. 6(1)(f) |



```ts
export async function verifyTurnstile(token: string, remoteip: string | null, env: { TURNSTILE_SECRET_KEY: string }): Promise<{ success: boolean; "error-codes": string[]; challenge_ts?: string; hostname?: string }> {
  const body = new FormData(); body.append('secret', env.TURNSTILE_SECRET_KEY); body.append('response', token); if (remoteip) body.append('remoteip', remoteip);
  return (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })).json();
}
```


1. A numbered list
   - with a nested bullet that keeps going for a while so it wraps onto a second line at narrow widths
     - and a third level
2. Second item[^long]

[^long]: A footnote with a long URL inside it: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/?utm_source=joaodavidsilva.com&utm_medium=article&utm_campaign=waitlist-implementation-notes#accepted-parameters

