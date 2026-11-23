import { loadConfig, saveConfig, exportJson, parseImport, onConfigChanged, defaultConfig } from '../src/config.js';
import { el, toast, colorDot } from './ui.js';

let config;
let selfWrite = false;

const $ = (id) => document.getElementById(id);

async function save(message) {
  selfWrite = true;
  config = await saveConfig(config);
  if (message) toast(message);
  setTimeout(() => { selfWrite = false; }, 300);
  render();
}

function render() {
  $('enabled').checked = config.enabled;

  const current = config.rules.find((r) => r.catchAll);
  $('catchAll').replaceChildren(
    el('option', { value: '', text: 'Leave them ungrouped', selected: !current }),
    ...config.rules.map((r) => el('option', { value: r.id, text: `Put them in "${r.title}"`, selected: r === current })),
  );

  $('groups').replaceChildren(...(config.rules.length
    ? config.rules.map((r) => el('span', {}, colorDot(r.color, 10), r.title))
    : [el('span', { class: 'muted', text: 'No groups yet' })]));
}

$('enabled').addEventListener('change', () => {
  config.enabled = $('enabled').checked;
  save(config.enabled ? 'Auto-sort is on.' : 'Auto-sort is paused.');
});

$('catchAll').addEventListener('change', () => {
  for (const r of config.rules) r.catchAll = r.id === $('catchAll').value;
  save('Saved.');
});

$('export').addEventListener('click', () => {
  const blob = new Blob([exportJson(config)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'calm-tab-groups.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('import').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const rules = parseImport(await file.text());
    config = { ...config, rules, setupDone: true };
    await save(`Imported ${rules.length} groups.`);
    await chrome.runtime.sendMessage({ type: 'sortNow' });
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('setup').addEventListener('click', () => {
  location.href = chrome.runtime.getURL('pages/welcome.html');
});

$('reset').addEventListener('click', async () => {
  const btn = $('reset');
  if (!btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.textContent = 'Click again to delete everything';
    setTimeout(() => { btn.classList.remove('armed'); btn.textContent = 'Delete all groups'; }, 3000);
    return;
  }
  btn.classList.remove('armed');
  btn.textContent = 'Delete all groups';
  config = { ...defaultConfig() };
  await save('All groups deleted. Open the pop-up to set things up again.');
});

onConfigChanged(async () => {
  if (selfWrite) return;
  config = await loadConfig();
  render();
});

$('version').textContent = 'Version ' + chrome.runtime.getManifest().version;

(async () => {
  config = await loadConfig();
  render();
})();
