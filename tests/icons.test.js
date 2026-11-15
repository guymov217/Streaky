import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASK_ICONS, DEFAULT_ICON, iconHTML, suggestIcon } from '../src/icons.js';

test('the picker offers the five study resources plus a general icon', () => {
  assert.deepEqual(TASK_ICONS.map((i) => i.id), ['uworld', 'sketchy', 'anki', 'firstaid', 'nbme', 'other']);
  assert.ok(TASK_ICONS.some((i) => i.id === DEFAULT_ICON));
});

test('titles pick the matching resource icon', () => {
  const cases = {
    '40 שאלות UWorld': 'uworld',
    'uworld block': 'uworld',
    '2 סרטונים ב-Sketchy': 'sketchy',
    '200 כרטיסיות': 'anki',
    'Anki reviews': 'anki',
    'לקרוא 20 עמודים First Aid': 'firstaid',
    'FA cardio': 'firstaid',
    'NBME 30': 'nbme',
    'מבחן תרגול': 'nbme',
    'ללכת לחדר כושר': DEFAULT_ICON,
  };
  for (const [title, id] of Object.entries(cases)) assert.equal(suggestIcon(title), id, title);
});

test('an exam made of questions is NBME, not UWorld', () => {
  assert.equal(suggestIcon('מבחן NBME של 200 שאלות'), 'nbme');
});

test('known ids render markup, unknown ids (old emoji tasks) do not', () => {
  assert.match(iconHTML('uworld'), /<img src="icons\/uworld\.png"/);
  assert.match(iconHTML('other'), /<svg/);
  assert.equal(iconHTML('💧'), null);
  assert.equal(iconHTML(undefined), null);
});
