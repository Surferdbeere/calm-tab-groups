// Pattern matching for Calm Tab Groups.
//
// Pattern syntax (case-insensitive):
//   youtube.com            exactly youtube.com (and www.youtube.com)
//   *.youtube.com          youtube.com and every subdomain (m.youtube.com, music.youtube.com …)
//   *.amazon.*             amazon.de, www.amazon.co.uk, … (any subdomain, any ending)
//   github.com/my-org      a site plus the beginning of a path
//   file://*               every local file opened in Chrome
//   file://*.pdf           local files with an ending
//   file:///home/me/uni/*  local files in a folder
//
// When several patterns match a tab, the MOST SPECIFIC one wins, regardless of order.
// So "mail.google.com" in "Mail" beats "*.google.com" in "Google".

export const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob, { optionalSubdomain = false, prefix = false } = {}) {
  let body = glob;
  let head = '^';
  if (optionalSubdomain && body.startsWith('*.')) {
    head = '^(?:.*\\.)?';
    body = body.slice(2);
  }
  const re = escapeRegex(body).replace(/\*/g, '.*');
  return new RegExp(head + re + (prefix ? '' : '$'), 'i');
}

function literalLength(s) {
  return s.replace(/\*/g, '').length;
}

// Turns a pattern string into a function that returns a specificity score (> 0) or 0.
export function compilePattern(raw) {
  const p = String(raw ?? '').trim().toLowerCase();
  if (!p) return null;

  if (p.startsWith('file://')) {
    const glob = p.slice('file://'.length) || '*';
    const re = globToRegex(glob);
    const score = 300 + literalLength(glob);
    return (u) => (u.isFile && re.test(u.path) ? score : 0);
  }

  const m = p.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  if (!m) return null;

  if (m.includes('/')) {
    const slash = m.indexOf('/');
    const hostRe = globToRegex(m.slice(0, slash), { optionalSubdomain: true });
    const pathRe = globToRegex(m.slice(slash), { prefix: true });
    const score = 400 + literalLength(m);
    return (u) => (u.isWeb && hostRe.test(u.host) && pathRe.test(u.path) ? score : 0);
  }

  if (m.startsWith('*.') && !m.slice(2).includes('*')) {
    const base = m.slice(2);
    const score = 100 + base.length;
    return (u) => (u.isWeb && (u.host === base || u.host.endsWith('.' + base)) ? score : 0);
  }

  if (!m.includes('*')) {
    const score = 200 + m.length;
    return (u) => (u.isWeb && (u.host === m || u.host === 'www.' + m) ? score : 0);
  }

  const re = globToRegex(m, { optionalSubdomain: true });
  const score = 50 + literalLength(m);
  return (u) => (u.isWeb && re.test(u.host) ? score : 0);
}

export function isValidPattern(raw) {
  try { return compilePattern(raw) !== null; } catch { return false; }
}

// rules: [{ id, title, color, patterns: [], catchAll }]
export function compileRules(rules) {
  const compiled = [];
  let catchAll = null;
  for (const rule of rules ?? []) {
    const tests = (rule.patterns ?? [])
      .map((p) => { try { return { pattern: p, fn: compilePattern(p) }; } catch { return null; } })
      .filter((t) => t && t.fn);
    const entry = { id: rule.id, title: rule.title, color: rule.color, tests, catchAll: !!rule.catchAll };
    compiled.push(entry);
    if (entry.catchAll && !catchAll) catchAll = entry;
  }
  return { rules: compiled, catchAll };
}

export function parseTabUrl(url) {
  if (!url) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const isWeb = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  const isFile = parsed.protocol === 'file:';
  if (!isWeb && !isFile) return null; // chrome://, new tab page, extensions … are never touched
  let path = parsed.pathname;
  if (isFile) {
    try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  } else {
    path += parsed.search;
  }
  return { isWeb, isFile, host: parsed.hostname.toLowerCase(), path };
}

// Returns { rule, pattern, viaCatchAll } or null.
export function matchUrl(compiled, url) {
  const u = parseTabUrl(url);
  if (!u) return null;
  let best = null;
  let bestScore = 0;
  for (const rule of compiled.rules) {
    for (const t of rule.tests) {
      const s = t.fn(u);
      if (s > bestScore) { bestScore = s; best = { rule, pattern: t.pattern, viaCatchAll: false }; }
    }
  }
  if (best) return best;
  if (u.isWeb && compiled.catchAll) return { rule: compiled.catchAll, pattern: null, viaCatchAll: true };
  return null;
}

// ---------- Helpers for the user interface ----------

// "https://www.youtube.com/watch?v=1" / "www.youtube.com" / "youtube.com" -> "*.youtube.com"
export function normalizePattern(input) {
  let p = String(input ?? '').trim();
  if (!p) return null;
  if (/^file:\/\//i.test(p)) return p.toLowerCase();
  if (/^https?:\/\//i.test(p)) {
    try { p = new URL(p).hostname; } catch { return null; }
  }
  p = p.toLowerCase().replace(/\/+$/, '');
  if (/\s/.test(p)) return null;
  if (!p.includes('*') && !p.includes('/')) {
    // Convert international domain names to the form Chrome reports (punycode).
    try { p = new URL('http://' + p).hostname; } catch { return null; }
    if (p.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(p)) p = '*.' + p.replace(/^www\./, '');
  }
  return isValidPattern(p) ? p : null;
}

const SECOND_LEVEL = new Set(['co', 'ac', 'com', 'org', 'gov', 'edu', 'net', 'or', 'gv', 'ne', 'gob', 'go']);

// Domains that host many unrelated apps or sites on subdomains. For these, each
// subdomain counts as its own site (mail.google.com ≠ docs.google.com).
const PLATFORMS = new Set([
  'google.com', 'microsoft.com', 'cloud.microsoft', 'office.com', 'live.com', 'sharepoint.com', 'yahoo.com',
  'proton.me', 'apple.com', 'icloud.com', 'amazonaws.com', 'github.io', 'gitlab.io', 'blogspot.com',
  'wordpress.com', 'tumblr.com', 'notion.site', 'vercel.app', 'netlify.app', 'pages.dev', 'herokuapp.com',
  'atlassian.net', 'slack.com', 'zendesk.com', 'substack.com', 'medium.com', 'web.app', 'firebaseapp.com',
]);

function isPlainHost(host) {
  return !host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[');
}

// "tiss.tuwien.ac.at" -> "tuwien.ac.at", "www.youtube.com" -> "youtube.com"
export function baseDomain(host) {
  const h = String(host).toLowerCase().replace(/^www\./, '');
  if (isPlainHost(h)) return h;
  const labels = h.split('.');
  const n = labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
  return labels.slice(-n).join('.');
}

// The host that stands for "this site": the base domain, or the full host on platforms.
export function siteHost(host) {
  const h = String(host).toLowerCase().replace(/^www\./, '');
  if (isPlainHost(h)) return h;
  const base = baseDomain(h);
  return PLATFORMS.has(base) ? h : base;
}

// The pattern that covers "this site" of a URL.
export function patternForUrl(url) {
  const u = parseTabUrl(url);
  if (!u) return null;
  if (u.isFile) return 'file://*';
  const site = siteHost(u.host);
  return isPlainHost(site) ? site : '*.' + site;
}

// "www.tuwien.ac.at" -> "Tuwien", "mail.google.com" -> "Mail"
export function siteName(host) {
  const h = String(host).toLowerCase().replace(/^www\./, '');
  const site = siteHost(h);
  const base = baseDomain(h);
  const name = (site !== base ? site.split('.')[0] : base.split('.')[0]) || 'Site';
  return name.charAt(0).toUpperCase() + name.slice(1);
}
