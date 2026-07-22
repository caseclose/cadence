import { t } from '../i18n';
import { supabase } from '../store/supabase';

export type WebhookProvider = 'feishu' | 'wecom' | 'dingtalk';

export interface NotificationWebhook {
  id: string;
  user_id: string;
  provider: WebhookProvider;
  url: string;
  secret: string | null;
  enabled: boolean;
  include_content: boolean;
  created_at: number;
  updated_at: number;
}

export const WEBHOOK_PROVIDERS: { id: WebhookProvider }[] = [
  { id: 'feishu' },
  { id: 'wecom' },
  { id: 'dingtalk' },
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
  includeContent?: boolean;
}): Promise<string | null> {
  if (!supabase) return t('errCloudNotConfigured');
  const url = input.url.trim();
  if (!url.startsWith('https://')) return t('errWebhookHttps');

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
        include_content: input.includeContent ?? false,
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
    include_content: input.includeContent ?? false,
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
  if (!supabase) return t('errCloudNotConfigured');
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
  if (!supabase) return t('errCloudNotConfigured');
  const { error } = await supabase
    .from('notification_webhooks')
    .update({ enabled, updated_at: Date.now() })
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) return error.message;
  return null;
}

/** Ask Edge Function to POST a test message to this user's saved webhooks. */
export async function testSavedWebhooks(): Promise<string | null> {
  if (!supabase) return t('errCloudNotConfigured');
  const { data, error } = await supabase.functions.invoke('push-due', {
    body: { action: 'test-webhook' },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const j = (await ctx.json()) as { error?: string; results?: { detail?: string }[] };
        if (j.error) return j.error;
        const fail = j.results?.find((r) => r.detail)?.detail;
        if (fail) return fail;
      } catch {
        /* ignore */
      }
    }
    return error.message || t('errWebhookTestFailed');
  }
  const payload = data as {
    ok?: boolean;
    error?: string;
    results?: { provider: string; ok: boolean; detail?: string }[];
  } | null;
  if (!payload) return t('errWebhookNoResponse');
  if (payload.error) return payload.error;
  if (payload.ok) return null;
  const fail = payload.results?.find((r) => !r.ok);
  return fail?.detail
    ? `${fail.provider}: ${fail.detail}`
    : t('errWebhookTestSignHint');
}
