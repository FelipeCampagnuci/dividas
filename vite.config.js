import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Servido na raiz de uma porta dedicada (pm2 -> node server.mjs na :3200),
  // então base "/" — igual ao meet-monitor que roda na :3100.
  base: "/",
  server: {
    host: true,
    port: 5173,
  },
});
