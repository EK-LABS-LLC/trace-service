# Pulse Dashboard

React + Vite frontend source for the integrated Pulse server UI.

This package is developed in-place under `trace-service/dashboard`, but the
shipped product is `pulse-server`, which serves the built dashboard assets from
the same origin as `/api/auth/*`, `/dashboard/api/*`, and `/v1/*`.

## Local development

Install dependencies and start the dashboard dev server:

```bash
bun install
cp .env.example .env.local # optional
bun run dev
```

By default the dev server proxies API calls to `http://localhost:3000`. Override
that behavior with:

- `VITE_API_BASE_URL`: browser API origin to bake into production builds
- `VITE_API_PROXY_TARGET`: optional dev-server proxy target when the API is not on `localhost:3000`

For an integrated local flow, run the trace service separately:

```bash
cd ..
bun run dev:single
```

## Production build

Build just the dashboard:

```bash
bun run build
```

Build the full server artifact, including bundled dashboard assets:

```bash
cd ..
bun run build:pulse
```

That copies the dashboard build output into `trace-service/dist/dashboard`,
which is what `pulse-server` and the server Docker image serve at runtime.

## Deployment model

The intended deployment is same-origin:

- `https://pulse.example.com/` -> dashboard HTML/assets served by `pulse-server`
- `https://pulse.example.com/api/auth/*` -> `pulse-server`
- `https://pulse.example.com/dashboard/api/*` -> `pulse-server`
- `https://pulse.example.com/v1/*` -> `pulse-server`

This avoids cross-origin cookie and CORS issues. Split-origin dashboard
deployment is only a development override, not the default product model.
