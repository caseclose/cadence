import {
  Action,
  BackoffConfig,
  DEFAULT_BACKOFF,
  Strategy,
  Task,
} from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Deterministic jitter helper. Given a seed we spread the interval by
 * +/- jitterFraction so multiple tasks don't all fire at the same instant.
 * A separate rng is injectable to keep the engine unit-testable.
 */
function applyJitter(
  intervalMs: number,
  fraction: number,
  rng: () => number,
): number {
  if (fraction <= 0) return intervalMs;
  const delta = (rng() * 2 - 1) * fraction; // [-fraction, +fraction]
  return Math.round(intervalMs * (1 + delta));
}

/**
 * The raw (pre-jitter, pre-clamp) interval for the n-th poll of a task.
 * attempt is 1-based: attempt 1 is the first backoff after the ETA fired.
 */
export function rawInterval(
  strategy: Strategy,
  etaMs: number,
  attempt: number,
  cfg: BackoffConfig,
): number {
  if (strategy === 'exponential') {
    // 5m, 10m, 20m, 40m ... doubling from the base.
    return cfg.exponentialBaseMs * 2 ** Math.max(0, attempt - 1);
  }
  if (strategy === 'recurring') return etaMs;
  // converging: first backoff is a fraction of the ETA, then decays.
  const first = etaMs * cfg.convergingFirstFraction;
  return first * cfg.convergingDecay ** Math.max(0, attempt - 1);
}

/**
 * Compute the next reminder interval for a task after an action.
 * Returns a positive number of milliseconds from `now`.
 */
export function nextInterval(
  task: Task,
  attempt: number,
  now: number,
  cfg: BackoffConfig,
  rng: () => number,
): number {
  let interval = rawInterval(task.strategy, task.etaMs, attempt, cfg);

  // Overdue acceleration: if we are well past the ETA the task is very
  // likely finished, so converge faster by shrinking the interval.
  if (task.strategy === 'converging') {
    const dueAt = task.createdAt + task.etaMs;
    const overdueBy = now - dueAt;
    if (overdueBy > task.etaMs * cfg.overdueAccelerateAfter) {
      interval *= 0.5;
    }
  }

  interval = applyJitter(interval, cfg.jitterFraction, rng);
  return clamp(interval, cfg.minIntervalMs, cfg.maxIntervalMs);
}

/**
 * Core reducer: given a task, an action and the current time, return the
 * next version of the task (new state + nextFireAt + attempts).
 * Pure and deterministic given `rng`.
 */
export function schedule(
  task: Task,
  action: Action,
  now: number,
  cfg: BackoffConfig = DEFAULT_BACKOFF,
  rng: () => number = Math.random,
): Task {
  const base = { ...task, updatedAt: now };

  switch (action.type) {
    case 'done':
      // A recurring reminder is never archived by confirming a round. Keep the
      // cadence anchored to the planned slot, skipping missed intervals.
      if (task.strategy === 'recurring') {
        // Completing a round manually starts the next interval from now. This
        // also prevents early completion from accumulating the old schedule.
        const interval = Math.max(task.etaMs, cfg.minIntervalMs);
        return {
          ...base,
          state: 'waiting',
          attempts: 0,
          completedAt: undefined,
          nextFireAt: now + interval,
        };
      }
      return { ...base, state: 'done', completedAt: now };

    case 'reopen':
      return {
        ...base,
        state: 'waiting',
        attempts: 0,
        completedAt: undefined,
        nextFireAt: now + task.etaMs,
      };

    case 'reestimate': {
      // Fresh ETA: go back to waiting and fire again at the new horizon.
      return {
        ...base,
        state: 'waiting',
        etaMs: action.etaMs,
        attempts: 0,
        nextFireAt: now + action.etaMs,
      };
    }

    case 'no_resources': {
      // You were too busy to look. Short snooze that does NOT consume the
      // backoff sequence, so we come back soon when you might be free.
      const snooze = applyJitter(
        cfg.snoozeMs,
        cfg.jitterFraction,
        rng,
      );
      return {
        ...base,
        state: 'snoozed',
        nextFireAt: now + clamp(snooze, cfg.minIntervalMs, cfg.maxIntervalMs),
      };
    }

    case 'snooze': {
      // Absolute target (e.g. "tomorrow 09:00"): keep the wall-clock moment.
      // If already past, roll forward one day at a time, then floor at now+minInterval.
      if ('fireAt' in action) {
        let fireAt = action.fireAt;
        const day = 24 * 60 * 60_000;
        while (fireAt <= now) fireAt += day;
        return {
          ...base,
          state: 'snoozed',
          nextFireAt: Math.max(fireAt, now + cfg.minIntervalMs),
        };
      }
      // Relative snooze (+10m / +1h): extend from the later of now and the
      // scheduled fire — never shrink remaining time when the modal is opened early.
      // Floor duration at minIntervalMs only; do NOT cap at maxIntervalMs / apply jitter
      // (unlike no_resources). Overdue tasks must use `now`, otherwise
      // nextFireAt + 10m would under-shoot (e.g. overdue 4m → shows ~6m left).
      const durationMs = 'durationMs' in action ? action.durationMs : cfg.minIntervalMs;
      const duration = Math.max(durationMs, cfg.minIntervalMs);
      const baseFireAt = Math.max(now, task.nextFireAt);
      return {
        ...base,
        state: 'snoozed',
        nextFireAt: baseFireAt + duration,
      };
    }

    case 'checked_not_done': {
      if (task.strategy === 'recurring') {
        // Skipping a round also starts the next interval from the response time.
        return {
          ...base,
          state: 'waiting',
          attempts: 0,
          nextFireAt: now + Math.max(task.etaMs, cfg.minIntervalMs),
        };
      }
      const attempt = task.attempts + 1;
      return {
        ...base,
        state: 'polling',
        attempts: attempt,
        nextFireAt: now + nextInterval(task, attempt, now, cfg, rng),
      };
    }
  }
}

/**
 * Build the initial task record when you first suspend a piece of work.
 * The first reminder fires exactly at the ETA horizon.
 */
export function createTask(
  input: {
    id: string;
    title: string;
    note?: string;
    strategy: Strategy;
    etaMs: number;
    priority?: number;
  },
  now: number,
): Task {
  return {
    id: input.id,
    title: input.title,
    note: input.note,
    strategy: input.strategy,
    etaMs: input.etaMs,
    state: 'waiting',
    attempts: 0,
    nextFireAt: now + input.etaMs,
    priority: input.priority ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}
