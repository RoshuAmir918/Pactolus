import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    proxy: {
      "/trpc": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
