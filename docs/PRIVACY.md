# Privacy and data handling

- Codex session files are read locally. The observer does not send commands
  to Codex or call an LLM.
- The browser receives bounded activity information. Raw user messages,
  internal reasoning and complete tool inputs/outputs are not forwarded.
  Visible assistant messages and questions can still contain private data.
- The server binds to `127.0.0.1`, with local cookie and origin checks.
  This is not a remotely deployable, multi-user service.
- Optional Open-Meteo city search and weather requests transmit the search
  text or chosen coordinates to Open-Meteo, not session records.
- Browser preferences and local launcher files remain on your machine.
  The observer reconstructs bounded history from source records after restart.

## Repository hygiene

Historical development reports, raw screenshots, authoring experiments and
machine-specific handoffs are excluded from the maintained source tree.
Runtime artwork lives under `src/web/public`. Automated checks reject
personal path patterns, common credential formats and private artifact paths
in tracked files. They are a guardrail, not an exhaustive security audit.

Published branch histories were rewritten to remove retired private development
files and personal commit email addresses. Existing clones, private backups,
forks and cached commit/PR views may still retain earlier data. Server-side cache
removal has been requested from GitHub Support and is not yet confirmed.
