import { useEffect, useState } from 'react';
import { getDigestPreference, saveDigestPreference } from '../notify/digest';
import { useStore } from '../store/useStore';
import { t, useLocale } from '../i18n';
import { TermTip } from './TermTip';

export function DigestSettings() {
  useLocale();
  const user = useStore((state) => state.user);
  const cloudEnabled = useStore((state) => state.cloudEnabled);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('09:00');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !cloudEnabled) return;
    void getDigestPreference(user.id).then((preference) => {
      if (!preference) return;
      setEnabled(preference.enabled);
      setTime(preference.local_time.slice(0, 5));
    });
  }, [user, cloudEnabled]);

  if (!user || !cloudEnabled) return null;
  const save = async () => {
    const err = await saveDigestPreference(user.id, {
      enabled,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      local_time: time,
      channel: 'webhook',
    });
    setMessage(err ?? t('digestSaved'));
  };
  return <details className="webhook-card"><summary className="webhook-summary"><TermTip hintKey="digestHint">{t('digestTitle')}</TermTip></summary><div className="webhook-body">
    <p className="webhook-lead">{t('digestLead')}</p>
    <label className="webhook-content-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>{t('digestEnable')}</span></label>
    <label className="webhook-label">{t('digestTime')}<input className="webhook-input" type="time" step="300" value={time} onChange={(event) => setTime(event.target.value)} /></label>
    <button type="button" className="btn-sm btn-primary" onClick={() => void save()}>{t('save')}</button>
    {message && <p className="webhook-message">{message}</p>}
  </div></details>;
}
