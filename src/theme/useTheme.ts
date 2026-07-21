import { useEffect, useState } from 'react';
import { applyTheme, persistTheme, resolveTheme, Theme } from './theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, setTheme, toggle };
}
