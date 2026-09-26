import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/observer/config.ts';

test('public settings override legacy aliases, including tracking and profile', () => {
  const config = readConfig({
    AI_OFFICE_PORT: '4327',
    CHELEBY_PORT: '4318',
    AI_OFFICE_CODEX_HOME: '/profiles/current',
    CHELEBY_CODEX_HOME: '/profiles/legacy',
    AI_OFFICE_TRACKING: 'running',
    CHELEBY_TRACKING: 'stopped',
    AI_OFFICE_RECENT_DAYS: '10',
    AI_OFFICE_MAX_FILES: '100',
    AI_OFFICE_POLL_MS: '2500',
  });
  assert.equal(config.port, 4327);
  assert.equal(config.tracking, true);
  assert.deepEqual(config.reader, {
    codexHome: '/profiles/current',
    recentDays: 10,
    maxFiles: 100,
    pollIntervalMs: 2500,
  });
});

test('legacy settings and empty public settings retain existing behavior', () => {
  const config = readConfig({
    AI_OFFICE_PORT: '',
    CHELEBY_PORT: '4320',
    CHELEBY_CODEX_HOME: '/profiles/legacy',
    CHELEBY_TRACKING: 'stopped',
    CHELEBY_RECENT_DAYS: '2',
    CHELEBY_MAX_FILES: '20',
    CHELEBY_POLL_MS: '500',
  });
  assert.equal(config.port, 4320);
  assert.equal(config.tracking, false);
  assert.deepEqual(config.reader, {
    codexHome: '/profiles/legacy',
    recentDays: 2,
    maxFiles: 20,
    pollIntervalMs: 500,
  });
  assert.equal(readConfig({}).port, 4317);
  assert.equal(readConfig({}).reader.codexHome, undefined);
});

test('invalid preferred values fail rather than silently using a legacy value', () => {
  for (const [name, values] of Object.entries({
    PORT: ['1023', '65536', 'abc', '4317.5'],
    RECENT_DAYS: ['0', '367'],
    MAX_FILES: ['0', '251'],
    POLL_MS: ['499', '30001'],
  })) {
    for (const value of values)
      assert.throws(
        () => readConfig({ [`AI_OFFICE_${name}`]: value }),
        new RegExp(`AI_OFFICE_${name}`),
      );
  }
  assert.throws(() => readConfig({ AI_OFFICE_PORT: 'invalid', CHELEBY_PORT: '4317' }));
});
