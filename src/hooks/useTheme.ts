import { useCallback, useEffect, useState } from 'react';
import { themes, type Theme, type ThemeSetting } from '../themes';

const STORAGE_KEY = 'web-praat-theme';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(setting: ThemeSetting): Theme {
  return setting === 'auto' ? getSystemTheme() : setting;
}

function applyTheme(theme: Theme) {
  const vars = themes[theme];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function useTheme() {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(STORAGE_KEY) as ThemeSetting) || 'dark';
  });

  const resolved = resolveTheme(setting);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (setting !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme(resolveTheme('auto'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setting]);

  const setTheme = useCallback((newSetting: ThemeSetting) => {
    setSetting(newSetting);
    localStorage.setItem(STORAGE_KEY, newSetting);
  }, []);

  return { setting, resolved, setTheme };
}
