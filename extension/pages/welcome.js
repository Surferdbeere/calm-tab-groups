import { compileRules, matchUrl, siteName } from '../src/rules.js';
import { PRESETS, CATCH_ALL_TITLE } from '../src/presets.js';
import { loadConfig, saveConfig, newId, parseImport } from '../src/config.js';
import { el, toast, colorDot, openSites, favicon, COLOR_HEX } from './ui.js';

const card = document.getElementById('card');
const stepsBar = document.getElementById('steps');

let step = 1;
let sites = [];
let existing;                         // config before setup (for re-runs)
const chosen = new Set();             // preset keys
const siteChoice = new Map();         // row name -> preset key | 'new:<Name>' | ''
let collectOthers = true;

// ---------- Helpers ----------

function presetRules(keys = chosen) {
  return PRESETS.filter((p) => keys.has(p.key)).map((p) => ({ id: p.key, title: p.title, color: p.color, patterns: [...p.patterns], catchAll: false }));
}

function sitesFor(preset) {
  const c = compileRules([{ id: preset.key, title: preset.title, color: preset.color, patterns: preset.patterns }]);
  return sites.filter((s) => matchUrl(c, s.url));
}

// Open sites that none of the chosen presets cover.
function uncoveredSites() {
  const c = compileRules(presetRules());
  return sites.filter((s) => !matchUrl(c, s.url));
}

function nav(back, nextLabel, onNext, extra = null) {
  return el('div', { class: 'nav' },
    back ? el('button', { class: 'ghost', text: '← Back', onclick: back }) : (extra ?? el('span')),
    back && extra ? extra : null,
    el('button', { class: 'primary', text: nextLabel, onclick: onNext }));
}

function go(n) {
  step = n;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Steps ----------

function render() {
  [...stepsBar.children].forEach((s, i) => s.classList.toggle('on', i < step));
  stepsBar.hidden = step > 3;
  card.replaceChildren(...(step === 1 ? stepGroups() : step === 2 ? stepSites() : step === 3 ? stepOthers() : stepDone()));
}

function stepGroups() {
  const grid = el('div', { class: 'presets' }, PRESETS.map((p) => {
    const found = sitesFor(p).reduce((n, s) => n + s.count, 0);
    const box = el('input', { type: 'checkbox', checked: chosen.has(p.key), 'aria-label': p.title });
    const examples = p.key === 'files'
      ? 'PDFs, images and other files you open in Chrome'
      : p.patterns.slice(0, 3).map((x) => x.replace(/^\*\./, '').replace(/\.\*$/, '')).join(', ') + (p.patterns.length > 3 ? ` +${p.patterns.length - 3} more` : '');
    const label = el('label', { class: 'preset' + (chosen.has(p.key) ? ' on' : '') }, box,
      el('div', {},
        el('div', { class: 't' }, colorDot(p.color, 11), p.title),
        el('div', { class: 'ex', text: examples }),
        found ? el('div', { class: 'found', text: `✓ ${found} open tab${found > 1 ? 's' : ''}` }) : null));
    box.addEventListener('change', () => {
      if (box.checked) chosen.add(p.key); else chosen.delete(p.key);
      label.classList.toggle('on', box.checked);
    });
    return label;
  }));

  const importBtn = el('button', { class: 'linklike', text: 'Import settings from a file instead', onclick: () => document.getElementById('importFile').click() });

  return [
    el('h2', { text: 'Which groups do you want?' }),
    el('p', { class: 'lead', text: 'Pick a few to start with. Groups that match your open tabs are already ticked. You can rename, recolor and change everything later.' }),
    grid,
    nav(null, 'Next →', () => go(2), importBtn),
  ];
}

// Open sites the chosen presets do not cover, combined by name
// (tuwien.ac.at + tuwien.at -> one row "Tuwien").
function uncoveredRows() {
  const rows = new Map();
  for (const s of uncoveredSites()) {
    const name = s.pattern === 'file://*' ? 'Files' : siteName(s.host);
    const row = rows.get(name) ?? { name, patterns: [], labels: [], count: 0, favIconUrl: s.favIconUrl };
    row.patterns.push(s.pattern);
    row.labels.push(s.label);
    row.count += s.count;
    row.favIconUrl ??= s.favIconUrl;
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function stepSites() {
  const list = uncoveredRows();
  // Smart default: a site you have 3+ tabs of probably deserves its own group.
  for (const r of list) {
    if (!siteChoice.has(r.name)) siteChoice.set(r.name, r.count >= 3 ? `new:${r.name}` : '');
  }

  let body;
  if (!list.length) {
    body = el('div', { class: 'empty', text: 'All your open tabs are already covered by the groups you picked. 🎉' });
  } else {
    body = el('div', { class: 'sites' }, list.slice(0, 40).map((r) => {
      const select = el('select', { 'aria-label': `Group for ${r.name}` }, siteOptions(r));
      select.addEventListener('change', () => { siteChoice.set(r.name, select.value); render(); });
      const label = r.labels.join(', ');
      return el('div', { class: 'site' }, favicon(r), el('span', { class: 'name', text: label, title: label }),
        el('span', { class: 'badge', text: `${r.count} tab${r.count > 1 ? 's' : ''}` }), select);
    }));
  }

  return [
    el('h2', { text: 'Sort the rest of your open tabs' }),
    el('p', { class: 'lead', text: list.length
      ? 'These sites are open right now but not in any group yet. Choose where each should go – or leave it.'
      : 'Nothing to do here.' }),
    body,
    nav(() => go(1), 'Next →', () => go(3)),
  ];
}

function siteOptions(row) {
  const current = siteChoice.get(row.name) ?? '';
  const opts = [el('option', { value: '', text: "Don't group", selected: current === '' })];
  for (const p of PRESETS.filter((x) => chosen.has(x.key))) {
    opts.push(el('option', { value: p.key, text: p.title, selected: current === p.key }));
  }
  // New groups created for other sites in this step can be reused.
  const newNames = new Set([...siteChoice.values()].filter((v) => v.startsWith('new:')).map((v) => v.slice(4)));
  newNames.add(row.name);
  for (const n of newNames) opts.push(el('option', { value: `new:${n}`, text: `New group "${n}"`, selected: current === `new:${n}` }));
  return opts;
}

function stepOthers() {
  const option = (value, title, text) => {
    const radio = el('input', { type: 'radio', name: 'others', checked: collectOthers === value });
    const label = el('label', { class: 'choice' + (collectOthers === value ? ' on' : '') }, radio, el('div', {}, el('b', { text: title }), el('span', { class: 'muted', text })));
    radio.addEventListener('change', () => { collectOthers = value; render(); });
    return label;
  };
  return [
    el('h2', { text: 'And all other websites?' }),
    el('p', { class: 'lead', text: 'What should happen with sites that are in none of your groups?' }),
    option(true, `Put them in a grey "${CATCH_ALL_TITLE}" group`, 'Every tab ends up in a group. Recommended.'),
    option(false, 'Leave them ungrouped', 'Only sites you added to a group get sorted.'),
    nav(() => go(2), 'Finish setup ✓', finish),
  ];
}

function stepDone() {
  const rules = existing.rules;
  return [el('div', { class: 'done' },
    el('div', { class: 'big', text: '✅' }),
    el('h2', { text: 'All set – your tabs are sorted!' }),
    el('p', { class: 'muted', text: 'New tabs are sorted automatically. When Chrome starts, sorting waits until all tabs are restored, so your browser stays responsive.' }),
    el('div', { class: 'summary' }, rules.map((r) => el('span', {}, colorDot(r.color, 10), r.title))),
    el('div', { class: 'tip' }, el('span', { text: '📌', style: 'font-size:22px' }), el('div', {},
      el('b', { text: 'Tip: pin the extension' }),
      el('div', { class: 'muted small', text: 'Click the puzzle icon in Chrome’s toolbar and pin “Calm Tab Groups”. Click its icon any time to move a site to another group, add groups or pause sorting.' }))),
    el('div', { class: 'nav', style: 'justify-content:center' }, el('button', { class: 'primary', text: 'Close this tab', onclick: () => window.close() })),
  )];
}

// ---------- Finish ----------

async function finish() {
  const rules = presetRules().map((r) => ({ ...r, id: newId() }));
  const byKey = new Map(presetRules().map((r, i) => [r.id, rules[i]]));
  const newGroups = new Map();
  const colors = Object.keys(COLOR_HEX).filter((c) => c !== 'grey');

  for (const row of uncoveredRows()) {
    const choice = siteChoice.get(row.name) ?? '';
    if (!choice) continue;
    let rule = byKey.get(choice);
    if (choice.startsWith('new:')) {
      const name = choice.slice(4);
      rule = newGroups.get(name) ?? rules.find((r) => r.title.toLowerCase() === name.toLowerCase());
      if (!rule) {
        const used = new Set(rules.map((r) => r.color));
        rule = { id: newId(), title: name, color: colors.find((c) => !used.has(c)) ?? colors[rules.length % colors.length], patterns: [], catchAll: false };
        rules.push(rule);
        newGroups.set(name, rule);
      }
    }
    for (const p of row.patterns) if (rule && !rule.patterns.includes(p)) rule.patterns.push(p);
  }

  if (collectOthers) rules.push({ id: newId(), title: CATCH_ALL_TITLE, color: 'grey', patterns: [], catchAll: true });

  existing = await saveConfig({ ...existing, setupDone: true, enabled: true, rules });
  await chrome.runtime.sendMessage({ type: 'sortNow' });
  go(4);
}

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const rules = parseImport(await file.text());
    existing = await saveConfig({ ...existing, setupDone: true, enabled: true, rules });
    await chrome.runtime.sendMessage({ type: 'sortNow' });
    toast(`Imported ${rules.length} groups.`);
    go(4);
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Start ----------

(async () => {
  [existing, sites] = await Promise.all([loadConfig(), openSites()]);
  for (const p of PRESETS) if (sitesFor(p).length) chosen.add(p.key);
  if (!chosen.size) ['video', 'social', 'shopping'].forEach((k) => chosen.add(k));
  if (existing.setupDone) {
    toast('Running setup again replaces your current groups when you click "Finish".');
  }
  render();
})();
