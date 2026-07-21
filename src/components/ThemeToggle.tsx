import { useTheme } from '../theme/useTheme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '浅色模式' : '深色模式'}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {isDark ? '☀' : '☽'}
      </span>
    </button>
  );
}
