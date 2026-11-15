// Plans on-device reminders for the installed Android app (no server involved).
// Notifications are scheduled ahead for the coming days and re-planned whenever the
// app's state changes, so finishing today's tasks removes today's remaining reminders.
import { dateKey, addDays } from './streak.js';
import { buildMessage } from './reminders.js';

export const PLAN_DAYS = 14;

// status: today's progress as built by the app (date, done, total, streak, lastDone, tasks).
// Returns [{ id, at: Date, title, body }] sorted by time.
export function planLocalReminders(status, { times, style = 'normal', now = new Date(), days = PLAN_DAYS, random = Math.random }) {
  const today = dateKey(now);
  const sorted = [...new Set(times)].sort();
  const plan = [];
  let avoid;
  for (let d = 0; d < days; d++) {
    const date = addDays(today, d);
    const [y, m, day] = date.split('-').map(Number);
    sorted.forEach((time, i) => {
      const at = new Date(y, m - 1, day, Number(time.slice(0, 2)), Number(time.slice(3)));
      if (at <= now) return;
      const msg = buildMessage(status, date, time, { style, random, avoid });
      if (!msg) return;
      avoid = msg.key ?? avoid;
      plan.push({ id: d * 10 + i + 1, at, title: msg.title, body: msg.body });
    });
  }
  return plan;
}
