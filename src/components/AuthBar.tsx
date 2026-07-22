import { useEffect, useState } from 'react';
import { useLocale, t } from '../i18n';
import { useStore } from '../store/useStore';
import { displayUsername, validateUsername } from '../store/username';
import {
  hasActivePushSubscription,
  isPushConfigured,
  isPushSupported,
} from '../notify/push';

export function AuthBar() {
  useLocale();
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
    return <span className="auth-chip auth-chip-muted">{t('localMode')}</span>;
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
            title={pushOn ? t('disablePushTitle') : t('enablePushTitle')}
            onClick={() => void togglePush()}
          >
            {pushBusy ? '…' : pushOn ? t('pushEnabled') : t('enablePush')}
          </button>
        )}
        <button type="button" className="btn-sm btn-ghost" onClick={() => void signOut()}>
          {t('signOut')}
        </button>
        {pushMsg && (
          <p
            className="auth-msg auth-msg-inline auth-msg-dismiss"
            role="button"
            tabIndex={0}
            title={t('clickDismiss')}
            onClick={() => setPushMsg(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPushMsg(null);
              }
            }}
          >
            {pushMsg}
          </p>
        )}
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
          placeholder={t('username')}
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <span className="auth-divider" aria-hidden />
        <input
          className="auth-field"
          placeholder={t('password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="auth-actions">
          <button type="submit" className="btn-sm btn-primary" disabled={!canSubmit}>
            {t('signIn')}
          </button>
          <button
            type="button"
            className="btn-sm btn-ghost"
            disabled={!canSubmit}
            onClick={() => void run(signUpWithUsername)}
          >
            {t('signUp')}
          </button>
        </div>
      </form>
      {msg && <p className="auth-msg">{msg}</p>}
    </div>
  );
}
