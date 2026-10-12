import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://<user>.github.io/png-scope/ on GitHub Pages.
export default defineConfig({
  base: "/png-scope/",
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: {
    // format-png spawns its worker via new URL("./worker.js", import.meta.url);
    // pre-bundling would break that relative URL.
    exclude: ["format-png"],
  },
  // format-png embeds its WebAssembly module, which makes the main chunk large.
  build: { target: "es2022", chunkSizeWarningLimit: 1024 },
});
