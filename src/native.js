// Bridges to native Android features when Streaky runs as the installed app (Capacitor).
// In a browser none of this is loaded.

export const isNative = () => window.Capacitor?.isNativePlatform?.() === true;

const CHANNEL_ID = 'reminders';
const SMALL_ICON = 'ic_stat_streaky';
const DEBOUNCE_MS = 800;

let pluginsPromise;
function plugins() {
  pluginsPromise ??= import('./vendor/capacitor-core.js').then(({ registerPlugin }) => ({
    notifications: registerPlugin('LocalNotifications'),
    haptics: registerPlugin('Haptics'),
    app: registerPlugin('App'),
  }));
  return pluginsPromise;
}

// kind: 'tap' for a completed task, 'success' for a perfect day.
export async function nativeHaptic(kind) {
  try {
    const { haptics } = await plugins();
    if (kind === 'success') await haptics.notification({ type: 'SUCCESS' });
    else await haptics.impact({ style: 'LIGHT' });
  } catch { /* haptics unavailable */ }
}

export async function nativeNotificationsAllowed() {
  try {
    const { notifications } = await plugins();
    return (await notifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

// Ask for permission. Throws with a user-facing Hebrew message when refused.
export async function enableNativeNotifications() {
  const { notifications } = await plugins();
  let perm = await notifications.checkPermissions();
  if (perm.display !== 'granted') perm = await notifications.requestPermissions();
  if (perm.display !== 'granted') {
    throw new Error('לא ניתן אישור להתראות. אפשר להפעיל אותן בהגדרות הטלפון ← אפליקציות ← Streaky ← התראות.');
  }
  try {
    await notifications.createChannel({ id: CHANNEL_ID, name: 'תזכורות יומיות', description: 'תזכורות לסיים את המטלות של היום', importance: 4, vibration: true });
  } catch { /* channel already exists or unsupported */ }
}

async function cancelAll(notifications) {
  const { notifications: pending } = await notifications.getPending();
  if (pending.length) await notifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
}

export async function cancelNativeReminders() {
  try { await cancelAll((await plugins()).notifications); } catch { /* nothing scheduled */ }
}

// Replace every scheduled reminder with `plan` ([{ id, at, title, body }]). Debounced.
let timer;
export function scheduleNativeReminders(getPlan) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const { notifications } = await plugins();
      await cancelAll(notifications);
      const plan = getPlan();
      if (!plan.length) return;
      // Without exact-alarm access, schedule() would open a settings screen; fall back to inexact quietly.
      let exact = false;
      try { exact = (await notifications.checkExactNotificationSetting()).exact_alarm === 'granted'; } catch { /* older plugin */ }
      await notifications.schedule({
        notifications: plan.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.at, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          smallIcon: SMALL_ICON,
          iconColor: '#58CC02',
          isExactNotification: exact,
        })),
      });
    } catch (err) {
      console.error('scheduling reminders failed', err);
    }
  }, DEBOUNCE_MS);
}

// Android back button: close the top-most overlay, otherwise leave the app.
export async function onNativeBack(closeTopOverlay) {
  try {
    const { app } = await plugins();
    await app.addListener('backButton', () => {
      if (!closeTopOverlay()) app.exitApp();
    });
  } catch { /* App plugin unavailable */ }
}
