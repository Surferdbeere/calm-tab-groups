# Chrome Web Store listing

Copy these texts into the Chrome Web Store Developer Dashboard.

## Store listing

**Name:** Calm Tab Groups

**Summary** (max. 132 characters):
> Auto-sort tabs into tab groups by website – without freezing Chrome on startup. Easy setup, smart suggestions, no tracking.

**Category:** Workflow & Planning (alternative: Tools)

**Language:** English

**Description:**

```
Calm Tab Groups automatically sorts your tabs into Chrome tab groups by website – YouTube into "Video", Gmail into "Mail", your university or work sites into their own group.

★ WHY "CALM"?
Many auto-grouping extensions make Chrome freeze for up to a minute when it starts and restores your tabs: they group every restored tab one by one. Calm Tab Groups waits until Chrome has restored your session and then sorts everything in a single, gentle pass. Your browser stays responsive – even with 100+ tabs on a slow laptop.

★ SET UP IN UNDER A MINUTE
A short assistant looks at the tabs you have open and suggests groups: Mail, Docs, Video, Social, Shopping, AI, Dev, News and local Files. It also offers to create groups for the sites you use most. No patterns to learn.

★ ONE CLICK TO CHANGE ANYTHING
Click the toolbar icon on any website and choose the group it belongs to. Add sites, rename groups, change colors, or pause sorting – all from the pop-up.

★ FEATURES
• Automatic sorting of new and existing tabs
• Optional "Other" group for every site without a group of its own
• Local files (PDFs, images …) can get their own group
• Smart matching: the most specific rule wins (mail.google.com in "Mail", the rest of google.com in "Google")
• Respects groups you create by hand and never moves pinned tabs
• Settings sync across your computers with your Chrome profile
• Import and export – including settings from "Auto Group Tabs"
• Light and dark mode

★ PRIVACY
Everything happens on your computer. No data collection, no analytics, no network requests. Open source (MIT): https://github.com/Surferdbeere/calm-tab-groups
```

**Website / Support URL:** https://github.com/Surferdbeere/calm-tab-groups

**Privacy policy URL:** https://github.com/Surferdbeere/calm-tab-groups/blob/main/PRIVACY.md

**Images:** `icon-512.png` (resize to 128×128 for the store icon), `screenshots/*.png` (1280×800), `promo-440x280.png` (small promo tile).

## Privacy practices tab

**Single purpose:**
> Calm Tab Groups automatically organizes the user's open tabs into Chrome tab groups based on website rules the user configures.

**Permission justifications:**

| Permission | Justification |
|---|---|
| tabs | Needed to read the URL of each open tab in order to decide which tab group it belongs to. URLs are evaluated locally and never stored or transmitted. |
| tabGroups | Needed to create tab groups, add tabs to them and set their names and colors – the core function of the extension. |
| storage | Saves the user's group settings (names, colors, website patterns) and syncs them via Chrome Sync. |
| alarms | Guarantees that the one-time sorting pass after browser startup runs even if Chrome suspends the extension's service worker while the session is being restored. |

**Remote code:** No, I am not using remote code.

**Data usage:** Tick **"Web history"** only if the dashboard asks about reading tab URLs (the extension reads URLs locally to sort tabs). Then confirm all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes
