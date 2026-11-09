---
name: Facts Memorizer
oneLine: A free times-tables practice app for children, with no accounts, no ads and no data collection.
status: active
version: 1.1.0
published: 2026-11-09
tags: [apps, education]
links:
  stores:
    - name: App Store
      url: https://apps.apple.com/app/times-tables-facts-memorizer/id6797351829
    - name: Google Play
      url: https://play.google.com/store/apps/details?id=com.factsmemorizer.app
software:
  category: EducationalApplication
  operatingSystems: [iOS, Android]
legal:
  - projects/facts-memorizer/privacy
  - projects/facts-memorizer/terms
---

Facts Memorizer helps children practise their times tables. It is published as "Times Tables: Facts Memorizer" on the App Store and Google Play.

## What it does

Instead of drilling the facts a child already knows, the app finds the multiplication and division facts they answer slowest and least accurately, and puts those in front of them.

- **What you practise:** multiplication tables up to ×10, ×11 or ×12, division tables (the inverse of every multiplication fact), or both mixed.
- **Five game modes:** Free Practice, Against the Clock, Survival, Clock Survival and Risk / Reward, with three difficulty levels in the timed modes.
- **The Domain Map:** every fact gets a Weakness Score combining accuracy and speed and is coloured on a single grid: Mastered, Solid, Shaky, Weak or Not practised.
- **Auto Focus:** the app picks the weakest tables on its own and can skip facts already mastered.
- **The habit:** practised days add up and never reset, so missing a day costs nothing; there are streaks, personal records for each mode and statistics on accuracy and speed.

## Key decisions

- **No data leaves the device.** The app has no servers and makes no network requests: practice records stay on the device. There is no account, no sign-up and no ads, and it works fully offline. Both store listings declare that no data is collected.
- **Practice where it counts.** Sessions target the weakest facts rather than the ones already known, measured by both accuracy and speed.

The latest update added Spanish, German, French, Italian and Dutch to Portuguese and English, let a Session pause and resume with the same clock, hits and Streak, and made the screen reader announce each fact's weakness band.
