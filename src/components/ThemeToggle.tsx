import { useTheme } from '../theme/useTheme';
import { useLocale, t } from '../i18n';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  useLocale();
  const isDark = theme === 'dark' || (theme === 'auto' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={t('themeToggle')}
      title={theme === 'auto' ? t('themeAuto') : isDark ? t('themeLight') : t('themeDark')}
    >
      <span className="theme-toggle-icon" aria-hidden>
        {isDark ? '☀' : '☽'}
      </span>
    </button>
  );
}
