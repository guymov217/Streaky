import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, activeStreak, completeDay, weekDays } from '../src/streak.js';

const base = { streak: 0, best: 0, lastDone: null, history: [] };

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('first perfect day starts a streak of 1', () => {
  const s = completeDay(base, '2026-11-15');
  assert.equal(s.streak, 1);
  assert.equal(s.best, 1);
  assert.deepEqual(s.history, ['2026-11-15']);
});

test('completing the same day twice does not double count', () => {
  const s = completeDay(completeDay(base, '2026-11-15'), '2026-11-15');
  assert.equal(s.streak, 1);
});

test('consecutive days grow the streak', () => {
  let s = completeDay(base, '2026-11-14');
  s = completeDay(s, '2026-11-15');
  assert.equal(s.streak, 2);
  assert.equal(s.best, 2);
});

test('missing a day resets the streak but keeps the best', () => {
  let s = completeDay(base, '2026-11-12');
  s = completeDay(s, '2026-11-13');
  s = completeDay(s, '2026-11-15');
  assert.equal(s.streak, 1);
  assert.equal(s.best, 2);
});

test('active streak survives until the end of the next day', () => {
  const s = completeDay(base, '2026-11-14');
  assert.equal(activeStreak(s, '2026-11-14'), 1);
  assert.equal(activeStreak(s, '2026-11-15'), 1);
  assert.equal(activeStreak(s, '2026-11-16'), 0);
});

test('weekDays starts on Sunday and marks done days', () => {
  const days = weekDays(['2026-11-15'], '2026-11-17'); // Tuesday
  assert.equal(days[0].key, '2026-11-15');
  assert.equal(days[0].done, true);
  assert.equal(days[2].isToday, true);
  assert.equal(days[6].future, true);
});
