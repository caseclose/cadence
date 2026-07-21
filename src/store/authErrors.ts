/** Map Supabase Auth errors to user-friendly 中文提示. */
export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return '用户名或密码错误。若尚未注册，请先点「注册」。';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return '该用户名已被占用，请换一个或直接登录。';
  }
  if (m.includes('password') && m.includes('weak')) {
    return '密码强度不足，请使用至少 6 位的更强密码。';
  }
  if (m.includes('rate limit')) {
    return '请求过于频繁，请稍后再试。';
  }
  if (m.includes('validate email') || (m.includes('email') && m.includes('invalid format'))) {
    return '登录服务暂时无法识别该用户名，请刷新页面后重试；仍失败请联系管理员。';
  }
  return message;
}
