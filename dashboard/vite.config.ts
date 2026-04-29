import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_PROXY_TARGET =
  process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api/auth": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      "/dashboard/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      "/v1": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      "/health": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
