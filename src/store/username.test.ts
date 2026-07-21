import { describe, expect, it } from 'vitest';
import { usernameToEmail, validateUsername, displayUsername } from './username';

describe('username', () => {
  it('validates username format', () => {
    expect(validateUsername('abc')).toBe(true);
    expect(validateUsername('user_1')).toBe(true);
    expect(validateUsername('小明')).toBe(true);
    expect(validateUsername('a')).toBe(false);
    expect(validateUsername('has space')).toBe(false);
  });

  it('maps to internal email', () => {
    expect(usernameToEmail('MyUser')).toBe('myuser@cadence.auth');
  });

  it('displays username from metadata or email', () => {
    expect(
      displayUsername({
        email: 'foo@cadence.auth',
        user_metadata: { username: 'Foo' },
      } as never),
    ).toBe('Foo');
    expect(displayUsername({ email: 'bar@cadence.auth', user_metadata: {} } as never)).toBe('bar');
  });
});
