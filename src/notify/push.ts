import { t } from '../i18n';
import { supabase } from '../store/supabase';

/** Convert a URL-safe base64 VAPID public key to Uint8Array for pushManager.subscribe. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function vapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey());
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Persist the current PushSubscription to Supabase for the signed-in user. */
async function upsertSubscriptionRow(sub: PushSubscription, userId: string): Promise<string | null> {
  if (!supabase) return t('errCloudNotConfigured');
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return t('errPushIncomplete');

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      created_at: Date.now(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) return error.message;
  return null;
}

async function deleteSubscriptionRow(endpoint: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/** True when Chrome cannot reach Google FCM (common in mainland China without VPN). */
export function isPushServiceUnavailableError(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes('push service') || m.includes('pushservice')) return true;
  return m.includes('push') && (m.includes('not available') || m.includes('unavailable'));
}

export function formatPushSubscribeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (isPushServiceUnavailableError(msg)) {
    return t('errPushUnavailable');
  }
  return t('errPushSubscribeFailed', { msg: msg || t('errPushUnknown') });
}

export async function subscribeToPush(userId: string): Promise<string | null> {
  if (!isPushSupported()) {
    return t('errPushNotSupported');
  }
  const publicKey = vapidPublicKey();
  if (!publicKey) {
    return t('errPushNoVapid');
  }
  if (!supabase) return t('errCloudNotConfigured');

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return t('errPushPermissionDenied');
  }

  const reg = await getRegistration();
  if (!reg) return t('errPushSwNotReady');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (err) {
      return formatPushSubscribeError(err);
    }
  }

  return upsertSubscriptionRow(sub, userId);
}

/** If permission already granted, ensure a subscription row exists (no prompt). */
export async function ensurePushSubscription(userId: string): Promise<void> {
  if (!isPushSupported() || !isPushConfigured() || !supabase) return;
  if (Notification.permission !== 'granted') return;
  const reg = await getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await upsertSubscriptionRow(sub, userId);
}

/** Unsubscribe this device and remove the row from Supabase. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    // ignore
  }
  await deleteSubscriptionRow(endpoint);
}

/** Whether this device already has an active PushSubscription. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return Boolean(sub);
}
