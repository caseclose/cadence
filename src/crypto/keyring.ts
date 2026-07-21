import type { User } from '@supabase/supabase-js';
import {
  createE2EEAccount,
  isE2EEMetadata,
  unlockE2EEAccount,
  type E2EEMetadata,
} from './e2ee';

/** In-memory only — cleared on sign-out or page close. */
let dek: CryptoKey | null = null;

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
