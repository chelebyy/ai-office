import type { Locale } from '../shared/contract.ts';

export type LanguagePreference = Locale | 'auto';
export const LANGUAGE_KEY = 'cheleby.office.language';

export function isLocale(value: unknown): value is Locale {
  return value === 'tr' || value === 'en';
}

export function languagePreference(value: unknown): LanguagePreference {
  return isLocale(value) ? value : 'auto';
}

export function preferredBrowserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function resolveLanguage(preference: unknown, sessionLocale: unknown, browser: Locale) {
  if (isLocale(preference)) return { locale: preference, source: 'preference' as const };
  if (isLocale(sessionLocale)) return { locale: sessionLocale, source: 'session' as const };
  return { locale: browser, source: 'browser' as const };
}

export function searchText(value: string): string {
  return value.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i');
}
