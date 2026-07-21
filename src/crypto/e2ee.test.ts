import { describe, expect, it } from 'vitest';
import type { Task } from '../scheduler/types';
import {
  createE2EEAccount,
  decryptTaskPayload,
  encryptTaskPayload,
  unlockE2EEAccount,
} from './e2ee';

const sampleTask: Task = {
  id: 't1',
  title: '投递快手',
  note: '私密备注',
  strategy: 'converging',
  etaMs: 1_800_000,
  state: 'waiting',
  attempts: 0,
  nextFireAt: Date.now() + 1_800_000,
  priority: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('e2ee', () => {
  it('creates account and unlocks with same password', async () => {
    const { metadata, dek } = await createE2EEAccount('test-pass-123');
    expect(metadata.e2ee_public_jwk.kty).toBe('RSA');

    const enc = await encryptTaskPayload(dek, sampleTask);
    const plain = await decryptTaskPayload(dek, enc);
    expect(plain.title).toBe('投递快手');
    expect(plain.note).toBe('私密备注');

    const unlocked = await unlockE2EEAccount(metadata, 'test-pass-123');
    const again = await decryptTaskPayload(unlocked.dek, enc);
    expect(again.title).toBe('投递快手');
  });

  it('fails unlock with wrong password', async () => {
    const { metadata } = await createE2EEAccount('right-password');
    await expect(unlockE2EEAccount(metadata, 'wrong-password')).rejects.toThrow();
  });
});
