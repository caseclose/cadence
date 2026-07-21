import { useState } from 'react';
import { useStore } from '../store/useStore';

export function AuthBar() {
  const { user, cloudEnabled, signInWithEmail, signOut } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (!cloudEnabled) {
    return <span className="auth-status">本地模式（未配置云同步）</span>;
  }

  if (user) {
    return (
      <span className="auth-status">
        {user.email} · <button className="link" onClick={() => void signOut()}>退出</button>
      </span>
    );
  }

  if (sent) {
    return <span className="auth-status">登录链接已发到 {email}，去邮箱点一下</span>;
  }

  return (
    <span className="auth-status">
      <input
        className="auth-input"
        placeholder="邮箱登录以跨设备同步"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="link"
        disabled={!email.includes('@')}
        onClick={async () => {
          await signInWithEmail(email);
          setSent(true);
        }}
      >
        发送登录链接
      </button>
    </span>
  );
}
