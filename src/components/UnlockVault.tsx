import { useState } from 'react';
import { useLocale, t } from '../i18n';
import { useStore } from '../store/useStore';

export function UnlockVault() {
  useLocale();
  const { unlockVault } = useStore();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = password.length >= 6 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    const err = await unlockVault(password);
    setBusy(false);
    setMsg(err);
    if (!err) setPassword('');
  };

  return (
    <div className="vault-card card">
      <h3 className="vault-title">🔐 {t('decryptTitle')}</h3>
      <p className="vault-copy">
        你的任务在云端以<strong>密文</strong>存储。私钥由t('loginPassword')保护。t('unlock')后本机可免密约
        <strong>6 小时</strong>（刷新页面仍保持t('unlock')）；过期或退出登录后需再输入密码。
      </p>
      <div className="vault-row">
        <input
          className="auth-field"
          type="password"
          placeholder="t('loginPassword')"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void submit();
          }}
        />
        <button type="button" className="btn-sm btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
          t('unlock')
        </button>
      </div>
      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
