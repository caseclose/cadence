/**
 * Cadence push-due Edge Function
 *
 * Invoked by pg_cron every minute. For each due task owner:
 * 1) Web Push (optional — needs VAPID; often blocked in mainland China)
 * 2) Feishu / WeCom / DingTalk webhooks (China-friendly)
 *
 * Secrets: VAPID_* (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REMINDER_TEXT =
  'Cadence · 有挂起任务到点了。打开应用确认进度（内容已端到端加密，本消息不含任务明文）。';

type Provider = 'feishu' | 'wecom' | 'dingtalk';

interface DueTask {
  id: string;
  user_id: string;
  next_fire_at: number;
  state: string;
  notified_fire_at: number | null;
  webhook_title: string | null;
  webhook_note: string | null;
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface WebhookRow {
  id: string;
  user_id: string;
  provider: Provider;
  url: string;
  secret: string | null;
  enabled: boolean;
  include_content: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'missing SUPABASE_URL / SERVICE_ROLE_KEY' }, 500);
    }

    // Client "发送测试"：用用户 JWT 识别身份，向其已保存的 webhook 发一条试消息。
    let reqBody: { action?: string } = {};
    try {
      reqBody = (await req.clone().json()) as { action?: string };
    } catch {
      reqBody = {};
    }
    if (reqBody.action === 'test-webhook') {
      if (!anonKey) return json({ error: 'missing SUPABASE_ANON_KEY' }, 500);
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ error: '需要登录' }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return json({ error: '登录无效' }, 401);

      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: hooks, error: hookErr } = await admin
        .from('notification_webhooks')
        .select('id, user_id, provider, url, secret, enabled, include_content')
        .eq('user_id', userData.user.id)
        .eq('enabled', true);
      if (hookErr) return json({ error: hookErr.message }, 500);
      const list = (hooks ?? []) as WebhookRow[];
      if (list.length === 0) {
        return json({ error: '尚未配置已启用的提醒通道，请先保存 Webhook' }, 400);
      }

      const results: { provider: string; ok: boolean; detail?: string }[] = [];
      for (const hook of list) {
        const r = await sendChatWebhook(hook, 'Cadence · 测试消息：提醒通道已连通。');
        results.push({ provider: hook.provider, ok: r.ok, detail: r.detail });
      }
      const allOk = results.every((r) => r.ok);
      return json({ ok: allOk, results }, allOk ? 200 : 502);
    }

    const pushEnabled = Boolean(vapidPublic && vapidPrivate);
    if (pushEnabled) {
      webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = Date.now();

    const { data: dueRows, error: dueErr } = await admin
      .from('tasks')
      .select('id, user_id, next_fire_at, state, notified_fire_at, webhook_title, webhook_note')
      .neq('state', 'done')
      .lte('next_fire_at', now);

    if (dueErr) {
      return json({ error: dueErr.message }, 500);
    }

    const due = ((dueRows ?? []) as DueTask[]).filter(
      (t) => t.notified_fire_at == null || t.notified_fire_at !== t.next_fire_at,
    );

    if (due.length === 0) {
      return json({ ok: true, due: 0, pushSent: 0, webhookSent: 0 });
    }

    const userIds = [...new Set(due.map((t) => t.user_id))];

    const { data: subRows, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (subErr) {
      return json({ error: subErr.message }, 500);
    }

    const { data: hookRows, error: hookErr } = await admin
      .from('notification_webhooks')
      .select('id, user_id, provider, url, secret, enabled, include_content')
      .in('user_id', userIds)
      .eq('enabled', true);

    if (hookErr) {
      return json({ error: hookErr.message }, 500);
    }

    const subsByUser = new Map<string, PushSub[]>();
    for (const s of (subRows ?? []) as PushSub[]) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push(s);
      subsByUser.set(s.user_id, list);
    }

    const hooksByUser = new Map<string, WebhookRow[]>();
    for (const h of (hookRows ?? []) as WebhookRow[]) {
      const list = hooksByUser.get(h.user_id) ?? [];
      list.push(h);
      hooksByUser.set(h.user_id, list);
    }

    const pushPayload = JSON.stringify({
      title: 'Cadence · 有挂起任务到点了',
      body: '打开应用确认进度。内容已端到端加密，推送不含任务明文。',
      tag: 'cadence-due',
    });

    let pushSent = 0;
    let webhookSent = 0;
    const notifiedTaskIds: { id: string; next_fire_at: number }[] = [];
    const deadEndpoints: string[] = [];

    const usersWithDue = new Set(due.map((t) => t.user_id));

    for (const userId of usersWithDue) {
      const userSubs = pushEnabled ? subsByUser.get(userId) ?? [] : [];
      const userHooks = hooksByUser.get(userId) ?? [];
      let userDelivered = false;

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
          );
          pushSent += 1;
          userDelivered = true;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            deadEndpoints.push(sub.endpoint);
          } else {
            console.error('webpush failed', err);
          }
        }
      }

      for (const hook of userHooks) {
        try {
          const text = hook.include_content
            ? formatWebhookReminder(due.filter((t) => t.user_id === userId))
            : REMINDER_TEXT;
          const r = await sendChatWebhook(hook, text);
          if (r.ok) {
            webhookSent += 1;
            userDelivered = true;
          } else {
            console.error('webhook failed', hook.provider, r.detail);
          }
        } catch (err) {
          console.error('webhook failed', hook.provider, err);
        }
      }

      // Mark tasks notified when we actually delivered, OR when the user has no
      // channels at all (avoid retry storms). If channels exist but all failed,
      // leave unmarked so the next cron tick retries.
      const hasChannels = userSubs.length > 0 || userHooks.length > 0;
      if (userDelivered || !hasChannels) {
        for (const t of due.filter((d) => d.user_id === userId)) {
          notifiedTaskIds.push({ id: t.id, next_fire_at: t.next_fire_at });
        }
      }
    }

    for (const t of notifiedTaskIds) {
      const { error } = await admin
        .from('tasks')
        .update({ notified_fire_at: t.next_fire_at })
        .eq('id', t.id);
      if (error) console.error('update notified_fire_at failed', t.id, error.message);
    }

    if (deadEndpoints.length > 0) {
      const { error } = await admin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', deadEndpoints);
      if (error) console.error('delete dead subs failed', error.message);
    }

    return json({
      ok: true,
      due: due.length,
      users: usersWithDue.size,
      pushSent,
      webhookSent,
      pushEnabled,
      dead: deadEndpoints.length,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});


function formatWebhookReminder(tasks: DueTask[]): string {
  const lines = ['Cadence · 任务到点提醒'];
  for (const task of tasks) {
    lines.push(`\n【${task.webhook_title || '未命名任务'}】`);
    if (task.webhook_note?.trim()) lines.push(task.webhook_note.trim());
  }
  return lines.join('\n');
}

async function sendChatWebhook(
  hook: WebhookRow,
  text: string,
): Promise<{ ok: boolean; detail?: string }> {
  const { url, body } = await buildWebhookRequest(hook, text);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    const detail = `HTTP ${res.status}: ${raw.slice(0, 200)}`;
    console.error('webhook HTTP', hook.provider, detail);
    return { ok: false, detail };
  }
  // Feishu / WeCom / DingTalk often return HTTP 200 with a business error code.
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (hook.provider === 'feishu') {
      const code = parsed.code;
      if (code !== undefined && code !== 0 && code !== '0') {
        const detail = typeof parsed.msg === 'string' ? parsed.msg : JSON.stringify(parsed);
        console.error('feishu webhook business error', parsed);
        return { ok: false, detail };
      }
    }
    if (hook.provider === 'wecom' || hook.provider === 'dingtalk') {
      const errcode = parsed.errcode;
      if (errcode !== undefined && errcode !== 0 && errcode !== '0') {
        const detail =
          typeof parsed.errmsg === 'string' ? parsed.errmsg : JSON.stringify(parsed);
        console.error(`${hook.provider} webhook business error`, parsed);
        return { ok: false, detail };
      }
    }
  } catch {
    // non-JSON success body — treat as ok if HTTP succeeded
  }
  return { ok: true };
}

async function buildWebhookRequest(
  hook: WebhookRow,
  text: string,
): Promise<{ url: string; body: Record<string, unknown> }> {
  const secret = hook.secret?.trim() || null;

  if (hook.provider === 'feishu') {
    const body: Record<string, unknown> = {
      msg_type: 'text',
      content: { text },
    };
    if (secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = await feishuSign(secret, timestamp);
      body.timestamp = String(timestamp);
      body.sign = sign;
    }
    return { url: hook.url, body };
  }

  if (hook.provider === 'wecom') {
    return {
      url: hook.url,
      body: {
        msgtype: 'text',
        text: { content: text },
      },
    };
  }

  // dingtalk
  let url = hook.url;
  if (secret) {
    const timestamp = Date.now();
    const sign = await dingtalkSign(secret, timestamp);
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  }
  return {
    url,
    body: {
      msgtype: 'text',
      text: { content: text },
    },
  };
}

/** Feishu: HMAC-SHA256 with key = `${timestamp}\\n${secret}`, message empty, then base64. */
async function feishuSign(secret: string, timestamp: number): Promise<string> {
  const stringToSign = `${timestamp}\n${secret}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(stringToSign),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new Uint8Array());
  return bytesToBase64(new Uint8Array(sig));
}

/** DingTalk: HMAC-SHA256 with key = secret, message = `${timestamp}\\n${secret}`, then base64. */
async function dingtalkSign(secret: string, timestamp: number): Promise<string> {
  const stringToSign = `${timestamp}\n${secret}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign));
  return bytesToBase64(new Uint8Array(sig));
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
