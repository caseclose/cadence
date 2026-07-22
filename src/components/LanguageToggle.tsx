import { useLanguage } from '../i18n';

export function LanguageToggle() {
  const { locale, toggle } = useLanguage();
  const next = locale === 'zh' ? 'English' : '中文';
  return (
    <button
      type="button"
      className="language-toggle"
      onClick={toggle}
      aria-label={locale === 'zh' ? '切换到英文' : 'Switch to Chinese'}
      title={locale === 'zh' ? '切换到英文' : 'Switch to Chinese'}
    >
      {next}
    </button>
  );
}
