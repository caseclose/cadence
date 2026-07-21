/** Map Supabase Auth errors to user-friendly 中文提示. */
export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('email rate limit')) {
    return 'Supabase 内置邮件发送已达上限（免费版每小时仅几封）。请先在 Supabase 关闭邮箱验证，或等约 1 小时后再试。';
  }
  if (m.includes('invalid login credentials')) {
    return '邮箱或密码错误。若尚未注册，请先点「注册」。';
  }
  if (m.includes('user already registered')) {
    return '该邮箱已注册，请直接登录。';
  }
  if (m.includes('password') && m.includes('weak')) {
    return '密码强度不足，请使用至少 6 位的更强密码。';
  }
  return message;
}
