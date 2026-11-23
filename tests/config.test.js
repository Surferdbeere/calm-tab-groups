import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeRules, parseImport, exportJson } from '../extension/src/config.js';

test('imports the Auto Group Tabs format', () => {
  const autoGroupTabs = [
    { id: '1', title: 'TU', color: 'blue', matchers: ['*.tuwien.at'], options: { strict: false } },
    { id: '2', title: 'Other', color: 'grey', matchers: [], options: {} },
  ];
  const rules = parseImport(JSON.stringify(autoGroupTabs));
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].patterns, ['*.tuwien.at']);
  assert.equal(rules[1].catchAll, true);
});

test('round-trips its own export', () => {
  const cfg = normalizeConfig({ enabled: true, setupDone: true, rules: [
    { title: 'A', color: 'red', patterns: ['a.com'], catchAll: false },
    { title: 'B', color: 'nope', patterns: ['b.com', 'b.com', ''], catchAll: true },
  ] });
  assert.equal(cfg.rules[1].color, 'grey');
  assert.deepEqual(cfg.rules[1].patterns, ['b.com']);
  const again = parseImport(exportJson(cfg));
  assert.equal(again[1].catchAll, true);
  assert.equal(again[0].catchAll, false);
});

test('keeps only one catch-all and unique titles', () => {
  const rules = normalizeRules([
    { title: 'X', catchAll: true }, { title: 'X', catchAll: true }, { title: 'Y', fallback: false },
  ]);
  assert.deepEqual(rules.map((r) => r.title), ['X', 'X 2', 'Y']);
  assert.deepEqual(rules.map((r) => r.catchAll), [true, false, false]);
});

test('explicit "no catch-all" is respected', () => {
  const rules = normalizeRules([{ title: 'A', patterns: [], catchAll: false }]);
  assert.equal(rules[0].catchAll, false);
});

test('rejects broken files with a readable message', () => {
  assert.throws(() => parseImport('{oops'), /not valid JSON/);
  assert.throws(() => parseImport('{"foo": 1}'), /No groups/);
});
