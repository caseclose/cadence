import { webcrypto } from 'node:crypto';

const crypto = webcrypto;
export interface E2EEMetadata {
  e2ee_v: 1;
  e2ee_priv_enc: string;
  e2ee_dek_wrapped: string;
  e2ee_kdf_salt: string;
}

const bytes = (text: string) => Uint8Array.from(Buffer.from(text, 'base64'));
const b64 = (value: ArrayBuffer | Uint8Array) => Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value)).toString('base64');
const buffer = (value: Uint8Array) => value.slice().buffer as ArrayBuffer;

async function wrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: buffer(salt), iterations: 120_000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function unlockDek(metadata: E2EEMetadata, password: string): Promise<CryptoKey> {
  const packed = bytes(metadata.e2ee_priv_enc);
  const key = await wrappingKey(password, bytes(metadata.e2ee_kdf_salt));
  const privateRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(packed.slice(0, 12)) }, key, buffer(packed.slice(12)));
  const privateKey = await crypto.subtle.importKey('pkcs8', privateRaw, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, buffer(bytes(metadata.e2ee_dek_wrapped)));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function encryptTask(dek: CryptoKey, task: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buffer(iv) }, dek, new TextEncoder().encode(JSON.stringify(task)));
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ciphertext) });
}

export async function decryptTask<T>(dek: CryptoKey, encoded: string): Promise<T> {
  const blob = JSON.parse(encoded) as { v: number; iv: string; ct: string };
  if (blob.v !== 1) throw new Error('Unsupported E2EE payload');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer(bytes(blob.iv)) }, dek, buffer(bytes(blob.ct)));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
