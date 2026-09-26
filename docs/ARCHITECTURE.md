# Architecture

- `src/observer`: discovers and incrementally reads bounded Codex records,
  converts public activity, serves the loopback HTTP/WebSocket API and manages
  observation state.
- `src/shared/contract.ts`: typed snapshot and runtime contracts shared by
  observer and web client.
- `src/web/fixed-office`: default fixed-camera React office, room selection,
  activity display, motion, lighting and optional weather.
- `src/web/office`: legacy WebGL view retained for compatibility.
- `src/web/public`: runtime artwork and models. Earlier internal artwork
  names are asset identifiers, not user configuration.
- `scripts`: Windows/Linux launchers and their local supervisor.
- `test`: synthetic behavior, privacy, state and platform launcher tests.

The supervisor owns only the server it launched and coordinates through
local IPC. Stopping observation does not stop Codex. Existing IPC names and
the health protocol identifier are retained for compatibility with older
running instances.

The application is installed locally from source; a static web deployment
alone cannot read local Codex records. CI validates Windows and Linux builds.
Release automation publishes source releases after those checks pass.

Optional title-index I/O shares a bounded deadline. If a child's parent is
discovered only after the scan's file budget is consumed, that family is
prioritized on the next scan; the file-read cap is never exceeded.
Startup may replace an absent persisted room with an available room. A room
selected during the current visit is never silently replaced by another
project when its data disappears. Ambient pets remain intentionally disabled.
