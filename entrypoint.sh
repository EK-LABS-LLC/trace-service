#!/bin/sh
set -e

# Wait for Postgres to be ready
echo "Waiting for database..."
until bun -e "
  const url = process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5432/pulse';
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  const [, user, password, host, port, db] = match;
  const net = require('net');
  const sock = net.createConnection({ host, port: Number(port) });
  sock.on('connect', () => { sock.destroy(); process.exit(0); });
  sock.on('error', () => { process.exit(1); });
" 2>/dev/null; do
  echo "Database not ready, retrying in 2s..."
  sleep 2
done
echo "Database is ready."

echo "Running database migrations..."
bun run db:migrate

echo "Starting server..."
exec bun run index.ts
