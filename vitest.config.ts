import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "site/src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
