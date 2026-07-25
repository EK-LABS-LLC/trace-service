#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "single" && "$MODE" != "scale" ]]; then
  echo "Usage: $0 <single|scale>"
  exit 1
fi

SPLIT="${SPLIT:-0}"
if [[ "$SPLIT" != "0" && "$SPLIT" != "1" ]]; then
  echo "SPLIT must be 0 or 1"
  exit 1
fi

export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-test-secret-key-at-least-32-characters-long}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-8d2a52c8333cabd7d3e49fd6a60da5574f5722d64fc4a2b211390a1634553a03}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}"
export FRONTEND_URL="${FRONTEND_URL:-$BETTER_AUTH_URL}"
export NODE_ENV="${NODE_ENV:-test}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCALE_DATABASE_PORT="${SCALE_DATABASE_PORT:-55433}"
SCALE_DATABASE_URL="${SCALE_DATABASE_URL:-postgresql://pulse:pulse@localhost:${SCALE_DATABASE_PORT}/pulse}"
# Always pick a random high port by default so the suite never collides with
# a dev server on :3000 (set TEST_PORT to pin one).
PORT="${TEST_PORT:-$((20000 + RANDOM % 20000))}"

SUFFIX="${MODE}"
if [[ "$SPLIT" == "1" ]]; then
  SUFFIX="${SUFFIX}-split"
fi

TEST_DATA_DIR="$(mktemp -d "/tmp/pulse-test-${SUFFIX}.XXXXXX")"
DATABASE_PATH="${TEST_DATA_DIR}/pulse.test.db"
WAL_SPAN_DIR="${TEST_DATA_DIR}/wal-spans.test"

APP_LOG="/tmp/trace-service-${SUFFIX}-test.log"
API_LOG="/tmp/trace-service-${SUFFIX}-api-test.log"
LISTENER_LOG="/tmp/trace-service-${SUFFIX}-listener-test.log"

declare -a PIDS=()
POSTGRES_STARTED=0

cleanup() {
  local exit_code=$?

  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done

  if [[ "$POSTGRES_STARTED" == "1" ]]; then
    PULSE_SCALE_PG_PORT="$SCALE_DATABASE_PORT" docker compose -f docker-compose.scale.yml down -v >/dev/null 2>&1 || true
  fi

  rm -rf "$TEST_DATA_DIR"
  exit "$exit_code"
}

print_logs_and_fail() {
  local message="$1"
  echo "$message"
  if [[ "$SPLIT" == "1" ]]; then
    echo "API logs:"
    tail -n 120 "$API_LOG" || true
    echo "Listener logs:"
    tail -n 120 "$LISTENER_LOG" || true
  else
    echo "Service logs:"
    tail -n 120 "$APP_LOG" || true
  fi
  exit 1
}

wait_for_health() {
  local url="$1"
  local max_attempts=40
  local i=0
  while (( i < max_attempts )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
  return 1
}

wait_for_postgres() {
  local max_attempts=60
  local i=0
  while (( i < max_attempts )); do
    if PULSE_SCALE_PG_PORT="$SCALE_DATABASE_PORT" docker compose -f docker-compose.scale.yml exec -T postgres pg_isready -U pulse -d pulse >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

start_single() {
  DATABASE_PATH="$DATABASE_PATH" WAL_SPAN_DIR="$WAL_SPAN_DIR" bun run db:migrate

  if [[ "$SPLIT" == "1" ]]; then
    echo "Using split test port $PORT"
    PORT="$PORT" DATABASE_PATH="$DATABASE_PATH" WAL_SPAN_DIR="$WAL_SPAN_DIR" SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=listener bun run pulse.ts >"$LISTENER_LOG" 2>&1 &
    PIDS+=("$!")
    PORT="$PORT" DATABASE_PATH="$DATABASE_PATH" WAL_SPAN_DIR="$WAL_SPAN_DIR" SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=api bun run pulse.ts >"$API_LOG" 2>&1 &
    PIDS+=("$!")
  else
    PORT="$PORT" DATABASE_PATH="$DATABASE_PATH" WAL_SPAN_DIR="$WAL_SPAN_DIR" SPAN_WAL_PARTITIONS=1 bun run pulse.ts >"$APP_LOG" 2>&1 &
    PIDS+=("$!")
  fi
}

start_scale() {
  PULSE_SCALE_PG_PORT="$SCALE_DATABASE_PORT" docker compose -f docker-compose.scale.yml up -d postgres
  POSTGRES_STARTED=1

  if ! wait_for_postgres; then
    echo "Postgres failed to become ready"
    exit 1
  fi

  PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" bun run db:migrate:scale

  if [[ "$SPLIT" == "1" ]]; then
    echo "Using split scale test port $PORT"
    PORT="$PORT" PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" WAL_SPAN_DIR="$WAL_SPAN_DIR" SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=listener bun run pulse.ts >"$LISTENER_LOG" 2>&1 &
    PIDS+=("$!")
    PORT="$PORT" PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" WAL_SPAN_DIR="$WAL_SPAN_DIR" SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=api bun run pulse.ts >"$API_LOG" 2>&1 &
    PIDS+=("$!")
  else
    PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" WAL_SPAN_DIR="$WAL_SPAN_DIR" SPAN_WAL_PARTITIONS=1 PORT="$PORT" bun run pulse.ts >"$APP_LOG" 2>&1 &
    PIDS+=("$!")
  fi
}

trap cleanup EXIT INT TERM

if [[ "$MODE" == "single" ]]; then
  start_single
else
  start_scale
fi

if ! wait_for_health "http://localhost:${PORT}/health"; then
  if [[ "$SPLIT" == "1" ]]; then
    print_logs_and_fail "Split ${MODE} API process failed to become healthy."
  elif [[ "$MODE" == "scale" ]]; then
    print_logs_and_fail "Scale service failed to become healthy."
  else
    print_logs_and_fail "Service failed to become healthy."
  fi
fi

if [[ "$MODE" == "single" ]]; then
  TEST_BASE_URL="http://localhost:${PORT}" DATABASE_PATH="$DATABASE_PATH" WAL_SPAN_DIR="$WAL_SPAN_DIR" bun test --env-file=.env.test
else
  TEST_BASE_URL="http://localhost:${PORT}" WAL_SPAN_DIR="$WAL_SPAN_DIR" bun test --env-file=.env.test
fi
