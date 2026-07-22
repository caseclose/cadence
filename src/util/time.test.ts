import { describe, expect, it } from 'vitest';
import { formatDuration, formatFireAt, formatRelative, parseClock, parseDuration, parseWhen } from './time';
import { setLocale } from '../i18n';

const HOUR = 60 * 60_000;
const MIN = 60_000;
const DAY = 24 * HOUR;

describe('formatDuration / formatRelative', () => {
  it('shows a full +10m snooze as 10m, not a floored 9m after a few seconds', () => {
    expect(formatDuration(10 * MIN)).toBe('10m');
    expect(formatDuration(10 * MIN - 20_000)).toBe('10m');
    expect(formatDuration(6 * MIN)).toBe('6m');
  });

  it('formatRelative after overdue+10m reads as ~10m left', () => {
    setLocale('zh');
    const now = 1_000_000;
    const overdueFireAt = now - 4 * MIN;
    // Bug path without Math.max(now, nextFireAt): overdueFireAt + 10m → 6m left.
    expect(formatRelative(overdueFireAt + 10 * MIN, now)).toBe('6m后');
    expect(formatRelative(now + 10 * MIN, now)).toBe('10m后');
  });
});

describe('parseDuration', () => {
  it('parses h/m/s/d and bare minutes', () => {
    expect(parseDuration('1h')).toBe(HOUR);
    expect(parseDuration('90m')).toBe(90 * MIN);
    expect(parseDuration('2d')).toBe(2 * DAY);
    expect(parseDuration('1d12h')).toBe(DAY + 12 * HOUR);
    expect(parseDuration('45')).toBe(45 * MIN);
  });

  it('parses English unit words', () => {
    expect(parseDuration('10 minutes')).toBe(10 * MIN);
    expect(parseDuration('1 hour 30 minutes')).toBe(HOUR + 30 * MIN);
    expect(parseDuration('2 days')).toBe(2 * DAY);
  });

  it('parses Chinese units and halves', () => {
    expect(parseDuration('10分钟')).toBe(10 * MIN);
    expect(parseDuration('10分')).toBe(10 * MIN);
    expect(parseDuration('1小时')).toBe(HOUR);
    expect(parseDuration('1时')).toBe(HOUR);
    expect(parseDuration('2天')).toBe(2 * DAY);
    expect(parseDuration('半小时')).toBe(HOUR / 2);
    expect(parseDuration('半天')).toBe(DAY / 2);
    expect(parseDuration('1小时30分钟')).toBe(HOUR + 30 * MIN);
  });
});

describe('parseClock cross-day', () => {
  const now = new Date(2026, 6, 21, 16, 0, 0).getTime(); // Jul 21 16:00

  it('rolls passed time to tomorrow', () => {
    expect(parseClock('14:00', now)).toBe(new Date(2026, 6, 22, 14, 0).getTime());
  });

  it('parses explicit 明天/后天', () => {
    expect(parseClock('明天下午3点', now)).toBe(new Date(2026, 6, 22, 15, 0).getTime());
    expect(parseClock('后天14:00', now)).toBe(new Date(2026, 6, 23, 14, 0).getTime());
  });

  it('parses 明天 alone as 09:00', () => {
    expect(parseClock('明天', now)).toBe(new Date(2026, 6, 22, 9, 0).getTime());
  });

  it('parses English relative dates', () => {
    expect(parseClock('tomorrow 14:00', now)).toBe(new Date(2026, 6, 22, 14, 0).getTime());
    expect(parseClock('day after tomorrow 3 PM', now)).toBe(new Date(2026, 6, 23, 15, 0).getTime());
  });
});

describe('parseClock calendar date', () => {
  const now = new Date(2026, 6, 21, 16, 0, 0).getTime(); // Jul 21 2026 16:00

  it('parses 7月22日上午10点', () => {
    expect(parseClock('7月22日上午10点', now)).toBe(
      new Date(2026, 6, 22, 10, 0).getTime(),
    );
  });

  it('parses 7/22 10:00', () => {
    expect(parseClock('7/22 10:00', now)).toBe(new Date(2026, 6, 22, 10, 0).getTime());
  });

  it('parses 2026年7月22日下午3点半', () => {
    expect(parseClock('2026年7月22日下午3点半', now)).toBe(
      new Date(2026, 6, 22, 15, 30).getTime(),
    );
  });

  it('rejects past explicit datetime on same day', () => {
    const late = new Date(2026, 6, 22, 11, 0, 0).getTime();
    expect(parseClock('7月22日上午10点', late)).toBeNull();
  });

  it('bumps year when month/day already passed this year', () => {
    const after = new Date(2026, 6, 23, 10, 0, 0).getTime(); // Jul 23
    expect(parseClock('7月22日上午10点', after)).toBe(
      new Date(2027, 6, 22, 10, 0).getTime(),
    );
  });
});

describe('parseClock weekday', () => {
  const now = new Date(2026, 6, 21, 10, 0, 0).getTime(); // Tue Jul 21 2026

  it('parses 周五下午2点 as next Friday', () => {
    expect(parseClock('周五下午2点', now)).toBe(new Date(2026, 6, 24, 14, 0).getTime());
  });

  it('parses 下周五下午2点 as Friday next week', () => {
    expect(parseClock('下周五下午2点', now)).toBe(new Date(2026, 6, 31, 14, 0).getTime());
  });

  it('parses 星期五14:00', () => {
    expect(parseClock('星期五14:00', now)).toBe(new Date(2026, 6, 24, 14, 0).getTime());
  });

  it('parses English weekdays', () => {
    expect(parseClock('Friday 2 PM', now)).toBe(new Date(2026, 6, 24, 14, 0).getTime());
    expect(parseClock('next Friday 14:00', now)).toBe(new Date(2026, 6, 31, 14, 0).getTime());
  });
});

describe('formatFireAt', () => {
  const now = new Date(2026, 6, 21, 10, 0).getTime();

  it('shows today / 明天 / weekday / date', () => {
    expect(formatFireAt(new Date(2026, 6, 21, 15, 0).getTime(), now)).toBe('15:00');
    expect(formatFireAt(new Date(2026, 6, 22, 15, 0).getTime(), now)).toBe('明天 15:00');
    expect(formatFireAt(new Date(2026, 6, 24, 15, 0).getTime(), now)).toBe('周五 15:00');
    expect(formatFireAt(new Date(2026, 7, 1, 15, 0).getTime(), now)).toBe('8月1日 15:00');
  });
});

describe('parseWhen', () => {
  const now = new Date(2026, 6, 21, 10, 0, 0).getTime();

  it('duration including multi-day', () => {
    const r = parseWhen('2d', now)!;
    expect(r.kind).toBe('duration');
    expect(r.etaMs).toBe(2 * DAY);
  });

  it('clock path converts calendar date to duration', () => {
    const r = parseWhen('7月22日上午10点', now)!;
    expect(r.kind).toBe('clock');
    expect(r.fireAt).toBe(new Date(2026, 6, 22, 10, 0).getTime());
  });

  it('clock path converts weekday to duration', () => {
    const r = parseWhen('周五下午2点', now)!;
    expect(r.kind).toBe('clock');
    expect(r.fireAt).toBe(new Date(2026, 6, 24, 14, 0).getTime());
  });
});
