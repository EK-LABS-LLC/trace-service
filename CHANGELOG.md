# Changelog

## Unreleased

### Make Auth Simpler - Operations Docs Sweep

Date: 2026-06-23 16:04:38 CDT; Status: Completed; PR: #7 https://github.com/EK-LABS-LLC/trace-service/pull/7
Task: Reflect simplified local auth flow in service operations docs.
Message: Operations docs now point local managed installs to `pulse up` then `pulse dashboard`.
Added/Changed: `docs/operations.md` notes first-run bootstrap and confirms config stores API URL/key/project/server command, not dashboard credentials.
Fixed/Removed: Removed stale expectation that local users manage dashboard email/password in setup docs.
Handoff: Pair with CLI PR #4 and pulse-docs branch `docs/make-auth-simpler-local-flow`.

### Make Auth Simpler - Final Local Smoke And Docs

Date: 2026-06-23 15:44:20 CDT; Status: Completed; PR: #7 https://github.com/EK-LABS-LLC/trace-service/pull/7
Task: Verify final local auth flow and align installed-binary docs.
Message: Fresh `pulse up` bootstrap, local dashboard login, API trace/span ingest, and SDK connectivity were smoke-tested against local trace-service.
Added/Changed: README now documents `pulse up` then `pulse dashboard` after installing server+CLI binaries.
Fixed/Removed: No service behavior changed; documentation now matches the simplified local auth flow.
Handoff: Paired CLI PR #4; local smoke used isolated HOME with config containing no `local_email` or `local_password`.

### Make Auth Simpler - API-Key Local Dashboard Login

Date: 2026-06-23 15:28:20 CDT; Status: Completed; PR: #7 https://github.com/EK-LABS-LLC/trace-service/pull/7
Task: Replace local dashboard email/password handoff with API-key backed local login.
Message: Local dashboard auth now uses the CLI API key/project id to mint a short-lived loopback login URL.
Added/Changed: `/dashboard/api/local-login-token` accepts API-key payloads, creates a Better Auth session for the project admin, and keeps old email/password payloads compatible.
Fixed/Removed: Prevents local login-screen lockout; no public API removed and remote/shared auth is unchanged.
Handoff: Paired CLI PR #4; server restarts only invalidate unconsumed in-memory login URLs; verified with `bun test tests/local-login.test.ts lib/local-secrets.test.ts lib/crypto.test.ts tests/validation.test.ts`.
