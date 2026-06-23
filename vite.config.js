import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Servido em http://10.100.12.23/dividas/ pelo Nginx (location /dividas/).
  // O base precisa bater com o subpath pra os assets carregarem certo.
  base: "/dividas/",
  server: {
    host: true,
    port: 5173,
  },
});
