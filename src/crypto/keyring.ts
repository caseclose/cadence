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
const SESSION_PROBE = 'cadence-e2ee-session-v1';

interface SessionBlob {
  v: 2;
  expiresAt: number;
  dekJwk: JsonWebKey;
  /** AES-GCM sealed SESSION_PROBE — proves the restored DEK is the one we saved. */
  probeIv: string;
  probeCt: string;
}

/** In-memory DEK — also mirrored to localStorage for KEYRING_SESSION_TTL_MS. */
let dek: CryptoKey | null = null;

function sessionStorageKey(userId: string): string {
  return `${SESSION_PREFIX}${userId}`;
}

function b64Encode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function b64Decode(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toAb(u8: Uint8Array): ArrayBuffer {
  return u8.slice().buffer;
}

async function sealSessionProbe(key: CryptoKey): Promise<{ probeIv: string; probeCt: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(SESSION_PROBE),
  );
  return { probeIv: b64Encode(iv), probeCt: b64Encode(ct) };
}

async function verifySessionProbe(
  key: CryptoKey,
  probeIv: string,
  probeCt: string,
): Promise<boolean> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toAb(b64Decode(probeIv)) },
      key,
      toAb(b64Decode(probeCt)),
    );
    return new TextDecoder().decode(plain) === SESSION_PROBE;
  } catch {
    return false;
  }
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
    const probe = await sealSessionProbe(dek);
    const blob: SessionBlob = {
      v: 2,
      expiresAt: Date.now() + KEYRING_SESSION_TTL_MS,
      dekJwk,
      ...probe,
    };
    localStorage.setItem(sessionStorageKey(userId), JSON.stringify(blob));
  } catch {
    /* ignore */
  }
}

/**
 * Restore DEK from localStorage if a non-expired session exists for this user.
 * Verifies a sealed probe so a corrupt/wrong DEK never unlocks the vault.
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
    const blob = JSON.parse(raw) as Partial<SessionBlob>;
    if (
      blob.v !== 2 ||
      typeof blob.expiresAt !== 'number' ||
      !blob.dekJwk ||
      typeof blob.probeIv !== 'string' ||
      typeof blob.probeCt !== 'string'
    ) {
      clearKeyringSession(userId);
      return false;
    }
    if (blob.expiresAt <= Date.now()) {
      clearKeyringSession(userId);
      return false;
    }
    const candidate = await crypto.subtle.importKey(
      'jwk',
      blob.dekJwk,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const ok = await verifySessionProbe(candidate, blob.probeIv, blob.probeCt);
    if (!ok) {
      clearKeyringSession(userId);
      return false;
    }
    dek = candidate;
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
