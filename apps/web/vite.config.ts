import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/heat/" : "/",
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      // so the web app can call the local API without CORS pain
      "/api": "http://localhost:8788"
    }
  }
}));
