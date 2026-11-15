import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localNow, dueReminders, buildMessage, sanitizeRecord } from '../netlify/lib/reminders.js';

const TZ = 'Asia/Jerusalem';
// 2026-11-15 20:10 in Israel (UTC+2 in November)
const at = (hhmm, day = '15') => new Date(`2026-11-${day}T${hhmm}:00+02:00`);

test('localNow converts to the user time zone', () => {
  assert.deepEqual(localNow(new Date('2026-11-15T22:30:00Z'), TZ), { date: '2026-11-16', minutes: 30 });
});

test('a reminder is due once its time passes, within the hour', () => {
  const r = { tz: TZ, reminders: ['09:00', '20:00'], lastSent: {} };
  assert.deepEqual(dueReminders(r, at('20:10')), [{ time: '20:00', date: '2026-11-15' }]);
  assert.deepEqual(dueReminders(r, at('19:59')), []);
  assert.deepEqual(dueReminders(r, at('21:05')), []);
});

test('a reminder is not sent twice on the same day', () => {
  const r = { tz: TZ, reminders: ['20:00'], lastSent: { '20:00': '2026-11-15' } };
  assert.deepEqual(dueReminders(r, at('20:15')), []);
  assert.equal(dueReminders(r, at('20:15', '16')).length, 1);
});

const status = (o) => ({ date: '2026-11-15', done: 0, total: 3, streak: 4, lastDone: '2026-11-14', ...o });

test('no message when the day is already perfect or there are no tasks', () => {
  assert.equal(buildMessage(status({ done: 3, lastDone: '2026-11-15', streak: 5 }), '2026-11-15', '20:00'), null);
  assert.equal(buildMessage(status({ total: 0 }), '2026-11-15', '20:00'), null);
});

test('evening reminder warns that the streak is at risk', () => {
  const m = buildMessage(status({ done: 1 }), '2026-11-15', '20:00');
  assert.match(m.title, /בסכנה/);
  assert.match(m.body, /2 מטלות/);
  assert.match(m.body, /4 ימים/);
});

test('status from yesterday counts as nothing done today', () => {
  const m = buildMessage(status({ date: '2026-11-14', done: 3 }), '2026-11-15', '09:00');
  assert.match(m.body, /3 מטלות מחכות/);
});

test('a broken streak is not mentioned as at risk', () => {
  const m = buildMessage(status({ lastDone: '2026-11-10' }), '2026-11-15', '20:00');
  assert.doesNotMatch(m.title, /בסכנה/);
});

const valid = {
  id: 'abcdef0123456789abcd',
  subscription: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'x', auth: 'y' } },
  tz: TZ,
  reminders: ['20:00', '09:00'],
  status: { date: '2026-11-15', done: 1, total: 3, streak: 2, lastDone: '2026-11-14' },
};

test('sanitizeRecord accepts a valid record and sorts times', () => {
  assert.deepEqual(sanitizeRecord(valid).reminders, ['09:00', '20:00']);
});

test('sanitizeRecord rejects non push-service endpoints and bad input', () => {
  assert.equal(sanitizeRecord({ ...valid, subscription: { ...valid.subscription, endpoint: 'https://evil.example/x' } }), null);
  assert.equal(sanitizeRecord({ ...valid, subscription: { ...valid.subscription, endpoint: 'http://web.push.apple.com/x' } }), null);
  assert.equal(sanitizeRecord({ ...valid, tz: 'Not/AZone' }), null);
  assert.equal(sanitizeRecord({ ...valid, reminders: ['25:00'] }), null);
  assert.equal(sanitizeRecord({ ...valid, id: 'short' }), null);
});
