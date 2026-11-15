// Pure reminder logic: which reminders are due and what they should say.
import { addDays } from '../../src/streak.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[a-z0-9]{16,64}$/;
const SEND_WINDOW_MIN = 60; // a reminder may be delivered up to an hour late, never later
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^web\.push\.apple\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

// Local calendar date and minutes-since-midnight in the user's time zone.
export function localNow(now, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

// Reminder times that have just passed and were not sent yet today.
export function dueReminders(record, now) {
  const { date, minutes } = localNow(now, record.tz);
  return record.reminders
    .filter((t) => minutes >= toMinutes(t) && minutes - toMinutes(t) < SEND_WINDOW_MIN)
    .filter((t) => record.lastSent?.[t] !== date)
    .map((time) => ({ time, date }));
}

// Progress for `date`: a status synced on an earlier day means nothing is done yet today.
export function todayProgress(status, date) {
  const total = status.total;
  const done = status.date === date ? Math.min(status.done, total) : 0;
  const perfect = status.lastDone === date;
  const streakAlive = status.lastDone === date || status.lastDone === addDays(date, -1);
  return { total, done, perfect, streak: streakAlive ? status.streak : 0 };
}

// Returns a {title, body} notification, or null when there is nothing to remind about.
export function buildMessage(status, date, time) {
  const p = todayProgress(status, date);
  if (p.total === 0 || p.perfect || p.done >= p.total) return null;
  const left = p.total - p.done;
  const leftText = left === 1 ? 'מטלה אחת' : `${left} מטלות`;
  const evening = toMinutes(time) >= 17 * 60;
  const late = toMinutes(time) >= 20 * 60;

  if (late) {
    const risk = p.streak > 0 ? ` הרצף של ${p.streak} ימים בסכנה!` : '';
    return { title: '😤 רררר... הצ׳יוואוה עצבני!', body: `היום עומד להיגמר ועוד ${leftText} לא בוצעו.${risk}` };
  }
  if (p.streak > 0 && evening) {
    return { title: '🔥 הרצף שלך בסכנה!', body: `נשארו לך ${leftText} כדי לשמור על רצף של ${p.streak} ימים. אתה יכול!` };
  }
  if (p.done === 0) {
    return p.streak > 0
      ? { title: '☀️ יום חדש, רצף ממשיך', body: `${p.total} מטלות מחכות לך. בוא נגיע ל-${p.streak + 1} ימים ברצף!` }
      : { title: '☀️ יום חדש, התחלה חדשה', body: `${p.total} מטלות מחכות לך. בוא נדליק רצף חדש 🔥` };
  }
  return { title: '💪 כמעט שם!', body: `השלמת ${p.done} מתוך ${p.total}. נשארו ${leftText} ליום מושלם` };
}

function isValidTz(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

// Validate and normalise a record sent by the app. Returns null if invalid.
export function sanitizeRecord(body) {
  if (!body || typeof body !== 'object' || !ID_RE.test(body.id ?? '')) return null;
  const sub = body.subscription;
  let endpoint;
  try { endpoint = new URL(sub?.endpoint); } catch { return null; }
  if (endpoint.protocol !== 'https:' || !PUSH_HOSTS.some((re) => re.test(endpoint.hostname))) return null;
  if (typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') return null;
  if (sub.keys.p256dh.length > 200 || sub.keys.auth.length > 100) return null;
  if (typeof body.tz !== 'string' || !isValidTz(body.tz)) return null;
  if (!Array.isArray(body.reminders) || body.reminders.length > 6 || !body.reminders.every((t) => TIME_RE.test(t))) return null;
  const s = body.status ?? {};
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const int = (n) => (Number.isInteger(n) && n >= 0 && n < 100000 ? n : 0);
  return {
    id: body.id,
    subscription: { endpoint: endpoint.href, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    tz: body.tz,
    reminders: [...new Set(body.reminders)].sort(),
    status: {
      date: dateRe.test(s.date ?? '') ? s.date : null,
      done: int(s.done),
      total: int(s.total),
      streak: int(s.streak),
      lastDone: dateRe.test(s.lastDone ?? '') ? s.lastDone : null,
    },
  };
}
