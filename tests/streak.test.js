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

// ---------- weekdays and rest days (2026-11-15 is a Sunday) ----------
import { weekday, scheduledOn, restDayChecker } from '../src/streak.js';

const SUN_TO_THU = [0, 1, 2, 3, 4];
const isRest = restDayChecker([{ days: SUN_TO_THU }]);

test('weekday and scheduledOn follow the calendar', () => {
  assert.equal(weekday('2026-11-15'), 0);
  assert.equal(weekday('2026-11-14'), 6);
  assert.equal(scheduledOn(null, '2026-11-14'), true);
  assert.equal(scheduledOn(SUN_TO_THU, '2026-11-14'), false);
  assert.equal(scheduledOn(SUN_TO_THU, '2026-11-15'), true);
});

test('a weekend with nothing scheduled does not break the streak', () => {
  const s = { ...base, streak: 3, best: 3, lastDone: '2026-11-12' }; // Thursday
  assert.equal(activeStreak(s, '2026-11-15', isRest), 3);
  assert.equal(completeDay(s, '2026-11-15', isRest).streak, 4);
});

test('missing a scheduled day still breaks the streak', () => {
  const s = { ...base, streak: 3, best: 3, lastDone: '2026-11-11' }; // Wednesday; Thursday was missed
  assert.equal(activeStreak(s, '2026-11-15', isRest), 0);
  assert.equal(completeDay(s, '2026-11-15', isRest).streak, 1);
});

test('with no tasks at all, days are not rest days', () => {
  assert.equal(restDayChecker([])('2026-11-14'), false);
});

test('weekDays marks rest days', () => {
  const days = weekDays([], '2026-11-15', isRest);
  assert.deepEqual(days.map((d) => d.rest), [false, false, false, false, false, true, true]);
});
