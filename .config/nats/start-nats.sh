#!/bin/sh
set -eu

: "${NATS_CONFIG:=/etc/nats/nats-server.conf}"
: "${NATS_URL:=nats://127.0.0.1:4222}"
: "${JETSTREAM_HEALTH:=http://127.0.0.1:8222/healthz}"
: "${STREAM_NAME:=TRACE_STREAM}"
: "${STREAM_CONFIG:=/etc/nats/streams/trace-stream.json}"
: "${CONSUMER_NAME:=trace-stream-consumer}"
: "${CONSUMER_CONFIG:=/etc/nats/consumers/trace-stream-consumer.json}"
: "${MAX_RETRIES:=60}"
: "${RETRY_DELAY:=1}"

nats-server -c "$NATS_CONFIG" &
SERVER_PID=$!
cleanup(){ kill "$SERVER_PID" >/dev/null 2>&1 || true; wait "$SERVER_PID" >/dev/null 2>&1 || true; }
trap cleanup INT TERM EXIT

attempt=0
until wget -qO- "$JETSTREAM_HEALTH" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "[nats-init] JetStream at $JETSTREAM_HEALTH not ready"
    exit 1
  fi
  sleep "$RETRY_DELAY"
done

if [ -f "$STREAM_CONFIG" ] && ! nats --server="$NATS_URL" stream info "$STREAM_NAME" >/dev/null 2>&1; then
  nats --server="$NATS_URL" stream create --config="$STREAM_CONFIG"
fi

if [ -f "$CONSUMER_CONFIG" ] && ! nats --server="$NATS_URL" consumer info "$STREAM_NAME" "$CONSUMER_NAME" >/dev/null 2>&1; then
  nats --server="$NATS_URL" consumer create "$STREAM_NAME" --config="$CONSUMER_CONFIG"
fi

wait "$SERVER_PID"
