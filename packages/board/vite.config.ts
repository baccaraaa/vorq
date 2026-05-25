import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwind()],
  root: __dirname,
  build: {
    outDir: "dist/ui",
    emptyOutDir: false,
    assetsDir: "assets",
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src/ui") } },
});
