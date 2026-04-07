import { defineConfig } from "vitest/config";
import { execFileSync } from "node:child_process";

execFileSync("npx", ["tsc"], { stdio: "inherit" });

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
