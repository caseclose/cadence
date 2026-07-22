import { t } from '../i18n';

/** Map Supabase Auth errors to localized user-friendly messages. */
export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return t('errInvalidCredentials');
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return t('errUserExists');
  }
  if (m.includes('password') && m.includes('weak')) {
    return t('errWeakPassword');
  }
  if (m.includes('rate limit')) {
    return t('errRateLimit');
  }
  if (m.includes('validate email') || (m.includes('email') && m.includes('invalid format'))) {
    return t('errInvalidUsernameAuth');
  }
  return message;
}
