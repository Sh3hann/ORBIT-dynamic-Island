# Legal Notice, Disclaimer & Privacy

_Last updated: 2026-10-29_

ORBIT is free, open-source software published by **Sh3hann** under the [MIT License](LICENSE).
By installing or using ORBIT you agree to the terms below.

## 1. Ownership & copyright

- The ORBIT name, logo and source code are © 2026 Sh3hann. The source code is licensed under the MIT License;
  the ORBIT name and logo may not be used in a way that suggests your fork or product is the official ORBIT
  release.
- Third-party components keep their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 2. No warranty & limitation of liability

ORBIT is provided **"as is"**, without warranty of any kind, express or implied, including merchantability,
fitness for a particular purpose and non-infringement. To the maximum extent permitted by law, the author and
contributors are not liable for any claim, damages, data loss, or other liability arising from the use of, or
inability to use, the software.

## 3. Trademarks & no affiliation

ORBIT is an independent project. It is **not** affiliated with, sponsored by, or endorsed by Apple Inc.,
Microsoft Corporation, Spotify AB, Google LLC / YouTube, Meta Platforms Inc. / WhatsApp, Deezer, or any
other company mentioned in the application or documentation.

"Dynamic Island" and "iOS" are trademarks of Apple Inc. ORBIT only takes visual inspiration from the
idea of a compact, expanding status pill and does not use Apple code or assets. Windows is a trademark of
Microsoft Corporation. Spotify, YouTube, YouTube Music, WhatsApp, Deezer, iTunes and all other product names,
logos and brands are the property of their respective owners and are used only to identify the
services whose notifications or playback ORBIT can display.

## 4. Privacy

ORBIT runs **entirely on your PC**. It has no account system, no analytics, no telemetry and no advertising.

**What ORBIT reads locally (never uploaded by ORBIT):**

| Data | Why |
| --- | --- |
| CPU / RAM / disk / battery / network speed | System-usage tab |
| Currently playing media (Windows media session) | Music tab, album art, lyrics lookup |
| Windows notification history (`wpndatabase.db`, read-only) | Show WhatsApp / app notifications on the island |
| Clipboard text, images and file paths | Clipboard shelf (kept on your PC only) |
| Bluetooth device names and battery level | Bluetooth tab |
| Foreground window full-screen state | Collapse to a small bar during full-screen apps |

**What leaves your PC:** to find lyrics and album covers, ORBIT sends the **song title and artist name** of
the track you are playing to public music APIs: `lrclib.net`, `itunes.apple.com` and `api.deezer.com`.
Notification avatar images may be downloaded from the URL supplied by the notifying app. Nothing else is sent.

**Where data is stored:** settings, shelf items and notification history are stored locally in
`%APPDATA%\ORBIT` and in the app's local browser storage. Uninstalling ORBIT removes this data. You can clear
the shelf and notifications at any time from inside the app.

## 5. Your responsibility

- Notification and clipboard contents can be sensitive. ORBIT shows them on screen; do not use it in a
  setting where other people should not see them (for example while sharing your screen — ORBIT hides itself
  from most screen captures, but this cannot be guaranteed for every capture tool).
- Use ORBIT in compliance with the terms of service of the apps and services whose information it displays.

## 6. Security reports & contact

Please report vulnerabilities privately by e-mail to **akilshehan760@gmail.com** or through a private GitHub
security advisory on <https://github.com/Sh3hann/dynamic-Island>. Do not open public issues for
security problems.
