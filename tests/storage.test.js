import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom, saveTo, storageWorks, normalizeState, STORAGE_KEY } from '../src/storage.js';

const fallback = () => ({ tasks: [], done: { date: '2026-11-15', ids: [] }, streak: 0, best: 0, lastDone: null, history: [], xp: 0, sound: true, schedule: [] });

function memory(initial = {}, { throwOnGet = false, throwOnSet = false } = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k) => { if (throwOnGet) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (throwOnSet) throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
}

const good = { tasks: [{ id: 'a', title: 'Anki' }], streak: 7, best: 9, xp: 120, lastDone: '2026-11-14', history: ['2026-11-14'], notify: { enabled: true }, deviceId: 'abc' };

test('loading good data keeps everything and refreshes the backup copy', () => {
  const s = memory({ [STORAGE_KEY]: JSON.stringify(good) });
  const { state, available, restored } = loadFrom(s, fallback());
  assert.equal(available, true);
  assert.equal(restored, false);
  assert.equal(state.streak, 7);
  assert.equal(state.tasks[0].title, 'Anki');
  assert.deepEqual(state.notify, { enabled: true });
  assert.equal(s.m.get('streaky-v1-backup'), JSON.stringify(good));
});

test('unreadable data is set aside and the backup is restored instead of starting over', () => {
  const s = memory({ [STORAGE_KEY]: '{"tasks": [broken', 'streaky-v1-backup': JSON.stringify(good) });
  const { state, restored } = loadFrom(s, fallback());
  assert.equal(restored, true);
  assert.equal(state.streak, 7);
  assert.equal(s.m.get('streaky-v1-unreadable'), '{"tasks": [broken');
});

test('unreadable data with no backup is kept aside, never silently lost', () => {
  const s = memory({ [STORAGE_KEY]: 'not json' });
  const { state } = loadFrom(s, fallback());
  assert.deepEqual(state.tasks, []);
  assert.equal(s.m.get('streaky-v1-unreadable'), 'not json');
});

test('blocked storage is reported instead of pretending to save', () => {
  const blocked = memory({}, { throwOnGet: true, throwOnSet: true });
  assert.equal(loadFrom(blocked, fallback()).available, false);
  assert.equal(storageWorks(blocked), false);
  assert.equal(saveTo(blocked, good), false);
  assert.equal(storageWorks(memory()), true);
  assert.equal(loadFrom(null, fallback()).available, false);
});

test('malformed fields are repaired without dropping valid data', () => {
  const s = normalizeState({ tasks: [{ title: 'no id' }, null, { id: 'x', title: 'ok', days: [1] }], streak: 4, best: 2, xp: -5, lastDone: 'yesterday', history: ['2026-11-14', 7], extra: 'kept' }, fallback());
  assert.deepEqual(s.tasks.map((t) => t.title), ['no id', 'ok']);
  assert.ok(s.tasks[0].id);
  assert.deepEqual(s.tasks[1].days, [1]);
  assert.equal(s.best, 4);
  assert.equal(s.xp, 0);
  assert.equal(s.lastDone, null);
  assert.deepEqual(s.history, ['2026-11-14']);
  assert.equal(s.extra, 'kept');
});
