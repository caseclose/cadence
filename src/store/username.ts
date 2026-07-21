import type { User } from '@supabase/supabase-js';

/** Internal domain for Supabase email mapping — users never see this. */
const INTERNAL_DOMAIN = 'cadence.auth';

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 2–20 位：字母、数字、下划线、中文 */
export function validateUsername(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return false;
  return /^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(trimmed);
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_DOMAIN}`;
}

export function displayUsername(user: User): string {
  const meta = user.user_metadata?.username;
  if (typeof meta === 'string' && meta) return meta;
  const email = user.email ?? '';
  const suffix = `@${INTERNAL_DOMAIN}`;
  if (email.endsWith(suffix)) return email.slice(0, -suffix.length);
  return email.split('@')[0] || '用户';
}
