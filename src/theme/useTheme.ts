import { useEffect, useState } from 'react';
import { applyTheme, persistTheme, resolveTheme, systemTheme, Theme } from './theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme());

  useEffect(() => {
    if (theme !== 'auto' || typeof matchMedia === 'undefined') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(systemTheme());
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [theme]);

  useEffect(() => {
    applyTheme(theme === 'auto' ? systemTheme() : theme as 'light' | 'dark');
    persistTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'auto' : 'light'));

  return { theme, setTheme, toggle };
}
