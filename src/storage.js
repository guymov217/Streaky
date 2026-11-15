// Loading and saving the user's data, guarded so that a bad write, an unreadable value or a missing
// field never wipes someone's tasks, streak or XP.

export const STORAGE_KEY = 'streaky-v1';
const BACKUP_KEY = 'streaky-v1-backup'; // copy of the last data that loaded fine
const RESCUE_KEY = 'streaky-v1-unreadable'; // raw text that could not be read, kept instead of overwritten

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

// Fill in missing or malformed fields without dropping anything that is valid.
export function normalizeState(raw, fallback) {
  const s = { ...fallback, ...raw };
  s.tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .filter((t) => t && typeof t === 'object' && typeof t.title === 'string')
    .map((t, i) => ({ ...t, id: typeof t.id === 'string' && t.id ? t.id : `task${i}` }));
  s.done = raw.done && typeof raw.done.date === 'string' && Array.isArray(raw.done.ids) ? raw.done : fallback.done;
  s.streak = count(raw.streak);
  s.best = Math.max(count(raw.best), s.streak);
  s.xp = count(raw.xp);
  s.lastDone = DATE_RE.test(raw.lastDone ?? '') ? raw.lastDone : null;
  s.history = (Array.isArray(raw.history) ? raw.history : []).filter((d) => DATE_RE.test(d));
  s.schedule = (Array.isArray(raw.schedule) ? raw.schedule : [])
    .filter((e) => e && typeof e.from === 'string' && Array.isArray(e.active));
  s.sound = raw.sound !== false;
  return s;
}

// Returns { state, available, restored }. Reads the main copy, then the backup; unreadable text is
// set aside under RESCUE_KEY so the next save cannot destroy it.
export function loadFrom(storage, fallback) {
  if (!storage) return { state: fallback, available: false };
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    let text;
    try { text = storage.getItem(key); } catch { return { state: fallback, available: false }; }
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (key === STORAGE_KEY) {
          try { storage.setItem(BACKUP_KEY, text); } catch { /* backup is best effort */ }
        }
        return { state: normalizeState(parsed, fallback), available: true, restored: key === BACKUP_KEY };
      }
    } catch { /* unreadable */ }
    try { storage.setItem(RESCUE_KEY, text); } catch { /* best effort */ }
  }
  return { state: fallback, available: true };
}

export function saveTo(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Whether data written now will still be there next time (false e.g. in private browsing).
export function storageWorks(storage) {
  if (!storage) return false;
  try {
    storage.setItem('__probe', '1');
    storage.removeItem('__probe');
    return true;
  } catch {
    return false;
  }
}
