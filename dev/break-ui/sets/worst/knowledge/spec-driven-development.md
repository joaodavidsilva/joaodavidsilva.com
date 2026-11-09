---
kind: concept
title: "Spec-driven development"
summary: "Writing the specification before the code, so an agent and a reviewer can check the result against something other than their own expectations."
category: "Development Processes & Methodologies"
tags: ["specifications", "process", "review", "agents"]
related: []
---

Writing the specification before the code, so an agent and a reviewer can check the result against something other than their own expectations.


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
