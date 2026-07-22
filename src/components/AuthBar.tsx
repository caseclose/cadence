import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { displayUsername, validateUsername } from '../store/username';
import {
  hasActivePushSubscription,
  isPushConfigured,
  isPushSupported,
} from '../notify/push';

export function AuthBar() {
  const {
    user,
    cloudEnabled,
    signInWithUsername,
    signUpWithUsername,
    signOut,
    enablePush,
    disablePush,
  } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPushOn(false);
      return;
    }
    void hasActivePushSubscription().then(setPushOn);
  }, [user]);

  if (!cloudEnabled) {
    return <span className="auth-chip auth-chip-muted">本地模式</span>;
  }

  if (user) {
    const name = displayUsername(user);
    const initial = name[0]?.toUpperCase() ?? '?';
    const pushAvailable = isPushSupported() && isPushConfigured();

    const togglePush = async () => {
      setPushBusy(true);
      setPushMsg(null);
      if (pushOn) {
        const err = await disablePush();
        setPushBusy(false);
        if (err) {
          setPushMsg(err);
          return;
        }
        setPushOn(false);
        return;
      }
      const err = await enablePush();
      setPushBusy(false);
      if (err) {
        setPushMsg(err);
        return;
      }
      setPushOn(true);
    };

    return (
      <div className="auth-user">
        <span className="auth-avatar" aria-hidden>
          {initial}
        </span>
        <span className="auth-email" title={name}>
          {name}
        </span>
        {pushAvailable && (
          <button
            type="button"
            className="btn-sm btn-ghost"
            disabled={pushBusy}
            title={
              pushOn
                ? '关闭本设备的后台推送'
                : '开启后台推送（关页/锁屏也可提醒；iOS 需先添加到主屏幕）'
            }
            onClick={() => void togglePush()}
          >
            {pushBusy ? '…' : pushOn ? '推送开' : '开启推送'}
          </button>
        )}
        <button type="button" className="btn-sm btn-ghost" onClick={() => void signOut()}>
          退出
        </button>
        {pushMsg && <p className="auth-msg auth-msg-inline">{pushMsg}</p>}
      </div>
    );
  }

  const canSubmit = validateUsername(username) && password.length >= 6 && !busy;

  const run = async (fn: (u: string, p: string) => Promise<string | null>) => {
    setBusy(true);
    setMsg(null);
    const err = await fn(username, password);
    setBusy(false);
    setMsg(err);
  };

  return (
    <div className="auth-box">
      <form
        className="auth-inline"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void run(signInWithUsername);
        }}
      >
        <input
          className="auth-field"
          placeholder="用户名（支持中文）"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <span className="auth-divider" aria-hidden />
        <input
          className="auth-field"
          placeholder="密码 ≥6 位"
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
            onClick={() => void run(signUpWithUsername)}
          >
            注册
          </button>
        </div>
      </form>
      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
