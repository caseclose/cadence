import { useLocale, t } from '../i18n';

export function ProjectIntro() {
  useLocale();
  return (
    <details className="intro-card">
      <summary className="intro-summary">
        <span className="intro-summary-label">
          <span className="intro-summary-q">{t('whyCadence')}</span>
          <span className="intro-summary-sep" aria-hidden>
            ·
          </span>
          <span className="intro-summary-sub">{t('introSub')}</span>
        </span>
        <span className="intro-chevron" aria-hidden />
      </summary>

      <div className="intro-panel">
        <div className="intro-panel-inner">
          <p className="intro-copy">{t('introCopy')}</p>
          <h3 className="intro-strategies-title">{t('introStrategiesTitle')}</h3>
          <p className="intro-strategies-lead">{t('introStrategiesLead')}</p>
          <div className="intro-strategies">
            <div className="intro-strategy">
              <span className="intro-badge converging">{t('converging')}</span>
              <p className="intro-strategy-scene">{t('introConvergingScene')}</p>
              <p className="intro-strategy-rhythm">{t('introConvergingRhythm')}</p>
              <p className="intro-strategy-example">{t('introConvergingExample')}</p>
            </div>
            <div className="intro-strategy">
              <span className="intro-badge exponential">{t('exponential')}</span>
              <p className="intro-strategy-scene">{t('introExponentialScene')}</p>
              <p className="intro-strategy-rhythm">{t('introExponentialRhythm')}</p>
              <p className="intro-strategy-example">{t('introExponentialExample')}</p>
            </div>
          </div>
          <p className="intro-privacy">
            {t('introPrivacy')}{' '}
            <a
              className="intro-privacy-link"
              href="https://github.com/caseclose/cadence/blob/main/docs/PRIVACY-E2EE.md"
              target="_blank"
              rel="noreferrer"
            >
              {t('introPrivacyLink')}
            </a>
            .
          </p>
        </div>
      </div>
    </details>
  );
}
