import { Task } from '../scheduler/types';

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
    etaMs: row.eta_ms,
    state: row.state,
    attempts: row.attempts,
    nextFireAt: row.next_fire_at,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
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
