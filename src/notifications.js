// Web Push subscription and syncing today's progress with the reminder server.

const DEBOUNCE_MS = 1500;

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// 'unsupported' | 'needs-install' | 'denied' | 'available'
export function pushAvailability() {
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'available';
}

function base64UrlToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function postSync(body) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
}

function payload(state, subscription, status) {
  return {
    id: state.deviceId,
    subscription: subscription.toJSON(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminders: state.notify.times,
    status,
  };
}

// Ask for permission and subscribe. Throws with a user-facing Hebrew message on failure.
export async function enablePush(state, status) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('לא ניתן אישור להתראות. אפשר לשנות זאת בהגדרות הטלפון.');
  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('שרת התזכורות לא זמין כרגע. נסה שוב מאוחר יותר.');
    const { publicKey } = await res.json();
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
  }
  await postSync(payload(state, subscription, status));
}

export async function disablePush(state) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* already gone */ }
  try { await postSync({ id: state.deviceId, unsubscribe: true }); } catch { /* offline: server drops it on next 410 */ }
}

// Keep the server's copy of today's progress fresh so it only nudges when needed.
let timer;
export function scheduleSync(state, status) {
  if (!state.notify.enabled || !pushSupported()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await postSync(payload(state, sub, status));
    } catch { /* offline: next change will retry */ }
  }, DEBOUNCE_MS);
}
