---
name: BrightBoi
oneLine: A free macOS menu bar app that unlocks the extra brightness of the MacBook Pro's Liquid Retina XDR display, up to 200%.
status: active
version: 1.2.0
published: 2026-11-09
tags: [apps, macos]
links:
  repository: https://github.com/joaodavidsilva/brightboi
  stores: []
software:
  category: UtilitiesApplication
  operatingSystems: [macOS]
figures:
  - src: ./brightboi/popover-screenshot.png
    alt: "The BrightBoi popover at 100% in dark mode: a large percentage with an estimate in nits, a slider from 0 to 200% with a hatched Boost section, and Dim, 100% and Max boi buttons"
    caption: The menu bar popover, with the 0–200% slider, a nits estimate and quick-set buttons.
  - src: ./brightboi/settings-screenshot.png
    alt: "The BrightBoi Settings window in dark mode: launch at login, auto-brightness, F1/F2 shortcuts, update check, a Boost ceiling slider and the Accessibility permission status"
    caption: Settings, with F1/F2 or custom shortcuts, the Boost ceiling and live permission status.
  - src: ./brightboi/popover-boost.png
    alt: The popover at 150% with a BOOSTED badge and the slider's amber Boost section filled
    caption: Boost engaged at 150%, about 750 nits.
  - src: ./brightboi/hud.png
    alt: The on-screen HUD showing 80% with a segmented level bar
    caption: The on-screen meter shown by the brightness keys, in 5% steps.
legal: []
---

MacBook Pros with a Liquid Retina XDR (mini-LED) display can sustain about 1000 nits full-screen, but macOS stops at the 500-nit SDR level. Commercial utilities unlock that range behind paid licences or subscriptions; BrightBoi gives the whole 0–200% range for free, in a native Swift menu bar app. It is open source under the MIT licence.

[Download the latest release](https://github.com/joaodavidsilva/brightboi/releases/latest) (version 1.2.0, released 30 September 2026). It needs an Apple silicon Mac running macOS 14 or later; Boost above 100% needs a MacBook Pro with a Liquid Retina XDR display.

## How it works

- **One slider from 0 to 200%.** 100% means what Control Center's 100% means, about 500 nits. Above it, Boost places a full-screen, click-through Metal overlay that uses the display's Extended Dynamic Range headroom to scale desktop luminance up to 2×, about 1000 nits. Boost uses public APIs and is invisible to screenshots and screen sharing; the 0–100% range uses the private DisplayServices framework.
- **A ceiling that respects the panel.** 200% is the panel's sustained full-screen rating, never its 1600-nit peak, which would overheat and throttle. The ceiling can be lowered in Settings.
- **Brightness keys.** F1 and F2 step 5% at a time across the whole range with an on-screen meter, or can be remapped to any shortcut with a modifier.
- **Advisories.** The popover explains when Boost is paused or blocked, when Low Power Mode is on, when passing 170% on battery, or when the Mac gets hot while boosted.
- **Built-in display only.** External monitors are never touched; Macs without an XDR display stop at 100%.

## Privacy

BrightBoi has no analytics, telemetry or accounts. It makes no network requests unless you check for updates, or opt into a daily check against GitHub Releases. Preferences stay on the Mac.

## Limitations

Releases are signed but not notarized, so the first launch needs a one-time approval in System Settings. While boosted, HDR video and photos lose their brightest highlights. The 0–100% range and the auto-brightness switch rely on private macOS frameworks that a future macOS release could change. The [README](https://github.com/joaodavidsilva/brightboi#readme) lists every known limitation, the install steps and how to build from source.
