import { devices } from '../lib/store.js';
import { sanitizeRecord } from '../lib/reminders.js';

const ID_RE = /^[a-z0-9]{16,64}$/;

// The app reports its subscription, reminder times and today's progress here.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const text = await req.text();
  if (text.length > 8000) return new Response('Too large', { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch { return new Response('Bad JSON', { status: 400 }); }

  const store = devices();
  if (body?.unsubscribe === true && ID_RE.test(body.id ?? '')) {
    await store.delete(body.id);
    return Response.json({ ok: true });
  }

  const record = sanitizeRecord(body);
  if (!record) return new Response('Invalid record', { status: 400 });
  const previous = await store.get(record.id, { type: 'json' });
  await store.setJSON(record.id, { ...record, lastSent: previous?.lastSent ?? {} });
  return Response.json({ ok: true });
};

export const config = { path: '/api/sync' };
