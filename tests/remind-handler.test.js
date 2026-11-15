import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// In-memory stand-ins for Netlify Blobs and the push service.
const stores = { devices: new Map(), config: new Map() };
const sent = [];
let failWith = null;

mock.module('@netlify/blobs', {
  namedExports: {
    getStore: ({ name }) => {
      const m = stores[name];
      return {
        get: async (k) => m.get(k) ?? null,
        setJSON: async (k, v, opts) => { if (!(opts?.onlyIfNew && m.has(k))) m.set(k, structuredClone(v)); },
        delete: async (k) => { m.delete(k); },
        list: async () => ({ blobs: [...m.keys()].map((key) => ({ key })) }),
      };
    },
  },
});
mock.module('web-push', {
  namedExports: {
    generateVAPIDKeys: () => ({ publicKey: 'pub', privateKey: 'priv' }),
    sendNotification: async (sub, body) => {
      if (failWith) throw Object.assign(new Error('gone'), { statusCode: failWith });
      sent.push({ endpoint: sub.endpoint, ...JSON.parse(body) });
    },
  },
});

const { default: remind } = await import('../netlify/functions/remind.mjs');

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const local = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

function device(id, status) {
  stores.devices.set(id, {
    id, tz, reminders: [local],
    subscription: { endpoint: `https://web.push.apple.com/${id}`, keys: { p256dh: 'p', auth: 'a' } },
    status: { date: today, total: 3, streak: 0, lastDone: null, ...status },
    lastSent: {},
  });
}

test('sends only to devices that still have tasks, and only once', async () => {
  device('pending', { done: 1 });
  device('finished', { done: 3, lastDone: today });
  await remind();
  assert.deepEqual(sent.map((s) => s.endpoint), ['https://web.push.apple.com/pending']);
  assert.equal(stores.devices.get('finished').lastSent[local], today);
  await remind();
  assert.equal(sent.length, 1);
});

test('expired subscriptions are removed', async () => {
  device('expired', { done: 0 });
  failWith = 410;
  await remind();
  assert.equal(stores.devices.has('expired'), false);
});
