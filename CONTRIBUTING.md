# Contributing to AI Office

Use Node.js 24.13 or newer in the 24.x line and run `npm ci`.
Start development with `npm run dev`; refresh the browser for web changes and
restart the observer for server changes.

Before opening a pull request, run `npm run check`. It checks repository
hygiene, TypeScript, behavioral tests and the production build. CI runs on
Windows and Linux; each platform skips the other platform's launcher tests.
Add regression coverage for behavior changes. Describe what you tested and
any remaining platform limitations.

Keep changes focused. Preserve the local-only observer model and bounded
record reading. Never add real Codex transcripts, home-directory paths,
credentials, local reports or screenshots of private conversations. Use
synthetic fixtures and review image metadata as well as visible pixels.

Run `npm run format` for source formatting. Do not include unrelated
formatting changes. Dependency versions and the lockfile are committed;
Dependabot proposes weekly dependency and GitHub Actions updates.

## Releases

Maintainers update the package version and lockfile in a reviewed pull request.
After merging and verifying CI, an explicitly authorized `v<version>` tag
triggers Windows/Linux validation and a GitHub source release. The tag must
match `package.json`. No server deployment or npm publication occurs.
Users install the source release using the README instructions.

## Compatibility

Public configuration uses `AI_OFFICE_*`. Legacy `CHELEBY_*` aliases remain
accepted when the corresponding new variable is empty or unset. Non-empty
new variables win. Launcher port arguments override environment variables.
The existing IPC names, health protocol identifier and browser preference
keys remain stable so upgrades can manage an already running local instance.
