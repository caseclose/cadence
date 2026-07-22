import { describe, expect, it } from 'vitest';
import { createE2EEAccount } from '../crypto/e2ee';
import type { Task } from '../scheduler/types';
import { isEncryptedRow, rowToTask, taskToRow, taskToRowPlain } from './mapping';

const sampleTask: Task = {
  id: '11111111-1111-1111-1111-111111111111',
  title: '私密任务标题',
  note: '秘密备注',
  strategy: 'exponential',
  etaMs: 3_600_000,
  state: 'polling',
  attempts: 2,
  nextFireAt: 1_700_000_000_000,
  priority: 1,
  createdAt: 1_600_000_000_000,
  updatedAt: 1_650_000_000_000,
};

describe('mapping', () => {
  it('plain row round-trips', () => {
    const row = taskToRowPlain(sampleTask, 'user-1');
    expect(row.title).toBe('私密任务标题');
    expect(row.next_fire_at).toBe(sampleTask.nextFireAt);
    expect(isEncryptedRow(row)).toBe(false);
  });

  it(
    'encrypted row exposes next_fire_at and state, hides title',
    async () => {
      const { dek } = await createE2EEAccount('mapping-test-pass');
      const row = await taskToRow(sampleTask, 'user-1', dek);

      expect(isEncryptedRow(row)).toBe(true);
      expect(row.title).toBe('[e2ee]');
      expect(row.note).toBeNull();
      expect(row.next_fire_at).toBe(sampleTask.nextFireAt);
      expect(row.state).toBe(sampleTask.state);
      expect(row.strategy).toBe('converging');
      expect(row.eta_ms).toBe(0);

      const back = await rowToTask(row, dek);
      expect(back?.title).toBe('私密任务标题');
      expect(back?.note).toBe('秘密备注');
      expect(back?.nextFireAt).toBe(sampleTask.nextFireAt);
      expect(back?.state).toBe('polling');
    },
    15_000,
  );

  it(
    'encrypted row prefers plaintext next_fire_at over stale enc payload',
    async () => {
      const { dek } = await createE2EEAccount('mapping-stale-enc');
      const row = await taskToRow(sampleTask, 'user-1', dek);
      const freshFireAt = sampleTask.nextFireAt + 10 * 60_000;
      row.next_fire_at = freshFireAt;
      row.state = 'snoozed';

      const back = await rowToTask(row, dek);
      expect(back?.nextFireAt).toBe(freshFireAt);
      expect(back?.state).toBe('snoozed');
      expect(back?.title).toBe('私密任务标题');
    },
    15_000,
  );
});