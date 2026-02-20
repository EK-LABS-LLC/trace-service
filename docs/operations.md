# Pulse Operations Runbook

## Modes

- `pulse-server` (single mode): local SQLite file (`~/.pulse/.data/pulse.db` by default), single-node.
- `pulse-server-scale` (scale mode): Postgres plus partitioned WAL listeners.

## Single Mode Runbook

### Environment

```bash
export PULSE_MODE=single
export PULSE_RUNTIME_MODE=all
export PORT=3000
export BETTER_AUTH_SECRET='replace-with-32+char-secret'
export BETTER_AUTH_URL='http://localhost:3000'
export ENCRYPTION_KEY='replace-with-32+char-secret'
```

### Start / Stop

```bash
bun run db:migrate
bun run pulse.ts
```

Stop with `Ctrl+C` (graceful shutdown is wired).

### Build Binary

```bash
bun run build:pulse
```

Binary output: `dist/pulse-server`.

## Scale Mode Runbook

### Environment

```bash
export PULSE_MODE=scale
export PULSE_RUNTIME_MODE=all
export DATABASE_URL='postgresql://pulse:pulse@localhost:5432/pulse'
export TRACE_WAL_PARTITIONS=4
export SPAN_WAL_PARTITIONS=4
export PORT=3000
export BETTER_AUTH_SECRET='replace-with-32+char-secret'
export BETTER_AUTH_URL='http://localhost:3000'
export ENCRYPTION_KEY='replace-with-32+char-secret'
```

### Start / Stop

```bash
bun run db:migrate:scale
bun run pulse-scale.ts
```

Stop with `Ctrl+C`.

### Split API and listeners (scale mode)

API-only process:

```bash
PULSE_MODE=scale PULSE_RUNTIME_MODE=api bun run pulse-scale.ts
```

Listener-only process:

```bash
PULSE_MODE=scale PULSE_RUNTIME_MODE=listener bun run pulse-scale.ts
```

### Build Binary

```bash
bun run build:pulse-scale
```

Binary output: `dist/pulse-server-scale`.

## Local Scale Testing

Spin up local Postgres container:

```bash
make scale-up
```

Run scale e2e:

```bash
make test-e2e-scale
```

Tear down:

```bash
make scale-down
```

## Release Artifacts

Build both binaries and write checksums:

```bash
bun run release:artifacts
```

Outputs:

- `dist/pulse-server`
- `dist/pulse-server-scale`
- `dist/checksums.txt`
