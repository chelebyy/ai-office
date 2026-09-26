import { useEffect, useState } from 'react';
import {
  OFFICE_THEME_KEY,
  OFFICE_LOCATION_KEY,
  OFFICE_SETUP_KEY,
  officeTheme,
  type ThemePreference,
} from './office-theme.ts';
import { solarLighting, validLocation, type OfficeLocation } from './office-environment.ts';

function readEnvironment() {
  try {
    const raw = localStorage.getItem(OFFICE_LOCATION_KEY);
    let location: OfficeLocation | null = null;
    try {
      location = validLocation(JSON.parse(raw ?? 'null'));
    } catch {
      /* Invalid saved data needs a fresh choice. */
    }
    return {
      preference: officeTheme(localStorage.getItem(OFFICE_THEME_KEY)),
      location,
      setupDone: localStorage.getItem(OFFICE_SETUP_KEY) === '1' || !!location,
    };
  } catch {
    return { preference: 'sunset' as ThemePreference, location: null, setupDone: false };
  }
}
function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The current view still works without persistence. */
  }
}
export function useOfficeTheme(now: number) {
  const [environment, setEnvironment] = useState(readEnvironment);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (
        event.key === null ||
        [OFFICE_THEME_KEY, OFFICE_LOCATION_KEY, OFFICE_SETUP_KEY].includes(event.key)
      )
        setEnvironment(readEnvironment());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const solar = solarLighting(now, environment.location);
  function setTheme(value: string) {
    const preference = officeTheme(value);
    setEnvironment((current) => ({ ...current, preference }));
    persist(OFFICE_THEME_KEY, preference);
  }
  function saveLocation(value: OfficeLocation) {
    const location = validLocation(value);
    if (!location) return;
    setEnvironment({ location, preference: 'auto', setupDone: true });
    persist(OFFICE_LOCATION_KEY, JSON.stringify(location));
    persist(OFFICE_THEME_KEY, 'auto');
    persist(OFFICE_SETUP_KEY, '1');
  }
  function skipSetup() {
    setEnvironment((current) => ({ ...current, setupDone: true }));
    persist(OFFICE_SETUP_KEY, '1');
  }
  return {
    ...environment,
    theme: environment.preference === 'auto' ? solar.theme : environment.preference,
    dawn: environment.preference === 'auto' && solar.dawn,
    setTheme,
    saveLocation,
    skipSetup,
  };
}
