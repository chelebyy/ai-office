# Security policy

AI Office reads local Codex records. Its HTTP service binds to loopback.
Do not expose it through a public proxy, port forward or shared host.
This project does not provide multi-user isolation or remote authentication.

## Reporting

Report vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/chelebyy/ai-office/security/advisories/new).
Do not put secrets, real session transcripts or exploit details in public issues.
If private reporting is unavailable, open a public issue asking for a private
contact channel without including sensitive details.

Security fixes target the latest code on the default branch. There is no
guaranteed response time or long-term support commitment.

## Data boundaries

See [privacy and data handling](docs/PRIVACY.md). Sanitizing displayed text is
best effort; it does not guarantee anonymization. Review every screenshot
and log before sharing. If a credential was published, revoke or rotate it;
deleting its current file does not remove earlier Git objects or copies.
