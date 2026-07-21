export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Human-friendly compact duration, e.g. 2d 3h, 1h 15m, 9m. */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const days = Math.floor(ms / DAY);
  const afterDays = ms % DAY;
  const h = Math.floor(afterDays / HOUR);
  const m = Math.floor((afterDays % HOUR) / MINUTE);
  const s = Math.floor((afterDays % MINUTE) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (h > 0) parts.push(m > 0 && days === 0 ? `${h}h ${m}m` : `${h}h`);
  else if (m > 0) parts.push(s > 0 && m < 5 && days === 0 ? `${m}m ${s}s` : `${m}m`);
  else if (days === 0) parts.push(`${s}s`);

  return parts.join(' ') || '0s';
}

/** Local clock time, e.g. 14:30. */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Fire time with day context when it is not today, e.g. 15:00 / 明天 15:00 / 7/23 15:00. */
export function formatFireAt(fireAt: number, now = Date.now()): string {
  const t = new Date(fireAt);
  const n = new Date(now);
  const clock = formatClock(fireAt);

  const startOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const dayDiff = Math.round((startOf(t) - startOf(n)) / DAY);

  if (dayDiff === 0) return clock;
  if (dayDiff === 1) return `明天 ${clock}`;
  if (dayDiff === 2) return `后天 ${clock}`;
  return `${t.getMonth() + 1}/${t.getDate()} ${clock}`;
}

/** Relative time from now, e.g. "3m 后" or "已过 5m". */
export function formatRelative(target: number, now: number): string {
  const diff = target - now;
  if (diff >= 0) return `${formatDuration(diff)}后`;
  return `已过 ${formatDuration(-diff)}`;
}

export interface ParsedWhen {
  etaMs: number;
  fireAt: number;
  kind: 'duration' | 'clock';
}

/** Parse relative duration like "1h", "90m", "2d", "1d12h". */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  const re = /(\d+(?:\.\d+)?)\s*(d|h|m|s)/g;
  let total = 0;
  let matched = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    matched = true;
    const value = parseFloat(match[1]);
    const unit = match[2];
    total +=
      unit === 'd'
        ? value * DAY
        : unit === 'h'
          ? value * HOUR
          : unit === 'm'
            ? value * MINUTE
            : value * 1000;
  }
  if (!matched) {
    const n = parseFloat(text);
    if (!Number.isNaN(n) && /^\d+(?:\.\d+)?$/.test(text)) return n * MINUTE;
    return null;
  }
  return total;
}

function atLocalTime(now: number, dayOffset: number, hour: number, minute: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Next occurrence of hour:minute strictly after `now` (today or tomorrow). */
function nextClock(now: number, hour: number, minute: number): number {
  let t = atLocalTime(now, 0, hour, minute);
  if (t <= now) t = atLocalTime(now, 1, hour, minute);
  return t;
}

function parseClockBody(text: string, now: number, dayOffset: number): number | null {
  // 14:00 / 9:05
  let m = text.match(/^(\d{1,2})[:：](\d{2})$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour <= 23 && minute <= 59) {
      const t = atLocalTime(now, dayOffset, hour, minute);
      return dayOffset > 0 || t > now ? t : atLocalTime(now, dayOffset + 1, hour, minute);
    }
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
    const t = atLocalTime(now, dayOffset, hour, minute);
    return dayOffset > 0 || t > now ? t : atLocalTime(now, dayOffset + 1, hour, minute);
  }

  // 下午3点 / 下午3点半
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

    const t = atLocalTime(now, dayOffset, hour, minute);
    return dayOffset > 0 || t > now ? t : atLocalTime(now, dayOffset + 1, hour, minute);
  }

  // 3点 / 3点半
  m = text.match(/^(\d{1,2})点(?:(\d{1,2})分?|半)?$/);
  if (m) {
    let hour = parseInt(m[1], 10);
    let minute = 0;
    if (text.includes('点半')) minute = 30;
    else if (m[2]) minute = parseInt(m[2], 10);
    if (hour > 23 || minute > 59) return null;

    if (dayOffset > 0) {
      if (hour >= 13) return atLocalTime(now, dayOffset, hour, minute);
      const am = atLocalTime(now, dayOffset, hour, minute);
      const pmHour = hour === 12 ? 12 : hour + 12;
      const pm = atLocalTime(now, dayOffset, pmHour, minute);
      return Math.min(am, pm);
    }

    if (hour >= 13) return nextClock(now, hour, minute);

    const candidates = [nextClock(now, hour, minute)];
    if (hour <= 12) {
      const pmHour = hour === 12 ? 12 : hour + 12;
      candidates.push(nextClock(now, pmHour, minute));
    }
    const future = candidates.filter((t) => t > now);
    return future.length ? Math.min(...future) : null;
  }

  // 明天 / 后天 with no time -> default 09:00
  if (text === '') {
    const t = atLocalTime(now, dayOffset, 9, 0);
    return t > now ? t : atLocalTime(now, dayOffset + 1, 9, 0);
  }

  return null;
}

const DAY_PREFIX: Record<string, number> = {
  今天: 0,
  明天: 1,
  后天: 2,
  大后天: 3,
};

/**
 * Parse absolute clock input into a future local timestamp.
 * Cross-day: auto-roll to tomorrow if today's time passed; or explicit 明天/后天.
 */
export function parseClock(input: string, now = Date.now()): number | null {
  let text = input.trim().toLowerCase().replace(/\s+/g, '');

  let dayOffset = 0;
  for (const [prefix, offset] of Object.entries(DAY_PREFIX)) {
    if (text.startsWith(prefix)) {
      dayOffset = offset;
      text = text.slice(prefix.length);
      break;
    }
  }

  return parseClockBody(text, now, dayOffset);
}

/** Parse duration or clock time into ms-from-now. */
export function parseWhen(input: string, now = Date.now()): ParsedWhen | null {
  const duration = parseDuration(input);
  if (duration !== null && duration > 0) {
    return { etaMs: duration, fireAt: now + duration, kind: 'duration' };
  }

  const fireAt = parseClock(input, now);
  if (fireAt === null || fireAt <= now) return null;

  return { etaMs: fireAt - now, fireAt, kind: 'clock' };
}

export function parseEta(input: string, now = Date.now()): number | null {
  return parseWhen(input, now)?.etaMs ?? null;
}
