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

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SCALE_DATABASE_PORT="${SCALE_DATABASE_PORT:-55433}"
SCALE_DATABASE_URL="${SCALE_DATABASE_URL:-postgresql://pulse:pulse@localhost:${SCALE_DATABASE_PORT}/pulse}"
PORT="${TEST_PORT:-}"
if [[ -z "$PORT" ]]; then
  if [[ "$SPLIT" == "1" ]]; then
    PORT="$((20000 + RANDOM % 20000))"
  else
    PORT="3000"
  fi
fi

SUFFIX="${MODE}"
if [[ "$SPLIT" == "1" ]]; then
  SUFFIX="${SUFFIX}-split"
fi

TEST_DATA_DIR="$(mktemp -d "/tmp/pulse-test-${SUFFIX}.XXXXXX")"
DATABASE_PATH="${TEST_DATA_DIR}/pulse.test.db"
WAL_DIR="${TEST_DATA_DIR}/wal.test"
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
  DATABASE_PATH="$DATABASE_PATH" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" bun run db:migrate

  if [[ "$SPLIT" == "1" ]]; then
    echo "Using split test port $PORT"
    PORT="$PORT" DATABASE_PATH="$DATABASE_PATH" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=listener bun run pulse.ts >"$LISTENER_LOG" 2>&1 &
    PIDS+=("$!")
    PORT="$PORT" DATABASE_PATH="$DATABASE_PATH" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=api bun run pulse.ts >"$API_LOG" 2>&1 &
    PIDS+=("$!")
  else
    PORT="$PORT" DATABASE_PATH="$DATABASE_PATH" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 bun run pulse.ts >"$APP_LOG" 2>&1 &
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
    PORT="$PORT" PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=listener bun run pulse-scale.ts >"$LISTENER_LOG" 2>&1 &
    PIDS+=("$!")
    PORT="$PORT" PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 PULSE_RUNTIME_MODE=api bun run pulse-scale.ts >"$API_LOG" 2>&1 &
    PIDS+=("$!")
  else
    PULSE_MODE=scale DATABASE_URL="$SCALE_DATABASE_URL" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" TRACE_WAL_PARTITIONS=1 SPAN_WAL_PARTITIONS=1 PORT="$PORT" bun run pulse-scale.ts >"$APP_LOG" 2>&1 &
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
  TEST_BASE_URL="http://localhost:${PORT}" DATABASE_PATH="$DATABASE_PATH" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" bun test --env-file=.env.test
else
  TEST_BASE_URL="http://localhost:${PORT}" WAL_DIR="$WAL_DIR" WAL_SPAN_DIR="$WAL_SPAN_DIR" bun test --env-file=.env.test
fi
