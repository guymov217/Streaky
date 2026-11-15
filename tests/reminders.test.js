import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localNow, dueReminders, buildMessage, sanitizeRecord } from '../src/reminders.js';

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

test('late reminder comes from the angry dog', () => {
  const m = buildMessage(status({ done: 1 }), '2026-11-15', '21:00');
  assert.match(m.title, /עצבני/);
  assert.match(m.body, /2 מטלות/);
  assert.match(m.body, /4 ימים/);
});

test('evening reminder warns that the streak is at risk', () => {
  const m = buildMessage(status({ done: 1 }), '2026-11-15', '18:00');
  assert.match(m.title, /בסכנה/);
  assert.match(m.body, /2 מטלות/);
  assert.match(m.body, /4 ימים/);
});

test('status from yesterday counts as nothing done today', () => {
  const m = buildMessage(status({ date: '2026-11-14', done: 3 }), '2026-11-15', '09:00');
  assert.match(m.body, /3 מטלות מחכות/);
});

test('a broken streak is not mentioned as at risk', () => {
  const m = buildMessage(status({ lastDone: '2026-11-10' }), '2026-11-15', '18:00');
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

// ---------- dark humour ----------
import { DARK_MESSAGES } from '../src/reminders.js';

const seq = (i, n) => () => (i + 0.5) / n; // deterministic "random" that walks every option

function allDark(st, time, extra = {}) {
  const n = DARK_MESSAGES.length;
  return Array.from({ length: n }, (_, i) => buildMessage(st, '2026-11-15', time, { style: 'dark', random: seq(i, n), ...extra }));
}

test('dark messages fill every placeholder', () => {
  const st = status({ done: 1, tasks: [{ title: 'ריצה', done: false }, { title: 'מים', done: true }, { title: 'קריאה', done: false }] });
  for (const time of ['08:00', '14:00', '21:00']) {
    for (const m of allDark(st, time)) {
      assert.doesNotMatch(m.title + m.body, /[{}]/);
      assert.match(m.title + m.body, /2 מטלות|ריצה|קריאה|4/);
    }
  }
});

test('task-specific jokes only use unfinished tasks', () => {
  const st = status({ done: 1, tasks: [{ title: 'ריצה', done: false }, { title: 'מים', done: true }] });
  const texts = allDark(st, '14:00').map((m) => m.title + m.body).join('\n');
  assert.match(texts, /ריצה/);
  assert.doesNotMatch(texts, /מים"/);
});

test('without task titles, no task-specific joke is chosen', () => {
  for (const m of allDark(status({ done: 0 }), '14:00')) assert.doesNotMatch(m.title, /"/);
});

test('streak jokes appear only while a streak is alive', () => {
  const texts = allDark(status({ lastDone: '2026-11-01' }), '14:00').map((m) => m.title).join('\n');
  assert.doesNotMatch(texts, /רצף/);
});

test('morning and late jokes stay in their time slots', () => {
  const morning = DARK_MESSAGES.filter((m) => m.when === 'morning').map((m) => m.title);
  const late = DARK_MESSAGES.filter((m) => m.when === 'late').map((m) => m.title);
  const at = (t) => allDark(status({ done: 1 }), t).map((m) => m.key);
  assert.ok(at('21:00').every((k) => !morning.includes(k)));
  assert.ok(at('08:00').every((k) => !late.includes(k)));
  assert.ok(at('21:00').some((k) => late.includes(k)));
});

test('the previous joke is not repeated', () => {
  const st = status({ done: 1 });
  const first = buildMessage(st, '2026-11-15', '14:00', { style: 'dark', random: () => 0 });
  const next = buildMessage(st, '2026-11-15', '14:00', { style: 'dark', random: () => 0, avoid: first.key });
  assert.notEqual(next.key, first.key);
});

test('no dark message when the day is done', () => {
  assert.equal(buildMessage(status({ done: 3, lastDone: '2026-11-15' }), '2026-11-15', '21:00', { style: 'dark' }), null);
});

test('sanitizeRecord keeps style and trims task titles', () => {
  const r = sanitizeRecord({ ...valid, style: 'dark', status: { ...valid.status, tasks: [{ title: ` ${'x'.repeat(80)} `, done: 1 }, { title: '' }, 'bad'] } });
  assert.equal(r.style, 'dark');
  assert.deepEqual(r.status.tasks, [{ title: 'x'.repeat(60), done: false, days: null }]);
  assert.equal(sanitizeRecord({ ...valid, style: 'evil' }).style, 'normal');
});

// ---------- tasks on specific weekdays (2026-11-15 is a Sunday) ----------
const weekly = (o = {}) => ({
  date: '2026-11-15', streak: 2, lastDone: '2026-11-13', done: 0, total: 0,
  tasks: [{ title: 'NBME', done: false, days: [1] }, { title: 'Anki', done: false, days: null }],
  ...o,
});

test('only tasks scheduled on that weekday count', () => {
  const m = buildMessage(weekly(), '2026-11-15', '18:00'); // Sunday: only Anki
  assert.match(m.body, /מטלה אחת/);
  const monday = buildMessage(weekly(), '2026-11-16', '09:00'); // Monday: Anki + NBME
  assert.match(monday.body, /2 מטלות/);
});

test('no reminder on a day with nothing scheduled', () => {
  const st = weekly({ tasks: [{ title: 'NBME', done: false, days: [1] }] });
  assert.equal(buildMessage(st, '2026-11-15', '20:00'), null);
});

test('a streak survives rest days in reminder texts', () => {
  const st = weekly({ tasks: [{ title: 'UWorld', done: false, days: [0, 1, 2, 3, 4] }], lastDone: '2026-11-12', streak: 5 });
  const m = buildMessage(st, '2026-11-15', '20:00');
  assert.match(m.body, /5 ימים/);
});

test('sanitizeRecord cleans weekday lists', () => {
  const tasks = [{ title: 'a', days: [3, 1, 1, 9, 'x'] }, { title: 'b', days: [0, 1, 2, 3, 4, 5, 6] }, { title: 'c' }];
  const r = sanitizeRecord({ ...valid, status: { ...valid.status, tasks } });
  assert.deepEqual(r.status.tasks.map((t) => t.days), [[1, 3], null, null]);
});
