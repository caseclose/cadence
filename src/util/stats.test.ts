import { describe, expect, it } from 'vitest';
import { summarizeTasks } from './stats';
import type { Task, TaskEvent } from '../scheduler/types';

const task = (id: string, completedAt: number, etaMs = 100): Task => ({
  id, title: id, strategy: 'converging', etaMs, initialEtaMs: etaMs, state: 'done', attempts: 0,
  nextFireAt: completedAt, priority: 0, createdAt: 0, updatedAt: completedAt, completedAt,
});

describe('summarizeTasks', () => {
  it('returns stable empty values without completed tasks', () => {
    expect(summarizeTasks([], [], 0)).toEqual({ completed: 0, medianRatio: null, p90Ratio: null, averageAttempts: 0 });
  });

  it('uses initial ETA and action history for the completed task window', () => {
    const events: TaskEvent[] = [
      { id: '1', taskId: 'a', type: 'created', at: 0 },
      { id: '2', taskId: 'a', type: 'snooze', at: 25 },
      { id: '3', taskId: 'a', type: 'done', at: 100 },
    ];
    const result = summarizeTasks([task('a', 100), task('b', 200)], events, 50);
    expect(result.completed).toBe(2);
    expect(result.medianRatio).toBe(1);
    expect(result.p90Ratio).toBe(2);
    expect(result.averageAttempts).toBe(1);
  });
});
