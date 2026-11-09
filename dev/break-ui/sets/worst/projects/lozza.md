---
name: Lozza
oneLine: "A product in development for people who keep losing track of what they lent to whom, with a Waitlist for anyone who wants to hear the day it becomes available on iPhone, iPad, Mac and Android, in English and Portuguese, with no account, no tracking and nothing stored off the device."
status: in development
version: 0.9.0-beta.12+build.20261109.9f8e7d6c5b4a
published: 2026-11-09
tags: [apps, ios, android]
links:
  site: https://lozza.example.com/
  repository: https://github.com/joaodavidsilva/lozza-for-ios-ipados-macos-and-android
  stores:
    - { name: App Store, url: "https://apps.apple.com/app/lozza/id6738291045" }
    - { name: Mac App Store, url: "https://apps.apple.com/app/lozza/id6738291046" }
    - { name: Google Play, url: "https://play.google.com/store/apps/details?id=com.joaodavidsilva.lozza" }
    - { name: Microsoft Store, url: "https://apps.microsoft.com/detail/9nblggh4r32n" }
    - { name: F-Droid, url: "https://f-droid.org/packages/com.joaodavidsilva.lozza/" }
    - { name: Huawei AppGallery, url: "https://appgallery.huawei.com/app/C109876543" }
    - { name: Samsung Galaxy Store (Galaxy Store for tablets and foldables), url: "https://galaxystore.samsung.com/detail/com.joaodavidsilva.lozza" }
software:
  category: LifestyleApplication
  operatingSystems: [iOS, iPadOS, macOS, Android]
figures:
  - src: ./lozza/panorama.png
    alt: A 4000 by 200 pixel panorama banner in the accent blue
    caption: "A panorama, 4000 × 200: the kind of banner a store listing exports, with a caption long enough to wrap onto a second line at phone widths and keep going."
  - src: ./lozza/tall.png
    alt: A 200 by 4000 pixel tall strip, like a full-page phone screenshot
legal: [projects/lozza/privacy, projects/lozza/terms, projects/lozza/privacy/2026-08-19]
waitlist: lozza
---

Lozza is in development and not yet available. Join the Waitlist below to be told when it is.


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
