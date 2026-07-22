import { supabase } from '../store/supabase';

export interface DigestPreference {
  enabled: boolean;
  timezone: string;
  local_time: string;
  channel: 'webhook';
}

export async function getDigestPreference(userId: string): Promise<DigestPreference | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('digest_preferences').select('enabled, timezone, local_time, channel').eq('user_id', userId).maybeSingle();
  return data as DigestPreference | null;
}

export async function saveDigestPreference(userId: string, preference: DigestPreference): Promise<string | null> {
  if (!supabase) return 'Cloud sync is not configured.';
  const { error } = await supabase.from('digest_preferences').upsert({ user_id: userId, ...preference, updated_at: Date.now() });
  return error?.message ?? null;
}
