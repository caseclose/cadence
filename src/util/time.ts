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

/** Local clock time, e.g. 14:30. */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Relative time from now, e.g. "3m 后" or "已过 5m". */
export function formatRelative(target: number, now: number): string {
  const diff = target - now;
  if (diff >= 0) return `${formatDuration(diff)}后`;
  return `已过 ${formatDuration(-diff)}`;
}

export interface ParsedWhen {
  /** Milliseconds from `now` until the reminder should fire. */
  etaMs: number;
  /** Absolute fire time (epoch ms). */
  fireAt: number;
  /** How the input was interpreted. */
  kind: 'duration' | 'clock';
}

/** Parse relative duration like "1h", "90m", "1h30m". */
export function parseDuration(input: string): number | null {
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
    const n = parseFloat(text);
    if (!Number.isNaN(n) && /^\d+(?:\.\d+)?$/.test(text)) return n * MINUTE;
    return null;
  }
  return total;
}

function atLocalTime(now: number, hour: number, minute: number): number {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Next occurrence of hour:minute strictly after `now`. */
function nextClock(now: number, hour: number, minute: number): number {
  let t = atLocalTime(now, hour, minute);
  if (t <= now) t += 24 * HOUR;
  return t;
}

/**
 * Parse absolute clock input into the next future local timestamp.
 * Supports 14:00, 3pm, 下午3点, 晚上8点半, etc.
 */
export function parseClock(input: string, now = Date.now()): number | null {
  let text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!text) return null;

  // 14:00 / 9:05 / 14：30
  let m = text.match(/^(\d{1,2})[:：](\d{2})$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour <= 23 && minute <= 59) return nextClock(now, hour, minute);
    return null;
  }

  // 3pm / 3:30pm
  m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const mer = m[3];
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (mer === 'pm' && hour !== 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    return nextClock(now, hour, minute);
  }

  // 下午3点 / 下午3点半 / 下午3点30 / 晚上8点15分
  m = text.match(/^(上午|早上|凌晨|中午|下午|晚上)(\d{1,2})点(?:(\d{1,2})分?|半)?$/);
  if (m) {
    const part = m[1];
    let hour = parseInt(m[2], 10);
    let minute = 0;
    if (text.includes('点半')) minute = 30;
    else if (m[3]) minute = parseInt(m[3], 10);
    if (hour < 1 || hour > 12 || minute > 59) return null;

    if (part === '中午') {
      hour = 12;
      minute = 0;
    } else if (part === '下午' || part === '晚上') {
      if (hour !== 12) hour += 12;
    } else if (part === '凌晨' && hour === 12) {
      hour = 0;
    }

    return nextClock(now, hour, minute);
  }

  // 3点 / 3点半 — pick the soonest plausible next occurrence (am or pm).
  m = text.match(/^(\d{1,2})点(?:(\d{1,2})分?|半)?$/);
  if (m) {
    let hour = parseInt(m[1], 10);
    let minute = 0;
    if (text.includes('点半')) minute = 30;
    else if (m[2]) minute = parseInt(m[2], 10);
    if (hour > 23 || minute > 59) return null;

    if (hour >= 13) return nextClock(now, hour, minute);

    const candidates: number[] = [];
    candidates.push(nextClock(now, hour, minute));
    if (hour <= 12) {
      const pmHour = hour === 12 ? 12 : hour + 12;
      candidates.push(nextClock(now, pmHour, minute));
    }
    const future = candidates.filter((t) => t > now);
    if (future.length === 0) return null;
    return Math.min(...future);
  }

  return null;
}

/**
 * Parse either a relative duration or an absolute clock time into ms-from-now.
 * Examples: 1h, 90m, 14:00, 下午3点, 3pm — all become "how long until reminder".
 */
export function parseWhen(input: string, now = Date.now()): ParsedWhen | null {
  const duration = parseDuration(input);
  if (duration !== null && duration > 0) {
    return { etaMs: duration, fireAt: now + duration, kind: 'duration' };
  }

  const fireAt = parseClock(input, now);
  if (fireAt === null || fireAt <= now) return null;

  return { etaMs: fireAt - now, fireAt, kind: 'clock' };
}

/** @deprecated Use parseWhen; kept for call sites that only need ms. */
export function parseEta(input: string, now = Date.now()): number | null {
  return parseWhen(input, now)?.etaMs ?? null;
}
