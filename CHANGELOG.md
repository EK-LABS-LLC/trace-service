# Changelog

## Unreleased

### Add Install Version Metadata

Date: 2026-06-28 00:00 CDT; Status: Completed; PR: pending
Task: Let the CLI detect installed server/dashboard release versions.
Changed: Bumped trace-service package version to 0.2.13.
Added: Installer writes `.pulse-install.toml` next to installed binaries.

### Fix Version Guard Release Baseline

Date: 2026-06-24 21:56 CDT; Status: Completed; PR: #11 https://github.com/EK-LABS-LLC/trace-service/pull/11
Task: Compare service version checks against released tags instead of main.
Changed: Bumped trace-service package version to 0.2.12.
Fixed: PR CI now requires package.json to be above the latest release tag.

### Guard Service Release Version

Date: 2026-06-24 18:25 CDT; Status: Completed; PR: #10 https://github.com/EK-LABS-LLC/trace-service/pull/10
Task: Add an internal service version and prevent stale release versions from merging.
Changed: Added trace-service package version 0.2.11.
Added: PR CI now checks that package.json is bumped above main/latest tag.

### Codex Span Source Support

Date: 2026-06-23 17:45 CDT; Status: Completed; PR: #9 https://github.com/EK-LABS-LLC/trace-service/pull/9
Task: Accept spans emitted by the new Codex CLI hook integration.
Message: Service validation and dashboard types now include `codex` as an agent span source.
Added/Changed: Added validation coverage so Codex spans can be ingested and shown with other agent sessions.

### Agent Session Display Names

Date: 2026-06-23 17:18 CDT; Status: Completed; PR: #8 https://github.com/EK-LABS-LLC/trace-service/pull/8
Task: Make agent sessions easier to connect to the real AI conversation.
Message: Dashboard agent sessions now show a friendly name from title, first prompt, folder, or short ID.
Changed/Added: Search covers friendly name, folder, model, source, prompt, and raw session ID.

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
