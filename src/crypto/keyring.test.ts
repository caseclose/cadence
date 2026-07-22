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
      v: 1;
      expiresAt: number;
      dekJwk: JsonWebKey;
    };
    blob.expiresAt = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(blob));

    lockKeyring();
    const ok = await tryRestoreKeyringSession(uid);
    expect(ok).toBe(false);
    expect(isKeyringUnlocked()).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('uses a 6-hour TTL', () => {
    expect(KEYRING_SESSION_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });
});
