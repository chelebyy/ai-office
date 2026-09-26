/** Public AI_OFFICE_* settings take precedence over the legacy aliases. */
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const setting = (name: string) => env[`AI_OFFICE_${name}`] || env[`CHELEBY_${name}`];
  function integer(name: string, fallback: number, min: number, max: number) {
    const input = setting(name);
    if (!input) return fallback;
    const value = Number(input);
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`AI_OFFICE_${name}: expected ${min}–${max}`);
    return value;
  }
  return {
    reader: {
      codexHome: setting('CODEX_HOME'),
      recentDays: integer('RECENT_DAYS', 7, 1, 366),
      maxFiles: integer('MAX_FILES', 60, 1, 250),
      pollIntervalMs: integer('POLL_MS', 1500, 500, 30000),
    },
    port: integer('PORT', 4317, 1024, 65535),
    tracking: setting('TRACKING') !== 'stopped',
  };
}
