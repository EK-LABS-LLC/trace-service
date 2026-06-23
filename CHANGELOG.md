# Changelog

## Unreleased

### Local auth simplification

- Added API-key backed local dashboard login for loopback-only use.
- `POST /dashboard/api/local-login-token` now accepts `{ api_key, project_id, redirect_url }` and returns a short-lived, one-use local login URL.
- Consuming the login URL creates a Better Auth session for the admin user attached to the API key's project, then redirects to the local dashboard.
- Existing email/password local login-token payloads are still accepted for backward compatibility.
- Remote/shared auth behavior is unchanged; normal dashboard login remains in place outside local loopback handoff.
- Added `tests/local-login.test.ts` to verify API-key local login creates a signed session cookie that can access dashboard APIs.

### Handoff context

- This is part of the `make auth simpler` effort on branch `feat/make-auth-simpler`.
- Paired CLI work should send the local API key and project id instead of stored local email/password.
- A server restart invalidates only unconsumed in-memory login URLs. The durable path remains CLI config API key -> project admin lookup -> fresh Better Auth session.
- Verified with `bun test tests/local-login.test.ts lib/local-secrets.test.ts lib/crypto.test.ts tests/validation.test.ts`.
