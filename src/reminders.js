// Pure reminder logic: which reminders are due and what they should say.
import { addDays } from './streak.js';

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

// Dark-humour reminders in the chihuahua's voice. Placeholders: {left} ("3 מטלות" / "מטלה אחת"),
// {streak}, {task} (an unfinished task's title). `when`: any | morning (< 12:00) | late (>= 20:00).
export const DARK_MESSAGES = [
  { title: '🩺 לא תלמד/י, מטופלים ימותו', body: 'נשארו עוד {left}. אין לחץ, זה רק חיי אדם.' },
  { title: '⚰️ הקברן כבר לקח לך מידות', body: 'עוד {left} ועדיין לא התחלת. הוא אמר שאין מה למהר.' },
  { title: '🐶 ד״ר בליני כתב צוואה', body: 'הכל עובר לחתול של השכנים. אלא אם תסיים/י עוד {left}.' },
  { title: '🪦 כאן נקברו התוכניות שלך להיום', body: 'עוד {left} שלא בוצעו. נוחו על משכבכן בשלום.' },
  { title: '👵 סבתא שלך מאוכזבת', body: 'וזה אפילו לא הדבר הכי גרוע שקרה לה השנה. עוד {left}.' },
  { title: '🛋️ הפסיכולוג שלך העלה מחיר', body: 'הוא אמר שזה בגלל המקרה שלך. עוד {left} פתוחות.' },
  { title: '🧟 מה ההבדל בינך לבין זומבי?', body: 'זומבי לפחות יוצא מהבית. עוד {left} מחכות.' },
  { title: '📉 המניה שלך בירידה', body: 'המשקיעים כבר מוכרים. עוד {left} כדי להציל את החברה.' },
  { title: '🦴 אפילו העצם שלי יותר פרודוקטיבית', body: 'והיא קבורה בגינה. עוד {left}.' },
  { title: '📌 "{task}" שאלה עלייך', body: 'אמרתי לה שאת/ה עסוק/ה. היא לא האמינה. גם אני לא.' },
  { title: '💔 "{task}" חושדת שאת/ה כבר לא אוהב/ת אותה', body: 'עוד יום כזה והיא חוזרת לגור אצל אמא שלה.' },
  { title: '🕵️ "{task}" הגישה תלונה במשטרה', body: 'סעיף: הזנחה בנסיבות מחמירות. עוד {left} לסגור את התיק.' },
  { title: '☀️ בוקר טוב, אכזבה קטנה', body: 'סתם. אבל עוד {left} מחכות, ואנחנו עוקבים.', when: 'morning' },
  { title: '☕ הקפה כבר התקרר', body: 'כמו החלומות שלך. עוד {left} להיום.', when: 'morning' },
  { title: '🔥 הרצף של {streak} ימים בטיפול נמרץ', body: 'הרופאים אומרים שהלילה קריטי. עוד {left} כדי לנתק אותו מהמכונות.', streak: true },
  { title: '🕯️ הדלקנו נר לזכר הרצף', body: '{streak} ימים. הוא היה צעיר מדי. עוד אפשר להחיות אותו: עוד {left}.', streak: true },
  { title: '😤 ד״ר בליני לא אכל כל היום', body: 'הוא אומר שזה בגללך. עוד {left} לפני חצות.', when: 'late' },
  { title: '🌙 חצות מתקרבת', body: 'לך יש עוד {left}. לד״ר בליני יש סבלנות של 3 שניות. 2... 1...', when: 'late' },
  { title: '👻 עוד מעט חצות', body: 'ואז המטלות שלא עשית יבואו לרדוף אותך בחלומות. עוד {left}.', when: 'late' },
];

function pickDark(p, time, pending, random, avoid) {
  const minutes = toMinutes(time);
  const slot = minutes < 12 * 60 ? 'morning' : minutes >= 20 * 60 ? 'late' : 'day';
  const eligible = DARK_MESSAGES.filter((m) => (!m.when || m.when === slot)
    && (!m.streak || p.streak > 0)
    && (!`${m.title}${m.body}`.includes('{task}') || pending.length > 0));
  const pool = eligible.length > 1 ? eligible.filter((m) => m.title !== avoid) : eligible;
  return { message: pool[Math.floor(random() * pool.length)], pendingPick: pending[Math.floor(random() * pending.length)] };
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
}

// Returns a {title, body, key} notification, or null when there is nothing to remind about.
// `key` identifies the template so the next reminder can avoid repeating it.
export function buildMessage(status, date, time, { style = 'normal', random = Math.random, avoid } = {}) {
  const p = todayProgress(status, date);
  if (p.total === 0 || p.perfect || p.done >= p.total) return null;
  const left = p.total - p.done;
  const leftText = left === 1 ? 'מטלה אחת' : `${left} מטלות`;

  if (style === 'dark') {
    const tasks = Array.isArray(status.tasks) ? status.tasks : [];
    const pending = (status.date === date ? tasks.filter((t) => !t.done) : tasks).map((t) => t.title);
    const { message, pendingPick } = pickDark(p, time, pending, random, avoid);
    const values = { left: leftText, streak: String(p.streak), task: pendingPick };
    return { title: fill(message.title, values), body: fill(message.body, values), key: message.title };
  }

  const evening = toMinutes(time) >= 17 * 60;
  const late = toMinutes(time) >= 20 * 60;
  if (late) {
    const risk = p.streak > 0 ? ` הרצף של ${p.streak} ימים בסכנה!` : '';
    return { title: '😤 רררר... ד״ר בליני עצבני!', body: `היום עומד להיגמר ועוד ${leftText} לא בוצעו.${risk}` };
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
      tasks: (Array.isArray(s.tasks) ? s.tasks : [])
        .filter((t) => t && typeof t.title === 'string' && t.title.trim())
        .slice(0, 30)
        .map((t) => ({ title: t.title.trim().slice(0, 60), done: t.done === true })),
    },
    style: body.style === 'dark' ? 'dark' : 'normal',
  };
}
