import type { User } from '@supabase/supabase-js';
import {
  createE2EEAccount,
  isE2EEMetadata,
  unlockE2EEAccount,
  type E2EEMetadata,
} from './e2ee';

/** How long a local unlock stays valid without re-entering the password. */
export const KEYRING_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

const SESSION_PREFIX = 'cadence:e2ee-session:';

interface SessionBlob {
  v: 1;
  expiresAt: number;
  dekJwk: JsonWebKey;
}

/** In-memory only — also mirrored to localStorage for KEYRING_SESSION_TTL_MS. */
let dek: CryptoKey | null = null;

function sessionStorageKey(userId: string): string {
  return `${SESSION_PREFIX}${userId}`;
}

export function isKeyringUnlocked(): boolean {
  return dek !== null;
}

export function lockKeyring(): void {
  dek = null;
}

export function getDek(): CryptoKey | null {
  return dek;
}

export function getE2EEMetadata(user: User | null | undefined): E2EEMetadata | null {
  if (!user?.user_metadata) return null;
  const meta = user.user_metadata as Record<string, unknown>;
  if (!isE2EEMetadata(meta)) return null;
  return meta;
}

export function userHasE2EE(user: User | null | undefined): boolean {
  return getE2EEMetadata(user) !== null;
}

export function clearKeyringSession(userId?: string): void {
  try {
    if (userId) {
      localStorage.removeItem(sessionStorageKey(userId));
      return;
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(SESSION_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist the current in-memory DEK so refresh stays unlocked for 6 hours. */
export async function persistKeyringSession(userId: string): Promise<void> {
  if (!dek) return;
  try {
    const dekJwk = await crypto.subtle.exportKey('jwk', dek);
    const blob: SessionBlob = {
      v: 1,
      expiresAt: Date.now() + KEYRING_SESSION_TTL_MS,
      dekJwk,
    };
    localStorage.setItem(sessionStorageKey(userId), JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

/**
 * Restore DEK from localStorage if a non-expired session exists for this user.
 * Returns true when the keyring is unlocked afterwards.
 */
export async function tryRestoreKeyringSession(userId: string): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(sessionStorageKey(userId));
  } catch {
    return false;
  }
  if (!raw) return false;

  try {
    const blob = JSON.parse(raw) as SessionBlob;
    if (blob.v !== 1 || typeof blob.expiresAt !== 'number' || !blob.dekJwk) {
      clearKeyringSession(userId);
      return false;
    }
    if (blob.expiresAt <= Date.now()) {
      clearKeyringSession(userId);
      return false;
    }
    dek = await crypto.subtle.importKey(
      'jwk',
      blob.dekJwk,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    return true;
  } catch {
    clearKeyringSession(userId);
    return false;
  }
}

export async function setupKeyring(password: string): Promise<E2EEMetadata> {
  const { metadata, dek: dataKey } = await createE2EEAccount(password);
  dek = dataKey;
  return metadata;
}

export async function unlockKeyring(user: User, password: string): Promise<void> {
  const metadata = getE2EEMetadata(user);
  if (!metadata) throw new Error('该账号未启用端到端加密');
  const { dek: dataKey } = await unlockE2EEAccount(metadata, password);
  dek = dataKey;
}
