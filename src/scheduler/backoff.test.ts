import { describe, expect, it } from 'vitest';
import { createTask, schedule } from './backoff';
import { DEFAULT_BACKOFF } from './types';

const MIN = 60_000;
const noJitter = () => 0.5; // rng=0.5 => zero jitter delta

describe('createTask', () => {
  it('fires the first reminder at the ETA horizon', () => {
    const now = 1_000_000;
    const t = createTask(
      { id: 'a', title: 'train', strategy: 'converging', etaMs: 60 * MIN },
      now,
    );
    expect(t.state).toBe('waiting');
    expect(t.nextFireAt).toBe(now + 60 * MIN);
    expect(t.attempts).toBe(0);
  });
});

describe('converging backoff', () => {
  it('shrinks intervals across successive "still not done" checks', () => {
    const now = 0;
    let t = createTask(
      { id: 'a', title: 'train', strategy: 'converging', etaMs: 60 * MIN },
      now,
    );
    const intervals: number[] = [];
    let clock = t.nextFireAt;
    for (let i = 0; i < 4; i++) {
      t = schedule(t, { type: 'checked_not_done' }, clock, DEFAULT_BACKOFF, noJitter);
      intervals.push(t.nextFireAt - clock);
      clock = t.nextFireAt;
    }
    // 15m, 9m, 5.4m->floored 5m, 5m
    expect(intervals[0]).toBe(15 * MIN);
    expect(intervals[1]).toBe(9 * MIN);
    expect(intervals[0]).toBeGreaterThan(intervals[1]);
    // never below the floor
    for (const iv of intervals) {
      expect(iv).toBeGreaterThanOrEqual(DEFAULT_BACKOFF.minIntervalMs);
    }
  });
});

describe('exponential backoff', () => {
  it('doubles intervals for tasks without a reliable ETA', () => {
    const now = 0;
    let t = createTask(
      { id: 'p', title: 'wait for person', strategy: 'exponential', etaMs: 30 * MIN },
      now,
    );
    const intervals: number[] = [];
    let clock = t.nextFireAt;
    for (let i = 0; i < 4; i++) {
      t = schedule(t, { type: 'checked_not_done' }, clock, DEFAULT_BACKOFF, noJitter);
      intervals.push(t.nextFireAt - clock);
      clock = t.nextFireAt;
    }
    expect(intervals[0]).toBe(5 * MIN);
    expect(intervals[1]).toBe(10 * MIN);
    expect(intervals[2]).toBe(20 * MIN);
    expect(intervals[3]).toBe(40 * MIN);
  });

  it('caps at maxIntervalMs', () => {
    const now = 0;
    let t = createTask(
      { id: 'p', title: 'wait', strategy: 'exponential', etaMs: MIN },
      now,
    );
    let clock = t.nextFireAt;
    for (let i = 0; i < 12; i++) {
      t = schedule(t, { type: 'checked_not_done' }, clock, DEFAULT_BACKOFF, noJitter);
      clock = t.nextFireAt;
    }
    const last = t.nextFireAt - (clock - (t.nextFireAt - clock));
    expect(t.nextFireAt).toBeLessThanOrEqual(clock + DEFAULT_BACKOFF.maxIntervalMs);
    expect(last).toBeLessThanOrEqual(DEFAULT_BACKOFF.maxIntervalMs);
  });
});

describe('no_resources snooze', () => {
  it('uses a short snooze and does not consume the backoff sequence', () => {
    const now = 0;
    let t = createTask(
      { id: 'a', title: 'train', strategy: 'converging', etaMs: 60 * MIN },
      now,
    );
    t = schedule(t, { type: 'no_resources' }, now, DEFAULT_BACKOFF, noJitter);
    expect(t.state).toBe('snoozed');
    expect(t.attempts).toBe(0);
    expect(t.nextFireAt).toBe(now + DEFAULT_BACKOFF.snoozeMs);
  });
});

describe('reestimate and done', () => {
  it('reestimate resets to waiting at the new horizon', () => {
    const now = 100;
    let t = createTask(
      { id: 'a', title: 'train', strategy: 'converging', etaMs: 60 * MIN },
      now,
    );
    t = schedule(t, { type: 'checked_not_done' }, now + 60 * MIN, DEFAULT_BACKOFF, noJitter);
    const at = now + 60 * MIN + 1;
    t = schedule(t, { type: 'reestimate', etaMs: 30 * MIN }, at, DEFAULT_BACKOFF, noJitter);
    expect(t.state).toBe('waiting');
    expect(t.attempts).toBe(0);
    expect(t.etaMs).toBe(30 * MIN);
    expect(t.nextFireAt).toBe(at + 30 * MIN);
  });

  it('done marks completion', () => {
    const now = 100;
    let t = createTask(
      { id: 'a', title: 'train', strategy: 'converging', etaMs: MIN },
      now,
    );
    t = schedule(t, { type: 'done' }, now + MIN, DEFAULT_BACKOFF, noJitter);
    expect(t.state).toBe('done');
    expect(t.completedAt).toBe(now + MIN);
  });

  it('reopen restores a completed task to waiting', () => {
    const now = 100;
    let t = createTask(
      { id: 'a', title: 'train', strategy: 'converging', etaMs: MIN, note: 'ctx' },
      now,
    );
    t = schedule(t, { type: 'checked_not_done' }, now + MIN, DEFAULT_BACKOFF, noJitter);
    expect(t.attempts).toBe(1);
    t = schedule(t, { type: 'done' }, now + 2 * MIN, DEFAULT_BACKOFF, noJitter);
    t = schedule(t, { type: 'reopen' }, now + 3 * MIN, DEFAULT_BACKOFF, noJitter);
    expect(t.state).toBe('waiting');
    expect(t.attempts).toBe(0);
    expect(t.completedAt).toBeUndefined();
    expect(t.nextFireAt).toBe(now + 3 * MIN + MIN);
    expect(t.note).toBe('ctx');
  });
});


describe('explicit snooze', () => {
  it('uses the requested duration without jitter or consuming attempts', () => {
    const task = createTask({ id: 's', title: 'wait', strategy: 'converging', etaMs: 60 * MIN }, 0);
    const snoozed = schedule(task, { type: 'snooze', durationMs: 60 * MIN }, 123, DEFAULT_BACKOFF, () => 0);
    expect(snoozed.nextFireAt).toBe(123 + 60 * MIN);
    expect(snoozed.attempts).toBe(0);
  });

  it('clamps an explicit snooze to scheduler bounds', () => {
    const task = createTask({ id: 's', title: 'wait', strategy: 'converging', etaMs: 60 * MIN }, 0);
    const snoozed = schedule(task, { type: 'snooze', durationMs: 1 }, 0);
    expect(snoozed.nextFireAt).toBe(DEFAULT_BACKOFF.minIntervalMs);
  });
});
