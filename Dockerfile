# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy trace-service package files
COPY trace-service/package.json trace-service/bun.lock* ./trace-service/

# Install dependencies
WORKDIR /app/trace-service
RUN bun install

# Copy trace-service source files
COPY trace-service .

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy package files and install deps (need drizzle-kit for migrations)
COPY --from=builder /app/trace-service/package.json ./
COPY --from=builder /app/trace-service/bun.lock* ./
RUN bun install

# Copy source code
COPY --from=builder /app/trace-service/*.ts ./
COPY --from=builder /app/trace-service/auth ./auth
COPY --from=builder /app/trace-service/event-bus ./event-bus
COPY --from=builder /app/trace-service/db ./db
COPY --from=builder /app/trace-service/drizzle ./drizzle
COPY --from=builder /app/trace-service/middleware ./middleware
COPY --from=builder /app/trace-service/routes ./routes
COPY --from=builder /app/trace-service/services ./services
COPY --from=builder /app/trace-service/shared ./shared

# Copy drizzle config for migrations
COPY --from=builder /app/trace-service/drizzle.config.ts ./

# Copy entrypoint script
COPY trace-service/entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
