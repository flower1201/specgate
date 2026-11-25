import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    dts: false,
    sourcemap: true,
    clean: true,
    splitting: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    outExtension() {
      return { js: ".js" };
    },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    outExtension() {
      return { js: ".js" };
    },
  },
]);
