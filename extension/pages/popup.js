import { COLORS, compileRules, matchUrl, normalizePattern, parseTabUrl, patternForUrl, siteName, siteHost } from '../src/rules.js';
import { loadConfig, saveConfig, newId, onConfigChanged } from '../src/config.js';
import { COLOR_HEX, COLOR_NAME, el, toast, colorDot, unusedColor, uniqueTitle, openSites, favicon } from './ui.js';

const main = document.getElementById('main');
const enabledBox = document.getElementById('enabled');

let config;
let activeTab = null;
let sites = [];
let openId = null;      // id of the expanded group
let selfWrite = false;  // ignore storage events caused by our own saves

// ---------- Data ----------

async function save(message) {
  selfWrite = true;
  config = await saveConfig(config);
  if (message) toast(message);
  setTimeout(() => { selfWrite = false; }, 300);
}

function compiled() {
  return compileRules(config.rules);
}

// Put `pattern` into `rule` (or nowhere if rule is null), removing it everywhere else.
function assignPattern(pattern, rule) {
  for (const r of config.rules) r.patterns = r.patterns.filter((p) => p !== pattern);
  if (rule) rule.patterns.push(pattern);
}

// Patterns that stand for exactly this site (e.g. "youtube.com", "*.youtube.com", "*.music.youtube.com").
function sitePatterns(host) {
  const bare = host.replace(/^www\./, '');
  const site = siteHost(host);
  return new Set([host, bare, '*.' + bare, 'www.' + bare, site, '*.' + site]);
}

function removeSitePatterns(host) {
  const own = sitePatterns(host);
  for (const r of config.rules) r.patterns = r.patterns.filter((p) => !own.has(p));
}

function newGroup(title, patterns = []) {
  const rule = { id: newId(), title: uniqueTitle(config.rules, title), color: unusedColor(config.rules), patterns, catchAll: false };
  config.rules.push(rule);
  return rule;
}

// ---------- Rendering ----------

function render() {
  enabledBox.checked = config.enabled;
  document.getElementById('addGroup').hidden = !config.setupDone;
  document.getElementById('sortNow').hidden = !config.setupDone;

  if (!config.setupDone) {
    main.replaceChildren(el('div', { class: 'setup' },
      el('h2', { text: 'Welcome!' }),
      el('p', { class: 'muted', text: 'Answer three quick questions and your tabs sort themselves into groups.' }),
      el('button', { class: 'primary', text: 'Start setup', onclick: () => openPage('welcome.html') }),
    ));
    return;
  }

  const parts = [];
  if (!config.enabled) {
    parts.push(el('div', { class: 'paused' }, '⏸', el('span', { text: 'Auto-sort is paused. Use the switch at the top to turn it back on.' })));
  }
  const current = renderCurrent();
  if (current) parts.push(current);
  const suggestions = renderSuggestions();
  if (suggestions) parts.push(suggestions);
  parts.push(renderGroups());
  main.replaceChildren(...parts);
}

function groupOptions(selected, { none = 'Not sorted', allowNew = null } = {}) {
  const opts = [el('option', { value: '', text: none })];
  for (const r of config.rules) opts.push(el('option', { value: r.id, text: r.title + (r.catchAll ? ' (all others)' : ''), selected: r.id === selected }));
  if (allowNew) opts.push(el('option', { value: '__new', text: `+ New group "${allowNew}"` }));
  return opts;
}

function renderCurrent() {
  const url = activeTab?.url || activeTab?.pendingUrl;
  const u = parseTabUrl(url);
  if (!u) return null;

  const match = matchUrl(compiled(), url);
  const label = u.isFile ? 'Local file' : siteHost(u.host);
  const sitePattern = patternForUrl(url);
  const name = u.isFile ? 'Files' : siteName(u.host);

  const catchAll = config.rules.find((r) => r.catchAll);
  const select = el('select', { 'aria-label': 'Group for this site' }, groupOptions(match && !match.viaCatchAll ? match.rule.id : '', {
    allowNew: name, none: catchAll ? `No own group (goes to "${catchAll.title}")` : 'Not sorted',
  }));
  let hint = null;
  if (match?.viaCatchAll) hint = 'Pick a group to sort this site somewhere else.';
  else if (match && !isSitePattern(match.pattern, u)) hint = `Matched by "${match.pattern}".`;

  select.addEventListener('change', async () => {
    const value = select.value;
    if (value === '') {
      if (u.isFile) assignPattern('file://*', null); else removeSitePatterns(u.host);
      const still = matchUrl(compiled(), url);
      await save(still && !still.viaCatchAll
        ? `Removed. Note: "${still.pattern}" in "${still.rule.title}" still matches this site.`
        : `${label} is no longer sorted into a group.`);
    } else {
      if (!u.isFile && match && !match.viaCatchAll && isSitePattern(match.pattern, u)) {
        match.rule.patterns = match.rule.patterns.filter((p) => p !== match.pattern);
      }
      if (!u.isFile) removeSitePatterns(u.host);
      let rule = config.rules.find((r) => r.id === value);
      if (value === '__new') { rule = newGroup(name); openId = rule.id; }
      assignPattern(sitePattern, rule);
      await save(`${label} now goes to "${rule.title}".`);
    }
    render();
  });

  return el('section', {},
    el('h2', { text: 'This tab' }),
    el('div', { class: 'current' },
      el('div', { class: 'site' }, favicon({ favIconUrl: activeTab.favIconUrl }), el('span', { text: label, title: url })),
      el('label', {}, 'Group', select),
      hint && el('div', { class: 'hint', text: hint }),
    ));
}

function isSitePattern(pattern, u) {
  return !!pattern && sitePatterns(u.host).has(pattern);
}

function renderSuggestions() {
  const c = compiled();
  const hasCatchAll = !!c.catchAll;
  const list = sites.filter((s) => {
    if (s.pattern === 'file://*') return !matchUrl(c, s.url);
    const m = matchUrl(c, s.url);
    return (!m || m.viaCatchAll) && s.count >= (hasCatchAll ? 2 : 1);
  }).slice(0, 6);
  if (!list.length) return null;

  const rows = list.map((s) => {
    const name = s.pattern === 'file://*' ? 'Files' : siteName(s.host);
    const select = el('select', { 'aria-label': `Group for ${s.label}` }, groupOptions('', { none: 'Add to…', allowNew: name }));
    select.addEventListener('change', async () => {
      if (!select.value) return;
      let rule = config.rules.find((r) => r.id === select.value);
      if (select.value === '__new') rule = newGroup(name);
      assignPattern(s.pattern, rule);
      await save(`${s.label} now goes to "${rule.title}".`);
      render();
    });
    return el('div', { class: 'srow' }, favicon(s), el('span', { class: 'name', text: s.label, title: s.label }),
      el('span', { class: 'badge', text: `${s.count} tab${s.count > 1 ? 's' : ''}` }), select);
  });

  return el('details', { class: 'suggest' },
    el('summary', { text: `${list.length} open site${list.length > 1 ? 's' : ''} without a group of ${list.length > 1 ? 'their' : 'its'} own` }),
    rows);
}

function renderGroups() {
  const section = el('section', {}, el('h2', { text: 'Groups' }));
  if (!config.rules.length) {
    section.append(el('p', { class: 'hint', text: 'No groups yet. Use "+ New group" below, or pick a group for this tab above.' }));
  }
  for (const rule of config.rules) section.append(renderGroup(rule));
  return section;
}

function renderGroup(rule) {
  const open = rule.id === openId;
  const n = rule.patterns.length;
  const box = el('div', { class: 'group' + (open ? ' open' : '') });
  box.append(el('div', {
    class: 'grow', role: 'button', tabindex: '0', 'aria-expanded': String(open),
    onclick: () => { openId = open ? null : rule.id; render(); },
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openId = open ? null : rule.id; render(); } },
  },
  colorDot(rule.color, 12),
  el('span', { class: 'title', text: rule.title }),
  rule.catchAll ? el('span', { class: 'badge', text: 'all others' }) : null,
  el('span', { class: 'count', text: n ? `${n} site${n > 1 ? 's' : ''}` : '' }),
  el('span', { class: 'chev', text: '›' })));

  if (open) box.append(renderEditor(rule));
  return box;
}

function renderEditor(rule) {
  // Name
  const nameInput = el('input', { value: rule.title, 'aria-label': 'Group name', maxlength: '60' });
  const applyName = async () => {
    const next = nameInput.value.trim();
    if (!next || next === rule.title) { nameInput.value = rule.title; return; }
    if (config.rules.some((r) => r !== rule && r.title.toLowerCase() === next.toLowerCase())) {
      nameInput.value = rule.title;
      toast(`There is already a group called "${next}".`, 'error');
      return;
    }
    const from = rule.title;
    rule.title = next;
    await chrome.runtime.sendMessage({ type: 'renameGroup', from, to: next });
    await save(`Renamed to "${next}".`);
    render();
  };
  nameInput.addEventListener('change', applyName);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

  // Colours
  const colors = el('div', { class: 'colors', role: 'radiogroup', 'aria-label': 'Color' }, COLORS.map((c) => el('button', {
    class: 'swatch' + (c === rule.color ? ' sel' : ''), title: COLOR_NAME[c], role: 'radio', 'aria-checked': String(c === rule.color),
    style: `background:${COLOR_HEX[c]}`,
    onclick: async () => { rule.color = c; await save(); render(); },
  })));

  // Sites
  const chips = rule.patterns.length
    ? el('div', { class: 'chips' }, rule.patterns.map((p) => el('span', { class: 'chip' }, p,
        el('button', { title: `Remove ${p}`, 'aria-label': `Remove ${p}`, text: '×', onclick: async () => {
          rule.patterns = rule.patterns.filter((x) => x !== p);
          await save(`Removed ${p}.`);
          render();
        } }))))
    : el('div', { class: 'hint', text: rule.catchAll ? 'Collects every site that has no group of its own.' : 'No sites yet – add one below.' });

  const addInput = el('input', { placeholder: 'Add a site, e.g. youtube.com', 'aria-label': 'Add a site' });
  const add = async () => {
    const raw = addInput.value;
    if (!raw.trim()) return;
    const pattern = normalizePattern(raw);
    if (!pattern) { toast('That does not look like a website. Try something like "youtube.com".', 'error'); return; }
    if (rule.patterns.includes(pattern)) { toast(`${pattern} is already in "${rule.title}".`); return; }
    const owner = config.rules.find((r) => r !== rule && r.patterns.includes(pattern));
    assignPattern(pattern, rule);
    await save(owner ? `Moved ${pattern} from "${owner.title}" to "${rule.title}".` : `Added ${pattern}.`);
    render();
    main.querySelector('.addrow input')?.focus();
  };
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  // Catch-all
  const catchBox = el('input', { type: 'checkbox', checked: rule.catchAll });
  catchBox.addEventListener('change', async () => {
    for (const r of config.rules) r.catchAll = false;
    rule.catchAll = catchBox.checked;
    await save(catchBox.checked ? `Sites without a group now go to "${rule.title}".` : 'Sites without a group now stay ungrouped.');
    render();
  });

  // Delete (two clicks, no pop-up dialogs)
  const del = el('button', { class: 'danger', text: 'Delete group' });
  del.addEventListener('click', async () => {
    if (!del.classList.contains('armed')) {
      del.classList.add('armed');
      del.textContent = 'Click again to delete';
      setTimeout(() => { if (del.isConnected) { del.classList.remove('armed'); del.textContent = 'Delete group'; } }, 3000);
      return;
    }
    config.rules = config.rules.filter((r) => r !== rule);
    openId = null;
    await save(`Deleted "${rule.title}". Its tabs stay where they are.`);
    render();
  });

  return el('div', { class: 'editor' },
    el('label', { class: 'field' }, el('span', { text: 'Name' }), nameInput),
    el('div', { class: 'field' }, el('span', { text: 'Color' }), colors),
    el('div', { class: 'field' }, el('span', { text: 'Sites' }), chips, el('div', { class: 'addrow' }, addInput, el('button', { text: 'Add', onclick: add }))),
    el('label', { class: 'checkline' }, catchBox, el('span', { text: 'Also collect every site that has no group of its own' })),
    el('div', { class: 'bottom' }, el('span'), del),
  );
}

// ---------- Buttons ----------

function openPage(page) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`pages/${page}`) });
  window.close();
}

enabledBox.addEventListener('change', async () => {
  config.enabled = enabledBox.checked;
  await save(config.enabled ? 'Auto-sort is on.' : 'Auto-sort is paused.');
  render();
});

document.getElementById('addGroup').addEventListener('click', async () => {
  const rule = newGroup('New group');
  openId = rule.id;
  await save();
  render();
  const input = main.querySelector('.group.open input');
  input?.focus();
  input?.select();
  main.querySelector('.group.open')?.scrollIntoView({ block: 'nearest' });
});

document.getElementById('sortNow').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'sortNow' });
  toast('All tabs are sorted.');
});

document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

onConfigChanged(async () => {
  if (selfWrite) return;
  config = await loadConfig();
  render();
});

// ---------- Start ----------

(async () => {
  [config, [activeTab], sites] = await Promise.all([
    loadConfig(),
    chrome.tabs.query({ active: true, currentWindow: true }),
    openSites(),
  ]);
  render();
})();
