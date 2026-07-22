import type { Task } from '../scheduler/types';
import { asNum } from './taskSanitize';
import { decryptTaskPayload, encryptTaskPayload } from '../crypto/e2ee';

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
  /** Present when task body is E2EE; plaintext columns are placeholders. */
  enc?: string | null;
  /** Last next_fire_at for which a Web Push was sent (server-side dedupe). */
  notified_fire_at?: number | null;
  webhook_title?: string | null;
  webhook_note?: string | null;
}

const PLACEHOLDER_TITLE = '[e2ee]';

export function isEncryptedRow(row: TaskRow): boolean {
  return typeof row.enc === 'string' && row.enc.length > 0;
}

/** Legacy plaintext row → task. */
export function rowToTaskPlain(row: TaskRow): Task {
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

export async function rowToTask(row: TaskRow, dek: CryptoKey | null): Promise<Task | null> {
  if (isEncryptedRow(row)) {
    if (!dek) return null;
    try {
      const task = await decryptTaskPayload(dek, row.enc!);
      return { ...task, id: row.id, updatedAt: asNum(row.updated_at) };
    } catch {
      return null;
    }
  }
  return rowToTaskPlain(row);
}

export function taskToRowPlain(task: Task, userId: string): TaskRow {
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
    enc: null,
    webhook_title: null,
    webhook_note: null,
  };
}

export async function taskToRow(
  task: Task,
  userId: string,
  dek: CryptoKey | null,
  includeWebhookContent = false,
): Promise<TaskRow> {
  if (!dek) return taskToRowPlain(task, userId);
  const enc = await encryptTaskPayload(dek, task);
  // Content stays in enc; expose timing/state so the server can fire Web Push
  // without reading the task body (push copy is generic).
  return {
    id: task.id,
    user_id: userId,
    title: PLACEHOLDER_TITLE,
    note: null,
    strategy: 'converging',
    eta_ms: 0,
    state: task.state,
    attempts: 0,
    next_fire_at: task.nextFireAt,
    priority: 0,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: null,
    enc,
    webhook_title: includeWebhookContent ? task.title : null,
    webhook_note: includeWebhookContent ? task.note ?? null : null,
  };
}
