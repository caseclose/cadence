import { describe, expect, it } from 'vitest';
import { formatFireAt, parseClock, parseDuration, parseWhen } from './time';

const HOUR = 60 * 60_000;
const MIN = 60_000;
const DAY = 24 * HOUR;

describe('parseDuration', () => {
  it('parses h/m/s/d and bare minutes', () => {
    expect(parseDuration('1h')).toBe(HOUR);
    expect(parseDuration('90m')).toBe(90 * MIN);
    expect(parseDuration('2d')).toBe(2 * DAY);
    expect(parseDuration('1d12h')).toBe(DAY + 12 * HOUR);
    expect(parseDuration('45')).toBe(45 * MIN);
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
});

describe('formatFireAt', () => {
  const now = new Date(2026, 6, 21, 10, 0).getTime();

  it('shows today / 明天 / date', () => {
    expect(formatFireAt(new Date(2026, 6, 21, 15, 0).getTime(), now)).toBe('15:00');
    expect(formatFireAt(new Date(2026, 6, 22, 15, 0).getTime(), now)).toBe('明天 15:00');
    expect(formatFireAt(new Date(2026, 6, 25, 15, 0).getTime(), now)).toBe('7/25 15:00');
  });
});

describe('parseWhen', () => {
  const now = new Date(2026, 6, 21, 10, 0, 0).getTime();

  it('duration including multi-day', () => {
    const r = parseWhen('2d', now)!;
    expect(r.kind).toBe('duration');
    expect(r.etaMs).toBe(2 * DAY);
  });

  it('clock path converts to duration', () => {
    const r = parseWhen('明天下午3点', now)!;
    expect(r.kind).toBe('clock');
    expect(r.fireAt).toBe(new Date(2026, 6, 22, 15, 0).getTime());
  });
});
