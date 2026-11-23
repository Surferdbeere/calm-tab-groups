import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileRules, matchUrl, normalizePattern, patternForUrl, siteName } from '../extension/src/rules.js';
import { PRESETS } from '../extension/src/presets.js';

const rules = [
  { id: 'g', title: 'Google', color: 'orange', patterns: ['*.google.com'] },
  { id: 'm', title: 'Mail', color: 'blue', patterns: ['mail.google.com'] },
  { id: 's', title: 'Shop', color: 'green', patterns: ['*.amazon.*'] },
  { id: 'x', title: 'X', color: 'yellow', patterns: ['x.com'] },
  { id: 'gh', title: 'Work', color: 'purple', patterns: ['github.com/my-org'] },
  { id: 'd', title: 'Dev', color: 'cyan', patterns: ['*.github.com', 'localhost'] },
  { id: 'f', title: 'Files', color: 'grey', patterns: ['file://*'] },
  { id: 'p', title: 'PDFs', color: 'red', patterns: ['file://*.pdf'] },
  { id: 'o', title: 'Other', color: 'grey', patterns: [], catchAll: true },
];
const c = compileRules(rules);
const t = (url) => matchUrl(c, url)?.rule.title ?? null;

test('most specific pattern wins regardless of order', () => {
  assert.equal(t('https://mail.google.com/mail/u/0'), 'Mail');
  assert.equal(t('https://www.google.com/search?q=x'), 'Google');
  assert.equal(t('https://github.com/my-org/repo'), 'Work');
  assert.equal(t('https://github.com/someone-else'), 'Dev');
  assert.equal(t('file:///home/me/a.pdf'), 'PDFs');
  assert.equal(t('file:///home/me/a.png'), 'Files');
});

test('wildcards and exact hosts', () => {
  assert.equal(t('https://www.amazon.de/dp/1'), 'Shop');
  assert.equal(t('https://amazon.co.uk/'), 'Shop');
  assert.equal(t('https://x.com/home'), 'X');
  assert.equal(t('https://www.x.com/home'), 'X');
  assert.equal(t('https://notx.com/'), 'Other');
  assert.equal(t('https://evilgoogle.com/'), 'Other');
  assert.equal(t('http://localhost:3000/'), 'Dev');
});

test('catch-all only for websites; browser pages untouched', () => {
  assert.equal(t('https://example.org/'), 'Other');
  assert.equal(matchUrl(c, 'https://example.org/').viaCatchAll, true);
  assert.equal(t('chrome://newtab/'), null);
  assert.equal(t('chrome-extension://abc/popup.html'), null);
  assert.equal(t(''), null);
  assert.equal(t('not a url'), null);
});

test('file paths with spaces and umlauts', () => {
  const c2 = compileRules([{ id: 'u', title: 'Uni', color: 'blue', patterns: ['file:///home/thomas/uni/*'] }]);
  assert.equal(matchUrl(c2, 'file:///home/thomas/Uni/%C3%9Cbung%201.pdf')?.rule.title, 'Uni');
});

test('normalizePattern turns user input into patterns', () => {
  assert.equal(normalizePattern('youtube.com'), '*.youtube.com');
  assert.equal(normalizePattern('www.YouTube.com'), '*.youtube.com');
  assert.equal(normalizePattern('https://www.youtube.com/watch?v=1'), '*.youtube.com');
  assert.equal(normalizePattern('  github.com/my-org/ '), 'github.com/my-org');
  assert.equal(normalizePattern('*.amazon.*'), '*.amazon.*');
  assert.equal(normalizePattern('file://*.pdf'), 'file://*.pdf');
  assert.equal(normalizePattern('localhost'), 'localhost');
  assert.equal(normalizePattern('bücher.de'), '*.xn--bcher-kva.de');
  assert.equal(normalizePattern('two words'), null);
  assert.equal(normalizePattern(''), null);
});

test('helpers', () => {
  assert.equal(patternForUrl('https://www.tiss.tuwien.ac.at/x'), '*.tuwien.ac.at');
  assert.equal(patternForUrl('https://music.youtube.com/'), '*.youtube.com');
  assert.equal(patternForUrl('https://mail.google.com/mail'), '*.mail.google.com');
  assert.equal(patternForUrl('https://my-blog.github.io/'), '*.my-blog.github.io');
  assert.equal(siteName('mail.google.com'), 'Mail');
  assert.equal(patternForUrl('file:///a.pdf'), 'file://*');
  assert.equal(patternForUrl('http://localhost:8080'), 'localhost');
  assert.equal(siteName('www.tuwien.ac.at'), 'Tuwien');
  assert.equal(siteName('github.com'), 'Github');
  assert.equal(siteName('news.bbc.co.uk'), 'Bbc');
});

test('presets are valid and do not overlap at equal specificity', () => {
  const all = compileRules(PRESETS.map((p) => ({ id: p.key, title: p.title, color: p.color, patterns: p.patterns })));
  for (const p of PRESETS) assert.equal(all.rules.find((r) => r.id === p.key).tests.length, p.patterns.length, p.key);
  assert.equal(matchUrl(all, 'https://mail.google.com/')?.rule.title, 'Mail');
  assert.equal(matchUrl(all, 'https://docs.google.com/document/d/1')?.rule.title, 'Docs');
  assert.equal(matchUrl(all, 'https://www.youtube.com/watch')?.rule.title, 'Video');
});
