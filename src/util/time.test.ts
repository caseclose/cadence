import { describe, expect, it } from 'vitest';
import { parseClock, parseDuration, parseWhen } from './time';

const HOUR = 60 * 60_000;
const MIN = 60_000;

describe('parseDuration', () => {
  it('parses h/m/s and bare minutes', () => {
    expect(parseDuration('1h')).toBe(HOUR);
    expect(parseDuration('90m')).toBe(90 * MIN);
    expect(parseDuration('1h30m')).toBe(90 * MIN);
    expect(parseDuration('45')).toBe(45 * MIN);
  });
});

describe('parseClock', () => {
  const now = new Date(2026, 6, 21, 10, 0, 0).getTime(); // 2026-07-21 10:00 local

  it('parses 24h clock', () => {
    expect(parseClock('14:00', now)).toBe(new Date(2026, 6, 21, 14, 0).getTime());
    expect(parseClock('09:30', now)).toBe(new Date(2026, 6, 22, 9, 30).getTime()); // past -> tomorrow
  });

  it('parses Chinese meridiem', () => {
    expect(parseClock('下午3点', now)).toBe(new Date(2026, 6, 21, 15, 0).getTime());
    expect(parseClock('下午3点半', now)).toBe(new Date(2026, 6, 21, 15, 30).getTime());
    expect(parseClock('晚上8点', now)).toBe(new Date(2026, 6, 21, 20, 0).getTime());
  });

  it('parses am/pm', () => {
    expect(parseClock('3pm', now)).toBe(new Date(2026, 6, 21, 15, 0).getTime());
    expect(parseClock('3:30pm', now)).toBe(new Date(2026, 6, 21, 15, 30).getTime());
  });
});

describe('parseWhen', () => {
  const now = new Date(2026, 6, 21, 10, 0, 0).getTime();

  it('duration path', () => {
    const r = parseWhen('2h', now)!;
    expect(r.kind).toBe('duration');
    expect(r.etaMs).toBe(2 * HOUR);
  });

  it('clock path converts to duration', () => {
    const r = parseWhen('14:00', now)!;
    expect(r.kind).toBe('clock');
    expect(r.etaMs).toBe(4 * HOUR);
    expect(r.fireAt).toBe(now + 4 * HOUR);
  });
});
