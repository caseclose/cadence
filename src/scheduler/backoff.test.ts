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
  it('when already due, uses now + duration without jitter or consuming attempts', () => {
    const task = createTask({ id: 's', title: 'wait', strategy: 'converging', etaMs: 60 * MIN }, 0);
    const now = 1_700_000_000_000; // well past task.nextFireAt
    const tenMin = schedule(task, { type: 'snooze', durationMs: 10 * MIN }, now, DEFAULT_BACKOFF, () => 0);
    expect(tenMin.nextFireAt).toBe(now + 10 * MIN);
    expect(tenMin.state).toBe('snoozed');
    expect(tenMin.attempts).toBe(0);
    expect(tenMin.etaMs).toBe(60 * MIN);

    const oneHour = schedule(task, { type: 'snooze', durationMs: 60 * MIN }, now, DEFAULT_BACKOFF, () => 0);
    expect(oneHour.nextFireAt).toBe(now + 60 * MIN);
  });

  it('when not yet due, adds duration onto nextFireAt instead of resetting to now', () => {
    const createdAt = 1_000_000;
    const task = createTask(
      { id: 's', title: 'wait', strategy: 'converging', etaMs: 2 * 60 * MIN },
      createdAt,
    );
    // Open the modal early (e.g. "view now") while ~2h remain.
    const now = createdAt + 5 * MIN;
    expect(task.nextFireAt).toBeGreaterThan(now);

    const snoozed = schedule(
      task,
      { type: 'snooze', durationMs: 10 * MIN },
      now,
      DEFAULT_BACKOFF,
      noJitter,
    );
    expect(snoozed.nextFireAt).toBe(task.nextFireAt + 10 * MIN);
    expect(snoozed.nextFireAt).not.toBe(now + 10 * MIN);
    expect(snoozed.etaMs).toBe(2 * 60 * MIN);
    expect(snoozed.attempts).toBe(0);
  });

  it('floors a relative snooze duration to minIntervalMs only', () => {
    const task = createTask({ id: 's', title: 'wait', strategy: 'converging', etaMs: 60 * MIN }, 0);
    // Already due: base is now, duration floors to minInterval.
    const due = { ...task, nextFireAt: 0 };
    const snoozed = schedule(due, { type: 'snooze', durationMs: 1 }, 0);
    expect(snoozed.nextFireAt).toBe(DEFAULT_BACKOFF.minIntervalMs);
  });

  it('honors an absolute fireAt without stacking onto nextFireAt', () => {
    const createdAt = Date.UTC(2026, 6, 22, 4, 0, 0); // 12:00 CST
    const task = createTask(
      { id: 's', title: 'wait', strategy: 'converging', etaMs: 2 * 60 * MIN },
      createdAt,
    );
    const now = createdAt + 5 * MIN;
    const tomorrow9 = Date.UTC(2026, 6, 23, 1, 0, 0); // 09:00 CST next day
    expect(tomorrow9 - now).toBeGreaterThan(DEFAULT_BACKOFF.maxIntervalMs);

    const snoozed = schedule(
      task,
      { type: 'snooze', fireAt: tomorrow9 },
      now,
      DEFAULT_BACKOFF,
      noJitter,
    );
    // Absolute target — not max(now, nextFireAt) + (tomorrow9 - now).
    expect(snoozed.nextFireAt).toBe(tomorrow9);
    expect(snoozed.etaMs).toBe(2 * 60 * MIN);
  });

  it('rolls a past absolute fireAt forward a day and floors at now+minInterval', () => {
    const now = Date.UTC(2026, 6, 22, 2, 0, 0); // 10:00 CST
    const past9 = Date.UTC(2026, 6, 22, 1, 0, 0); // 09:00 CST today (already past)
    const task = createTask({ id: 's', title: 'wait', strategy: 'converging', etaMs: 60 * MIN }, 0);

    const snoozed = schedule(
      task,
      { type: 'snooze', fireAt: past9 },
      now,
      DEFAULT_BACKOFF,
      noJitter,
    );
    const nextDay9 = past9 + 24 * 60 * 60_000;
    expect(snoozed.nextFireAt).toBe(Math.max(nextDay9, now + DEFAULT_BACKOFF.minIntervalMs));
    expect(snoozed.nextFireAt).toBe(nextDay9);
  });
});
