export type Strategy = 'converging' | 'exponential' | 'recurring';

export type TaskState = 'waiting' | 'due' | 'polling' | 'snoozed' | 'done';

/**
 * A suspended piece of work that the scheduler polls you about,
 * modeled after a process that called yield() and waits to be rescheduled.
 */
export interface Task {
  id: string;
  title: string;
  note?: string;
  strategy: Strategy;
  /** Estimated time-to-completion in ms (the ETA horizon). */
  etaMs: number;
  state: TaskState;
  /** How many times we have already polled you about it. */
  attempts: number;
  /** Absolute epoch ms when the next reminder should fire. */
  nextFireAt: number;
  priority: number;
  createdAt: number;
  updatedAt: number;
  /** Deterministic tie-breaker for concurrent updates with the same timestamp. */
  revision?: string;
  /** Original ETA, preserved when the task is re-estimated. */
  initialEtaMs?: number;
  /** Set once when the task is completed. */
  completedAt?: number;
}

/** Actions you can take, mirroring how a scheduler dispositions a process. */
export type Action =
  | { type: 'checked_not_done' } // looked, still running -> back off
  | { type: 'no_resources' } // too busy to look -> short snooze
  | { type: 'snooze'; durationMs: number } // relative: add to max(now, nextFireAt)
  | { type: 'snooze'; fireAt: number } // absolute target moment (e.g. tomorrow 09:00)
  | { type: 'reestimate'; etaMs: number } // give a fresh ETA -> back to waiting
  | { type: 'reopen' } // undo completion -> back to waiting
  | { type: 'done' }; // finished -> dequeue

export type TaskEventType = 'created' | 'done' | 'checked_not_done' | 'snooze' | 'reestimate' | 'reopen';

export interface TaskTemplate {
  id: string;
  title: string;
  note?: string;
  strategy: Strategy;
  etaMs: number;
  priority?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  type: TaskEventType;
  at: number;
  etaMs?: number;
  durationMs?: number;
}

export interface BackoffConfig {
  /** Floor for any interval, prevents spamming. */
  minIntervalMs: number;
  /** Ceiling for any interval. */
  maxIntervalMs: number;
  /** Converging: first backoff = etaMs * convergingFirstFraction. */
  convergingFirstFraction: number;
  /** Converging: each subsequent interval multiplies by this (<1 => shrinks). */
  convergingDecay: number;
  /** Exponential: base interval for the doubling sequence. */
  exponentialBaseMs: number;
  /** Short snooze used when you have no resources to check. */
  snoozeMs: number;
  /** +/- jitter fraction applied to every interval to avoid collisions. */
  jitterFraction: number;
  /** When now exceeds ETA by this factor, converging shrinks faster. */
  overdueAccelerateAfter: number;
}

export const DEFAULT_BACKOFF: BackoffConfig = {
  minIntervalMs: 5 * 60_000,
  maxIntervalMs: 4 * 60 * 60_000,
  convergingFirstFraction: 0.25,
  convergingDecay: 0.6,
  exponentialBaseMs: 5 * 60_000,
  snoozeMs: 10 * 60_000,
  jitterFraction: 0.1,
  overdueAccelerateAfter: 3,
};
