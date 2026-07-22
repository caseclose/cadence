import { useState } from 'react';
import { useLocale, t } from '../i18n';

export function WhenFormatGuide() {
  useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="format-guide">
      <button
        type="button"
        className="link format-guide-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? t('formatGuideCollapse') : t('formatGuideExpand')}
      </button>
      {open && (
        <div className="format-guide-body">
          <p className="format-guide-lead">{t('formatGuideLead')}</p>
          <div className="format-guide-grid">
            <section>
              <h4>{t('formatRelativeDuration')}</h4>
              <ul>
                <li><code>1h</code> · <code>90m</code> · <code>2d</code></li>
                <li><code>10分钟</code> · <code>1小时</code> · <code>2天</code></li>
                <li><code>半小时</code> · <code>45</code>{t('formatPureNumber')}</li>
              </ul>
            </section>
            <section>
              <h4>{t('formatMomentDate')}</h4>
              <ul>
                <li><code>14:00</code> · <code>下午3点</code></li>
                <li><code>明天上午10点</code> · <code>后天14:00</code></li>
              </ul>
            </section>
            <section>
              <h4>{t('formatWeekday')}</h4>
              <ul>
                <li><code>周五下午2点</code></li>
                <li><code>下周五14:00</code></li>
                <li><code>这周五上午10点</code></li>
              </ul>
            </section>
            <section>
              <h4>{t('formatAbsoluteDate')}</h4>
              <ul>
                <li><code>7月22日上午10点</code></li>
                <li><code>7/22 10:00</code></li>
                <li><code>2026年7月22日下午3点</code></li>
              </ul>
            </section>
          </div>
          <p className="format-guide-note">{t('formatGuideNote')}</p>
        </div>
      )}
    </div>
  );
}
