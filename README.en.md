<div align="center">
  <br>
  <h1>Vinylly</h1>
  <p><strong>A physical audio collection catalog that actually looks like an app, not a spreadsheet.</strong></p>

  <p>
    <a href="https://github.com/annenskei/Vinylly/actions"><img src="https://img.shields.io/github/actions/workflow/status/annenskei/Vinylly/ci.yml?branch=main&style=flat-square&logo=github&color=0F62FE" alt="CI"></a>
    <a href="./LICENSE.md"><img src="https://img.shields.io/badge/License-Non--Commercial-F56C2D?style=flat-square" alt="License"></a>
    <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri-2.x-24C8D8?style=flat-square&logo=tauri" alt="Tauri"></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React"></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript"></a>
    <br>
    <a href="./README.md"><img src="https://img.shields.io/badge/Читать-по--русски-0F62FE?style=flat-square" alt="Russian"></a>
    <a href="https://boosty.to/annenskei/donate"><img src="https://img.shields.io/badge/Sponsor-Boosty-F56C2D?style=flat-square&logo=boosty" alt="Sponsor"></a>
  </p>
</div>

<br>

---

> **Speak Russian?** [Switch to Russian](./README.md)

---

## Support the project

Vinylly is a free open-source project. I write it in my spare time — which, as you might imagine, shrinks a little more every year. If you find it useful, buy me a coffee. Or tea. Or a Spotify subscription (the irony is not lost on me).

- **[Boosty](https://boosty.to/annenskei/donate)**
- **[DonationAlerts](https://dalink.to/annenskei)**
- **Bitcoin:** `bc1qvuhvewu3rjth80wnpdxkrl6vwtgjtspszkcqap`
- **Ethereum:** `0xc126080ffD216827A37850a5511cf1273E303E73`
- **Solana:** `516jeJxi1gwaRH7aEEiopAUAGNHKMrUxWv4cfGm32GhB`

---

## What is this

You know that feeling when you're standing in front of your record shelf, staring at the spines, and thinking: "I'm pretty sure I own this album. Or do I? Wait, was that my friend's?" Me too. More times than I'd like to admit.

**Vinylly** is a desktop app for cataloging physical audio media — vinyl, CDs, cassettes, and anything else collecting dust on your shelves. It doesn't stream music and it's not trying to replace Discogs. It just helps you avoid buying a fourth copy of *Abbey Road* because you forgot about the third one.

---

## Why Vinylly

| Collector's pain                         | How Vinylly solves it                                  |
| :--------------------------------------- | :----------------------------------------------------- |
| Covers and metadata scattered everywhere | Search via Discogs / MusicBrainz with auto-fill        |
| Remembering sleeve condition "by eye"    | Fields for sleeve and media condition + notes          |
| Can't remember where things are          | "Location" field with quick search                     |
| Want offline-first                       | Local SQLite; network for enrichment only              |
| Tired of "yet another Electron app"      | Tauri 2.x: native binary, lightweight, portable mode   |

---

## Features

- **Quick add** — by barcode, catalog number, or title.
- **Auto-enrichment** — covers, tracklists, year, genre, label from Discogs / MusicBrainz.
- **Collection grid** — tile view with covers, filters by format, search, sorting.
- **Release card** — cover art, metadata, personal notes, tracklist with lyrics.
- **Import / export** — JSON and CSV for backup and migration.
- **Portable mode** — run from a USB stick (`--portable` or `VINYL_PORTABLE=1`).
- **Neumorphism UI** — consistent design system with light and dark themes.

<!-- TODO: screenshots -->
<!-- ![Collection](./docs/screenshots/collection.png) -->
<!-- ![Detail](./docs/screenshots/detail.png) -->

---

## Tech stack

| Layer             | Technologies                                                        |
| :---------------- | :------------------------------------------------------------------ |
| Frontend          | React 18, TypeScript, Vite                                          |
| UI / Styling      | Tailwind CSS, custom neumorphic design system                       |
| State Management  | TanStack Query, Zustand                                             |
| Desktop           | Tauri 2.x (Rust + WebView)                                          |
| Database          | SQLite, Prisma                                                      |
| Media Providers   | Discogs, MusicBrainz, Cover Art Archive, Last.fm, Genius            |
| Testing           | Vitest, Playwright                                                  |

---

## Quick start

```bash
# 1. Clone the repo
git clone https://github.com/annenskei/vinylly.git
cd vinylly

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

### Available scripts

```bash
pnpm lint          # ESLint — so the code doesn't look like my first PHP scripts
pnpm typecheck     # TypeScript type checking
pnpm test          # Unit tests (yes, I write those, believe it or not)
pnpm format        # Prettier — even code deserves to look good
pnpm dev           # Dev server (Vite)
pnpm build         # Full build (web + desktop)
```

---

## Building the desktop app

You'll need the Rust toolchain and Tauri dependencies ([guide](https://tauri.app/start/prerequisites/)). If you've never installed Rust before... well, it's a one-time setup, and after that it just works. Probably.

```bash
pnpm --filter @vinylly/desktop build --no-bundle
```

Artifacts:
- **Windows:** `apps/desktop/src-tauri/target/release/vinylly.exe`
- **Linux:** `apps/desktop/src-tauri/target/release/vinylly`

---

## Architecture

```
Vinylly/
├── apps/
│   ├── web/                # React + Vite (WebView payload)
│   └── desktop/            # Tauri 2.x (Rust shell)
├── packages/
│   ├── db/                 # Prisma schema + SQLite
│   ├── media-providers/    # Discogs, MusicBrainz, Last.fm, Genius clients
│   ├── host/               # HostFs / HostPaths / HostNet abstractions
│   └── ui/                 # Neumorphic components
├── package.json            # pnpm workspace
└── README.md
```

The core principle is **portability**: business logic and UI don't depend on the platform. The same TypeScript code runs on desktop, web, and (eventually) mobile devices.

---

## Roadmap

- [x] Database and models
- [x] Search and release import
- [x] Collection and release details page
- [x] Import / export JSON and CSV
- [ ] Song lyrics with fallback
- [ ] Android / iOS ports (yes, I know you're waiting)
- [ ] PWA build

---

## License

[Vinylly Non-Commercial License](./LICENSE.md) — free for non-commercial use.  
Commercial use requires written permission. See [LICENSE.md](./LICENSE.md) for details.

---

<div align="center">
  <sub>Made with love and a dwindling supply of free time</sub>
  <br>
  <sub><a href="./README.md">Russian version</a></sub>
</div>
