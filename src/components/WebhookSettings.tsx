import { useEffect, useState } from 'react';
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

export function WebhookSettings() {
  const user = useStore((s) => s.user);
  const cloudEnabled = useStore((s) => s.cloudEnabled);
  const [hooks, setHooks] = useState<NotificationWebhook[]>([]);
  const [provider, setProvider] = useState<WebhookProvider>('feishu');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
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
    } else {
      setUrl('');
      setSecret('');
    }
  }, [provider, hooks]);

  if (!cloudEnabled || !user) return null;

  const existing = hooks.find((h) => h.provider === provider);
  const active = WEBHOOK_PROVIDERS.find((p) => p.id === provider)!;
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
    });
    setBusy(false);
    if (err) {
      setMsg(err);
      return;
    }
    setMsgOk(true);
    setMsg('已保存。可点「发送测试」立刻验证；到点后也会自动发到该群。');
    await reload();
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
    setMsg('已删除该通道');
    await reload();
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    setMsgOk(false);
    // Persist current form first so test uses latest URL/secret
    if (url.trim()) {
      const saveErr = await upsertWebhook({
        userId: user.id,
        provider,
        url,
        secret,
        enabled: true,
      });
      if (saveErr) {
        setBusy(false);
        setMsg(saveErr);
        return;
      }
      await reload();
    }
    const err = await testSavedWebhooks();
    setBusy(false);
    if (err) {
      setMsg(err);
      return;
    }
    setMsgOk(true);
    setMsg('测试消息已发送，请查看飞书/企微/钉钉群。');
  };

  return (
    <details className="webhook-card">
      <summary className="webhook-summary">
        <span>提醒通道（飞书 / 企微 / 钉钉）</span>
        <span className="webhook-badge">
          {configuredCount > 0 ? `已配置 ${configuredCount}` : '国内推荐'}
        </span>
      </summary>
      <div className="webhook-body">
        <p className="webhook-lead">
          大陆 Chrome 的网页推送常不可用。配置群机器人 Webhook 后，关页也能在群里收到到点提醒。若飞书未开启「签名校验」，签名密钥请留空。
        </p>

        <div className="webhook-tabs" role="tablist">
          {WEBHOOK_PROVIDERS.map((p) => {
            const on = hooks.some((h) => h.provider === p.id && h.enabled);
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={provider === p.id}
                className={`webhook-tab${provider === p.id ? ' is-active' : ''}`}
                onClick={() => setProvider(p.id)}
              >
                {p.label}
                {on ? ' · 开' : ''}
              </button>
            );
          })}
        </div>

        <p className="webhook-hint">{active.hint}</p>

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
            签名密钥（可选；未开签名校验请留空）
            <input
              className="webhook-input"
              type="password"
              placeholder={provider === 'dingtalk' ? 'SEC 开头的密钥' : '仅在开启签名校验时填写'}
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
            保存
          </button>
          <button
            type="button"
            className="btn-sm btn-ghost"
            disabled={busy || (!url.trim() && !existing)}
            onClick={() => void test()}
          >
            发送测试
          </button>
          {existing && (
            <button
              type="button"
              className="btn-sm btn-ghost"
              disabled={busy}
              onClick={() => void remove()}
            >
              删除
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
