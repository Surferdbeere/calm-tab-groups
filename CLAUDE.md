# CLAUDE.md – Calm Tab Groups

Context for Claude Code. Read this before changing anything.

## Working with the maintainer
- Maintainer: Thomas (GitHub: Surferdbeere), Vienna, studies computer science.
- **Talk to him in German.** Everything in the repo (code, comments, UI text, docs, commits) stays **English** – the extension is published internationally.
- He wants the extension to be beginner-proof: no jargon in the UI, sensible defaults, nothing that can silently break.

## What this is
A Manifest V3 Chrome extension that sorts tabs into Chrome tab groups by website rules
(e.g. `*.youtube.com` → "Video"). Goal: publish it on the Chrome Web Store, open source (MIT).

**Origin / core promise:** Existing extensions ("Automatische Tab-Sortierung", "Auto group tabs")
froze Chrome for ~30 s on every start on both of Thomas' machines (Windows + Omarchy Linux) when
Chrome restored the last session. Cause: they group every restored tab individually on every tab
event → hundreds of `chrome.tabs.group` calls → tab strip rebuilt on the UI thread over and over.
**Never reintroduce per-tab grouping on events.** Startup safety is the whole point of the product.

## Architecture (no build step, no dependencies)
```
extension/manifest.json        permissions: tabs, tabGroups, storage, alarms (no host permissions)
extension/src/background.js    service worker: scheduling + sorting passes
extension/src/rules.js         pattern compiling/matching, URL helpers (pure, tested in Node)
extension/src/config.js        storage (chrome.storage.sync, local fallback >7.5 KB), import/export
extension/src/presets.js       groups offered in setup (Mail, Docs, Video, Social, Shopping, AI, Dev, News, Files)
extension/pages/popup.*        toolbar pop-up: "This tab" assign, suggestions, group editor, pause switch
extension/pages/welcome.*      3-step setup wizard, opens on install
extension/pages/settings.*     options page: auto-sort, catch-all, import/export, reset
extension/pages/ui.js, common.css   shared UI helpers and styles (light/dark)
tests/*.test.js                node:test – rules, config, simulated 120-tab startup with mocked chrome.*
store/                         Web Store listing text (listing.md), screenshots, promo tile, icon
scripts/build.sh               zips extension/ → dist/calm-tab-groups-<version>.zip
scripts/make_icons.py          regenerates icons (Pillow)
```

## Key design decisions (keep them)
- **Startup:** `chrome.storage.session` flag `booted` detects a real browser start (session storage is cleared on start; worker restarts keep it). During startup nothing runs until tab events are quiet 3 s (min 5 s, max 45 s after boot). An alarm (`startup-pass`) guarantees the pass if the worker is suspended. Flag `startupDone` afterwards.
- **A pass** queries all normal windows, collects tab IDs per target rule and calls `chrome.tabs.group` **once per group per window**, paced (60 ms between calls at startup, 15 ms otherwise). Tabs already in the right group are skipped. Failed calls (e.g. user dragging a tab) → retry with exponential back-off (max 6).
- **Events:** only `onCreated`, `onUpdated` with `url`/`pinned:false`, `onAttached`, `onReplaced`. Group changes never trigger a pass → no loops, no fighting the user.
- **Matching:** most specific pattern wins, independent of rule order (scores in `compilePattern`). Groups are identified by **title** within a window.
- **Catch-all** (`catchAll: true`, one rule max): only for http(s) tabs; never pulls tabs out of groups the user made by hand (group titles without a rule). `chrome://`, New Tab page and pinned tabs are never touched.
- **Sites:** `siteHost()` collapses subdomains to the base domain (tiss.tuwien.ac.at → tuwien.ac.at) except on platform domains (google.com, microsoft.com, github.io, …) listed in `PLATFORMS`.
- **Config format:** `{ version, enabled, setupDone, rules: [{ id, title, color, patterns, catchAll }] }`. Import also accepts the "Auto Group Tabs" format (`matchers`, first empty group = catch-all).
- Renaming a group in the pop-up renames the live Chrome groups via a `renameGroup` message.
- No network requests, no analytics, no remote code (Web Store + PRIVACY.md depend on this).
- UI: no `alert/confirm`; destructive actions use a two-click "Click again to …" button.

## Commands
```sh
npm test          # node --test (Node 20+), must stay green
npm run build     # dist/ zip for the Web Store
```
Manual test: `chrome://extensions` → Developer mode → Load unpacked → `extension/`.
After changes reload with ↻ on the extension card. Bump `version` in `extension/manifest.json`
(and `package.json`) for every release and add a CHANGELOG entry.

## Status (2026-11-23)
- [x] v1.0.0 feature-complete, 13 tests green, end-to-end checked in real Chrome (headless):
      setup wizard, pop-up, settings, import, 150-tab session restore.
- [ ] **Push to GitHub** – repo `Surferdbeere/calm-tab-groups` exists (empty, public); local commit is ready.
- [ ] **Verify the startup freeze is gone on Thomas' real machines** (Windows + Omarchy, headed Chrome,
      100+ tabs, "Continue where you left off"). Headless Chrome could NOT reproduce the original freeze,
      even with a naive per-tab extension, so this is still unproven in practice.
- [ ] Chrome Web Store submission: developer account, upload dist zip, copy texts from `store/listing.md`,
      privacy policy URL = PRIVACY.md on GitHub.
- [ ] Thomas' own rules: import his old "Auto group tabs" JSON via Settings → Import.

## Ideas for later (not started)
- German UI via `_locales` (chrome.i18n) – currently English only.
- Optional: keep group order stable / sort groups alphabetically.
- Optional: "exclude" patterns (e.g. a subdomain that should not follow its domain).
