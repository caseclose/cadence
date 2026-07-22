import { useEffect, useState } from 'react';
import { useLocale, t } from '../i18n';
import { useStore } from '../store/useStore';
import {
  WEBHOOK_PROVIDERS,
  deleteWebhook,
  listWebhooks,
  type NotificationWebhook,
  type WebhookProvider,
  testSavedWebhooks,
  upsertWebhook,
} from '../notify/webhooks';
import { TermTip } from './TermTip';

const PROVIDER_KEYS: Record<WebhookProvider, { label: string; hint: string }> = {
  feishu: { label: 'webhookFeishu', hint: 'webhookHintFeishu' },
  wecom: { label: 'webhookWecom', hint: 'webhookHintWecom' },
  dingtalk: { label: 'webhookDingtalk', hint: 'webhookHintDingtalk' },
};

export function WebhookSettings() {
  useLocale();
  const user = useStore((s) => s.user);
  const cloudEnabled = useStore((s) => s.cloudEnabled);
  const syncWebhookContent = useStore((s) => s.syncWebhookContent);
  const [hooks, setHooks] = useState<NotificationWebhook[]>([]);
  const [provider, setProvider] = useState<WebhookProvider>('feishu');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [includeContent, setIncludeContent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || !cloudEnabled) {
      setHooks([]);
      return;
    }
    void listWebhooks(user.id).then(setHooks);
  }, [user?.id, cloudEnabled]);

  useEffect(() => {
    const row = hooks.find((h) => h.provider === provider);
    if (row) {
      setUrl(row.url);
      setSecret(row.secret ?? '');
      setIncludeContent(row.include_content ?? false);
    } else {
      setUrl('');
      setSecret('');
      setIncludeContent(false);
    }
  }, [provider, hooks]);

  if (!cloudEnabled || !user) return null;

  const existing = hooks.find((h) => h.provider === provider);
  const activeKeys = PROVIDER_KEYS[provider];
  const configuredCount = hooks.filter((h) => h.enabled).length;

  const reload = async () => {
    setHooks(await listWebhooks(user.id));
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setMsgOk(false);
    const err = await upsertWebhook({
      userId: user.id,
      provider,
      url,
      secret,
      enabled: true,
      includeContent,
    });
    setBusy(false);
    if (err) {
      setMsg(err);
      return;
    }
    setMsgOk(true);
    setMsg(t('webhookSaved'));
    await reload();
    await syncWebhookContent();
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    setMsgOk(false);
    const err = await deleteWebhook(user.id, provider);
    setBusy(false);
    if (err) {
      setMsg(err);
      return;
    }
    setUrl('');
    setSecret('');
    setMsgOk(true);
    setMsg(t('webhookDeleted'));
    await reload();
    await syncWebhookContent();
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    setMsgOk(false);
    if (url.trim()) {
      const saveErr = await upsertWebhook({
        userId: user.id,
        provider,
        url,
        secret,
        enabled: true,
        includeContent,
      });
      if (saveErr) {
        setBusy(false);
        setMsg(saveErr);
        return;
      }
      await reload();
      await syncWebhookContent();
    }
    const err = await testSavedWebhooks();
    setBusy(false);
    if (err) {
      setMsg(err);
      return;
    }
    setMsgOk(true);
    setMsg(t('webhookTestSent'));
  };

  return (
    <details className="webhook-card">
      <summary className="webhook-summary">
        <TermTip hintKey="webhookTermHint">{t('webhookTitle')}</TermTip>
        <span className="webhook-badge">
          {configuredCount > 0 ? t('webhookConfigured', { count: String(configuredCount) }) : t('webhookRecommended')}
        </span>
      </summary>
      <div className="webhook-body">
        <p className="webhook-lead">{t('webhookLead')}</p>

        <div className="webhook-tabs" role="tablist">
          {WEBHOOK_PROVIDERS.map((p) => {
            const on = hooks.some((h) => h.provider === p.id && h.enabled);
            const keys = PROVIDER_KEYS[p.id];
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={provider === p.id}
                className={`webhook-tab${provider === p.id ? ' is-active' : ''}`}
                onClick={() => setProvider(p.id)}
              >
                {t(keys.label)}
                {on ? t('webhookOn') : ''}
              </button>
            );
          })}
        </div>

        <p className="webhook-hint">{t(activeKeys.hint)}</p>

        <label className="webhook-content-toggle">
          <input
            type="checkbox"
            checked={includeContent}
            onChange={(e) => setIncludeContent(e.target.checked)}
          />
          <span>{t('webhookIncludeContent')}</span>
        </label>
        <p className="webhook-content-warning">{t('webhookIncludeContentWarning')}</p>

        <label className="webhook-label">
          Webhook URL
          <input
            className="webhook-input"
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="off"
          />
        </label>

        {(provider === 'feishu' || provider === 'dingtalk') && (
          <label className="webhook-label">
            {t('webhookSecretLabel')}
            <input
              className="webhook-input"
              type="password"
              placeholder={provider === 'dingtalk' ? t('webhookSecretPlaceholderDingtalk') : t('webhookSecretPlaceholderFeishu')}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}

        <div className="webhook-actions">
          <button
            type="button"
            className="btn-sm btn-primary"
            disabled={busy || !url.trim()}
            onClick={() => void save()}
          >
            {t('save')}
          </button>
          <button
            type="button"
            className="btn-sm btn-ghost"
            disabled={busy || (!url.trim() && !existing)}
            onClick={() => void test()}
          >
            {t('webhookTest')}
          </button>
          {existing && (
            <button
              type="button"
              className="btn-sm btn-ghost"
              disabled={busy}
              onClick={() => void remove()}
            >
              {t('delete')}
            </button>
          )}
        </div>
        {msg && (
          <p className={`webhook-msg${msgOk ? '' : ' is-error'}`}>{msg}</p>
        )}
      </div>
    </details>
  );
}
