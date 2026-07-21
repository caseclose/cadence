import { Task } from '../scheduler/types';
import { asNum } from './taskSanitize';

/** DB row shape (snake_case) as stored in Supabase. */
export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  strategy: Task['strategy'];
  eta_ms: number;
  state: Task['state'];
  attempts: number;
  next_fire_at: number;
  priority: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? undefined,
    strategy: row.strategy,
    etaMs: asNum(row.eta_ms),
    state: row.state,
    attempts: asNum(row.attempts),
    nextFireAt: asNum(row.next_fire_at),
    priority: asNum(row.priority),
    createdAt: asNum(row.created_at),
    updatedAt: asNum(row.updated_at),
    completedAt:
      row.completed_at === null || row.completed_at === undefined
        ? undefined
        : asNum(row.completed_at),
  };
}

export function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    note: task.note ?? null,
    strategy: task.strategy,
    eta_ms: task.etaMs,
    state: task.state,
    attempts: task.attempts,
    next_fire_at: task.nextFireAt,
    priority: task.priority,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt ?? null,
  };
}
