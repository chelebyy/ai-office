import test from 'node:test';
import assert from 'node:assert/strict';
import {
  languagePreference,
  preferredBrowserLocale,
  resolveLanguage,
  searchText,
} from '../src/web/locale.ts';
import { detectLocale } from '../src/observer/parser.ts';

test('explicit preference wins over session and browser, while automatic follows the selected session', () => {
  assert.deepEqual(resolveLanguage('en', 'tr', 'tr'), { locale: 'en', source: 'preference' });
  assert.deepEqual(resolveLanguage('tr', 'en', 'en'), { locale: 'tr', source: 'preference' });
  assert.deepEqual(resolveLanguage('auto', 'tr', 'en'), { locale: 'tr', source: 'session' });
  assert.deepEqual(resolveLanguage('auto', 'en', 'tr'), { locale: 'en', source: 'session' });
});

test('invalid saved choices and missing or unsupported session languages fall back safely', () => {
  for (const value of [null, undefined, '', 'de', 'invalid', {}]) {
    assert.equal(languagePreference(value), 'auto');
    assert.deepEqual(resolveLanguage(value, 'ar', 'en'), { locale: 'en', source: 'browser' });
  }
  assert.equal(resolveLanguage('auto', null, 'tr').locale, 'tr');
});

test('browser preference order selects the first supported language and defaults to English', () => {
  assert.equal(preferredBrowserLocale(['tr-TR', 'en-US']), 'tr');
  assert.equal(preferredBrowserLocale(['EN-gb', 'tr']), 'en');
  assert.equal(preferredBrowserLocale(['fr-FR', 'tr-TR', 'en']), 'tr');
  assert.equal(preferredBrowserLocale(['de-DE', 'ar']), 'en');
  assert.equal(preferredBrowserLocale([]), 'en');
});

test('room search handles dotted and dotless Turkish I and accent-insensitive queries', () => {
  assert.ok(searchText('İSTANBUL IŞIK').includes(searchText('istanbul ışık')));
  assert.ok(searchText('Kitaplık · GÖREVLER').includes(searchText('kitaplik')));
  assert.ok(searchText('Üçüncü oturum').includes(searchText('ucuncu')));
});

test('clear Turkish and English changes work in uppercase too', () => {
  assert.equal(detectLocale('IMPLEMENT THIS WITH CARE.', 'tr'), 'en');
  assert.equal(detectLocale('PLEASE IMPLEMENT THIS FEATURE FOR THE PROJECT.', 'tr'), 'en');
  assert.equal(detectLocale('ŞİMDİ BU ÖZELLİĞİ BENİM İÇİN YAP.', 'en'), 'tr');
  assert.equal(detectLocale('Please update this feature for the project.', 'tr'), 'en');
  assert.equal(detectLocale('Şimdi bu özelliği benim için yap.', 'en'), 'tr');
});

test('inline code, quoted passages and pasted error lines do not change the conversation language', () => {
  assert.equal(detectLocale('`please implement this with the new test`', 'tr'), 'tr');
  assert.equal(detectLocale('> Please implement this feature for the project.', 'tr'), 'tr');
  assert.equal(detectLocale('Error: Please implement this feature for the project.', 'tr'), 'tr');
  assert.equal(
    detectLocale('Şimdi bunu yap. `please implement this with the new test`', 'en'),
    'tr',
  );
});

test('shared accents alone do not classify German as Turkish and short replies retain the language', () => {
  assert.equal(detectLocale('Bitte prüfe die Oberfläche und ändere die Größe.'), null);
  assert.equal(detectLocale('Bitte prüfe die Oberfläche und ändere die Größe.', 'en'), 'en');
  for (const message of ['ok', 'tamam', 'yes', 'devam'])
    assert.equal(detectLocale(message, 'tr'), 'tr');
  assert.equal(detectLocale('يرجى تحديث هذه الميزة في المشروع.'), null);
});
