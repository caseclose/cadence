import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearKeyringSession,
  getDek,
  isKeyringUnlocked,
  KEYRING_SESSION_TTL_MS,
  lockKeyring,
  persistKeyringSession,
  setupKeyring,
  tryRestoreKeyringSession,
} from './keyring';

function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const store: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
  });
}

describe('keyring session', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    lockKeyring();
    clearKeyringSession();
  });

  it('persists and restores DEK across lock', async () => {
    await setupKeyring('session-pass-123');
    expect(isKeyringUnlocked()).toBe(true);
    const uid = 'user-session-1';
    await persistKeyringSession(uid);

    lockKeyring();
    expect(isKeyringUnlocked()).toBe(false);

    const ok = await tryRestoreKeyringSession(uid);
    expect(ok).toBe(true);
    expect(isKeyringUnlocked()).toBe(true);
    expect(getDek()).not.toBeNull();
  });

  it('rejects expired session', async () => {
    await setupKeyring('session-pass-456');
    const uid = 'user-session-2';
    await persistKeyringSession(uid);

    const key = `cadence:e2ee-session:${uid}`;
    const blob = JSON.parse(localStorage.getItem(key)!) as {
      v: number;
      expiresAt: number;
    };
    blob.expiresAt = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(blob));

    lockKeyring();
    const ok = await tryRestoreKeyringSession(uid);
    expect(ok).toBe(false);
    expect(isKeyringUnlocked()).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('rejects corrupt DEK that fails probe verification', async () => {
    await setupKeyring('session-pass-789');
    const uid = 'user-session-3';
    await persistKeyringSession(uid);

    const key = `cadence:e2ee-session:${uid}`;
    const blob = JSON.parse(localStorage.getItem(key)!) as {
      v: number;
      expiresAt: number;
      dekJwk: JsonWebKey;
      probeIv: string;
      probeCt: string;
    };
    // Swap in a different AES key while keeping the old probe.
    const other = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    blob.dekJwk = await crypto.subtle.exportKey('jwk', other);
    localStorage.setItem(key, JSON.stringify(blob));

    lockKeyring();
    const ok = await tryRestoreKeyringSession(uid);
    expect(ok).toBe(false);
    expect(isKeyringUnlocked()).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('rejects legacy v1 sessions without probe', async () => {
    await setupKeyring('session-pass-legacy');
    const uid = 'user-session-legacy';
    await persistKeyringSession(uid);
    const key = `cadence:e2ee-session:${uid}`;
    const blob = JSON.parse(localStorage.getItem(key)!) as Record<string, unknown>;
    blob.v = 1;
    delete blob.probeIv;
    delete blob.probeCt;
    localStorage.setItem(key, JSON.stringify(blob));

    lockKeyring();
    const ok = await tryRestoreKeyringSession(uid);
    expect(ok).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('uses a 6-hour TTL', () => {
    expect(KEYRING_SESSION_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });
});
