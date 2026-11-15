import { vapidKeys } from '../lib/store.js';

export default async () => {
  const { publicKey } = await vapidKeys();
  return Response.json({ publicKey });
};

export const config = { path: '/api/config' };
