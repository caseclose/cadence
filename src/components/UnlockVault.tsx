import { useState } from 'react';
import { useStore } from '../store/useStore';

export function UnlockVault() {
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
      <h3 className="vault-title">🔐 解锁端到端加密</h3>
      <p className="vault-copy">
        你的任务在云端以<strong>密文</strong>存储。私钥由登录密码保护，仅在本机内存中解密——刷新页面后需再输入一次密码。
      </p>
      <div className="vault-row">
        <input
          className="auth-field"
          type="password"
          placeholder="登录密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) void submit();
          }}
        />
        <button type="button" className="btn-sm btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
          解锁
        </button>
      </div>
      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
