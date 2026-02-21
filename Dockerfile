FROM oven/bun:1.3.5-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build:pulse

FROM oven/bun:1.3.5-alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist/pulse-server /usr/local/bin/pulse-server

EXPOSE 3000
VOLUME ["/root/.pulse"]

ENTRYPOINT ["pulse-server"]
