import { useState } from 'react';
import { useStore } from '../store/useStore';

export function AuthBar() {
  const { user, cloudEnabled, signInWithPassword, signUpWithPassword, signOut } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!cloudEnabled) {
    return <span className="auth-chip auth-chip-muted">本地模式</span>;
  }

  if (user) {
    const initial = (user.email?.[0] ?? '?').toUpperCase();
    return (
      <div className="auth-user">
        <span className="auth-avatar" aria-hidden>
          {initial}
        </span>
        <span className="auth-email" title={user.email ?? ''}>
          {user.email}
        </span>
        <button type="button" className="btn-sm btn-ghost" onClick={() => void signOut()}>
          退出
        </button>
      </div>
    );
  }

  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  const run = async (fn: (e: string, p: string) => Promise<string | null>) => {
    setBusy(true);
    setMsg(null);
    const err = await fn(email, password);
    setBusy(false);
    setMsg(err);
  };

  return (
    <div className="auth-box">
      <form
        className="auth-inline"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void run(signInWithPassword);
        }}
      >
        <input
          className="auth-field"
          placeholder="邮箱"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <span className="auth-divider" aria-hidden />
        <input
          className="auth-field"
          placeholder="密码"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="auth-actions">
          <button type="submit" className="btn-sm btn-primary" disabled={!canSubmit}>
            登录
          </button>
          <button
            type="button"
            className="btn-sm btn-ghost"
            disabled={!canSubmit}
            onClick={() => void run(signUpWithPassword)}
          >
            注册
          </button>
        </div>
      </form>
      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
