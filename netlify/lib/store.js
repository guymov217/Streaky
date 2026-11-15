import { getStore } from '@netlify/blobs';
import * as webpush from 'web-push';

export const devices = () => getStore({ name: 'devices', consistency: 'strong' });

// VAPID keys are created on first use and kept in Blobs, so no secrets need to be configured.
export async function vapidKeys() {
  const store = getStore({ name: 'config', consistency: 'strong' });
  let keys = await store.get('vapid', { type: 'json' });
  if (!keys) {
    await store.setJSON('vapid', webpush.generateVAPIDKeys(), { onlyIfNew: true });
    keys = await store.get('vapid', { type: 'json' });
  }
  return keys;
}
