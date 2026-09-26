export type OfficeTheme = 'day' | 'sunset' | 'night';
export type ThemePreference = OfficeTheme | 'auto';

export const OFFICE_THEME_KEY = 'cheleby.office.theme';
export const OFFICE_LOCATION_KEY = 'cheleby.office.location';
export const OFFICE_SETUP_KEY = 'cheleby.office.setup';
export const DAY_WINDOW_ASSET = '/office/day-window-v1.png';
export const NIGHT_WINDOW_ASSET = '/office/night-window-v1.png';

export function officeTheme(value: unknown): ThemePreference {
  return value === 'auto' || value === 'day' || value === 'night' ? value : 'sunset';
}
