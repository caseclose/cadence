/**
 * Cadence push-due Edge Function
 *
 * Invoked by pg_cron every minute (see migration_push.sql).
 * Finds tasks that are due and have not yet been notified for the current
 * next_fire_at, then sends a generic Web Push to each of the owner's devices.
 *
 * Secrets (supabase secrets set):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * Auto-injected by Supabase:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DueTask {
  id: string;
  user_id: string;
  next_fire_at: number;
  state: string;
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'missing SUPABASE_URL / SERVICE_ROLE_KEY' }, 500);
    }
    if (!vapidPublic || !vapidPrivate) {
      return json({ error: 'missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = Date.now();

    const { data: dueRows, error: dueErr } = await admin
      .from('tasks')
      .select('id, user_id, next_fire_at, state, notified_fire_at')
      .neq('state', 'done')
      .lte('next_fire_at', now);

    if (dueErr) {
      return json({ error: dueErr.message }, 500);
    }

    const due = ((dueRows ?? []) as Array<DueTask & { notified_fire_at: number | null }>).filter(
      (t) => t.notified_fire_at == null || t.notified_fire_at !== t.next_fire_at,
    );

    if (due.length === 0) {
      return json({ ok: true, due: 0, sent: 0 });
    }

    const userIds = [...new Set(due.map((t) => t.user_id))];
    const { data: subRows, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (subErr) {
      return json({ error: subErr.message }, 500);
    }

    const subsByUser = new Map<string, PushSub[]>();
    for (const s of (subRows ?? []) as PushSub[]) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push(s);
      subsByUser.set(s.user_id, list);
    }

    const payload = JSON.stringify({
      title: 'Cadence · 有挂起任务到点了',
      body: '打开应用确认进度。内容已端到端加密，推送不含任务明文。',
      tag: 'cadence-due',
    });

    let sent = 0;
    const notifiedTaskIds: { id: string; next_fire_at: number }[] = [];
    const deadEndpoints: string[] = [];

    // One push per user that has at least one due task (avoid spamming N tasks × M devices)
    const usersWithDue = new Set(due.map((t) => t.user_id));

    for (const userId of usersWithDue) {
      const subs = subsByUser.get(userId) ?? [];
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            deadEndpoints.push(sub.endpoint);
          } else {
            console.error('webpush failed', sub.endpoint, err);
          }
        }
      }

      for (const t of due.filter((d) => d.user_id === userId)) {
        notifiedTaskIds.push({ id: t.id, next_fire_at: t.next_fire_at });
      }
    }

    // Mark tasks as notified for this fire time (even if user has no subscriptions,
    // so we don't keep retrying forever; they can re-subscribe later for new fires).
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
      sent,
      dead: deadEndpoints.length,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
