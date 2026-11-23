<p align="center">
  <img src="store/icon-512.png" width="96" alt="Calm Tab Groups icon">
</p>

<h1 align="center">Calm Tab Groups</h1>

<p align="center">
  Automatically sorts your Chrome tabs into tab groups by website –<br>
  <b>without freezing Chrome when it starts.</b>
</p>

---

## Why another auto-grouping extension?

Most auto-grouping extensions react to every single tab event. When Chrome starts and
restores a session with dozens or hundreds of tabs, they fire hundreds of grouping
calls in a few seconds. Each call makes Chrome rebuild its tab strip on the same
thread that handles your clicks and keyboard shortcuts – so Chrome can become
unresponsive for 30 seconds or more. Incognito windows work fine, which is the
tell-tale sign.

Calm Tab Groups does the same job differently:

- **It waits while Chrome restores your tabs.** Once things are quiet for a few seconds
  (at the latest after 45 s), it sorts everything in one pass.
- **One call per group, not per tab.** 150 restored tabs are sorted with about a dozen
  calls instead of hundreds.
- **Gentle pacing.** Calls are spaced out slightly, so even slow computers stay responsive.
- **Never touches what is already right**, and never fights with you: moving a tab
  by hand is respected until the tab navigates somewhere else.
- **Reliable.** If Chrome refuses a change (for example while you drag a tab), it
  retries automatically. An alarm makes sure the startup pass happens even if Chrome
  suspends the extension in the meantime.

## Features

- **Setup in under a minute.** A short assistant suggests groups based on the tabs you
  have open (Mail, Docs, Video, Social, Shopping, AI, Dev, News, Files) and offers to
  create groups for the sites you use most.
- **One-click sorting from the toolbar.** Open the pop-up on any site and pick the group
  it belongs to – done.
- **Suggestions** for open sites that don't have a group yet.
- **"Everything else" group** – optionally collect all other websites in a grey *Other* group.
- **Local files** (PDFs, images …) can get their own group.
- **Smart matching:** the most specific pattern wins, so `mail.google.com` can be in *Mail*
  while `*.google.com` is in *Google*.
- **Pause switch**, import/export, and sync across your computers via your Chrome profile.
- **Imports settings from "Auto Group Tabs"** and similar extensions.
- Light and dark mode. No tracking, no network requests, no accounts.

## Install

- **Chrome Web Store:** _coming soon_
- **From source:**
  1. Download this repository (Code → Download ZIP) and unzip it.
  2. Open `chrome://extensions` and switch on **Developer mode** (top right).
  3. Click **Load unpacked** and select the `extension` folder.

## Patterns

You normally don't need to write patterns – typing `youtube.com` or pasting a full address
works. For more control:

| Pattern | Matches |
|---|---|
| `youtube.com` | becomes `*.youtube.com`: youtube.com and all its subdomains |
| `*.amazon.*` | amazon.de, www.amazon.co.uk, … |
| `mail.google.com` | exactly this host (and `www.`) |
| `github.com/my-org` | a site plus the beginning of a path |
| `localhost`, `127.0.0.1` | local development servers |
| `file://*` | every local file opened in Chrome |
| `file://*.pdf` | local files with an ending |
| `file:///home/me/uni/*` | local files in a folder (`file:///C:/Users/me/Uni/*` on Windows) |

If several patterns match, the most specific one wins. Browser pages (`chrome://…`,
the New Tab page) and pinned tabs are never moved. Tabs in groups you created yourself
are never pulled into the *Other* group.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read the address of each tab to decide which group it belongs to. |
| `tabGroups` | Create, name and color tab groups. |
| `storage` | Save your groups (synced with your Chrome profile). |
| `alarms` | Guarantee the sorting pass after Chrome starts, even if the extension was suspended. |

No host permissions, no remote code, no network requests. See [PRIVACY.md](PRIVACY.md).

## Development

No build step and no dependencies – the `extension` folder is loaded as is.

```sh
npm test          # unit tests + a simulated 120-tab startup (Node 20+)
npm run build     # creates dist/calm-tab-groups-<version>.zip for the Chrome Web Store
```

Project layout:

```
extension/
  manifest.json
  src/background.js   service worker: scheduling and sorting
  src/rules.js        pattern matching
  src/config.js       storage, import/export
  src/presets.js      groups offered during setup
  pages/              pop-up, setup assistant, settings
tests/                node:test unit tests
store/                Chrome Web Store listing text and images
```

Contributions are welcome – please open an issue first for larger changes. When you add
presets, keep them limited to widely used sites.

## License

[MIT](LICENSE)
