<p align="center">
  <img src="docs/logo.png" alt="ORBIT logo" width="140" />
</p>

<h1 align="center">ORBIT</h1>

<p align="center">
  A Dynamic Island style, always-on-top status bar for Windows.<br/>
  Music with live lyrics, notifications, Bluetooth, system usage, clipboard shelf and more, in one tiny pill.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-white.svg" /></a>
  <img alt="Platform: Windows 10/11" src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-lightgrey.svg" />
</p>

---

## Screenshots

> Screenshots of the bar go here. Put the image files in [`docs/screenshots`](docs/screenshots) and reference them below.

<!-- Example:
<p align="center"><img src="docs/screenshots/music.png" width="420" /></p>
-->

## Features

- **Music** – shows what is playing on Spotify, YouTube or YouTube Music with album art, album-colour
  backgrounds and time-synced lyrics.
- **Notifications** – real Windows notifications, including WhatsApp messages and calls, with brand-colour flashes.
- **System usage** – live CPU, RAM, disk, battery and network speed of your own PC.
- **Bluetooth** – connection pop-up with device name, battery and sound controls.
- **Clipboard shelf** – copy, paste and drag & drop text, images and files in and out of the island.
- **Smart behaviour** – auto-expands on hover, auto-minimizes, remembers your last tab and shrinks to a small
  clickable bar while a full-screen app is running. It hides itself from screenshots and screen recordings.
- **Settings panel** – choose which pages are pinned, the idle bar style, the full-screen bar style and whether
  ORBIT **starts with Windows** (on/off switch).
- **Lightweight** – lives in the system tray with no taskbar icon and no console window.

## Install

1. Download **`ORBIT-Setup-<version>.exe`** from the [Releases](https://github.com/Sh3hann/dynamic-Island/releases) page.
2. Run it and follow the installer. No Node.js, npm or other tools are needed.
3. ORBIT starts automatically and appears at the top-centre of your screen. Use the tray icon to expand,
   open the settings or quit.

> Windows may show a SmartScreen notice because the installer is not code-signed. Choose **More info → Run anyway**.

### Shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt + Space` or `Ctrl + Shift + I` | Expand / collapse |
| `Ctrl + Shift + V` | Open the clipboard shelf |

## Build from source

Requires Node.js 20+ on Windows.

```powershell
git clone https://github.com/Sh3hann/dynamic-Island.git
cd dynamic-Island
npm install
npm run build
npm start          # run from source
npm run dist       # create release\ORBIT-Setup-<version>.exe
```

## Privacy

ORBIT works locally on your PC and has no telemetry. Only the song title and artist are sent to public
lyrics / album-art APIs (LRCLIB, iTunes Search, Deezer). Details are in [LEGAL.md](LEGAL.md).

## Legal

- Licensed under the [MIT License](LICENSE) © 2026 Sh3hann.
- [LEGAL.md](LEGAL.md) – disclaimer, trademarks and privacy.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) – open-source components.

ORBIT is an independent project and is not affiliated with Apple, Microsoft, Spotify, Google, Meta or any other
company named in the app.
