# Changelog

## Unreleased

### Make Auth Simpler - API-Key Local Dashboard Login

Date: 2026-06-23 15:28:20 CDT
Task: Replace local dashboard email/password handoff with API-key backed local login.
Message: Local dashboard auth now uses the CLI's saved API key/project id to mint a short-lived loopback login URL.
Status: Completed
PR: #7
PR URL: https://github.com/EK-LABS-LLC/trace-service/pull/7

#### Added

- API-key payload support for `POST /dashboard/api/local-login-token`.
- One-use local login URLs that create a Better Auth session for the API key project admin.
- `tests/local-login.test.ts` covering token creation, redirect, signed session cookie, and dashboard API access.

#### Changed

- Local dashboard handoff no longer needs stored local email/password credentials.
- Existing email/password local-login-token payloads remain supported for backward compatibility.
- Remote/shared auth behavior is unchanged.

#### Fixed

- Prevents local users from getting stuck behind the dashboard login screen when the CLI already has a valid local API key.

#### Removed

- Nothing removed from the public API.

#### Handoff Context

- Branch: `feat/make-auth-simpler`.
- Paired CLI PR: https://github.com/EK-LABS-LLC/trace-cli/pull/4.
- Server restarts only invalidate unconsumed in-memory login URLs; `pulse dashboard` can request a fresh token from durable CLI config.
- Verified with `bun test tests/local-login.test.ts lib/local-secrets.test.ts lib/crypto.test.ts tests/validation.test.ts`.
