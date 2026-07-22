import { supabase } from '../store/supabase';

export type WebhookProvider = 'feishu' | 'wecom' | 'dingtalk';

export interface NotificationWebhook {
  id: string;
  user_id: string;
  provider: WebhookProvider;
  url: string;
  secret: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export const WEBHOOK_PROVIDERS: {
  id: WebhookProvider;
  label: string;
  hint: string;
}[] = [
  {
    id: 'feishu',
    label: '飞书',
    hint: '群设置 → 机器人 → 自定义机器人 → Webhook 地址；若开启签名校验请填密钥',
  },
  {
    id: 'wecom',
    label: '企业微信',
    hint: '群机器人 → Webhook 地址（一般无需密钥）',
  },
  {
    id: 'dingtalk',
    label: '钉钉',
    hint: '群设置 → 智能群助手 → 自定义机器人；安全设置若选「加签」请填 SEC；若选关键词请包含 Cadence',
  },
];

export async function listWebhooks(userId: string): Promise<NotificationWebhook[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notification_webhooks')
    .select('*')
    .eq('user_id', userId)
    .order('provider');
  if (error) {
    console.error('list webhooks failed', error.message);
    return [];
  }
  return (data ?? []) as NotificationWebhook[];
}

export async function upsertWebhook(input: {
  userId: string;
  provider: WebhookProvider;
  url: string;
  secret?: string;
  enabled?: boolean;
}): Promise<string | null> {
  if (!supabase) return '未配置云同步';
  const url = input.url.trim();
  if (!url.startsWith('https://')) return 'Webhook 地址须以 https:// 开头';

  const now = Date.now();
  const { data: existing } = await supabase
    .from('notification_webhooks')
    .select('id')
    .eq('user_id', input.userId)
    .eq('provider', input.provider)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('notification_webhooks')
      .update({
        url,
        secret: input.secret?.trim() || null,
        enabled: input.enabled ?? true,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) return error.message;
    return null;
  }

  const { error } = await supabase.from('notification_webhooks').insert({
    user_id: input.userId,
    provider: input.provider,
    url,
    secret: input.secret?.trim() || null,
    enabled: input.enabled ?? true,
    created_at: now,
    updated_at: now,
  });
  if (error) return error.message;
  return null;
}

export async function deleteWebhook(
  userId: string,
  provider: WebhookProvider,
): Promise<string | null> {
  if (!supabase) return '未配置云同步';
  const { error } = await supabase
    .from('notification_webhooks')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) return error.message;
  return null;
}

export async function setWebhookEnabled(
  userId: string,
  provider: WebhookProvider,
  enabled: boolean,
): Promise<string | null> {
  if (!supabase) return '未配置云同步';
  const { error } = await supabase
    .from('notification_webhooks')
    .update({ enabled, updated_at: Date.now() })
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) return error.message;
  return null;
}
