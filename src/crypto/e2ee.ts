/**
 * Client-side end-to-end encryption (E2EE) for cloud-synced tasks.
 *
 * Model:
 * - RSA-OAEP key pair per user; public key may live in Supabase metadata.
 * - Private key is encrypted with a password-derived AES key (PBKDF2) and
 *   stored locally; a copy can be synced in user_metadata for multi-device.
 * - A random AES data key (DEK) encrypts task payloads; DEK is RSA-wrapped.
 * - Supabase only ever sees ciphertext in `tasks.enc`.
 */

import type { Task } from '../scheduler/types';

export const E2EE_VERSION = 1;
export const PBKDF2_ITERATIONS = 120_000;

export interface E2EEMetadata {
  e2ee_v: typeof E2EE_VERSION;
  e2ee_public_jwk: JsonWebKey;
  e2ee_priv_enc: string;
  e2ee_dek_wrapped: string;
  e2ee_kdf_salt: string;
}

export interface EncryptedBlob {
  v: typeof E2EE_VERSION;
  iv: string;
  ct: string;
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

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

/** Copy into a standalone ArrayBuffer for Web Crypto typings. */
function ab(u8: Uint8Array): ArrayBuffer {
  return u8.slice().buffer;
}

export function isE2EEMetadata(meta: unknown): meta is E2EEMetadata {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return (
    m.e2ee_v === E2EE_VERSION &&
    typeof m.e2ee_public_jwk === 'object' &&
    typeof m.e2ee_priv_enc === 'string' &&
    typeof m.e2ee_dek_wrapped === 'string' &&
    typeof m.e2ee_kdf_salt === 'string'
  );
}

async function deriveWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ab(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function exportPrivateKeyPkcs8(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('pkcs8', key);
}

async function importPrivateKeyPkcs8(pkcs8: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt'],
  );
}

export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function wrapPrivateKeyWithPassword(
  privateKey: CryptoKey,
  password: string,
): Promise<{ salt: string; encrypted: string }> {
  const salt = randomBytes(16);
  const wrapKey = await deriveWrappingKey(password, salt);
  const iv = randomBytes(12);
  const pkcs8 = await exportPrivateKeyPkcs8(privateKey);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(iv) }, wrapKey, pkcs8);
  const packed = new Uint8Array(iv.length + ct.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ct), iv.length);
  return { salt: b64Encode(salt), encrypted: b64Encode(packed) };
}

export async function unwrapPrivateKeyWithPassword(
  encrypted: string,
  saltB64: string,
  password: string,
): Promise<CryptoKey> {
  const salt = b64Decode(saltB64);
  const wrapKey = await deriveWrappingKey(password, salt);
  const packed = b64Decode(encrypted);
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ab(iv) }, wrapKey, ab(ct));
  return importPrivateKeyPkcs8(pkcs8);
}

export async function wrapDekWithPublicKey(dek: CryptoKey, publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', dek);
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw);
  return b64Encode(wrapped);
}

export async function unwrapDekWithPrivateKey(wrappedB64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const wrapped = b64Decode(wrappedB64);
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, ab(wrapped));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptTaskPayload(dek: CryptoKey, task: Task): Promise<string> {
  const iv = randomBytes(12);
  const plain = new TextEncoder().encode(JSON.stringify(task));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(iv) }, dek, plain);
  const blob: EncryptedBlob = { v: E2EE_VERSION, iv: b64Encode(iv), ct: b64Encode(ct) };
  return JSON.stringify(blob);
}

export async function decryptTaskPayload(dek: CryptoKey, enc: string): Promise<Task> {
  const blob = JSON.parse(enc) as EncryptedBlob;
  if (blob.v !== E2EE_VERSION) throw new Error('unsupported e2ee version');
  const iv = b64Decode(blob.iv);
  const ct = b64Decode(blob.ct);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ab(iv) }, dek, ab(ct));
  return JSON.parse(new TextDecoder().decode(plain)) as Task;
}

/** Create metadata + in-memory keys for a new account. */
export async function createE2EEAccount(password: string): Promise<{
  metadata: E2EEMetadata;
  dek: CryptoKey;
  privateKey: CryptoKey;
}> {
  const pair = await generateRsaKeyPair();
  const dek = await generateDek();
  const { salt, encrypted } = await wrapPrivateKeyWithPassword(pair.privateKey, password);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const dekWrapped = await wrapDekWithPublicKey(dek, pair.publicKey);
  return {
    metadata: {
      e2ee_v: E2EE_VERSION,
      e2ee_public_jwk: publicJwk,
      e2ee_priv_enc: encrypted,
      e2ee_dek_wrapped: dekWrapped,
      e2ee_kdf_salt: salt,
    },
    dek,
    privateKey: pair.privateKey,
  };
}

/** Unlock an existing account from metadata + password. */
export async function unlockE2EEAccount(
  metadata: E2EEMetadata,
  password: string,
): Promise<{ dek: CryptoKey; privateKey: CryptoKey }> {
  const privateKey = await unwrapPrivateKeyWithPassword(
    metadata.e2ee_priv_enc,
    metadata.e2ee_kdf_salt,
    password,
  );
  const dek = await unwrapDekWithPrivateKey(metadata.e2ee_dek_wrapped, privateKey);
  return { dek, privateKey };
}
