FROM oven/bun:1.3.5-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY dashboard/package.json dashboard/bun.lock ./dashboard/
RUN cd dashboard && bun install --frozen-lockfile

COPY . .
RUN bun run build:pulse

FROM oven/bun:1.3.5-alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist/pulse-server /usr/local/bin/pulse-server
COPY --from=build /app/dist/dashboard /app/dashboard

ENV DASHBOARD_DIST_DIR=/app/dashboard

EXPOSE 3000
VOLUME ["/root/.pulse"]

ENTRYPOINT ["pulse-server"]
