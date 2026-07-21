export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Human-friendly compact duration, e.g. 1h 15m, 9m, 45s. */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  const s = Math.floor((ms % MINUTE) / 1000);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 && m < 5 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/** Relative time from now, e.g. "3m 后" or "已过 5m". */
export function formatRelative(target: number, now: number): string {
  const diff = target - now;
  if (diff >= 0) return `${formatDuration(diff)}后`;
  return `已过 ${formatDuration(-diff)}`;
}

/** Parse a loose ETA string like "1h", "90m", "1h30m", "45s" into ms. */
export function parseEta(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  const re = /(\d+(?:\.\d+)?)\s*(h|m|s)/g;
  let total = 0;
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    matched = true;
    const value = parseFloat(match[1]);
    const unit = match[2];
    total += unit === 'h' ? value * HOUR : unit === 'm' ? value * MINUTE : value * 1000;
  }
  if (!matched) {
    // bare number => minutes
    const n = parseFloat(text);
    if (!Number.isNaN(n)) return n * MINUTE;
    return null;
  }
  return total;
}
