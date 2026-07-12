import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ quoteStyle: "double" }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // Required for SSE (Server-Sent Events) — prevents proxy from buffering
        // or timing out long-lived streaming connections
        configure(proxy) {
          proxy.on("proxyReq", (_proxyReq, req) => {
            if (req.headers.accept?.includes("text/event-stream")) {
              req.socket.setTimeout(0);
              req.socket.setNoDelay(true);
              req.socket.setKeepAlive(true);
            }
          });
        },
      },
    },
  },
});
