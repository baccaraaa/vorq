import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    express: "src/server/adapters/express.ts",
    cli: "src/server/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: false,
  sourcemap: true,
  target: "node20",
  platform: "node",
  external: ["@vorq/core", "react", "react-dom"],
});
