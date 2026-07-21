import { Task } from './types';

export interface TickerOptions {
  /** How often to scan for due tasks. Defaults to 15s. */
  intervalMs?: number;
  /** Returns the current set of live (non-done) tasks. */
  getTasks: () => Task[];
  /** Called once per task that has crossed its nextFireAt. */
  onDue: (task: Task) => void;
  /** Injectable clock for testing. */
  now?: () => number;
}

/**
 * A single wall-clock loop that compares each task's nextFireAt against the
 * current time. We use timestamp comparison (not per-task setTimeout) so the
 * loop is robust to sleep/wake, tab throttling and clock drift.
 */
export function startTicker(opts: TickerOptions): () => void {
  const intervalMs = opts.intervalMs ?? 15_000;
  const now = opts.now ?? (() => Date.now());
  const fired = new Set<string>();

  const scan = () => {
    const t = now();
    for (const task of opts.getTasks()) {
      if (task.state === 'done') {
        fired.delete(task.id);
        continue;
      }
      if (task.nextFireAt <= t) {
        // Guard against firing repeatedly before the store updates the task.
        const key = `${task.id}:${task.nextFireAt}`;
        if (fired.has(key)) continue;
        fired.add(key);
        opts.onDue(task);
      }
    }
  };

  scan();
  const handle = setInterval(scan, intervalMs);
  return () => clearInterval(handle);
}
