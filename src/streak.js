// Pure date & streak logic (shared by the app and the tests).

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

// Day of the week of a date key: 0 = Sunday … 6 = Saturday.
export function weekday(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// A task repeats every day unless it lists specific weekdays.
export function scheduledOn(days, key) {
  return !Array.isArray(days) || days.length === 0 || days.includes(weekday(key));
}

// Rest day: there are tasks, but none of them is scheduled on that date.
export function restDayChecker(tasks) {
  return (key) => tasks.length > 0 && !tasks.some((t) => scheduledOn(t.days, key));
}

// Weekdays (0–6) that have at least one task.
export function activeWeekdays(tasks) {
  const days = new Set();
  for (const t of tasks) {
    if (!Array.isArray(t.days) || t.days.length === 0) return [0, 1, 2, 3, 4, 5, 6];
    t.days.forEach((d) => days.add(d));
  }
  return [...days].sort();
}

// Schedule history: [{ from: dateKey, active: weekdays[] }] sorted by `from`. Rest days in the past
// are judged by the schedule that applied then, so editing tasks never rewrites (and breaks) old streaks.
function activeAt(log, key) {
  let active = log[0]?.active ?? null;
  for (const entry of log) if (entry.from <= key) active = entry.active;
  return active;
}

export function updateScheduleLog(log, tasks, today) {
  const active = activeWeekdays(tasks);
  const before = log.filter((e) => e.from < today);
  if (before.length && before[before.length - 1].active.join() === active.join()) return before;
  return [...before, { from: today, active }].slice(-60);
}

export function restCheckerFromLog(log) {
  return (key) => {
    const active = activeAt(log, key);
    return Array.isArray(active) && active.length > 0 && !active.includes(weekday(key));
  };
}

const MAX_REST_RUN = 7;

// The streak the user currently holds: still alive if the last perfect day was today,
// yesterday, or before a run of rest days (days with nothing scheduled don't break it).
export function activeStreak(state, today, isRest = () => false) {
  if (state.lastDone === today) return state.streak;
  // The device clock went back (e.g. flying west): that never counts as a missed day.
  if (state.lastDone && state.lastDone > today) return state.streak;
  let key = addDays(today, -1);
  for (let i = 0; i <= MAX_REST_RUN; i++) {
    if (state.lastDone === key) return state.streak;
    if (!isRest(key)) return 0;
    key = addDays(key, -1);
  }
  return 0;
}

// Record that every task was completed today. Idempotent within a day.
export function completeDay(state, today, isRest = () => false) {
  if (state.lastDone && state.lastDone >= today) return state;
  const streak = activeStreak(state, today, isRest) > 0 ? state.streak + 1 : 1;
  const history = state.history.includes(today) ? state.history : [...state.history, today];
  return {
    ...state,
    streak,
    best: Math.max(state.best, streak),
    lastDone: today,
    history: history.slice(-400),
  };
}

// The 7 days of the current week (Sunday first), each marked if it was perfect or a rest day.
export function weekDays(history, today, isRest = () => false) {
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const start = addDays(today, -dow);
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    return { key, done: history.includes(key), isToday: key === today, future: key > today, rest: isRest(key) };
  });
}
