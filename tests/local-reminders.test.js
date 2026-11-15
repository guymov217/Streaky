import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLocalReminders, PLAN_DAYS } from '../src/local-reminders.js';

const now = new Date(2026, 10, 15, 10, 0); // 15 Nov 2026, 10:00 local
const status = (o = {}) => ({ date: '2026-11-15', done: 1, total: 3, streak: 2, lastDone: '2026-11-14', tasks: [], ...o });
const plan = (st, opts = {}) => planLocalReminders(st, { times: ['20:00', '09:00'], now, ...opts });

test('schedules only future reminders, starting with tonight', () => {
  const p = plan(status());
  assert.equal(p.length, PLAN_DAYS * 2 - 1); // this morning's 09:00 already passed
  assert.deepEqual([p[0].at.getDate(), p[0].at.getHours()], [15, 20]);
  assert.deepEqual([p[1].at.getDate(), p[1].at.getHours()], [16, 9]);
  assert.ok(p.every((n, i) => i === 0 || n.at > p[i - 1].at));
});

test('a finished day gets no more reminders, the next days still do', () => {
  const p = plan(status({ done: 3, lastDone: '2026-11-15', streak: 3 }));
  assert.ok(p.every((n) => n.at.getDate() !== 15));
  assert.equal(p[0].at.getDate(), 16);
});

test('nothing is scheduled without tasks', () => {
  assert.deepEqual(plan(status({ total: 0, done: 0 })), []);
});

test('ids are unique and stable per day and time', () => {
  const ids = plan(status()).map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => Number.isInteger(id) && id > 0 && id < 2 ** 31));
});

test('dark style fills messages and does not repeat back to back', () => {
  const p = plan(status({ tasks: [{ title: 'ריצה', done: false }] }), { style: 'dark' });
  assert.ok(p.every((n) => !/[{}]/.test(n.title + n.body)));
  assert.ok(p.every((n, i) => i === 0 || n.title !== p[i - 1].title));
});

test('tomorrow can still mention a live streak, later days cannot', () => {
  const p = plan(status({ done: 3, lastDone: '2026-11-15', streak: 3 }), { style: 'normal' });
  const tomorrowEvening = p.find((n) => n.at.getDate() === 16 && n.at.getHours() === 20);
  const laterEvening = p.find((n) => n.at.getDate() === 18 && n.at.getHours() === 20);
  assert.match(tomorrowEvening.body, /3 ימים/);
  assert.doesNotMatch(laterEvening.body, /ימים/);
});
