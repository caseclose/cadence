import { describe, expect, it } from 'vitest';
import { sanitizeTasks } from './taskSanitize';

describe('sanitizeTasks', () => {
  const valid = {
    id: '1',
    title: 'test',
    strategy: 'converging' as const,
    etaMs: 3600,
    state: 'waiting' as const,
    attempts: 0,
    nextFireAt: 100,
    priority: 0,
    createdAt: 1,
    updatedAt: 1,
  };

  it('returns empty for non-array', () => {
    expect(sanitizeTasks(null)).toEqual([]);
    expect(sanitizeTasks({})).toEqual([]);
  });

  it('drops null and malformed entries', () => {
    expect(sanitizeTasks([null, {}, valid])).toEqual([valid]);
  });

  it('coerces string numbers from Supabase bigint', () => {
    const raw = { ...valid, etaMs: '3600', nextFireAt: '100' };
    expect(sanitizeTasks([raw])[0].etaMs).toBe(3600);
    expect(sanitizeTasks([raw])[0].nextFireAt).toBe(100);
  });
});
