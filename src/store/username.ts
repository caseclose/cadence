import type { User } from '@supabase/supabase-js';

/** Internal domain for Supabase email mapping — users never see this. */
const INTERNAL_DOMAIN = 'cadence.auth';

/** Supabase only accepts ASCII in the email local part. */
const ASCII_LOCAL = /^[a-z0-9._-]+$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 2–20 位：字母、数字、下划线、中文 */
export function validateUsername(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return false;
  return /^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(trimmed);
}

function encodeLocalPart(name: string): string {
  const bytes = new TextEncoder().encode(name);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `u.${b64}`;
}

function decodeLocalPart(local: string): string {
  if (!local.startsWith('u.')) return local;
  const padded = local.slice(2).replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return local;
  }
}

export function usernameToEmail(username: string): string {
  const normalized = normalizeUsername(username);
  const local = ASCII_LOCAL.test(normalized) ? normalized : encodeLocalPart(normalized);
  return `${local}@${INTERNAL_DOMAIN}`;
}

export function displayUsername(user: User): string {
  const meta = user.user_metadata?.username;
  if (typeof meta === 'string' && meta) return meta;
  const email = user.email ?? '';
  const suffix = `@${INTERNAL_DOMAIN}`;
  if (email.endsWith(suffix)) {
    const local = email.slice(0, -suffix.length);
    return decodeLocalPart(local);
  }
  return email.split('@')[0] || '用户';
}
