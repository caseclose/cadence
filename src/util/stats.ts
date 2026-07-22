import type { Task, TaskEvent } from '../scheduler/types';

export interface TaskStats {
  completed: number;
  medianRatio: number | null;
  p90Ratio: number | null;
  averageAttempts: number;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? null;
}

export function summarizeTasks(tasks: Task[], events: TaskEvent[], since: number): TaskStats {
  const completed = tasks.filter((task) => task.state === 'done' && (task.completedAt ?? 0) >= since);
  const ratios = completed.map((task) => {
    const actual = Math.max(0, (task.completedAt ?? task.updatedAt) - task.createdAt);
    return actual / Math.max(task.initialEtaMs ?? task.etaMs, 1);
  });
  const attempts = completed.map((task) => events.filter((event) => event.taskId === task.id && event.type !== 'created').length);
  return {
    completed: completed.length,
    medianRatio: percentile(ratios, 0.5),
    p90Ratio: percentile(ratios, 0.9),
    averageAttempts: attempts.length ? attempts.reduce((a, b) => a + b, 0) / attempts.length : 0,
  };
}
