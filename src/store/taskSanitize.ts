import { Strategy, Task, TaskState } from '../scheduler/types';

const VALID_STATES = new Set<TaskState>(['waiting', 'due', 'polling', 'snoozed', 'done']);
const VALID_STRATEGIES = new Set<Strategy>(['converging', 'exponential']);

export function asNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function isTaskLike(v: unknown): v is Task {
  if (!v || typeof v !== 'object') return false;
  const t = v as Task;
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    VALID_STRATEGIES.has(t.strategy) &&
    VALID_STATES.has(t.state) &&
    Number.isFinite(asNum(t.etaMs)) &&
    Number.isFinite(asNum(t.nextFireAt)) &&
    Number.isFinite(asNum(t.attempts)) &&
    Number.isFinite(asNum(t.priority)) &&
    Number.isFinite(asNum(t.createdAt)) &&
    Number.isFinite(asNum(t.updatedAt))
  );
}

/** Drop nulls and malformed entries so render/ticker never crash. */
export function sanitizeTasks(data: unknown): Task[] {
  if (!Array.isArray(data)) return [];
  const out: Task[] = [];
  for (const item of data) {
    if (!isTaskLike(item)) continue;
    out.push({
      ...item,
      etaMs: asNum(item.etaMs),
      ...(item.initialEtaMs === undefined ? {} : { initialEtaMs: asNum(item.initialEtaMs, asNum(item.etaMs)) }),
      attempts: asNum(item.attempts),
      nextFireAt: asNum(item.nextFireAt),
      priority: asNum(item.priority),
      createdAt: asNum(item.createdAt),
      updatedAt: asNum(item.updatedAt),
      ...(typeof item.revision === 'string' ? { revision: item.revision } : {}),
      ...(item.completedAt === undefined || item.completedAt === null ? {} : { completedAt: asNum(item.completedAt) }),
    });
  }
  return out;
}
