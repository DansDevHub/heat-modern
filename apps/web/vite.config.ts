import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // so the web app can call the local API without CORS pain
      "/api": "http://localhost:8787"
    }
  }
});
