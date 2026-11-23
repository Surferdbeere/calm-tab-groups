// Small shared helpers for the extension pages.

import { parseTabUrl, patternForUrl, siteHost } from '../src/rules.js';

export const COLOR_HEX = {
  grey: '#9aa0a6', blue: '#4c8bf5', red: '#e8584c', yellow: '#f6b400', green: '#34a853',
  pink: '#e5559b', purple: '#a26bf2', cyan: '#1fb5c9', orange: '#f7934c',
};
export const COLOR_NAME = {
  grey: 'Grey', blue: 'Blue', red: 'Red', yellow: 'Yellow', green: 'Green',
  pink: 'Pink', purple: 'Purple', cyan: 'Cyan', orange: 'Orange',
};

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

let toastTimer;
export function toast(message, kind = 'info') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = ''; }, 3500);
}

export function colorDot(color, size = 12) {
  return el('span', { class: 'dot', style: `background:${COLOR_HEX[color]};width:${size}px;height:${size}px` });
}

export function unusedColor(rules) {
  const used = new Set(rules.map((r) => r.color));
  return Object.keys(COLOR_HEX).find((c) => c !== 'grey' && !used.has(c)) ?? 'blue';
}

export function uniqueTitle(rules, base, except = null) {
  let title = base, n = 2;
  while (rules.some((r) => r !== except && r.title.toLowerCase() === title.toLowerCase())) title = `${base} ${n++}`;
  return title;
}

// Collects the sites of all open tabs: [{ key, label, pattern, host, count, url, favIconUrl }]
export async function openSites() {
  const tabs = await chrome.tabs.query({});
  const map = new Map();
  for (const t of tabs) {
    const url = t.url || t.pendingUrl;
    const u = parseTabUrl(url);
    if (!u || t.incognito) continue;
    const pattern = patternForUrl(url);
    const label = u.isFile ? 'Local files' : siteHost(u.host);
    const entry = map.get(pattern) ?? { key: pattern, label, pattern, host: u.host, count: 0, url, favIconUrl: t.favIconUrl };
    entry.count++;
    if (!entry.favIconUrl && t.favIconUrl) entry.favIconUrl = t.favIconUrl;
    map.set(pattern, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function favicon(site) {
  // Only show favicons Chrome already loaded; never fetch anything from the network.
  const src = site.favIconUrl && /^(data:|https:|chrome:)/.test(site.favIconUrl) ? site.favIconUrl : null;
  return src
    ? el('img', { class: 'favicon', src, alt: '', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(el('span', { class: 'favicon ph' })) })
    : el('span', { class: 'favicon ph' });
}
