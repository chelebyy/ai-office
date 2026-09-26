import { useEffect, useState } from 'react';
import { browserLocale } from './i18n.ts';
import { LANGUAGE_KEY, languagePreference, resolveLanguage } from './locale.ts';

function readPreference() {
  try {
    return languagePreference(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return 'auto' as const;
  }
}

export function useLanguage(sessionLocale?: unknown) {
  const [preference, setPreferenceState] = useState(readPreference);
  const [browser, setBrowser] = useState(browserLocale);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY || event.key === null) setPreferenceState(readPreference());
    };
    const languageChanged = () => setBrowser(browserLocale());
    window.addEventListener('storage', sync);
    window.addEventListener('languagechange', languageChanged);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('languagechange', languageChanged);
    };
  }, []);

  function setPreference(value: string) {
    const next = languagePreference(value);
    setPreferenceState(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // The choice still works for the current view when storage is unavailable.
    }
  }

  return { ...resolveLanguage(preference, sessionLocale, browser), preference, setPreference };
}
