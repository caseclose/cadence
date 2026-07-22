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
  if (!supabase) return '未配置云同步';
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return '推送订阅不完整';

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

/**
 * Request notification permission (must be called from a user gesture on iOS),
 * subscribe to Web Push, and upsert the subscription for `userId`.
 */
export async function subscribeToPush(userId: string): Promise<string | null> {
  if (!isPushSupported()) {
    return '当前浏览器不支持推送（iOS 需「添加到主屏幕」后的 PWA）';
  }
  const publicKey = vapidPublicKey();
  if (!publicKey) {
    return '未配置 VITE_VAPID_PUBLIC_KEY，无法开启推送';
  }
  if (!supabase) return '未配置云同步';

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return '未授予通知权限';
  }

  const reg = await getRegistration();
  if (!reg) return 'Service Worker 尚未就绪，请刷新后再试';

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `订阅推送失败：${msg}`;
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
