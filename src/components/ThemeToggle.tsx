import { useTheme } from '../theme/useTheme';
import { useLocale, t } from '../i18n';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  useLocale();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? (t('switchToChinese') + ' / light') : (t('switchToEnglish') + ' / dark')}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {isDark ? '☀' : '☽'}
      </span>
    </button>
  );
}
