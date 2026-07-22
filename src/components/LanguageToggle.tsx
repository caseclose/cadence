import { useLanguage } from '../i18n';

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();
  return (
    <div className="language-toggle" role="group" aria-label={locale === 'zh' ? '语言' : 'Language'}>
      <button
        type="button"
        className={locale === 'zh' ? 'is-active' : ''}
        aria-pressed={locale === 'zh'}
        onClick={() => setLocale('zh')}
      >
        中
      </button>
      <span aria-hidden>/</span>
      <button
        type="button"
        className={locale === 'en' ? 'is-active' : ''}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
}
