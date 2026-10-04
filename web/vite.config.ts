import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // "api" is the compose service. Proxying keeps API calls same-origin, so the auth cookie just works.
    proxy: { "/api": "http://api:3000" },
  },
});
