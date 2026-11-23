// Calm Tab Groups – background service worker.
//
// Why other auto-grouping extensions freeze Chrome on startup:
// they group every tab the moment an event arrives. When Chrome restores a session with
// 100 tabs, that means hundreds of separate grouping calls, and each one makes Chrome
// rebuild the tab strip on the same thread that handles your clicks and key presses.
//
// What this worker does instead:
//  1. Startup: while Chrome restores the session, nothing happens. Once tab events have
//     been quiet for a few seconds (at the latest after 45 s) ONE pass sorts everything.
//     An alarm guarantees that pass even if the worker is shut down in the meantime.
//  2. Every pass collects all tabs per target group and moves them with ONE call per
//     group and window, instead of one call per tab. Calls are spaced out slightly so
//     Chrome stays responsive on slow computers.
//  3. Tabs that are already in the right group are never touched.
//  4. While browsing, events are batched for a moment before a pass runs.
//  5. The worker's own grouping changes never trigger another pass (no loops).
//  6. If Chrome refuses a change (e.g. while you drag a tab), it retries with a back-off.

import { compileRules, matchUrl } from './rules.js';
import { loadConfig, onConfigChanged } from './config.js';

const STARTUP_QUIET_MS = 3000;
const STARTUP_MIN_MS = 5000;
const STARTUP_MAX_MS = 45000;
const NORMAL_QUIET_MS = 500;
const NORMAL_MAX_MS = 2500;
const PACE_STARTUP_MS = 60;   // pause between grouping calls during the startup pass
const PACE_NORMAL_MS = 15;
const MAX_RETRIES = 6;
const STARTUP_ALARM = 'startup-pass';

const bootTime = Date.now();
let inStartup = true;   // corrected below once storage.session has been checked
let cache = null;       // { config, compiled }
let timer = null;
let firstPendingAt = 0;
let running = false;
let rerun = false;
let retries = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// chrome.storage.session is cleared whenever Chrome starts. If our marker is present,
// this is just the worker waking up again (which happens all the time) – not a startup.
const ready = chrome.storage.session.get(['booted', 'startupDone']).then(async ({ booted, startupDone }) => {
  if (!booted) {
    await chrome.storage.session.set({ booted: true });
    await chrome.alarms.create(STARTUP_ALARM, { when: Date.now() + STARTUP_MAX_MS + 5000 });
    schedule();
  } else if (!startupDone) {
    schedule(); // the worker was stopped during startup – finish the job
  } else {
    inStartup = false;
  }
});

async function getState() {
  if (!cache) {
    const config = await loadConfig();
    cache = { config, compiled: compileRules(config.rules) };
  }
  return cache;
}

function schedule() {
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  let at;
  if (inStartup) {
    at = Math.max(now + STARTUP_QUIET_MS, bootTime + STARTUP_MIN_MS);
    at = Math.min(at, bootTime + STARTUP_MAX_MS);
  } else {
    at = Math.min(now + NORMAL_QUIET_MS, firstPendingAt + NORMAL_MAX_MS);
  }
  clearTimeout(timer);
  timer = setTimeout(() => run(), Math.max(0, at - now));
}

async function run({ force = false } = {}) {
  clearTimeout(timer);
  timer = null;
  firstPendingAt = 0;
  if (running) { rerun = true; return; }
  running = true;
  const wasStartup = inStartup;
  try {
    const { config, compiled } = await getState();
    if (!config.enabled && !force) return;
    const failed = await sortAllWindows(compiled, wasStartup ? PACE_STARTUP_MS : PACE_NORMAL_MS);
    if (failed && retries < MAX_RETRIES) {
      retries++;
      setTimeout(schedule, 1000 * 2 ** retries); // 2 s, 4 s, 8 s …
    } else {
      retries = 0;
    }
  } catch (e) {
    console.warn('[Calm Tab Groups] Sorting failed:', e);
  } finally {
    if (wasStartup) {
      inStartup = false;
      chrome.storage.session.set({ startupDone: true });
      chrome.alarms.clear(STARTUP_ALARM);
    }
    running = false;
    if (rerun) { rerun = false; schedule(); }
  }
}

// One pass over all normal windows. Returns true if something could not be changed.
async function sortAllWindows(compiled, paceMs) {
  if (!compiled.rules.length) return false;
  const ruleTitles = new Set(compiled.rules.map((r) => r.title));
  let failed = false;
  let calls = 0;
  const pace = async () => { if (calls++ > 0 && paceMs) await sleep(paceMs); };

  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  for (const win of windows) {
    let tabs, groups;
    try {
      [tabs, groups] = await Promise.all([
        chrome.tabs.query({ windowId: win.id }),
        chrome.tabGroups.query({ windowId: win.id }),
      ]);
    } catch { continue; } // window closed meanwhile

    const groupById = new Map(groups.map((g) => [g.id, g]));
    const groupByTitle = new Map();
    for (const g of groups) if (g.title && !groupByTitle.has(g.title)) groupByTitle.set(g.title, g);

    const pending = new Map(); // rule -> [tabId]
    for (const tab of tabs) {
      if (tab.pinned) continue;
      const match = matchUrl(compiled, tab.url || tab.pendingUrl);
      if (!match) continue; // chrome:// pages, new tab page … stay where they are
      const target = groupByTitle.get(match.rule.title);
      if (target && tab.groupId === target.id) continue; // already correct
      // The catch-all group never takes tabs out of groups the user made by hand.
      if (match.viaCatchAll && tab.groupId !== -1) {
        const current = groupById.get(tab.groupId);
        if (current && !ruleTitles.has(current.title)) continue;
      }
      if (!pending.has(match.rule)) pending.set(match.rule, []);
      pending.get(match.rule).push(tab.id);
    }

    // Keep the colours of existing groups in line with the settings.
    for (const rule of compiled.rules) {
      const g = groupByTitle.get(rule.title);
      if (g && g.color !== rule.color) {
        await pace();
        try { await chrome.tabGroups.update(g.id, { color: rule.color }); } catch { failed = true; }
      }
    }

    // One call per target group.
    for (const [rule, tabIds] of pending) {
      await pace();
      try {
        const existing = groupByTitle.get(rule.title);
        if (existing) {
          await chrome.tabs.group({ groupId: existing.id, tabIds });
        } else {
          const id = await chrome.tabs.group({ tabIds, createProperties: { windowId: win.id } });
          await chrome.tabGroups.update(id, { title: rule.title, color: rule.color });
          groupByTitle.set(rule.title, { id, title: rule.title, color: rule.color });
        }
      } catch (e) {
        // Typical: "Tabs cannot be edited right now (user may be dragging a tab)" or a tab closed meanwhile.
        console.warn(`[Calm Tab Groups] Could not update "${rule.title}":`, e?.message ?? e);
        failed = true;
      }
    }
  }
  return failed;
}

async function renameGroups(from, to) {
  if (!from || !to || from === to) return;
  const groups = await chrome.tabGroups.query({ title: from });
  for (const g of groups) {
    if (g.title !== from) continue;
    try { await chrome.tabGroups.update(g.id, { title: to }); } catch { /* group gone */ }
  }
}

// ---------- Events ----------
// Only changes that can affect where a tab belongs. Group changes (ours or the user's)
// deliberately do not trigger anything, so the extension never fights with you.

const onTabEvent = () => { if (!cache || cache.config.enabled) schedule(); };
chrome.tabs.onCreated.addListener(onTabEvent);
chrome.tabs.onUpdated.addListener((_id, info) => { if (info.url || info.pinned === false) onTabEvent(); });
chrome.tabs.onAttached.addListener(onTabEvent);
chrome.tabs.onReplaced.addListener(onTabEvent);

onConfigChanged(() => { cache = null; schedule(); });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === STARTUP_ALARM) ready.then(() => { if (inStartup) run(); });
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const { config } = await getState();
    if (!config.setupDone) chrome.tabs.create({ url: chrome.runtime.getURL('pages/welcome.html') });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'sortNow') {
    cache = null;
    run({ force: true }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'renameGroup') {
    renameGroups(msg.from, msg.to).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
