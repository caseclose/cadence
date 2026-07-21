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

/** Fire time with day context when it is not today. */
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
  if (dayDiff >= 3 && dayDiff <= 6) {
    return `${WEEKDAY_LABELS[t.getDay()]} ${clock}`;
  }
  return `${t.getMonth() + 1}月${t.getDate()}日 ${clock}`;
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

function atCalendarDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function normalizeYear(y: number): number {
  if (y < 100) return 2000 + y;
  return y;
}

function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Parse time-only portion: 14:00, 上午10点, 3pm, 10点, etc. */
function resolveTime(text: string): { hour: number; minute: number } | null {
  if (!text) return { hour: 9, minute: 0 };

  let m = text.match(/^(\d{1,2})[:：](\d{2})$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = parseInt(m[2], 10);
    if (hour <= 23 && minute <= 59) return { hour, minute };
    return null;
  }

  m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (m[3] === 'pm' && hour !== 12) hour += 12;
    if (m[3] === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }

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
    return { hour, minute };
  }

  m = text.match(/^(\d{1,2})点(?:(\d{1,2})分?|半)?$/);
  if (m) {
    const hour = parseInt(m[1], 10);
    let minute = 0;
    if (text.includes('点半')) minute = 30;
    else if (m[2]) minute = parseInt(m[2], 10);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
  timeText: string;
  hasExplicitYear: boolean;
}

/** Parse leading calendar date: 7月22日上午10点, 7/22 10:00, 2026年7月22日... */
function parseCalendarDatePrefix(text: string, now: number): CalendarParts | null {
  let m = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(.*)$/);
  if (m) {
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return {
      year: parseInt(m[1], 10),
      month,
      day,
      timeText: m[4] || '上午9点',
      hasExplicitYear: true,
    };
  }

  m = text.match(/^(\d{1,2})月(\d{1,2})日(.*)$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    let year = new Date(now).getFullYear();
    const dayStart = new Date(year, month - 1, day).getTime();
    if (dayStart < startOfDayMs(new Date(now))) year += 1;
    return {
      year,
      month,
      day,
      timeText: m[3] || '上午9点',
      hasExplicitYear: false,
    };
  }

  m = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(.*)$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const hasExplicitYear = Boolean(m[3]);
    let year = hasExplicitYear ? normalizeYear(parseInt(m[3]!, 10)) : new Date(now).getFullYear();
    if (!hasExplicitYear) {
      const dayStart = new Date(year, month - 1, day).getTime();
      if (dayStart < startOfDayMs(new Date(now))) year += 1;
    }
    return {
      year,
      month,
      day,
      timeText: m[4] || '9:00',
      hasExplicitYear,
    };
  }

  return null;
}

function parseAbsoluteDateTime(parts: CalendarParts, now: number): number | null {
  const time = resolveTime(parts.timeText);
  if (!time) return null;

  let t = atCalendarDate(parts.year, parts.month, parts.day, time.hour, time.minute);
  if (t > now) return t;

  if (parts.hasExplicitYear) return null;

  // Same calendar day but time already passed -> invalid, do not roll to next year.
  const targetDay = startOfDayMs(new Date(parts.year, parts.month - 1, parts.day));
  const today = startOfDayMs(new Date(now));
  if (targetDay === today) return null;

  t = atCalendarDate(parts.year + 1, parts.month, parts.day, time.hour, time.minute);
  return t > now ? t : null;
}

/** Next occurrence of hour:minute strictly after `now` (today or tomorrow). */
function nextClock(now: number, hour: number, minute: number): number {
  let t = atLocalTime(now, 0, hour, minute);
  if (t <= now) t = atLocalTime(now, 1, hour, minute);
  return t;
}

function parseClockBody(text: string, now: number, dayOffset: number): number | null {
  const time = resolveTime(text);
  if (!time) {
    if (text === '') {
      const t = atLocalTime(now, dayOffset, 9, 0);
      return t > now ? t : atLocalTime(now, dayOffset + 1, 9, 0);
    }
    return null;
  }

  const { hour, minute } = time;

  if (dayOffset > 0) {
    const t = atLocalTime(now, dayOffset, hour, minute);
    return t > now ? t : atLocalTime(now, dayOffset + 1, hour, minute);
  }

  if (hour >= 13 || text.match(/^(\d{1,2})[:：](\d{2})$/)) {
    return nextClock(now, hour, minute);
  }

  if (text.match(/^(\d{1,2})点/) && !text.match(/^(上午|早上|凌晨|中午|下午|晚上)/)) {
    const candidates = [nextClock(now, hour, minute)];
    if (hour <= 12) {
      const pmHour = hour === 12 ? 12 : hour + 12;
      candidates.push(nextClock(now, pmHour, minute));
    }
    const future = candidates.filter((t) => t > now);
    return future.length ? Math.min(...future) : null;
  }

  return nextClock(now, hour, minute);
}

const DAY_PREFIX: Record<string, number> = {
  今天: 0,
  明天: 1,
  后天: 2,
  大后天: 3,
};

const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface WeekdayParts {
  dow: number;
  rest: string;
  extraWeeks: number;
}

/** 周五下午2点 / 下周五14:00 / 这周五上午10点 */
function parseWeekdayPrefix(text: string): WeekdayParts | null {
  let extraWeeks = 0;
  let t = text;

  if (t.startsWith('下')) {
    extraWeeks = 1;
    t = t.slice(1);
  } else if (t.startsWith('这') || t.startsWith('本')) {
    t = t.replace(/^这(?:周|星期)?/, '周').replace(/^本(?:周|星期)?/, '周');
  }

  const m = t.match(/^(?:周|星期)([日天一二三四五六])(.*)$/);
  if (!m) return null;

  const dow = WEEKDAY_MAP[m[1]];
  if (dow === undefined) return null;

  return { dow, rest: m[2], extraWeeks };
}

function computeWeekdayFireAt(
  now: number,
  dow: number,
  hour: number,
  minute: number,
  extraWeeks: number,
): number {
  const currentDow = new Date(now).getDay();
  let daysAhead = (dow - currentDow + 7) % 7;

  if (daysAhead === 0) {
    const t = atLocalTime(now, 0, hour, minute);
    if (t <= now) daysAhead = 7;
  }

  daysAhead += extraWeeks * 7;
  return atLocalTime(now, daysAhead, hour, minute);
}

function parseWeekdayDateTime(text: string, now: number): number | null {
  const parts = parseWeekdayPrefix(text);
  if (!parts) return null;

  const time = resolveTime(parts.rest);
  if (!time) return null;

  const t = computeWeekdayFireAt(now, parts.dow, time.hour, time.minute, parts.extraWeeks);
  return t > now ? t : null;
}

/**
 * Parse absolute clock input into a future local timestamp.
 * Supports 14:00, 明天下午3点, 7月22日上午10点, 周五下午2点, etc.
 */
export function parseClock(input: string, now = Date.now()): number | null {
  const text = input.trim().replace(/\s+/g, '');

  const dated = parseCalendarDatePrefix(text, now);
  if (dated) return parseAbsoluteDateTime(dated, now);

  const weekday = parseWeekdayDateTime(text, now);
  if (weekday !== null) return weekday;

  let dayOffset = 0;
  let rest = text;
  for (const [prefix, offset] of Object.entries(DAY_PREFIX)) {
    if (text.startsWith(prefix)) {
      dayOffset = offset;
      rest = text.slice(prefix.length);
      break;
    }
  }

  return parseClockBody(rest, now, dayOffset);
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
