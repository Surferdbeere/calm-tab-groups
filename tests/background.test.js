// Simulates a Chrome start that restores 120 tabs and checks that the worker stays
// quiet during the restore, then sorts everything with a handful of API calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const ev = (name) => ({ addListener: (fn) => { (listeners[name] ??= []).push(fn); } });
const fire = (name, ...args) => (listeners[name] ?? []).forEach((fn) => fn(...args));

const tabs = [];
const groups = [];
let nextGroup = 1;
let calls = 0;
let failNextGroupCall = true; // simulate "user is dragging a tab" once

const config = {
  version: 1, enabled: true, setupDone: true, rules: [
    { id: 'a', title: 'Video', color: 'red', patterns: ['*.youtube.com'], catchAll: false },
    { id: 'b', title: 'Mail', color: 'blue', patterns: ['mail.google.com'], catchAll: false },
    { id: 'c', title: 'Files', color: 'grey', patterns: ['file://*'], catchAll: false },
    { id: 'd', title: 'Other', color: 'grey', patterns: [], catchAll: true },
  ],
};
const store = { sync: { config }, local: {}, session: {} };
const area = (n) => ({
  get: async (k) => (typeof k === 'string' ? { [k]: store[n][k] } : Object.fromEntries((k ?? Object.keys(store[n])).map((x) => [x, store[n][x]]))),
  set: async (o) => { Object.assign(store[n], o); },
  remove: async (k) => { delete store[n][k]; },
});

globalThis.chrome = {
  storage: { sync: area('sync'), local: area('local'), session: area('session'), onChanged: ev('storage') },
  alarms: { create: async () => {}, clear: async () => {}, onAlarm: ev('alarm') },
  runtime: { onInstalled: ev('installed'), onMessage: ev('message'), getURL: (p) => p },
  windows: { getAll: async () => [{ id: 1 }] },
  tabs: {
    onCreated: ev('created'), onUpdated: ev('updated'), onAttached: ev('attached'), onReplaced: ev('replaced'),
    create: async () => {},
    query: async ({ windowId }) => tabs.filter((t) => t.windowId === windowId).map((t) => ({ ...t })),
    group: async ({ groupId, tabIds }) => {
      calls++;
      if (failNextGroupCall) { failNextGroupCall = false; throw new Error('Tabs cannot be edited right now (user may be dragging a tab).'); }
      const id = groupId ?? nextGroup++;
      if (groupId == null) groups.push({ id, title: '', color: 'grey', windowId: 1 });
      for (const tid of tabIds) tabs.find((t) => t.id === tid).groupId = id;
      return id;
    },
  },
  tabGroups: {
    query: async ({ windowId, title }) => groups.filter((g) => (windowId == null || g.windowId === windowId) && (title == null || g.title === title)).map((g) => ({ ...g })),
    update: async (id, props) => { calls++; Object.assign(groups.find((g) => g.id === id), props); },
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urls = ['https://www.youtube.com/watch?v=1', 'https://mail.google.com/', 'https://example.org/', 'file:///home/me/a.pdf', 'chrome://newtab/'];

test('startup with 120 restored tabs', { timeout: 30000 }, async () => {
  await import('../extension/src/background.js');

  for (let i = 0; i < 120; i++) {
    tabs.push({ id: i, windowId: 1, url: urls[i % urls.length], groupId: -1, pinned: i === 0 });
    fire('created');
    fire('updated', i, { url: tabs[i].url });
    await sleep(15);
  }
  assert.equal(calls, 0, 'no API calls while Chrome restores tabs');

  await sleep(12000); // first pass fails once (dragging), retry after back-off

  const byTitle = Object.fromEntries(groups.map((g) => [g.title, tabs.filter((t) => t.groupId === g.id).length]));
  assert.deepEqual(byTitle, { Video: 23, Mail: 24, Other: 24, Files: 24 });
  assert.equal(tabs.filter((t) => t.url.startsWith('chrome://')).every((t) => t.groupId === -1), true);
  assert.equal(tabs[0].groupId, -1, 'pinned tab stays');
  assert.ok(calls <= 12, `few API calls (${calls})`);

  // Nothing to do -> no calls
  const before = calls;
  fire('updated', 5, { url: tabs[5].url });
  await sleep(800);
  assert.equal(calls, before);

  // Own group changes do not trigger passes
  fire('updated', 5, { groupId: 3 });
  await sleep(800);
  assert.equal(calls, before);

  // User-made groups are respected by the catch-all
  groups.push({ id: 99, title: 'My research', color: 'pink', windowId: 1 });
  tabs.push({ id: 500, windowId: 1, url: 'https://example.net/', groupId: 99, pinned: false });
  fire('created');
  await sleep(800);
  assert.equal(tabs.find((t) => t.id === 500).groupId, 99);
  process.exit(0); // stop the worker's timers
});
