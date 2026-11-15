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

// The streak the user currently holds: still alive if the last perfect day
// was today or yesterday, otherwise it has been broken.
export function activeStreak(state, today) {
  if (state.lastDone === today || state.lastDone === addDays(today, -1)) {
    return state.streak;
  }
  return 0;
}

// Record that every task was completed today. Idempotent within a day.
export function completeDay(state, today) {
  if (state.lastDone === today) return state;
  const streak = state.lastDone === addDays(today, -1) ? state.streak + 1 : 1;
  const history = state.history.includes(today) ? state.history : [...state.history, today];
  return {
    ...state,
    streak,
    best: Math.max(state.best, streak),
    lastDone: today,
    history: history.slice(-400),
  };
}

// The 7 days of the current week (Sunday first), each marked if it was perfect.
export function weekDays(history, today) {
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const start = addDays(today, -dow);
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    return { key, done: history.includes(key), isToday: key === today, future: key > today };
  });
}
