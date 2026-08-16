import { defineConfig } from "vitest/config";
import path from "node:path";
import os from "node:os";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      WORLDMARK_MASTER_STORE_PATH: path.join(os.tmpdir(), "worldmark-demo-masters-test.json"),
      WORLDMARK_POLICY_STORE_PATH: path.join(os.tmpdir(), "worldmark-demo-policies-test.json"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
