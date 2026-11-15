import * as webpush from 'web-push';
import { devices, vapidKeys } from '../lib/store.js';
import { dueReminders, buildMessage } from '../lib/reminders.js';

// Runs every 15 minutes and nudges devices whose reminder time has come
// and whose daily tasks are not finished yet.
export default async () => {
  const keys = await vapidKeys();
  const subject = process.env.URL || 'https://streaky.netlify.app';
  const store = devices();
  const { blobs } = await store.list();
  const now = new Date();

  for (const { key } of blobs) {
    const record = await store.get(key, { type: 'json' });
    if (!record) continue;
    const due = dueReminders(record, now);
    if (!due.length) continue;

    // Several reminders due at once (e.g. after downtime): send only the latest.
    const { time, date } = due[due.length - 1];
    const message = buildMessage(record.status, date, time);
    for (const d of due) record.lastSent = { ...record.lastSent, [d.time]: d.date };

    if (message) {
      try {
        await webpush.sendNotification(record.subscription, JSON.stringify(message), {
          vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 3600,
        });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await store.delete(key); // subscription no longer exists
          continue;
        }
        console.error('push failed', key, err.statusCode, err.body);
      }
    }
    await store.setJSON(key, record);
  }
};

export const config = { schedule: '*/15 * * * *' };
