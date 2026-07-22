import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Hook = { provider: 'feishu' | 'wecom' | 'dingtalk'; url: string; secret: string | null };
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sign(secret: string, timestamp: number, provider: Hook['provider']): Promise<string> {
  const input = `${timestamp}\n${secret}`;
  const keyText = provider === 'feishu' ? input : secret;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const raw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(provider === 'feishu' ? '' : input));
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function send(hook: Hook, text: string): Promise<boolean> {
  let url = hook.url;
  const body: Record<string, unknown> = hook.provider === 'feishu'
    ? { msg_type: 'text', content: { text } }
    : { msgtype: 'text', text: { content: text } };
  if (hook.secret) {
    const timestamp = hook.provider === 'feishu' ? Math.floor(Date.now() / 1000) : Date.now();
    const signature = await sign(hook.secret, timestamp, hook.provider);
    if (hook.provider === 'feishu') Object.assign(body, { timestamp: String(timestamp), sign: signature });
    if (hook.provider === 'dingtalk') url += `${url.includes('?') ? '&' : '?'}timestamp=${timestamp}&sign=${encodeURIComponent(signature)}`;
  }
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return response.ok;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CADENCE_CRON_SECRET');
  if (!secret || req.headers.get('x-cadence-cron-secret') !== secret) return new Response('Unauthorized', { status: 401 });
  const now = new Date();
  const { data: preferences, error } = await db.from('digest_preferences').select('*').eq('enabled', true);
  if (error) return json({ error: error.message }, 500);
  let sent = 0;
  for (const preference of preferences ?? []) {
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: preference.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    if (localTime !== String(preference.local_time).slice(0, 5)) continue;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: preference.timezone }).format(now);
    const { data: claimed, error: claimError } = await db.rpc('claim_daily_digest', {
      p_user_id: preference.user_id,
      p_digest_date: date,
      p_channel: preference.channel,
    });
    if (claimError || !claimed) continue;
    const [{ count: active }, { count: due }, { data: hooks }] = await Promise.all([
      db.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', preference.user_id).neq('state', 'done'),
      db.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', preference.user_id).neq('state', 'done').lte('next_fire_at', Date.now()),
      db.from('notification_webhooks').select('provider,url,secret').eq('user_id', preference.user_id).eq('enabled', true),
    ]);
    const message = `Cadence 每日摘要：进行中 ${active ?? 0} 个，已到期 ${due ?? 0} 个。`;
    const results = await Promise.all((hooks as Hook[] ?? []).map((hook) => send(hook, message)));
    const delivered = results.some(Boolean);
    await db.from('digest_deliveries').update({ status: delivered ? 'sent' : 'failed', sent_at: delivered ? Date.now() : null, last_error: delivered ? null : 'No webhook delivery succeeded' }).eq('user_id', preference.user_id).eq('digest_date', date).eq('channel', preference.channel);
    if (delivered) sent++;
  }
  return json({ ok: true, sent });
});
