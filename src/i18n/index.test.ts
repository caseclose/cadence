import { beforeEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale, t } from './index';

describe('i18n', () => {
  beforeEach(() => setLocale('zh'));
  it('defaults to Chinese and switches dictionaries', () => {
    expect(getLocale()).toBe('zh');
    expect(t('queue')).toBe('挂起队列');
    setLocale('en');
    expect(t('queue')).toBe('Suspended queue');
  });
  it('interpolates variables', () => {
    setLocale('en');
    expect(t('reminderTitle', { title: 'Build' })).toContain('Build');
  });
});
