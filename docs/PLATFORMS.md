# Platform verification

| Platform | Evidence and limits |
| --- | --- |
| Windows | Local observer, managed launcher lifecycle and desktop browser flows have been tested. CI runs Windows behavior tests, typecheck and build. |
| Linux | Prior acceptance used Ubuntu 26.04 under WSL 2 with native Linux Node.js, 100 tests, typecheck/build and seven browser checks from Windows Chrome on 17 September 2026. CI additionally runs Linux behavior tests, launcher lifecycle and build for each checked revision. |
| macOS | Not tested; no macOS launcher acceptance is claimed. |

The earlier Linux acceptance included representative Linux files and a real
Windows Codex Desktop record read from WSL. Native Linux Codex CLI lifecycle,
other distributions and a native Linux desktop browser were not covered.
CI success is not a substitute for those live integrations.

Only Codex is tested. Other assistants and LLM integrations are not supported.
The interface targets desktop browsers; mobile is not an acceptance target.
See the current [CI runs](https://github.com/chelebyy/ai-office/actions/workflows/ci.yml)
for commit-specific automated results.
