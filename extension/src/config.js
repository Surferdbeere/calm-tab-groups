// Loading, saving and importing the configuration.
//
// The config is stored in chrome.storage.sync, so it follows the user to every computer
// where they are signed in to Chrome. If it ever gets too big for sync (very many
// patterns), it is transparently stored locally instead.

import { COLORS, isValidPattern } from './rules.js';

export const CONFIG_KEY = 'config';
const SYNC_LIMIT = 7500; // bytes; chrome.storage.sync allows 8192 per item

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultConfig() {
  return { version: 1, enabled: true, setupDone: false, rules: [] };
}

function cleanRule(r) {
  const raw = r?.patterns ?? r?.matchers ?? [];
  const patterns = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const s = String(p).trim().toLowerCase();
    if (s && isValidPattern(s) && !patterns.includes(s)) patterns.push(s);
  }
  return {
    id: typeof r?.id === 'string' && r.id ? r.id : newId(),
    title: String(r?.title ?? '').trim().slice(0, 60) || 'Group',
    color: COLORS.includes(r?.color) ? r.color : 'grey',
    patterns,
    catchAll: r?.catchAll === true || r?.fallback === true,
  };
}

// Accepts our own format and exports of "Auto Group Tabs"-style extensions
// ([{ title, color, matchers: [...] }, ...]).
export function normalizeRules(input) {
  const list = Array.isArray(input) ? input : [];
  const hasFlags = list.some((r) => typeof r?.catchAll === 'boolean' || typeof r?.fallback === 'boolean');
  const rules = list.filter((r) => r && typeof r === 'object').map(cleanRule);

  // Foreign format without a catch-all flag: the first group without patterns collects the rest.
  if (!hasFlags) {
    const empty = rules.find((r) => r.patterns.length === 0);
    if (empty) empty.catchAll = true;
  }
  // Only one catch-all, unique titles.
  let seenCatchAll = false;
  const titles = new Set();
  for (const r of rules) {
    if (r.catchAll) { if (seenCatchAll) r.catchAll = false; seenCatchAll = true; }
    let t = r.title, n = 2;
    while (titles.has(t)) t = `${r.title} ${n++}`;
    r.title = t;
    titles.add(t);
  }
  return rules;
}

export function normalizeConfig(input) {
  const base = defaultConfig();
  if (Array.isArray(input)) return { ...base, setupDone: true, rules: normalizeRules(input) };
  if (!input || typeof input !== 'object') return base;
  return {
    version: 1,
    enabled: input.enabled !== false,
    setupDone: input.setupDone === true,
    rules: normalizeRules(input.rules),
  };
}

export async function loadConfig() {
  const { useLocal } = await chrome.storage.local.get('useLocal');
  const area = useLocal ? chrome.storage.local : chrome.storage.sync;
  const data = await area.get(CONFIG_KEY);
  return normalizeConfig(data[CONFIG_KEY]);
}

export async function saveConfig(config) {
  const clean = normalizeConfig(config);
  const size = new Blob([JSON.stringify({ [CONFIG_KEY]: clean })]).size;
  if (size < SYNC_LIMIT) {
    try {
      await chrome.storage.sync.set({ [CONFIG_KEY]: clean });
      await chrome.storage.local.set({ useLocal: false });
      await chrome.storage.local.remove(CONFIG_KEY);
      return clean;
    } catch (e) {
      console.warn('Sync storage failed, saving locally instead:', e);
    }
  }
  await chrome.storage.local.set({ [CONFIG_KEY]: clean, useLocal: true });
  return clean;
}

export function onConfigChanged(callback) {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[CONFIG_KEY] || changes.useLocal) callback();
  });
}

export function exportJson(config) {
  const rules = config.rules.map(({ title, color, patterns, catchAll }) => ({ title, color, patterns, catchAll }));
  return JSON.stringify({ app: 'calm-tab-groups', version: 1, rules }, null, 2);
}

// Returns the normalized rule list or throws a readable error.
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  const list = Array.isArray(data) ? data : data?.rules;
  if (!Array.isArray(list)) throw new Error('No groups found in this file.');
  const rules = normalizeRules(list);
  if (!rules.length) throw new Error('No groups found in this file.');
  return rules;
}
