import type { Task } from '../scheduler/types';
import { sanitizeTasks } from './taskSanitize';

/** True when `incoming` should replace `current` by its timestamp and revision. */
export function isNewerTask(incoming: Task, current: Task): boolean {
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt;
  }
  // New clients attach a random UUID per mutation. Its lexical ordering gives
  // every device the same winner when wall-clock milliseconds collide. Empty
  // legacy revisions intentionally retain the primary list's task.
  return Boolean(incoming.revision) && incoming.revision! > (current.revision ?? '');
}

/**
 * Merge two task lists by id. Legacy rows without a revision retain the first
 * list on a timestamp tie (call with local-first for cache echoes).
 */
export function mergeTasks(primary: Task[], secondary: Task[]): Task[] {
  const byId = new Map<string, Task>();
  for (const t of primary) byId.set(t.id, t);
  for (const t of secondary) {
    const prev = byId.get(t.id);
    if (!prev || isNewerTask(t, prev)) byId.set(t.id, t);
  }
  return sanitizeTasks([...byId.values()]);
}
