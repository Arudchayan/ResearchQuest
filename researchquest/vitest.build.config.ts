import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/viteProductionBuild.test.ts"],
    pool: "forks",
    maxWorkers: 2,
  },
});
