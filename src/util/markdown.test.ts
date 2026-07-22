import { describe, expect, it } from 'vitest';
import { noteSummary } from './markdown';

describe('noteSummary', () => {
  it('takes the first non-empty line', () => {
    expect(noteSummary('## 检查点\n\n- 跑通训练')).toBe('检查点');
  });

  it('strips list markers and code ticks', () => {
    expect(noteSummary('- `npm run build`')).toBe('npm run build');
  });

  it('truncates long lines', () => {
    const long = 'a'.repeat(100);
    expect(noteSummary(long, 20)).toBe(`${'a'.repeat(19)}…`);
  });

  it('returns empty for blank notes', () => {
    expect(noteSummary('  \n\n  ')).toBe('');
  });
});
