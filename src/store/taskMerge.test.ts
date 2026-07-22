import { describe, expect, it } from 'vitest';
import type { Task } from '../scheduler/types';
import { isNewerTask, mergeTasks } from './taskMerge';

function task(partial: Partial<Task> & Pick<Task, 'id' | 'updatedAt' | 'nextFireAt'>): Task {
  return {
    title: 't',
    strategy: 'converging',
    etaMs: 60_000,
    state: 'waiting',
    attempts: 0,
    priority: 0,
    createdAt: 0,
    ...partial,
  };
}

describe('isNewerTask', () => {
  it('orders timestamps, then revisions when timestamps tie', () => {
    const a = task({ id: '1', updatedAt: 10, nextFireAt: 100 });
    const b = task({ id: '1', updatedAt: 10, nextFireAt: 200 });
    const c = task({ id: '1', updatedAt: 11, nextFireAt: 50 });
    const d = task({ id: '1', updatedAt: 10, revision: 'z', nextFireAt: 300 });
    const e = task({ id: '1', updatedAt: 10, revision: 'a', nextFireAt: 400 });
    expect(isNewerTask(b, a)).toBe(false);
    expect(isNewerTask(c, a)).toBe(true);
    expect(isNewerTask(d, e)).toBe(true);
    expect(isNewerTask(e, d)).toBe(false);
  });
});

describe('mergeTasks', () => {
  it('keeps primary on equal updatedAt so a stale remote echo cannot roll back nextFireAt', () => {
    const local = task({ id: '1', updatedAt: 100, nextFireAt: 1_000 + 10 * 60_000 });
    const staleRemote = task({ id: '1', updatedAt: 100, nextFireAt: 1_000 - 4 * 60_000 });
    const merged = mergeTasks([local], [staleRemote]);
    expect(merged).toHaveLength(1);
    expect(merged[0].nextFireAt).toBe(local.nextFireAt);
  });

  it('converges on the same winner for equal-timestamp versions', () => {
    const first = task({ id: '1', updatedAt: 100, revision: 'a', nextFireAt: 500 });
    const second = task({ id: '1', updatedAt: 100, revision: 'b', nextFireAt: 900 });
    expect(mergeTasks([first], [second])[0].nextFireAt).toBe(900);
    expect(mergeTasks([second], [first])[0].nextFireAt).toBe(900);
  });
});
