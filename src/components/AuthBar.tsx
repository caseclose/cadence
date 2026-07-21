import { useState } from 'react';
import { useStore } from '../store/useStore';

export function AuthBar() {
  const { user, cloudEnabled, signInWithPassword, signUpWithPassword, signOut } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!cloudEnabled) {
    return <span className="auth-status">本地模式（未配置云同步）</span>;
  }

  if (user) {
    return (
      <span className="auth-status">
        {user.email} ·{' '}
        <button className="link" onClick={() => void signOut()}>
          退出
        </button>
      </span>
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
    <span className="auth-status auth-form">
      <input
        className="auth-input"
        placeholder="邮箱"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="auth-input"
        placeholder="密码 (≥6位)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="link" disabled={!canSubmit} onClick={() => void run(signInWithPassword)}>
        登录
      </button>
      <button className="link" disabled={!canSubmit} onClick={() => void run(signUpWithPassword)}>
        注册
      </button>
      {msg && <span className="auth-msg">{msg}</span>}
    </span>
  );
}
